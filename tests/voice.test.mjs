import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Run the real TypeScript services/routes with isolated platform, env and provider mocks.
function load(file, { platform = 'web', env = {}, fetch } = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(source, {
    exports, process: { env }, fetch,
    FormData, Blob, File, Request, Response, AbortSignal,
    console: { error() {} },
    require(name) {
      if (name === 'react-native') return { Platform: { OS: platform } };
      if (name.endsWith('/languages')) return load('../src/languages.ts');
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

function recording(language) {
  const form = new FormData();
  form.append('audio', new Blob(['recording'], { type: 'audio/webm;codecs=opus' }), 'question.webm');
  if (language) form.append('language', language);
  return new Request('https://app.example/api/transcribe', { method: 'POST', body: form });
}

test('native chat uses the configured app origin, separately from the data API', async () => {
  const { askAssistant } = load('../src/voice.ts', {
    platform: 'android',
    env: { EXPO_PUBLIC_APP_API_BASE_URL: 'https://app.example///', EXPO_PUBLIC_API_BASE_URL: 'https://data.example' },
    fetch: async (url, options) => {
      assert.equal(url, 'https://app.example/api/chat');
      assert.equal(JSON.parse(options.body).language, 'te-IN');
      return Response.json({ reply: 'స్వాగతం' });
    },
  });
  assert.equal((await askAssistant([], 'te-IN', 'Farmer')).reply, 'స్వాగతం');
});

test('development requests retain relative URLs for Expo origin resolution', async () => {
  const { speak } = load('../src/voice.ts', {
    platform: 'ios', fetch: async url => {
      assert.equal(url, '/api/speak');
      return Response.json({ audio: 'wav-data' });
    },
  });
  assert.equal(await speak('Hello', 'en-IN'), 'data:audio/wav;base64,wav-data');
});

test('web upload preserves the browser audio format and selected language', async () => {
  const { transcribe } = load('../src/voice.ts', {
    env: { EXPO_PUBLIC_APP_API_BASE_URL: 'https://native.example' },
    fetch: async (url, options) => {
      if (url === 'blob:recording') return new Response(new Blob(['audio'], { type: 'audio/mp4' }));
      assert.equal(url, '/api/transcribe');
      assert.equal(options.body.get('audio').name, 'question.m4a');
      assert.equal(options.body.get('language'), 'mr-IN');
      assert.equal(options.headers, undefined); // fetch supplies the multipart boundary
      return Response.json({ transcript: 'नमस्कार', language: 'mr-IN' });
    },
  });
  assert.equal((await transcribe('blob:recording', 'mr-IN')).language, 'mr-IN');
});

test('selected language reaches Sarvam and overrides an incorrect detected language', async () => {
  const { POST } = load('../src/app/api/transcribe+api.ts', {
    env: { SARVAM_API_KEY: 'test-key' },
    fetch: async (url, options) => {
      assert.equal(url, 'https://api.sarvam.ai/speech-to-text');
      assert.equal(options.headers['api-subscription-key'], 'test-key');
      assert.equal(options.body.get('language_code'), 'mr-IN');
      assert.equal(options.body.get('file').type, 'audio/webm');
      return Response.json({ transcript: ' नमस्कार ', language_code: 'hi-IN' });
    },
  });
  const response = await POST(recording('mr-IN'));
  assert.deepEqual(await response.json(), { transcript: 'नमस्कार', language: 'mr-IN' });
});

test('automatic detection uses the provider language', async () => {
  const { POST } = load('../src/app/api/transcribe+api.ts', {
    env: { SARVAM_API_KEY: 'test-key' }, fetch: async (_url, options) => {
      assert.equal(options.body.get('language_code'), 'unknown');
      return Response.json({ transcript: 'Hello', language_code: 'en-IN' });
    },
  });
  assert.equal((await (await POST(recording())).json()).language, 'en-IN');
});

test('silence returns a recoverable error instead of an empty question', async () => {
  const { POST } = load('../src/app/api/transcribe+api.ts', {
    env: { SARVAM_API_KEY: 'test-key' }, fetch: async () => Response.json({ transcript: '   ' }),
  });
  assert.equal((await POST(recording())).status, 422);
});

test('missing credentials fail without contacting the provider', async () => {
  const { POST } = load('../src/app/api/transcribe+api.ts', {
    fetch() { assert.fail('Provider must not be called without a key'); },
  });
  const response = await POST(recording());
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /not configured/);
});

test('speech output sends the answer language and returns playable audio', async () => {
  const { POST } = load('../src/app/api/speak+api.ts', {
    env: { SARVAM_API_KEY: 'test-key' }, fetch: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.language_code, 'te-IN');
      assert.equal(body.model, 'bulbul:v3');
      return Response.json({ audios: ['wav-data'] });
    },
  });
  const response = await POST(new Request('https://app.example/api/speak', {
    method: 'POST', body: JSON.stringify({ text: 'నమస్కారం', language: 'te-IN' }),
  }));
  assert.deepEqual(await response.json(), { audio: 'wav-data' });
});

test('provider errors are shown to the caller', async () => {
  const { speak } = load('../src/voice.ts', {
    fetch: async () => Response.json({ error: 'Voice replies are not configured yet.' }, { status: 500 }),
  });
  await assert.rejects(speak('Hello', 'en-IN'), /Voice replies are not configured/);
});

test('long dialog narration preserves all text across provider-sized chunks', () => {
  const { speechChunks } = load('../src/speech-text.ts');
  const text = 'Check the weather before spraying. '.repeat(200).trim();
  const chunks = speechChunks(text);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(chunk => chunk.length <= 2200));
  assert.equal(chunks.join(' '), text);
});

test('dialog narration includes nested text and button titles, without input values', () => {
  const { dialogText } = load('../src/speech-text.ts');
  const tree = { props: { children: [
    { props: { children: ['Enter your code for ', '+91'] } },
    { props: { value: 'private-input', placeholder: 'Code' } },
    { props: { title: 'Verify and continue' } },
    false,
  ] } };
  assert.equal(dialogText(tree), 'Enter your code for  +91 Verify and continue');
});

test('dictated numeric fields normalize Indic digits and retain input limits', () => {
  const { dictatedValue } = load('../src/speech-text.ts');
  assert.equal(dictatedValue('१२३ ४५६ ७८९०', 'number-pad', 6), '123456');
  assert.equal(dictatedValue('౨.౫ tonnes', 'decimal-pad'), '2.5');
  assert.equal(dictatedValue('  My village  ', 'default'), 'My village');
  assert.equal(dictatedValue('no digits', 'number-pad'), '');
});

test('Telugu and English spoken digits can fill mobile numbers and verification codes', () => {
  const { dictatedValue } = load('../src/speech-text.ts');
  assert.equal(dictatedValue('తొమ్మిది ఎనిమిది ఏడు ఆరు ఐదు నాలుగు మూడు రెండు ఒకటి సున్నా', 'number-pad', 10), '9876543210');
  assert.equal(dictatedValue('ఒకటి, రెండు, మూడు, నాలుగు, ఐదు, ఆరు.', 'number-pad', 6), '123456');
  assert.equal(dictatedValue('nine eight seven six five four three two one zero', 'phone-pad', 10), '9876543210');
  assert.equal(dictatedValue('౯ eight ౭ ఆరు 5', 'number-pad'), '98765');
  assert.equal(dictatedValue('one two three four five six seven', 'number-pad', 6), '123456');
});

test('spoken decimal values work without rewriting free-text names or places', () => {
  const { dictatedValue, numericSpeechText } = load('../src/speech-text.ts');
  assert.equal(dictatedValue('రెండు పాయింట్ ఐదు', 'decimal-pad'), '2.5');
  assert.equal(dictatedValue('two point five', 'decimal-pad'), '2.5');
  assert.equal(numericSpeechText('రెండు పాయింట్ ఐదు ఎకరాలు'), '2.5 ఎకరాలు');
  assert.equal(dictatedValue('One Tree Village'), 'One Tree Village');
  assert.equal(dictatedValue('రెండు చెట్లు'), 'రెండు చెట్లు');
  assert.equal(dictatedValue('Someone'), 'Someone');
});
