const assert = require('node:assert/strict');
const test = require('node:test');

require('../background/auto-run-controller.js');

function createRuntime() {
  let value = {
    autoRunActive: false,
    autoRunTotalRuns: 0,
    autoRunCurrentRun: 0,
    autoRunAttemptRun: 0,
    autoRunSessionId: 0,
  };
  return {
    get: () => ({ ...value }),
    set: (updates) => {
      value = { ...value, ...updates };
    },
  };
}

function createHarness(overrides = {}) {
  let state = { ...(overrides.initialState || {}) };
  let nextSessionId = 100;
  const logs = [];
  const statuses = [];
  const records = [];
  const stops = [];
  const runCalls = [];
  const runtime = createRuntime();

  const controller = globalThis.MultiPageBackgroundAutoRunController.createAutoRunController({
    addLog: async (message, level = 'info') => {
      logs.push({ message, level });
    },
    appendAccountRunRecord: async (status, recordState, reason) => {
      records.push({ status, state: { ...recordState }, reason });
      return { status };
    },
    AUTO_RUN_MAX_RETRIES_PER_ROUND: 3,
    AUTO_RUN_RETRY_DELAY_MS: 1,
    AUTO_RUN_TIMER_KIND_BEFORE_RETRY: 'before_retry',
    AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS: 'between_rounds',
    broadcastAutoRunStatus: async (phase, payload = {}, extraState = {}) => {
      statuses.push({ phase, payload, extraState });
      state = { ...state, ...extraState, autoRunPhase: phase, ...payload };
    },
    broadcastStopToContentScripts: async () => {
      stops.push('broadcast-stop');
    },
    cancelPendingCommands: (reason) => {
      stops.push(reason);
    },
    clearStopRequest: () => {},
    createAutoRunSessionId: () => {
      nextSessionId += 1;
      return nextSessionId;
    },
    getAutoRunStatusPayload: (phase, payload = {}) => ({
      autoRunning: !['idle', 'complete', 'stopped'].includes(phase),
      autoRunPhase: phase,
      autoRunCurrentRun: payload.currentRun,
      autoRunTotalRuns: payload.totalRuns,
      autoRunAttemptRun: payload.attemptRun,
      autoRunSessionId: payload.sessionId,
    }),
    getErrorMessage: (error) => String(error?.message || error || ''),
    getPendingAutoRunTimerPlan: () => null,
    getRunningNodeIds: () => [],
    getState: async () => state,
    getStopRequested: () => false,
    hasSavedNodeProgress: () => false,
    isAddPhoneAuthFailure: () => false,
    isCloudCheckoutAlreadyPaidFailure: () => false,
    isGpcTaskEndedFailure: () => false,
    isHostedCheckoutGenericErrorFailure: () => false,
    isHostedCheckoutVerificationResendLimitFailure: () => false,
    isHostedCheckoutSlideCaptchaFailedFailure: () => false,
    isLocalCpaJsonExportFailedFailure: () => false,
    isPhoneSmsPlatformRateLimitFailure: () => false,
    isPlusCheckoutNonFreeTrialFailure: (error) => /PLUS_CHECKOUT_NON_FREE_TRIAL::/.test(String(error?.message || error || '')),
    isRestartCurrentAttemptError: () => false,
    isStep4Route405RecoveryLimitFailure: () => false,
    isSignupUserAlreadyExistsFailure: () => false,
    isStopError: (error) => String(error?.message || error || '') === 'STOP',
    launchAutoRunTimerPlan: async () => false,
    normalizeAutoRunFallbackThreadIntervalMinutes: () => 0,
    persistAutoRunTimerPlan: async () => ({}),
    resetState: async () => {
      state = {};
    },
    runAutoSequenceFromNode: async (startNodeId, context) => {
      runCalls.push({ startNodeId, context });
      return overrides.runAutoSequenceFromNode?.(startNodeId, context, runCalls.length);
    },
    runtime,
    setState: async (updates) => {
      state = { ...state, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfAutoRunSessionStopped: () => {},
    waitForRunningNodesToFinish: async () => state,
    chrome: {
      runtime: {
        sendMessage: async () => {},
      },
    },
    ...overrides.deps,
  });

  return {
    controller,
    getState: () => state,
    logs,
    records,
    runCalls,
    statuses,
    stops,
  };
}

test('auto run keeps retrying current round when phone providers have no numbers', async () => {
  const harness = createHarness({
    runAutoSequenceFromNode: async (_startNodeId, _context, callNumber) => {
      if (callNumber <= 2) {
        throw new Error('步骤 2：所有接码平台候选均未获取到手机号。HeroSMS：暂无可用号码（NO_NUMBERS）');
      }
    },
  });

  await harness.controller.autoRunLoop(1, { autoRunSkipFailures: false });

  assert.equal(harness.runCalls.length, 3);
  assert.equal(harness.records.length, 0);
  assert.equal(harness.statuses.some((item) => item.phase === 'stopped'), false);
  assert.match(
    harness.logs.map((item) => item.message).join('\n'),
    /接码号池暂无可用号码，将持续重试取号/
  );
  assert.equal(harness.getState().autoRunPhase, 'complete');
});

test('auto run fresh reset preserves custom email pool settings for allocation', async () => {
  const customMailProviderPoolEntries = [
    { id: 'manual-1', email: 'manual001@example.com', enabled: true, used: true },
    { id: 'manual-2', email: 'manual002@example.com', enabled: true, used: false },
  ];
  const customEmailPoolEntries = [
    { id: 'entry-1', email: 'pool001@example.com', enabled: true, used: false },
  ];
  const harness = createHarness({
    initialState: {
      mailProvider: 'custom',
      emailGenerator: 'custom-pool',
      customMailProviderPool: ['manual002@example.com'],
      customMailProviderPoolEntries,
      customEmailPool: ['pool001@example.com'],
      customEmailPoolEntries,
    },
    runAutoSequenceFromNode: async () => {
      const state = harness.getState();
      assert.deepEqual(state.customMailProviderPool, ['manual002@example.com']);
      assert.deepEqual(state.customMailProviderPoolEntries, customMailProviderPoolEntries);
      assert.deepEqual(state.customEmailPool, ['pool001@example.com']);
      assert.deepEqual(state.customEmailPoolEntries, customEmailPoolEntries);
    },
  });

  await harness.controller.autoRunLoop(1, { autoRunSkipFailures: false });

  assert.equal(harness.getState().autoRunPhase, 'complete');
});

test('auto run skips to next round for non-free-trial checkout without retrying current round', async () => {
  const harness = createHarness({
    initialState: {
      plusPaymentMethod: 'paypal',
      plusAccountAccessStrategy: 'sms_oauth',
    },
    runAutoSequenceFromNode: async (_startNodeId, context) => {
      if (context.targetRun === 1) {
        throw new Error('PLUS_CHECKOUT_NON_FREE_TRIAL::步骤 6：检测到今日应付金额不是 0（US$20.00），当前账号没有免费试用资格。');
      }
    },
    deps: {
      normalizeAutoRunFallbackThreadIntervalMinutes: () => 5,
      persistAutoRunTimerPlan: async () => {
        throw new Error('non-free-trial skip should not wait for the between-round timer');
      },
    },
  });

  await harness.controller.autoRunLoop(2, {
    autoRunSkipFailures: false,
    autoRunRetryNonFreeTrial: true,
  });

  assert.deepEqual(
    harness.runCalls.map((item) => [item.context.targetRun, item.context.attemptRuns]),
    [[1, 1], [2, 1]]
  );
  assert.equal(harness.records.length, 1);
  assert.equal(harness.records[0].status, 'failed');
  assert.equal(harness.statuses.some((item) => item.phase === 'retrying'), false);
  assert.match(
    harness.logs.map((item) => item.message).join('\n'),
    /没有 Plus 免费试用资格，本轮将直接失败，不再自动重试该错误/
  );
  assert.doesNotMatch(
    harness.logs.map((item) => item.message).join('\n'),
    /回到第\s*.*\s*步[\s\S]*重新创建\s*(?:Plus\s*)?Checkout|回到步骤\s*6[\s\S]*重新创建\s*(?:Plus\s*)?Checkout|从步骤\s*6[\s\S]*重新创建\s*(?:Plus\s*)?Checkout|plus-checkout-create\s*重试|重建\s*Checkout/
  );
  assert.equal(harness.getState().autoRunPhase, 'complete');
});
