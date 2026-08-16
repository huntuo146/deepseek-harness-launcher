import { test } from 'node:test'
import assert from 'node:assert/strict'
import { versionGreaterThan, resolvePort } from '../src/launcher.js'

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
