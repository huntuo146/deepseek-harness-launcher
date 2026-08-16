/**
 * Core launcher logic for the `deepseek` command.
 *
 * Responsibilities:
 *   1. Detect the newest published version of @deepseek-ai/dsh (network, with
 *      a timeout; failures are silent so they never block normal startup).
 *   2. Compare it against the locally recorded version (stored in a state file
 *      under the user's home directory).
 *   3. If a newer version exists, ask the user whether to upgrade, then
 *      `npm install -g @deepseek-ai/dsh@latest`.
 *   4. Boot the Web UI by spawning `npx --yes @deepseek-ai/dsh web` with all
 *      remaining arguments passed through verbatim.
 */

import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import net from 'node:net'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export const TARGET_PACKAGE = '@deepseek-ai/dsh'

export const STATE_DIR = join(homedir(), '.deepseek-harness')
export const STATE_FILE = join(STATE_DIR, 'launcher-state.json')

// How long to wait for the npm registry before giving up on the check.
const CHECK_TIMEOUT_MS = 8000
// Minimum interval between registry checks so repeated invocations stay snappy.
const MIN_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours

/**
 * Compare two semver-ish version strings. Returns true when `a` is newer than
 * `b`. Implements the semver rule that a version without a prerelease tag is
 * newer than the same version carrying a prerelease (e.g. 0.1.0 > 0.1.0-rc.10).
 */
export function versionGreaterThan(a, b) {
  const [coreA, preA = ''] = a.split('-')
  const [coreB, preB = ''] = b.split('-')
  const pa = coreA.split('.').map(Number)
  const pb = coreB.split('.').map(Number)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x > y
  }
  // Core versions are equal; decide by prerelease tag.
  if (preA === '' && preB !== '') return true // release beats prerelease
  if (preA !== '' && preB === '') return false
  if (preA === preB) return false
  const idA = preA.split('.')
  const idB = preB.split('.')
  const n = Math.max(idA.length, idB.length)
  for (let i = 0; i < n; i++) {
    const x = idA[i]
    const y = idB[i]
    if (x === undefined) return false // A has fewer identifiers → A is smaller
    if (y === undefined) return true
    const nx = Number(x)
    const ny = Number(y)
    if (Number.isInteger(nx) && Number.isInteger(ny)) {
      if (nx !== ny) return nx > ny
    } else if (x !== y) {
      return x > y
    }
  }
  return false
}

async function readState() {
  try {
    const raw = await readFile(STATE_FILE, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function writeState(state) {
  try {
    await mkdir(STATE_DIR, { recursive: true })
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8')
  } catch {
    // Best-effort: a failed write must never crash the launcher.
  }
}

/**
 * Run a child process safely on both Windows and POSIX. `.cmd`/`.bat` files
 * (like npm's shims) can only be executed through a shell on Windows; spawning
 * them directly raises EINVAL.
 */
/**
 * Quote a single argument for the Windows cmd.exe shell. Characters that are
 * special to cmd even inside double quotes (% and ! for variable expansion)
 * are escaped with ^; internal double quotes are doubled; the whole argument
 * is wrapped in double quotes when it contains whitespace or metacharacters.
 */
function quoteCmdArg(arg) {
  const s = String(arg)
  if (s === '') return '""'
  if (!/[\s"&|<>^()%!]/.test(s)) return s
  const escaped = s.replace(/"/g, '""').replace(/%/g, '^%').replace(/!/g, '^!')
  return `"${escaped}"`
}

/**
 * Open a URL in the user's default browser, cross-platform.
 *
 *   - Windows: `cmd /c start <url>`
 *   - macOS:   `open <url>`
 *   - Linux:   `xdg-open <url>`
 *
 * Returns a promise that resolves once the browser process has been handed the
 * URL (not when the user closes the browser). Never rejects: failures are
 * reported on the console only, so a browser that cannot launch never breaks
 * the server.
 */
export async function openBrowser(url) {
  let command
  let args = []
  if (process.platform === 'win32') {
    command = 'cmd'
    args = ['/c', 'start', '', url]
  } else if (process.platform === 'darwin') {
    command = 'open'
    args = [url]
  } else {
    command = 'xdg-open'
    args = [url]
  }
  const child = spawn(command, args, { stdio: 'ignore', windowsHide: true })
  return new Promise((resolve) => {
    child.on('error', (err) => {
      console.warn(`\n⚠️ 无法自动打开浏览器：${err.message}`)
      console.warn(`   请手动访问 ${url}`)
      resolve(false)
    })
    child.on('close', () => resolve(true))
  })
}

/**
 * Probe whether a TCP port is accepting connections by attempting a raw
 * connection and immediately closing it. Returns true when reachable.
 */
function probePort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port })
    const done = (ok) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(ok)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    socket.setTimeout(1500, () => done(false))
  })
}

/**
 * Poll `host:port` until it accepts connections or the timeout elapses.
 * Returns true when the port became reachable within the window.
 */
export async function waitForPort(port, { host = '127.0.0.1', timeoutMs = 180000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await probePort(port, host)) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

/**
 * Extract the `--port <n>` value from the app arguments, defaulting to 3080.
 */
export function resolvePort(extraArgs) {
  for (let i = 0; i < extraArgs.length; i++) {
    const a = extraArgs[i]
    if (a === '--port' && i + 1 < extraArgs.length) {
      const n = Number(extraArgs[i + 1])
      if (Number.isInteger(n) && n > 0 && n <= 65535) return n
    } else if (a.startsWith('--port=')) {
      const n = Number(a.slice('--port='.length))
      if (Number.isInteger(n) && n > 0 && n <= 65535) return n
    }
  }
  return 3080
}

/**
 * Run a child process safely on both Windows and POSIX. `.cmd`/`.bat` files
 * (like npm's shims) can only be executed through a shell on Windows; spawning
 * them directly raises EINVAL. In shell mode the full command line is built
 * with explicit quoting so user-supplied arguments cannot inject shell syntax.
 */
function spawnSafe(command, args, options = {}) {
  const isWindows = process.platform === 'win32'
  const needShell =
    isWindows && (/\.(cmd|bat)$/i.test(command) || command === 'npm' || command === 'npx')
  if (needShell) {
    const cmdline = [command, ...args].map(quoteCmdArg).join(' ')
    return spawn(cmdline, { ...options, shell: true, windowsHide: true })
  }
  return spawn(command, args, { ...options, windowsHide: true })
}

/**
 * Fetch the newest published version of the target package from the npm
 * registry. Returns null on any failure (offline, timeout, non-JSON, ...).
 */
export async function fetchLatestVersion() {
  return new Promise((resolve) => {
    const child = spawnSafe('npm', ['view', TARGET_PACKAGE, 'version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve(null)
    }, CHECK_TIMEOUT_MS)

    child.stdout.on('data', (chunk) => (out += chunk))
    child.stderr.on('data', (chunk) => (err += chunk))
    child.on('error', () => {
      clearTimeout(timer)
      resolve(null)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        resolve(null)
        return
      }
      const version = out.trim().split(/\s+/)[0]
      resolve(version || null)
    })
  })
}

async function shouldCheckNow(state) {
  const last = state?.lastCheckAt
  if (!last) return true
  return Date.now() - last >= MIN_CHECK_INTERVAL_MS
}

async function askYesNo(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise((resolve) => {
    rl.question(`${question} (y/N) `, (a) => resolve(a.trim().toLowerCase()))
  })
  rl.close()
  return answer === 'y' || answer === 'yes'
}

async function runUpdate() {
  const child = spawnSafe('npm', ['install', '-g', `${TARGET_PACKAGE}@latest`], {
    stdio: 'inherit',
  })
  const code = await new Promise((resolve) => {
    child.on('close', resolve)
    child.on('error', () => resolve(1))
  })
  return code === 0
}

/**
 * Perform the update check and, when an update is available, prompt the user.
 * Updates the state file with the latest version seen regardless of whether
 * the user chose to upgrade, so we don't nag on every launch.
 */
export async function checkForUpdates({ force = false } = {}) {
  const state = await readState()
  if (!force && !(await shouldCheckNow(state))) {
    return { checked: false, latest: state?.latestSeen ?? null, updated: false }
  }

  const latest = await fetchLatestVersion()
  const now = Date.now()

  if (latest === null) {
    // Registry unreachable — remember we tried so we don't hammer it.
    await writeState({ ...state, lastCheckAt: now, latestSeen: state?.latestSeen ?? null })
    return { checked: true, latest: null, updated: false }
  }

  const latestSeen = state?.latestSeen ?? null
  let updated = false
  if (latestSeen && versionGreaterThan(latest, latestSeen)) {
    console.log(`\n🔔 检测到 DeepSeek Harness 新版本：${latestSeen} → ${latest}`)
    if (await askYesNo('是否立即升级到最新版本？')) {
      console.log(`正在升级 ${TARGET_PACKAGE}@latest ...`)
      updated = await runUpdate()
      if (updated) {
        console.log('✅ 升级完成。')
      } else {
        console.log('⚠️ 升级失败，请手动执行：npm install -g @deepseek-ai/dsh@latest')
      }
    } else {
      console.log('已跳过本次升级。')
    }
  }

  await writeState({ ...state, lastCheckAt: now, latestSeen: latest })
  return { checked: true, latest, updated }
}

/**
 * Boot the DeepSeek Harness Web UI. All extra arguments are passed through to
 * the underlying `dsh web` command verbatim.
 *
 * When `autoOpenBrowser` is true, once the HTTP port starts listening the
 * user's default browser is opened to the Web UI automatically. The port is
 * derived from `--port` in the args (default 3080). The browser is only opened
 * if the dsh child is still running — a crash before readiness opens nothing.
 */
export function bootWeb(extraArgs, { stdio = 'inherit', autoOpenBrowser = true } = {}) {
  const child = spawnSafe('npx', ['--yes', TARGET_PACKAGE, 'web', ...extraArgs], {
    stdio,
  })

  const forward = (signal) => {
    if (!child.killed && child.exitCode === null) {
      try {
        child.kill(signal)
      } catch {
        // Ignore: process may already have exited.
      }
    }
  }
  process.on('SIGINT', () => forward('SIGINT'))
  process.on('SIGTERM', () => forward('SIGTERM'))
  // On Windows there is no SIGINT delivered to children automatically; closing
  // stdin lets interactive children notice the terminal ended.
  process.on('exit', () => {
    try {
      child.kill()
    } catch {
      // ignore
    }
  })

  child.on('error', (err) => {
    console.error(`\n❌ 无法启动 DeepSeek Harness：${err.message}`)
    console.error('请确认已安装 Node.js（https://nodejs.org）后重试。')
    process.exitCode = 1
  })

  // Open the default browser as soon as the server is reachable.
  if (autoOpenBrowser) {
    const port = resolvePort(extraArgs)
    const url = `http://127.0.0.1:${port}`
    // Fire-and-forget: never block or crash on the browser step.
    void (async () => {
      console.log(`⏳ 等待 Web UI 就绪 (${url}) ...`)
      const ready = await waitForPort(port)
      if (!ready) {
        console.warn('⚠️ 等待服务超时，未自动打开浏览器。')
        return
      }
      // Only open the browser if the harness process is still alive.
      if (child.exitCode === null && !child.killed) {
        console.log(`🌐 正在打开浏览器：${url}`)
        await openBrowser(url)
      }
    })()
  }

  return child
}

export const DEFAULT_BIN_PATH = join(__dirname, '..', 'bin', 'deepseek.js')
