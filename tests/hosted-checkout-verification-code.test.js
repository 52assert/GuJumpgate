const assert = require('node:assert/strict');
const test = require('node:test');

require('../background/steps/create-plus-checkout.js');

function createExecutorWithPayload(payload) {
  return globalThis.MultiPageBackgroundPlusCheckoutCreate.createPlusCheckoutCreateExecutor({
    fetch: async () => ({
      text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
    }),
  });
}

async function fetchManualCode(payload) {
  const executor = createExecutorWithPayload(payload);
  const result = await executor.fetchHostedCheckoutVerificationCodeManually({
    verificationUrl: 'http://example.test/api/get_sms?key=test',
  });
  return result.code;
}

test('manual hosted checkout code fetch extracts plain 62-us PayPal response', async () => {
  const code = await fetchManualCode(
    "yes|PayPal: 201412 is your security code. Don't share it.|(PayPal)|到期时间：2026-07-29 00:00:00"
  );

  assert.equal(code, '201412');
});

test('manual hosted checkout code fetch extracts nested tgflare PayPal response', async () => {
  const code = await fetchManualCode({
    code: 1,
    msg: 'ok',
    data: {
      code: "PayPal: 288652 is your security code. Don't share it.",
      code_time: '2026-05-22 12:25:10',
      expired_date: '2026-07-31 00:00:00',
    },
  });

  assert.equal(code, '288652');
});

test('manual hosted checkout code fetch extracts issue 29 nested data.code response', async () => {
  const code = await fetchManualCode({
    code: 1,
    msg: 'ok',
    data: {
      code: 'PayPal: 011119 is your security code. Don`t share it.',
      code_time: '2026-05-21 10:37:02',
      expired_date: '2026-06-14 00:00:00',
    },
  });

  assert.equal(code, '011119');
});

test('manual hosted checkout code fetch extracts separated security code digits', async () => {
  const code = await fetchManualCode(
    "yes|PayPal: 1 2 3 4 5 6 is your security code. Don't share it.|(PayPal)|到期时间：2026-07-29 00:00:00"
  );

  assert.equal(code, '123456');
});

test('manual hosted checkout code fetch ignores metadata phone before sms text', async () => {
  const code = await fetchManualCode({
    data: {
      phone: '+14155552671',
      sms: "PayPal: 288652 is your security code. Don't share it.",
    },
  });

  assert.equal(code, '288652');
});

test('manual hosted checkout code fetch ignores metadata order id before message text', async () => {
  const code = await fetchManualCode({
    data: {
      order_id: '123456',
      message: "PayPal: 288652 is your security code. Don't share it.",
    },
  });

  assert.equal(code, '288652');
});

test('manual hosted checkout code fetch ignores PayPal confirmation text with expiration date', async () => {
  const executor = createExecutorWithPayload(
    'yes|PayPal: Thanks for confirming your phone number. Log in or get the app to get transaction alerts: https://py.pl/24BgEk|(PayPal)|到期时间：2026-07-29 00:00:00'
  );

  await assert.rejects(
    () => executor.fetchHostedCheckoutVerificationCodeManually({
      verificationUrl: 'http://example.test/api/get_sms?key=test',
    }),
    /(?:暂未返回有效验证码|非验证码内容)/
  );
});

test('manual hosted checkout code fetch rejects "暂无验证码" placeholder response with expiration date', async () => {
  const executor = createExecutorWithPayload(
    'no|暂无验证码|到期时间：2026-07-29 00:00:00'
  );

  await assert.rejects(
    () => executor.fetchHostedCheckoutVerificationCodeManually({
      verificationUrl: 'http://example.test/api/get_sms?key=test',
    }),
    /暂未返回有效验证码/
  );
});

test('manual hosted checkout code fetch rejects English "no sms" placeholder response', async () => {
  const executor = createExecutorWithPayload(
    'no|no sms received|expires_at: 2026-07-29 00:00:00'
  );

  await assert.rejects(
    () => executor.fetchHostedCheckoutVerificationCodeManually({
      verificationUrl: 'http://example.test/api/get_sms?key=test',
    }),
    /暂未返回有效验证码/
  );
});

test('manual hosted checkout code fetch ignores 6-digit year-month pulled from YYYY-MM-DD dates without keyword', async () => {
  // 即便 payload 没出现 "暂无" 关键字，纯日期字符串里抽出的 "2026-07" 也不应该被误判为验证码。
  const executor = createExecutorWithPayload({
    data: {
      sms: '',
      expired_date: '2026-07-29 00:00:00',
      code_time: '2026-05-21 10:37:02',
    },
  });

  await assert.rejects(
    () => executor.fetchHostedCheckoutVerificationCodeManually({
      verificationUrl: 'http://example.test/api/get_sms?key=test',
    }),
    /暂未返回有效验证码/
  );
});

test('hosted checkout runtime prefers PayPal SMS pool entry over fallback phone config', async () => {
  const state = {
    plusPaymentMethod: 'paypal',
    plusHostedCheckoutIsFinalStep: true,
    hostedCheckoutPhoneNumber: '9999999999',
    hostedCheckoutVerificationUrl: 'https://fallback.example.test/code',
    hostedCheckoutSmsPoolText: '4155552671----https://pool.example.test/code',
    hostedCheckoutSmsPoolUsage: {},
  };
  const logs = [];
  const requestedUrls = [];
  const executor = globalThis.MultiPageBackgroundPlusCheckoutCreate.createPlusCheckoutCreateExecutor({
    addLog: async (message) => logs.push(String(message)),
    chrome: {
      storage: {
        local: {
          get: async () => ({}),
        },
      },
    },
    fetch: async (url) => {
      requestedUrls.push(String(url));
      return {
        text: async () => "yes|PayPal: 201412 is your security code. Don't share it.",
        json: async () => ({}),
      };
    },
    getState: async () => state,
    setState: async (patch) => {
      Object.assign(state, patch);
    },
  });

  await executor.fetchHostedCheckoutVerificationCodeManually();

  assert(logs.some((line) => line.includes('PayPal 接码池已选择号码 4155552671')));
  assert.equal(requestedUrls[0], 'https://pool.example.test/code');
});

test('hosted checkout automation does not fall back to static phone when configured SMS pool has no usable entries', async () => {
  const state = {
    hostedCheckoutPhoneNumber: '9999999999',
    hostedCheckoutSmsPoolText: 'bad-pool-data-without-url',
    hostedCheckoutSmsPoolUsage: {},
  };
  const executor = globalThis.MultiPageBackgroundPlusCheckoutCreate.createPlusCheckoutCreateExecutor({
    chrome: {
      storage: {
        local: {
          get: async () => ({}),
        },
      },
    },
    fetch: async () => ({
      text: async () => 'no|暂无验证码',
      json: async () => ({}),
    }),
    getState: async () => state,
    setState: async (patch) => {
      Object.assign(state, patch);
    },
  });

  await assert.rejects(
    () => executor.fetchHostedCheckoutVerificationCodeManually(),
    /PayPal 接码池已填写，但未识别到有效号码/
  );
});
