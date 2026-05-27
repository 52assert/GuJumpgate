const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadMessageRouterModule() {
  const filePath = path.join(__dirname, '..', 'background', 'message-router.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.runInNewContext(source, sandbox, { filename: filePath });
  return sandbox.MultiPageBackgroundMessageRouter;
}

function createRouter(overrides = {}) {
  return loadMessageRouterModule().createMessageRouter({
    addLog: async () => {},
    clearStopRequest: overrides.clearStopRequest || (() => {}),
    getSourceLabel: (source) => source || 'unknown',
    getState: async () => ({}),
    normalizeHotmailAccounts: (accounts = []) => accounts,
    registerTab: async () => {},
    flushCommand: () => {},
    testHotmailAccountMailAccess: overrides.testHotmailAccountMailAccess || (async () => ({
      account: { id: 'hotmail-1', email: 'user@example.com' },
      latestCode: '123456',
    })),
    fetchHostedCheckoutVerificationCodeManually: overrides.fetchHostedCheckoutVerificationCodeManually || (async () => ({
      code: '654321',
      verificationUrl: 'https://example.test/code',
    })),
  });
}

test('manual Hotmail code copy clears stale stop request before polling mailbox', async () => {
  const calls = [];
  const router = createRouter({
    clearStopRequest: () => {
      calls.push('clear-stop');
    },
    testHotmailAccountMailAccess: async (accountId) => {
      calls.push(`test-hotmail:${accountId}`);
      return {
        account: { id: accountId, email: 'user@example.com' },
        latestCode: '123456',
      };
    },
  });

  const response = await router.handleMessage({
    type: 'TEST_HOTMAIL_ACCOUNT',
    source: 'sidepanel',
    payload: { accountId: 'hotmail-1' },
  }, {});

  assert.equal(response.ok, true);
  assert.equal(response.latestCode, '123456');
  assert.deepEqual(calls, ['clear-stop', 'test-hotmail:hotmail-1']);
});

test('manual hosted checkout code fetch clears stale stop request before fetching code', async () => {
  const calls = [];
  const router = createRouter({
    clearStopRequest: () => {
      calls.push('clear-stop');
    },
    fetchHostedCheckoutVerificationCodeManually: async (payload) => {
      calls.push(`fetch-hosted:${payload.verificationUrl}`);
      return {
        code: '654321',
        verificationUrl: payload.verificationUrl,
      };
    },
  });

  const response = await router.handleMessage({
    type: 'FETCH_HOSTED_CHECKOUT_VERIFICATION_CODE',
    source: 'sidepanel',
    payload: { verificationUrl: 'https://example.test/code' },
  }, {});

  assert.equal(response.ok, true);
  assert.equal(response.code, '654321');
  assert.deepEqual(calls, ['clear-stop', 'fetch-hosted:https://example.test/code']);
});
