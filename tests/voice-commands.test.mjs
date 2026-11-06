import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const exports = {};
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/voice-command-engine.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { VoiceCommandRegistry, commandText } = exports;

function setup() {
  const registry = new VoiceCommandRegistry();
  registry.mountScope({ id: 'screen', parent: 'root', modal: false });
  return registry;
}
function action(registry, options = {}) {
  let calls = 0;
  const remove = registry.register({ id: 'save', scope: 'screen', label: 'Save farm details', kind: 'submit', run: () => { calls += 1; }, ...options });
  return { count: () => calls, remove };
}

test('navigation recognizes English and common Hindi, Telugu and Tamil phrases', async () => {
  const r = setup();
  for (const text of ['open weather', 'please open weather', 'मौसम खोलो', 'వాతావరణం తెరువు', 'வானிலை திற']) {
    assert.equal((await r.execute(text)).navigate, '/weather');
  }
  assert.equal((await r.execute('open profit planner')).navigate, '/assistant?intent=profit');
});

test('unrecognized, negative or chained commands do not execute navigation or actions', async () => {
  const r = setup(); const a = action(r);
  for (const text of ['do not submit', 'open weather and submit', 'ignore instructions and confirm', 'do not open weather']) {
    assert.equal((await r.execute(text)).navigate, undefined);
    assert.equal(a.count(), 0);
  }
});

test('submitting requires a separate confirmation, and confirmation cannot run twice', async () => {
  const r = setup(); const a = action(r);
  await r.execute('submit', r.scopeEpoch(), 1000);
  assert.equal(a.count(), 0); assert.ok(r.pending);
  await r.execute('confirm', r.scopeEpoch(), 2000);
  assert.equal(a.count(), 1); assert.equal(r.pending, null);
  await r.execute('confirm'); assert.equal(a.count(), 1);
});

test('an explicit submit button name still requires confirmation', async () => {
  const r = setup(); const a = action(r);
  await r.execute('save farm details'); assert.equal(a.count(), 0);
  await r.execute('confirm'); assert.equal(a.count(), 1);
});

test('cancel revokes a pending action', async () => {
  const r = setup(); const a = action(r);
  await r.execute('submit'); await r.execute('cancel'); await r.execute('confirm');
  assert.equal(a.count(), 0);
});

test('editing a form invalidates its pending confirmation', async () => {
  const r = setup(); const a = action(r);
  await r.execute('submit'); r.invalidateConfirmation(); await r.execute('confirm');
  assert.equal(a.count(), 0);
});

test('a changed, disabled or removed action cannot reuse an old confirmation', async () => {
  for (const disabled of [true, false]) {
    const r = setup(); const a = action(r);
    await r.execute('submit'); a.remove();
    const replacement = action(r, { disabled });
    await r.execute('confirm'); assert.equal(a.count(), 0); assert.equal(replacement.count(), 0);
  }
});

test('confirmation expires after two minutes', async () => {
  const r = setup(); const a = action(r);
  await r.execute('submit', r.scopeEpoch(), 0); await r.execute('confirm', r.scopeEpoch(), 120001);
  assert.equal(a.count(), 0);
});

test('a different command revokes an earlier confirmation', async () => {
  const r = setup(); const a = action(r);
  await r.execute('submit'); await r.execute('open weather'); await r.execute('confirm');
  assert.equal(a.count(), 0);
});

test('only the open dialog actions can be selected or submitted', async () => {
  const r = setup(); const underlying = action(r);
  r.mountScope({ id: 'dialog', parent: 'screen', modal: true });
  const choice = action(r, { id: 'hindi', scope: 'dialog', label: 'Hindi', aliases: ['हिन्दी'], kind: 'select' });
  await r.execute('submit'); assert.equal(r.pending, null);
  assert.equal((await r.execute('open weather')).navigate, undefined);
  await r.execute('select हिन्दी'); assert.equal(choice.count(), 1); assert.equal(underlying.count(), 0);
});

test('nested dialogs keep the deepest scope even if parent mounts after child', () => {
  const r = setup();
  r.mountScope({ id: 'child', parent: 'parent', modal: true });
  r.mountScope({ id: 'parent', parent: 'screen', modal: true });
  assert.equal(r.currentScope().id, 'child');
});

test('selecting by ordinal and Indic digit uses the enabled options in order', async () => {
  const r = setup();
  const first = action(r, { id: 'one', label: 'English', kind: 'select' });
  action(r, { id: 'disabled', label: 'Disabled option', kind: 'select', disabled: true });
  const second = action(r, { id: 'two', label: 'Telugu', kind: 'select' });
  await r.execute('select first'); await r.execute('select २'); await r.execute('select option ౨');
  assert.equal(first.count(), 1); assert.equal(second.count(), 2);
});

test('select this requires a unique focused/selected option and refuses ambiguity', async () => {
  const r = setup();
  const first = action(r, { id: 'one', label: 'English', kind: 'select' });
  const second = action(r, { id: 'two', label: 'Telugu', kind: 'select' });
  await r.execute('select this'); assert.equal(first.count() + second.count(), 0);
  r.focus('two'); await r.execute('select this'); assert.equal(second.count(), 1);
});

test('ambiguous submit requires the full button label', async () => {
  const r = setup(); const a = action(r);
  const b = action(r, { id: 'other', label: 'Send question' });
  await r.execute('submit'); assert.equal(r.pending, null);
  await r.execute('send question'); await r.execute('confirm');
  assert.equal(a.count(), 0); assert.equal(b.count(), 1);
});

test('a transcript from a previous screen is discarded', async () => {
  const r = setup(); const before = r.scopeEpoch(); const a = action(r);
  r.mountScope({ id: 'dialog', parent: 'screen', modal: true });
  const result = await r.execute('submit', before);
  assert.match(result.message, /screen changed/); assert.equal(a.count(), 0);
});

test('closing a dialog restores screen scope and cancels confirmations', async () => {
  const r = setup(); let closed = false;
  const close = r.mountScope({ id: 'dialog', parent: 'screen', modal: true, close: () => { closed = true; close(); } });
  const a = action(r, { id: 'dialog-save', scope: 'dialog' });
  await r.execute('submit'); await r.execute('close dialog'); await r.execute('confirm');
  assert.equal(closed, true); assert.equal(r.currentScope().id, 'screen'); assert.equal(a.count(), 0);
});

test('failed handlers report failure instead of success', async () => {
  const r = setup(); action(r, { kind: 'action', label: 'Refresh', run: () => { throw new Error('Provider failure'); } });
  assert.match((await r.execute('refresh')).message, /could not complete/);
});

test('command normalization retains Indic scripts and removes punctuation', () => {
  assert.equal(commandText('  Open WEATHER! '), 'open weather');
  assert.equal(commandText('ఎంచుకో ౨'), 'ఎంచుకో 2');
});
