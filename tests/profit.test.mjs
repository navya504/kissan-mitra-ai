import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function load(file, { fetch, env = {}, forecast = null, onForecast = () => {} } = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(source, {
    exports, fetch, process: { env }, Request, Response, AbortSignal,
    console: { error() {} },
    require(name) {
      if (name.endsWith('/profit')) return load('../src/profit.ts');
      if (name.endsWith('/languages')) return load('../src/languages.ts');
      if (name.endsWith('/forecast')) return { getForecast: async (...coordinates) => { onForecast(...coordinates); return forecast; }, forecastText: () => 'Forecast fixture' };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

const { buildProfitPlan, addProfitGuidance, indiaDate, wantsProfit } = load('../src/profit.ts');
const now = new Date('2026-11-05T10:00:00Z');
const options = { now, weatherAvailable: true, rainRisk: true };
const inputs = () => ({ stage: 'ready', quantityQuintals: '100', cultivationCost: '150000', routes: [
  { market: 'Local buyer', pricePerQuintal: '2200', sellingCost: '5000', quotedOn: '2026-11-05' },
  { market: 'Distant mandi', pricePerQuintal: '2400', sellingCost: '40000', quotedOn: '2026-11-05' },
] });

test('ranks net profit after selling costs, rather than the highest gross price', () => {
  const plan = buildProfitPlan(inputs(), options);
  assert.equal(plan.status, 'ready');
  assert.equal(plan.routes.length, 2);
  assert.equal(plan.routes[0].market, 'Local buyer');
  assert.equal(plan.routes[0].netProfit, 65000);
  assert.equal(plan.routes[1].netProfit, 50000);
  assert.equal(plan.routes[0].profitAtLowerPrice, 43000);
  assert.equal(plan.routes[0].breakEvenPrice, 1550);
  assert.ok(plan.routes[0].checklist.some(step => step.includes('Rain')));
});

test('missing inputs never produce made-up numerical routes', () => {
  const plan = buildProfitPlan(undefined, options);
  assert.equal(plan.status, 'needs-details');
  assert.equal(plan.routes.length, 0);
  assert.ok(plan.missing.length >= 4);
});

test('blank costs differ from explicitly confirmed zero costs', () => {
  const input = inputs();
  input.cultivationCost = '';
  assert.equal(buildProfitPlan(input, options).status, 'needs-details');
  input.cultivationCost = '0';
  input.routes[0].sellingCost = '0';
  assert.equal(buildProfitPlan(input, options).routes[0].netProfit, 220000);
});

test('one complete option works, while a partially entered second option must be completed', () => {
  const input = inputs();
  input.routes[1] = { market: '', pricePerQuintal: '', sellingCost: '', quotedOn: '2026-11-05' };
  assert.equal(buildProfitPlan(input, options).routes.length, 1);
  input.routes[1].market = 'Another buyer';
  const plan = buildProfitPlan(input, options);
  assert.equal(plan.status, 'needs-details');
  assert.equal(plan.routes.length, 0);
});

test('old, future and invalid dates cannot be presented as current offers', () => {
  for (const date of ['2026-10-01', '2026-11-06', '2026-02-30', 'not a date']) {
    const input = inputs();
    input.routes[0].quotedOn = date;
    assert.equal(buildProfitPlan(input, options).status, 'needs-details');
  }
});

test('negative profits remain losses and the smallest loss is ranked first', () => {
  const input = inputs();
  input.cultivationCost = '300000';
  const plan = buildProfitPlan(input, options);
  assert.equal(plan.routes[0].netProfit, -85000);
  assert.equal(plan.routes[1].netProfit, -100000);
});

test('fractional harvest and rupee amounts retain paise instead of rounding revenue to whole rupees', () => {
  const input = inputs();
  input.quantityQuintals = '100.5';
  input.routes[0].pricePerQuintal = '2200.5';
  assert.equal(buildProfitPlan(input, options).routes[0].revenue, 221150.25);
});

test('AI supplies route reasoning and checklists while computed rank and money cannot be overwritten', () => {
  const plan = buildProfitPlan(inputs(), options);
  const enriched = addProfitGuidance(plan, [{
    rank: 1, netProfit: 9999999, market: 'Invented buyer', why: 'The nearby buyer leaves more after transport costs.',
    checklist: ['Confirm the local offer.', 'Protect the harvest from rain.', 'Check the payment terms.'],
  }]);
  assert.equal(enriched.routes[0].netProfit, 65000);
  assert.equal(enriched.routes[0].market, 'Local buyer');
  assert.equal(enriched.routes[0].guidanceSource, 'ai');
  assert.equal(enriched.routes[1].guidanceSource, 'standard');
  assert.match(enriched.routes[0].reasoning, /transport/);
});

test('malformed or duplicated AI route guidance falls back to a labelled standard checklist', () => {
  const plan = buildProfitPlan(inputs(), options);
  for (const guidance of [null, [{ rank: 1, why: 'Missing checklist' }], [{ rank: 1 }, { rank: 1 }]]) {
    assert.equal(addProfitGuidance(plan, guidance).routes[0].guidanceSource, 'standard');
  }
});

test('invalid quantities and prices are rejected without coercing null to zero', () => {
  for (const value of ['-1', 'Infinity', 'NaN', '0', '', null]) {
    const input = inputs();
    input.quantityQuintals = value;
    assert.equal(buildProfitPlan(input, options).status, 'needs-details');
  }
  const input = inputs();
  input.routes[0].pricePerQuintal = 'not known';
  assert.equal(buildProfitPlan(input, options).routes.length, 0);
});

test('growing crops and unavailable weather remain visible assumptions', () => {
  const input = inputs();
  input.stage = 'growing';
  const plan = buildProfitPlan(input, { now });
  assert.ok(plan.assumptions.some(item => item.includes('still growing')));
  assert.ok(plan.routes[0].checklist.some(item => item.includes('Weather is unavailable')));
});

test('India date and common spoken-language profit questions are handled', () => {
  assert.equal(indiaDate(new Date('2026-11-04T20:00:00Z')), '2026-11-05');
  for (const question of ['How much profit?', 'నా లాభం ఎంత?', 'मेरा मुनाफा कितना होगा?', 'எவ்வளவு லாபம்?']) assert.equal(wantsProfit(question), true);
  assert.equal(wantsProfit('Will it rain tomorrow?'), false);
});

test('chat uses the saved farm coordinates and sends authoritative profit arithmetic to the model', async () => {
  const input = inputs();
  input.routes.forEach(route => { route.quotedOn = indiaDate(); });
  const { POST } = load('../src/app/api/chat+api.ts', {
    env: { NEBIUS_API_KEY: 'test-key' },
    onForecast: (lat, lon) => { assert.equal(lat, 19.1); assert.equal(lon, 72.8); },
    fetch: async (_url, request) => {
      const system = JSON.parse(request.body).messages[0].content;
      assert.match(system, /Maharashtra/);
      assert.match(system, /"netProfit":65000/);
      assert.match(system, /Never invent prices/);
      return Response.json({ choices: [{ message: { content: '[PROFIT] Compare these two estimated options.' } }] });
    },
  });
  const response = await POST(new Request('https://app.example/api/chat', { method: 'POST', body: JSON.stringify({
    messages: [{ from: 'farmer', text: 'What is my profit?' }], language: 'en-IN',
    profile: { crop: 'Paddy', state: 'Maharashtra', latitude: '19.1', longitude: '72.8' }, profitInputs: input,
  }) }));
  const answer = await response.json();
  assert.equal(answer.reply, 'Compare these two estimated options.');
  assert.equal(answer.profitRequested, true);
  assert.equal(answer.profitPlan.routes[0].netProfit, 65000);
});

test('model intent opens profit planning for a question outside keyword matching', async () => {
  const { POST } = load('../src/app/api/chat+api.ts', {
    env: { NEBIUS_API_KEY: 'test-key' },
    onForecast: () => assert.fail('Missing coordinates must not use the sample farmer location'),
    fetch: async () => Response.json({ choices: [{ message: { content: '[PROFIT] Please enter your quantity and costs.' } }] }),
  });
  const response = await POST(new Request('https://app.example/api/chat', { method: 'POST', body: JSON.stringify({
    messages: [{ from: 'farmer', text: 'What will I take home after the harvest?' }], language: 'en-IN',
  }) }));
  const answer = await response.json();
  assert.equal(answer.profitPlan.status, 'needs-details');
  assert.equal(answer.profitPlan.routes.length, 0);
});

test('structured Nebius response is used for farm-specific AI checklists', async () => {
  const input = inputs();
  input.routes.forEach(route => { route.quotedOn = indiaDate(); });
  const { POST } = load('../src/app/api/chat+api.ts', {
    env: { NEBIUS_API_KEY: 'test-key' },
    fetch: async () => Response.json({ choices: [{ message: { content: JSON.stringify({
      intent: 'profit', reply: 'The nearby option leaves more after costs.', routeGuidance: [{
        rank: 1, why: 'Lower transport costs suit your harvest.',
        checklist: ['Confirm your paddy grade.', 'Arrange covered transport.', 'Confirm payment before dispatch.'],
      }],
    }) } }] }),
  });
  const response = await POST(new Request('https://app.example/api/chat', { method: 'POST', body: JSON.stringify({
    messages: [{ from: 'farmer', text: 'Show my profit options' }], language: 'en-IN', profitInputs: input,
  }) }));
  const answer = await response.json();
  assert.equal(answer.reply, 'The nearby option leaves more after costs.');
  assert.equal(answer.profitPlan.routes[0].guidanceSource, 'ai');
  assert.equal(answer.profitPlan.routes[0].netProfit, 65000);
  assert.equal(answer.profitPlan.routes[1].guidanceSource, 'standard');
});
