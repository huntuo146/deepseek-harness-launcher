import { test } from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import { versionGreaterThan, resolvePort, probePort } from '../src/launcher.js'

test('versionGreaterThan compares semver-ish versions', () => {
  assert.equal(versionGreaterThan('1.0.0', '0.1.0'), true)
  assert.equal(versionGreaterThan('0.1.0', '1.0.0'), false)
  assert.equal(versionGreaterThan('1.0.0', '1.0.0'), false)
  assert.equal(versionGreaterThan('0.1.0-rc.6', '0.1.0-rc.5'), true)
  assert.equal(versionGreaterThan('0.1.0-rc.5', '0.1.0-rc.6'), false)
  // A release is newer than the same version with a prerelease tag.
  assert.equal(versionGreaterThan('0.1.0', '0.1.0-rc.10'), true)
  assert.equal(versionGreaterThan('0.1.0-rc.10', '0.1.0'), false)
  assert.equal(versionGreaterThan('0.2.0', '0.1.0-rc.99'), true)
  // Numeric prerelease parts compare numerically.
  assert.equal(versionGreaterThan('0.1.0-rc.10', '0.1.0-rc.9'), true)
})

test('resolvePort parses --port and defaults to 3080', () => {
  assert.equal(resolvePort([]), 3080)
  assert.equal(resolvePort(['--patch', './x.yml']), 3080)
  assert.equal(resolvePort(['--port', '8080']), 8080)
  assert.equal(resolvePort(['--port=9090']), 9090)
  assert.equal(resolvePort(['--trusted-host', 'foo', '--port', '4444']), 4444)
  // Invalid ports fall back to the default.
  assert.equal(resolvePort(['--port', 'abc']), 3080)
  assert.equal(resolvePort(['--port', '0']), 3080)
  assert.equal(resolvePort(['--port', '70000']), 3080)
  // --port without a following value falls back to default.
  assert.equal(resolvePort(['--port']), 3080)
})

test('probePort detects a listening port and misses a closed one', async () => {
  // Probe a definitely-closed port.
  const closed = await probePort(1) // port 1 is almost always closed
  assert.equal(closed, false)

  // Start a real server, then probe it — should be reachable.
  const server = net.createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const open = await probePort(port)
  assert.equal(open, true)
  await new Promise((resolve) => server.close(resolve))
})
