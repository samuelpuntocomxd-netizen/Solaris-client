'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { requiredJavaMajor, getRamProfile, applyLightweightOptions } = require('../lib/launcher-utils');

test('detecta el Java mínimo de versiones conocidas', () => {
  assert.equal(requiredJavaMajor('1.16.5'), 8);
  assert.equal(requiredJavaMajor('1.17.1'), 16);
  assert.equal(requiredJavaMajor('1.20.4'), 17);
  assert.equal(requiredJavaMajor('1.20.5'), 21);
  assert.equal(requiredJavaMajor('1.21.11'), 21);
  assert.equal(requiredJavaMajor('26.1'), 25);
  assert.equal(requiredJavaMajor('no-version'), null);
});

test('calcula un límite de RAM conservador', () => {
  const gib = 1024 ** 3;
  assert.equal(getRamProfile(4 * gib, 3 * gib).maxRam, 2);
  assert.equal(getRamProfile(8 * gib, 6 * gib).maxRam, 5);
  assert.equal(getRamProfile(16 * gib, 12 * gib).maxRam, 8);
  assert.equal(getRamProfile(8 * gib, 1.5 * gib).maxRam, 0);
});

test('aplica ajustes ligeros sin borrar opciones desconocidas', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'solaris-test-'));
  const file = path.join(dir, 'options.txt');
  fs.writeFileSync(file, 'sound:0.8\nrenderDistance:16\ncustomSetting:keep\n');
  applyLightweightOptions(file, fs);
  const output = fs.readFileSync(file, 'utf8');
  assert.match(output, /renderDistance:6/);
  assert.match(output, /sound:0.8/);
  assert.match(output, /customSetting:keep/);
  fs.rmSync(dir, { recursive: true, force: true });
});
