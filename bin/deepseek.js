#!/usr/bin/env node
/**
 * `deepseek` — friendly launcher for DeepSeek Harness.
 *
 * Usage:
 *   deepseek                    start the Web UI (alias: deepseek web)
 *   deepseek web [args...]      start the Web UI with app args
 *   deepseek --check-update     force an update check
 *   deepseek --help             show this help
 */

import { checkForUpdates, bootWeb } from '../src/launcher.js'

const HELP = `
deepseek — DeepSeek Harness 启动器

用法:
  deepseek                   启动 Web UI 并自动打开默认浏览器 (默认)
  deepseek [args...]         启动 Web UI 并透传参数 (如 --port 8080)
  deepseek --no-browser      启动后不自动打开浏览器
  deepseek --check-update    强制检查更新
  deepseek -h, --help        显示本帮助

说明:
  每次启动会自动检测 @deepseek-ai/dsh 的更新；发现新版本时会询问是否升级。
  添加参数 deepseek --no-update 可跳过本次检测。
  Web UI 就绪后会自动打开默认浏览器；添加 --no-browser 可禁用。
`

function parseArgs(argv) {
  const out = {
    checkUpdate: false,
    skipUpdate: false,
    noBrowser: false,
    help: false,
    passthrough: [],
  }
  for (const arg of argv) {
    if (arg === '--check-update') out.checkUpdate = true
    else if (arg === '--no-update') out.skipUpdate = true
    else if (arg === '--no-browser') out.noBrowser = true
    else if (arg === '-h' || arg === '--help') out.help = true
    else out.passthrough.push(arg)
  }
  return out
}

async function main() {
  const { checkUpdate, skipUpdate, noBrowser, help, passthrough } = parseArgs(process.argv.slice(2))

  if (help) {
    console.log(HELP)
    process.exit(0)
  }

  // Update detection (skipped if user passed --no-update).
  if (!skipUpdate) {
    await checkForUpdates({ force: checkUpdate })
  }

  // Boot the Web UI, forwarding all non-flag args to `dsh web`.
  const child = bootWeb(passthrough, { autoOpenBrowser: !noBrowser })

  const code = await new Promise((resolve) => {
    child.on('close', resolve)
  })
  process.exitCode = code ?? 0
}

main().catch((err) => {
  console.error('deepseek: 发生错误:', err)
  process.exitCode = 1
})
