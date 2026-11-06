import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function load(name) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(`../src/${name}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: path => load(path.replace('./', '')) });
  return exports;
}
const { registrationTransition: answer, registrationValue, nextRegistrationStep, registrationPinValid, effectiveRegistrationStep } = load('registration-guide');
const { registrationPrompt } = load('registration-prompts');
const states = ['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Maharashtra', 'Kerala', 'Punjab'];
const empty = () => ({ name: '', state: '', district: '', village: '', crop: '', area: '', location: '', latitude: '', longitude: '' });
const full = () => ({ name: 'Ramesh Kumar', state: 'Andhra Pradesh', district: 'Anakapalli', village: 'Anakapalle', crop: 'Paddy', area: '2 acres', location: 'Anakapalle, Andhra Pradesh', latitude: '17.69', longitude: '83.00' });

test('guided registration asks each question, requires the map, then accepts explicit confirmation', () => {
  let current = { profile: empty(), session: { step: 'name' } };
  const replies = ['My name is Ramesh Kumar', 'Andhra Pradesh', 'Anakapalli', 'Anakapalle', 'Paddy', 'two acres'];
  const expected = ['state', 'district', 'village', 'crop', 'area', 'map'];
  replies.forEach((text, index) => {
    current = answer(current.session, current.profile, text, states);
    assert.equal(current.error, undefined);
    assert.equal(current.command, undefined);
    assert.equal(current.session.step, expected[index]);
  });
  assert.equal(current.profile.name, 'Ramesh Kumar');
  assert.equal(current.profile.area, '2 acres');
  assert.equal(answer(current.session, current.profile, 'confirm', states).command, undefined);
  current.profile = { ...current.profile, latitude: '17.69', longitude: '83.0' };
  assert.equal(effectiveRegistrationStep(current.session, current.profile, states), 'review');
  assert.equal(answer(current.session, current.profile, 'confirm', states).command, 'save');
});

test('confirm before the review cannot be saved as a name or submit registration', () => {
  const result = answer({ step: 'name' }, empty(), 'confirm', states);
  assert.equal(result.profile.name, '');
  assert.equal(result.command, undefined);
  assert.match(result.error, /Finish the questions/);
  assert.equal(answer({ step: 'name' }, full(), 'confirm', states).command, undefined);
});

test('change my village requests a new answer and clears the old farm pin', () => {
  const correction = answer({ step: 'review' }, full(), 'change my village', states);
  assert.equal(correction.session.step, 'village');
  const changed = answer(correction.session, correction.profile, 'New village', states);
  assert.equal(changed.profile.village, 'New village');
  assert.equal(changed.profile.latitude, '');
  assert.equal(changed.profile.longitude, '');
  assert.equal(changed.profile.location, '');
  assert.equal(changed.session.step, 'map');
});

test('changing a state clears dependent district, village and coordinates', () => {
  const result = answer({ step: 'state' }, full(), 'Telangana', states);
  assert.equal(result.profile.state, 'Telangana');
  for (const field of ['district', 'village', 'latitude', 'longitude', 'location']) assert.equal(result.profile[field], '');
  assert.equal(result.profile.crop, 'Paddy');
  assert.equal(result.session.step, 'district');
});

test('changing a district clears village and pin but keeps the state', () => {
  const result = answer({ step: 'district' }, full(), 'New district', states);
  assert.equal(result.profile.state, 'Andhra Pradesh');
  assert.equal(result.profile.village, '');
  assert.equal(result.profile.latitude, '');
  assert.equal(result.session.step, 'village');
});

test('changing crop or area does not move a confirmed farm pin', () => {
  const result = answer({ step: 'crop' }, full(), 'Maize', states);
  assert.equal(result.profile.crop, 'Maize');
  assert.equal(result.profile.latitude, '17.69');
  assert.equal(result.session.step, 'review');
});

test('English and supported regional state names map to canonical picker values', () => {
  for (const text of ['andhra pradesh', 'ఆంధ్రప్రదేశ్', 'आंध्र प्रदेश']) assert.equal(registrationValue('state', text, states).value, 'Andhra Pradesh');
  assert.equal(registrationValue('state', 'తెలంగాణ', states).value, 'Telangana');
  assert.equal(registrationValue('state', 'தமிழ்நாடு', states).value, 'Tamil Nadu');
  assert.equal(registrationValue('state', 'ಕರ್ನಾಟಕ', states).value, 'Karnataka');
  assert.equal(registrationValue('state', 'not a real state', states).value, undefined);
  assert.equal(registrationValue('state', 'Punjab', states).value, 'Punjab');
});

test('area supports units, Indic numerals and common English number words', () => {
  for (const [input, expected] of [['two acres', '2 acres'], ['౨ ఎకరాలు', '2 acres'], ['०.८ हेक्टेयर', '0.8 hectares'], ['2', '2 acres'], ['3 ஏக்கர்', '3 acres']])
    assert.equal(registrationValue('area', input, states).value, expected);
  for (const invalid of ['0 acres', '-1 acres', 'Infinity', 'two thousand', '2 acres and 4 hectares', 'unknown'])
    assert.equal(registrationValue('area', invalid, states).value, undefined);
});

test('repeat, back and pause do not overwrite entered fields', () => {
  const profile = full();
  assert.equal(answer({ step: 'review' }, profile, 'repeat', states).command, 'repeat');
  assert.equal(answer({ step: 'review' }, profile, 'go back', states).session.step, 'area');
  const paused = answer({ step: 'review' }, profile, 'cancel', states);
  assert.equal(paused.command, 'pause');
  assert.equal(paused.profile, profile);
});

test('regional correction and confirmation commands follow the same review rules', () => {
  assert.equal(answer({ step: 'review' }, full(), 'గ్రామం మార్చు', states).session.step, 'village');
  assert.equal(answer({ step: 'review' }, full(), 'गांव बदलो', states).session.step, 'village');
  for (const text of ['నిర్ధారించు', 'पुष्टि करो', 'உறுதிப்படுத்து', 'ದೃಢೀಕರಿಸಿ', 'पुष्टी'])
    assert.equal(answer({ step: 'review' }, full(), text, states).command, 'save');
});

test('missing or invalid coordinates block confirmation and cannot be invented from place names', () => {
  for (const [latitude, longitude] of [['', ''], ['NaN', '83'], ['91', '83'], ['17', '181']]) {
    const profile = { ...full(), latitude, longitude };
    assert.equal(registrationPinValid(profile), false);
    assert.equal(nextRegistrationStep(profile, states), 'map');
    assert.equal(answer({ step: 'review' }, profile, 'confirm', states).command, undefined);
  }
  const profile = { ...full(), latitude: '', longitude: '' };
  assert.equal(answer({ step: 'map' }, profile, 'Anakapalle', states).profile.latitude, '');
  assert.equal(answer({ step: 'map' }, profile, 'open map', states).command, 'map');
});

test('all six app languages provide spoken questions and exact review values', () => {
  for (const language of ['English', 'Telugu', 'Hindi', 'Tamil', 'Kannada', 'Marathi']) {
    for (const step of ['name', 'state', 'district', 'village', 'crop', 'area', 'map', 'review']) assert.ok(registrationPrompt(step, language, full()).length > 5);
    const summary = registrationPrompt('review', language, full());
    for (const value of ['Ramesh Kumar', 'Anakapalle', '2 acres', '17.69', '83.00']) assert.ok(summary.includes(value));
  }
});

test('invalid or incomplete form changes return to the missing question rather than saving', () => {
  const profile = { ...full(), area: '0' };
  const result = answer({ step: 'review' }, profile, 'confirm', states);
  assert.equal(result.command, undefined);
  assert.equal(result.session.step, 'area');
});

test('silence, long answers and bare introduction phrases cannot become a profile field', () => {
  for (const value of ['', ' ', '12345', 'x'.repeat(121), 'my name is']) assert.equal(registrationValue('name', value, states).value, undefined);
});
