const assert = require('node:assert/strict');
const test = require('node:test');

const mailProviderUtils = require('../mail-provider-utils.js');

test('custom mail provider remains manual and does not normalize to a mailbox provider', () => {
  assert.equal(mailProviderUtils.normalizeMailProvider('custom'), 'custom');
  assert.equal(mailProviderUtils.normalizeMailProvider('manual'), 'custom');

  const config = mailProviderUtils.getMailProviderConfig({ mailProvider: 'custom' });
  assert.equal(config.provider, 'custom');
  assert.equal(config.manual, true);
  assert.equal(config.source, undefined);
  assert.equal(config.url, undefined);
});
