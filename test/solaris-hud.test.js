const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { provisionSolarisHud, hudStatus, DEFAULT_HUD } = require('../lib/solaris-hud');

test('Solaris HUD se configura automaticamente para una instancia', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'solaris-hud-'));
  const instance = { id: 'abc', version: '1.21.1', loader: 'fabric' };
  provisionSolarisHud(root, instance);
  const status = hudStatus(root);
  assert.equal(status.configured, true);
  assert.equal(status.modInstalled, false);
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config', 'solaris', 'hud.json')));
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.modules.fps.enabled, true);
  assert.equal(cfg.modules.keystrokes.enabled, true);
});

test('Solaris HUD detecta el jar cuando existe', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'solaris-hud-'));
  fs.mkdirSync(path.join(root, 'mods'), { recursive: true });
  fs.writeFileSync(path.join(root, 'mods', 'solaris-hud-0.1.0.jar'), 'test');
  assert.equal(hudStatus(root).modInstalled, true);
});
