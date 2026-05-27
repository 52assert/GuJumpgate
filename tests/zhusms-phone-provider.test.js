const assert = require('node:assert/strict');
const test = require('node:test');

require('../phone-sms/providers/zhusms.js');

function createProvider(overrides = {}) {
  return globalThis.PhoneSmsZhuSmsProvider.createProvider({
    fetchImpl: overrides.fetchImpl,
    useProxy: overrides.useProxy,
    proxyBaseUrl: overrides.proxyBaseUrl,
    sleepWithStop: overrides.sleepWithStop || (async () => {}),
    throwIfStopped: overrides.throwIfStopped || (() => {}),
  });
}

async function readBodyText(body) {
  if (!body) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return body.toString();
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return Array.from(body.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }
  return String(body);
}

test('ZhuSMS provider requests order with session cookie and returns US local phone', async () => {
  const requests = [];
  const provider = createProvider({
    useProxy: false,
    fetchImpl: async (url, init = {}) => {
      requests.push({ url, init });
      assert.equal(String(url), 'https://zhusms.com/api/order/take');
      assert.equal(init.method, 'POST');
      assert.equal(init.headers.Cookie, 'zhusms_sid=ses_demo');
      const bodyText = await readBodyText(init.body);
      assert.match(bodyText, /service=codex/);
      return {
        ok: true,
        text: async () => JSON.stringify({
          ok: true,
          order_no: 'ZS-8KLD64UL',
          phone: '+12183710920',
          service: 'codex',
          ttl_sec: 300,
        }),
      };
    },
  });

  const activation = await provider.requestActivation({
    zhuSmsSid: 'zhusms_sid=ses_demo',
  });

  assert.equal(requests.length, 1);
  assert.equal(activation.provider, 'zhusms');
  assert.equal(activation.activationId, 'ZS-8KLD64UL');
  assert.equal(activation.phoneNumber, '2183710920');
  assert.equal(activation.serviceCode, 'codex');
  assert.equal(activation.countryId, 187);
  assert.equal(activation.countryLabel, 'USA');
});

test('ZhuSMS provider routes order requests through local helper proxy by default', async () => {
  const requests = [];
  const provider = createProvider({
    fetchImpl: async (url, init = {}) => {
      requests.push({ url, init });
      assert.equal(String(url), 'http://127.0.0.1:17373/zhusms');
      assert.equal(init.method, 'POST');
      assert.equal(init.headers['Content-Type'], 'application/json;charset=UTF-8');
      const body = JSON.parse(String(init.body || '{}'));
      assert.equal(body.method, 'POST');
      assert.equal(body.path, '/api/order/take');
      assert.equal(body.sid, 'ses_demo');
      assert.equal(body.baseUrl, 'https://zhusms.com');
      assert.match(body.body, /service=codex/);
      return {
        ok: true,
        text: async () => JSON.stringify({
          ok: true,
          status: 200,
          payload: {
            ok: true,
            order_no: 'ZS-8KLD64UL',
            phone: '+12183710920',
          },
        }),
      };
    },
  });

  const activation = await provider.requestActivation({
    zhuSmsSid: 'zhusms_sid=ses_demo',
  });

  assert.equal(requests.length, 1);
  assert.equal(activation.activationId, 'ZS-8KLD64UL');
  assert.equal(activation.phoneNumber, '2183710920');
});

test('ZhuSMS provider polls waiting status then returns code', async () => {
  const urls = [];
  const provider = createProvider({
    useProxy: false,
    fetchImpl: async (url, init = {}) => {
      urls.push(String(url));
      assert.equal(init.headers.Cookie, 'zhusms_sid=ses_demo');
      if (urls.length === 1) {
        return {
          ok: true,
          text: async () => JSON.stringify({
            ok: true,
            order_no: 'ZS-8KLD64UL',
            phone: '+12183710920',
            status: 'waiting',
            code: null,
            raw_sms: null,
          }),
        };
      }
      return {
        ok: true,
        text: async () => JSON.stringify({
          ok: true,
          order_no: 'ZS-8KLD64UL',
          phone: '+12183710920',
          status: 'got',
          code: '809789',
          raw_sms: '"yes|您的 OpenAI 验证代码是：809789"',
        }),
      };
    },
  });

  const code = await provider.pollActivationCode({
    zhuSmsSid: 'ses_demo',
  }, {
    activationId: 'ZS-8KLD64UL',
    provider: 'zhusms',
  }, {
    timeoutMs: 100,
    intervalMs: 1,
    maxRounds: 2,
  });

  assert.equal(code, '809789');
  assert.equal(urls.length, 2);
  assert.match(urls[0], /\/api\/order\/status\?order_no=ZS-8KLD64UL$/);
});

test('ZhuSMS provider extracts verification code from raw_sms when code is absent', async () => {
  const provider = createProvider({
    useProxy: false,
    fetchImpl: async () => ({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        order_no: 'ZS-8KLD64UL',
        status: 'got',
        code: null,
        raw_sms: '"yes|您的 OpenAI 验证代码是：809789"',
      }),
    }),
  });

  const code = await provider.pollActivationCode({
    zhuSmsSid: 'ses_demo',
  }, {
    activationId: 'ZS-8KLD64UL',
    provider: 'zhusms',
  }, {
    timeoutMs: 100,
    intervalMs: 1,
    maxRounds: 1,
  });

  assert.equal(code, '809789');
});
