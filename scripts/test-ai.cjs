const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync('lib/ai.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function scenario(responses, env = {}) {
  const calls = [], logs = [];
  let now = 0;
  const exports = {};
  vm.runInNewContext(source, {
    exports, Error, TypeError, SyntaxError, JSON,
    process: { env: { GEMINI_API_KEY: 'test-key', ...env } },
    Date: { now: () => now },
    AbortSignal: { timeout: (ms) => ({ ms }) },
    setTimeout: (fn, ms) => { now += ms; fn(); },
    console: { info: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
    fetch: async (url, options) => {
      calls.push(url.match(/models\/(.*):generateContent/)[1]);
      assert.ok(!url.includes('test-key'));
      assert.equal(options.headers['x-goog-api-key'], 'test-key');
      const response = responses.shift();
      assert.ok(response, 'Unexpected extra API call');
      if (response.timeout) {
        now += options.signal.ms;
        const error = new Error('timeout'); error.name = 'TimeoutError'; throw error;
      }
      const status = response.status || 200;
      return {
        ok: status === 200, status, body: { cancel: async () => {} },
        json: async () => ({ candidates: [{ content: { parts: [{ text: response.text || '{"summary":"ok","details":{}}' }] } }] }),
      };
    },
  });
  let result, error;
  try { result = await exports.analyzeImage('test-image', 'image/png', 'office-schedule'); }
  catch (e) { error = e; }
  return { calls, logs, result, error, now };
}

(async () => {
  let s = await scenario([{}]);
  assert.deepEqual(s.calls, ['gemini-3-flash-preview']);
  assert.equal(s.result.summary, 'ok');

  s = await scenario([{ status: 503 }, {}]);
  assert.deepEqual(s.calls, ['gemini-3-flash-preview', 'gemini-3-flash-preview']);
  assert.equal(s.result.summary, 'ok');

  s = await scenario([{ status: 503 }, { status: 503 }, {}]);
  assert.deepEqual(s.calls, ['gemini-3-flash-preview', 'gemini-3-flash-preview', 'gemini-2.5-flash']);
  assert.equal(s.logs[0][1].status, 503);

  s = await scenario([{ text: 'invalid JSON' }, {}]);
  assert.deepEqual(s.calls, ['gemini-3-flash-preview', 'gemini-2.5-flash']);

  s = await scenario(Array.from({ length: 4 }, () => ({ status: 503 })));
  assert.match(s.error.message, /혼잡/);
  assert.ok(!s.error.message.includes('"error"'));

  s = await scenario([{ status: 403 }, { status: 403 }]);
  assert.equal(s.calls.length, 2);
  assert.match(s.error.message, /설정 오류/);

  s = await scenario([{ timeout: true }, { timeout: true }, { timeout: true }]);
  assert.equal(s.calls[1], 'gemini-2.5-flash');
  assert.ok(s.now <= 45000);
  assert.match(s.error.message, /지연/);

  s = await scenario([{ status: 503 }, {}], { GEMINI_MODEL: 'gemini-2.5-flash', GEMINI_FALLBACK_MODEL: 'gemini-2.5-flash' });
  assert.deepEqual(s.calls, ['gemini-2.5-flash', 'gemini-2.5-flash']);
  console.log('PASS: 8 AI model selection, retry, fallback, error and deadline scenarios');
})().catch((error) => { console.error(error); process.exitCode = 1; });
