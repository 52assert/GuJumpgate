const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadGeneratedEmailHelpersModule() {
  const filePath = path.join(__dirname, '..', 'background', 'generated-email-helpers.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const sandbox = {
    AbortController,
    URL,
    console,
    setTimeout,
    clearTimeout,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.runInNewContext(source, sandbox, { filename: filePath });
  return sandbox.MultiPageGeneratedEmailHelpers;
}

function createHelpers(overrides = {}) {
  return loadGeneratedEmailHelpersModule().createGeneratedEmailHelpers({
    addLog: overrides.addLog || (async () => {}),
    buildGeneratedAliasEmail: () => 'alias@example.com',
    buildCloudflareTempEmailHeaders: () => ({}),
    CLOUDFLARE_TEMP_EMAIL_GENERATOR: 'cloudflare-temp-email',
    CUSTOM_EMAIL_POOL_GENERATOR: 'custom-pool',
    DUCK_AUTOFILL_URL: 'https://duckduckgo.com/email',
    fetch: async () => ({ ok: true, text: async () => '{}' }),
    fetchIcloudHideMyEmail: async () => 'icloud@example.com',
    getCloudflareTempEmailAddressFromResponse: () => '',
    getCloudflareTempEmailConfig: () => ({}),
    getCustomEmailPoolEmail: () => '',
    getRegistrationEmailBaseline: (_state, options = {}) => options.preferredEmail || options.fallbackEmail || '',
    getState: overrides.getState || (async () => ({})),
    ensureMail2925AccountForFlow: async () => ({ id: 'mail2925-1' }),
    joinCloudflareTempEmailUrl: (baseUrl, requestPath) => `${baseUrl}${requestPath}`,
    normalizeCloudflareDomain: (value) => String(value || '').trim().toLowerCase(),
    normalizeCloudflareTempEmailAddress: (value) => String(value || '').trim().toLowerCase(),
    normalizeEmailGenerator: (value) => String(value || 'duck').trim().toLowerCase(),
    isGeneratedAliasProvider: () => false,
    persistRegistrationEmailState: overrides.persistRegistrationEmailState,
    reuseOrCreateTab: async () => {},
    sendToContentScript: async () => ({ email: 'duck@example.com' }),
    setEmailState: overrides.setEmailState || (async () => {}),
    throwIfStopped: () => {},
  });
}

test('custom mail provider uses customMailProviderPool in the raw generated email helper', async () => {
  const persistedEmails = [];
  const logs = [];
  const helpers = createHelpers({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    persistRegistrationEmailState: async (_state, email, options = {}) => {
      persistedEmails.push({ email, options });
    },
  });

  const email = await helpers.fetchGeneratedEmail({
    mailProvider: 'custom',
    emailGenerator: 'duck',
    customMailProviderPool: ['first@example.com', 'SECOND@EXAMPLE.COM'],
  }, {
    poolIndex: 2,
  });

  assert.equal(email, 'second@example.com');
  assert.equal(persistedEmails.length, 1);
  assert.equal(persistedEmails[0].email, 'second@example.com');
  assert.equal(persistedEmails[0].options.source, 'custom-mail-provider-pool');
  assert.equal(persistedEmails[0].options.preserveAccountIdentity, false);
  assert.equal(logs[0].level, 'ok');
  assert.match(logs[0].message, /自定义邮箱号池：已取用 second@example.com/);
});

test('custom mail provider raw generated email helper reports an empty customMailProviderPool clearly', async () => {
  const helpers = createHelpers();

  await assert.rejects(
    () => helpers.fetchGeneratedEmail({
      mailProvider: 'custom',
      emailGenerator: 'duck',
      customMailProviderPool: [],
    }),
    /当前邮箱服务为自定义邮箱，但自定义号池为空/
  );
});

test('custom mail provider skips used customMailProviderPoolEntries in the raw generated email helper', async () => {
  const helpers = createHelpers();

  const email = await helpers.fetchGeneratedEmail({
    mailProvider: 'custom',
    emailGenerator: 'duck',
    customMailProviderPool: ['legacy-first@example.com'],
    customMailProviderPoolEntries: [
      { email: 'used@example.com', enabled: true, used: true },
      { email: 'available@example.com', enabled: true, used: false },
      { email: 'disabled@example.com', enabled: false, used: false },
    ],
  }, {
    poolIndex: 1,
  });

  assert.equal(email, 'available@example.com');
});

test('custom mail provider does not fall back to legacy pool when customMailProviderPoolEntries are exhausted', async () => {
  const helpers = createHelpers();

  await assert.rejects(
    () => helpers.fetchGeneratedEmail({
      mailProvider: 'custom',
      emailGenerator: 'duck',
      customMailProviderPool: ['legacy-first@example.com'],
      customMailProviderPoolEntries: [
        { email: 'used@example.com', enabled: true, used: true },
      ],
    }),
    /当前邮箱服务为自定义邮箱，但自定义号池为空/
  );
});
