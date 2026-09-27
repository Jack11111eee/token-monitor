'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { pendingLimitProviders } = require('../../src/electron/renderer/edgeDock/composer');

const rendererDir = path.join(__dirname, '..', '..', 'src', 'electron', 'renderer');

// A provider that reports no quota has no cell in automatic mode and no entry in
// the connected list, so before this the only way to pin one — an API-key Claude
// being the case that surfaced it — was to hand-edit settings.json. The rule that
// decides whether it can be pinned at all is the part worth testing; the menu
// around it is DOM.
test('a provider the user enabled but that reports nothing is still offered', () => {
  assert.deepEqual(
    pendingLimitProviders(['claude', 'codex', 'cursor'], ['codex']),
    ['claude', 'cursor']
  );
});

test('the order is the one it was handed, so the menu follows the limits order', () => {
  assert.deepEqual(
    pendingLimitProviders(['cursor', 'claude', 'codex'], []),
    ['cursor', 'claude', 'codex']
  );
});

test('nothing is listed twice: the connected and the already-added are both skipped', () => {
  assert.deepEqual(pendingLimitProviders(['claude', 'codex'], ['codex', 'claude']), []);
});

test('ids are compared case-insensitively, so a cased entry cannot double up', () => {
  assert.deepEqual(pendingLimitProviders(['Claude', 'codex'], ['CLAUDE']), ['codex']);
});

test('nothing enabled and nothing left both yield an empty section', () => {
  assert.deepEqual(pendingLimitProviders([], ['codex']), []);
  assert.deepEqual(pendingLimitProviders(undefined, undefined), []);
  assert.deepEqual(pendingLimitProviders(['claude'], ['claude']), []);
});

// The rule above is only worth anything if the menu asks it: a helper that exists
// but is never wired would pass every test above and still leave the gap open.
test('the add menu offers the enabled-but-silent providers as their own section', () => {
  const composer = fs.readFileSync(path.join(rendererDir, 'edgeDock', 'composer.js'), 'utf8');
  assert.match(composer, /section\('settings\.edgeDock\.addLimitsUnavailable'/);
  assert.match(composer, /pendingLimitProviders\(\s*enabledLimitProviders\?\.\(\) \|\| \[\],/);
  // The section must not be gated on the connected list, which is what hid these
  // providers in the first place.
  assert.doesNotMatch(composer, /section\('settings\.edgeDock\.addLimitsUnavailable', connectedProviders\(\)/);
});

test('the composer is handed the enabled providers in the user\'s limits order', () => {
  const app = fs.readFileSync(path.join(rendererDir, 'app.js'), 'utf8');
  assert.match(app, /enabledLimitProviders: \(\) => limitProviderOrderApi/);
  assert.match(app, /\.orderedLimitProviders\(LIMIT_PROVIDERS, state\.settings\?\.limitProviderOrder\)/);
  assert.match(app, /\.filter\(\(\{ id \}\) => enabledLimitProviderSet\(\)\.has\(id\)\)/);
});
