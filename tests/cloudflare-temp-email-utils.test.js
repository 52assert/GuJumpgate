const assert = require('node:assert/strict');
const test = require('node:test');

const cloudflareTempEmailUtils = require('../cloudflare-temp-email-utils.js');
const hotmailUtils = require('../hotmail-utils.js');

test('Cloudflare Temp Email normalizes HTML body fields for code matching', () => {
  const receivedAt = Math.floor(Date.UTC(2026, 4, 21, 0, 28, 9) / 1000);
  const messages = cloudflareTempEmailUtils.normalizeCloudflareTempEmailMailApiMessages({
    rows: [
      {
        id: 17,
        address: 'tmpv8ks2z13ni@example.com',
        from: 'ChatGPT <noreply@tm.openai.com>',
        subject: '你的 ChatGPT 临时验证码',
        created_at: receivedAt,
        html: '<main><p>输入此临时验证码以继续：</p><div>991207</div></main>',
      },
    ],
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].bodyPreview.includes('<main>'), false);
  assert.equal(messages[0].bodyPreview.includes('991207'), true);
  assert.equal(messages[0].receivedDateTime, '2026-05-21T00:28:09.000Z');

  const matchResult = hotmailUtils.pickVerificationMessageWithTimeFallback(messages, {
    afterTimestamp: Date.UTC(2026, 4, 21, 0, 28, 0),
  });

  assert.equal(matchResult.match.code, '991207');
});

test('Cloudflare Temp Email reads nested content objects instead of stringifying metadata', () => {
  const messages = cloudflareTempEmailUtils.normalizeCloudflareTempEmailMailApiMessages([
    {
      id: 18,
      address: 'tmpv8ks2z13ni@example.com',
      sender: 'ChatGPT <noreply@tm.openai.com>',
      subject: '你的 ChatGPT 临时验证码',
      body: {
        html: '<section><strong>654321</strong></section>',
      },
      date: '2026-05-21T00:28:09.000Z',
    },
  ]);

  assert.equal(messages[0].bodyPreview.includes('[object Object]'), false);
  assert.equal(messages[0].bodyPreview.includes('654321'), true);
  assert.equal(hotmailUtils.extractVerificationCodeFromMessage(messages[0]), '654321');
});

test('Hotmail verification picker skips newer non-code mail and reads message body content', () => {
  const messages = [
    {
      id: 'newer-newsletter',
      mailbox: 'INBOX',
      from: { emailAddress: { address: 'digest@example.com' } },
      subject: 'Daily digest',
      bodyPreview: 'No code here.',
      receivedDateTime: '2026-05-21T00:31:00.000Z',
    },
    {
      id: 'older-code',
      mailbox: 'Junk',
      from: { emailAddress: { address: 'noreply@tm.openai.com' } },
      subject: 'Your ChatGPT code',
      bodyPreview: 'Open the message to continue.',
      body: {
        content: '<p>Your ChatGPT code is 782914</p>',
      },
      receivedDateTime: '2026-05-21T00:30:00.000Z',
    },
  ];

  assert.equal(hotmailUtils.extractVerificationCodeFromMessage(messages[0]), null);

  const matchResult = hotmailUtils.pickVerificationMessageWithTimeFallback(messages, {
    afterTimestamp: Date.UTC(2026, 4, 21, 0, 29, 0),
    senderFilters: ['openai'],
    subjectFilters: ['code'],
    requiredKeywords: ['chatgpt'],
  });

  assert.equal(matchResult.match.code, '782914');
  assert.equal(matchResult.match.message.id, 'older-code');
});

test('Hotmail manual fallback can copy a recent code even when OpenAI hints miss', () => {
  const messages = [
    {
      id: 'recent-code',
      mailbox: 'INBOX',
      from: { emailAddress: { address: 'security@example-mail.test' } },
      subject: '安全确认',
      bodyPreview: '你的验证码是 341290，请尽快使用。',
      receivedDateTime: '2026-05-21T00:32:00.000Z',
    },
  ];

  const strictResult = hotmailUtils.pickVerificationMessageWithTimeFallback(messages, {
    afterTimestamp: Date.UTC(2026, 4, 21, 0, 31, 0),
    senderFilters: ['openai'],
    subjectFilters: ['chatgpt'],
    requiredKeywords: ['login'],
  });
  assert.equal(strictResult.match, null);

  const relaxedResult = hotmailUtils.pickVerificationMessage(messages, {
    afterTimestamp: Date.UTC(2026, 4, 21, 0, 31, 0),
  });

  assert.equal(relaxedResult.code, '341290');
  assert.equal(relaxedResult.message.id, 'recent-code');
});
