(function attachBackgroundPlusCheckoutCreate(root, factory) {
  root.MultiPageBackgroundPlusCheckoutCreate = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundPlusCheckoutCreateModule() {
  const PLUS_CHECKOUT_SOURCE = 'plus-checkout';
  const PAYPAL_SOURCE = 'paypal-flow';
  const PLUS_CHECKOUT_ENTRY_URL = 'https://chatgpt.com/';
  const PLUS_CHECKOUT_INJECT_FILES = ['content/utils.js', 'content/operation-delay.js', 'content/plus-checkout.js'];
  const PAYPAL_INJECT_FILES = ['content/utils.js', 'content/operation-delay.js', 'content/paypal-flow.js'];
  const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';
  const PLUS_PAYMENT_METHOD_GOPAY = 'gopay';
  const PLUS_PAYMENT_METHOD_GPC_HELPER = 'gpc-helper';
  const DEFAULT_GPC_HELPER_API_URL = 'https://your-gpc-helper-domain.example';
  const BUILTIN_PLUS_CHECKOUT_CLOUD_CONVERSION_API_URL = 'https://gujumpgate.zg.fyi/api/checkout';
  const BUILTIN_PLUS_CHECKOUT_CLOUD_CONVERSION_API_KEY = '2KwVxE6f0ABH002JLkoQJ9ReRf4_d01y';
  const GPC_HELPER_PHONE_MODE_AUTO = 'auto';
  const GPC_HELPER_PHONE_MODE_MANUAL = 'manual';
  const CHECKOUT_READY_URL_PATTERN = /^https:\/\/(?:chatgpt\.com\/checkout|pay\.openai\.com\/c\/pay|checkout\.stripe\.com\/c\/pay)(?:\/|$)/i;
  const CHECKOUT_REDIRECT_WAIT_TIMEOUT_MS = 15000;
  const HOSTED_CHECKOUT_ADDRESS_ENDPOINT = 'https://www.meiguodizhi.com/api/v1/dz';
  const HOSTED_CHECKOUT_VERIFICATION_CODE_ENDPOINT = 'https://mail.test.com/api/text-relay/eca_tr_xxxxxxxxx';
  const HOSTED_CHECKOUT_TRANSITION_TIMEOUT_MS = 120000;
  const HOSTED_CHECKOUT_SUCCESS_WAIT_TIMEOUT_MS = 180000;
  const HOSTED_CHECKOUT_PAYPAL_LOOP_TIMEOUT_MS = 10 * 60 * 1000;
  const HOSTED_CHECKOUT_VERIFICATION_POLL_ATTEMPTS = 12;
  const HOSTED_CHECKOUT_VERIFICATION_POLL_INTERVAL_MS = 5000;
  const HOSTED_CHECKOUT_VERIFICATION_INVALID_RESEND_DELAY_MS = 3000;
  const HOSTED_CHECKOUT_VERIFICATION_POPUP_DELAY_MIN_SECONDS = 0;
  const HOSTED_CHECKOUT_VERIFICATION_POPUP_DELAY_MAX_SECONDS = 60;
  const HOSTED_CHECKOUT_VERIFICATION_POPUP_DELAY_DEFAULT_SECONDS = 20;
  const HOSTED_CHECKOUT_PAYPAL_DEFAULT_PHONE = '1234567890';
  const HOSTED_CHECKOUT_SUCCESS_URL_PATTERN = /^https:\/\/(?:chatgpt\.com|www\.chatgpt\.com|chat\.openai\.com)\/(?:backend-api\/)?payments\/success(?:[/?#]|$)/i;
  const HOSTED_CHECKOUT_SMS_POOL_SEPARATOR = '----';
  const HOSTED_CHECKOUT_SAMPLE_PHONE = '1234567890';
  const HOSTED_CHECKOUT_SAMPLE_VERIFICATION_URL = 'https://mail.test.com/api/text-relay/eca_tr_xxxxxxxxx';
  const HOSTED_CHECKOUT_GENERIC_ERROR_PREFIX = 'HOSTED_CHECKOUT_GENERIC_ERROR::';
  const HOSTED_CHECKOUT_VERIFICATION_RESEND_LIMIT_PREFIX = 'HOSTED_CHECKOUT_VERIFICATION_RESEND_LIMIT::';
  const HOSTED_CHECKOUT_VERIFICATION_RESEND_MAX_ATTEMPTS = 1;
  const HOSTED_CHECKOUT_SLIDE_CAPTCHA_FAILED_PREFIX = 'HOSTED_CHECKOUT_SLIDE_CAPTCHA_FAILED::';
  // 当 PayPal 提示 "Try a different phone number." 时给失败号码加冷却：
  // 默认 5 分钟；同一号码累计被拒 3 次及以上后，进入 30 分钟"长冷却"，防止反复在不可用号码上原地循环。
  // 期间该号码会从自动选号池中跳过，UI 也会标记为"冷却中"，到期后自动恢复可用。
  const HOSTED_CHECKOUT_EXCEED_PHONE_COOLDOWN_MS = 5 * 60 * 1000;
  const HOSTED_CHECKOUT_EXCEED_PHONE_LONG_COOLDOWN_MS = 30 * 60 * 1000;
  const HOSTED_CHECKOUT_EXCEED_PHONE_LONG_COOLDOWN_THRESHOLD = 3;
  const CHECKOUT_CONVERSION_PROXY_SETTINGS_SCOPE = 'regular';
  const CHECKOUT_CONVERSION_PROXY_BYPASS_LIST = ['<local>', 'localhost', '127.0.0.1'];
  const CHECKOUT_CONVERSION_PROXY_TARGET_HOST_PATTERNS = [
    'chatgpt.com',
    '*.chatgpt.com',
    'openai.com',
    '*.openai.com',
    'oaistatic.com',
    '*.oaistatic.com',
    'stripe.com',
    '*.stripe.com',
  ];
  const CHECKOUT_CONVERSION_PROXY_TEST_PROBE_ENDPOINTS = [
    'http://ip-api.com/json?lang=en',
    'https://ipinfo.io/json',
    'https://chatgpt.com/cdn-cgi/trace',
  ];
  const CHECKOUT_CONVERSION_PROXY_TEST_TARGET_ENDPOINTS = [
    'https://chatgpt.com/',
  ];
  const CHECKOUT_CONVERSION_PROXY_TEST_TARGET_HOST_PATTERNS = [
    ...CHECKOUT_CONVERSION_PROXY_TARGET_HOST_PATTERNS,
    'ip-api.com',
    '*.ip-api.com',
    'ipinfo.io',
    '*.ipinfo.io',
  ];
  const CLOUD_CHECKOUT_ALREADY_PAID_SOURCE = 'cloud-checkout-already-paid';
  const PLUS_CHECKOUT_PAYMENT_NODE_IDS = [
    'plus-checkout-billing',
    'paypal-approve',
    'plus-checkout-return',
    'gopay-subscription-confirm',
  ];

  function createPlusCheckoutCreateExecutor(deps = {}) {
    const {
      addLog: rawAddLog = async () => {},
      applyCheckoutScopedProxyFromUrl = null,
      broadcastDataUpdate = null,
      chrome,
      completeNodeFromBackground,
      createAutomationTab = null,
      enableHostedCheckoutAutomation = false,
      ensureContentScriptReadyOnTabUntilStopped,
      failNodeFromBackground = null,
      fetch: fetchImpl = null,
      getState = null,
      requestStop = null,
      registerTab,
      restoreCheckoutScopedProxySnapshot = null,
      sendTabMessageUntilStopped,
      setNodeStatus = null,
      setState,
      sleepWithStop,
      waitForTabCompleteUntilStopped,
      waitForTabUrlMatchUntilStopped = null,
      throwIfStopped = () => {},
    } = deps;

    function addLog(message, level = 'info', options = {}) {
      return rawAddLog(message, level, {
        step: 6,
        stepKey: 'plus-checkout-create',
        ...(options && typeof options === 'object' ? options : {}),
      });
    }

    function normalizePlusPaymentMethod(value = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.normalizePlusPaymentMethod) {
        return rootScope.GoPayUtils.normalizePlusPaymentMethod(value);
      }
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === PLUS_PAYMENT_METHOD_GPC_HELPER) {
        return PLUS_PAYMENT_METHOD_GPC_HELPER;
      }
      return normalized === PLUS_PAYMENT_METHOD_GOPAY ? PLUS_PAYMENT_METHOD_GOPAY : PLUS_PAYMENT_METHOD_PAYPAL;
    }

    function getCheckoutModeLabel(state = {}) {
      const paymentMethod = normalizePlusPaymentMethod(state?.plusPaymentMethod);
      if (paymentMethod === PLUS_PAYMENT_METHOD_GPC_HELPER) {
        return 'GPC 订阅页';
      }
      return paymentMethod === PLUS_PAYMENT_METHOD_GOPAY ? 'GoPay 订阅页' : 'Plus Checkout';
    }

    function getPlusPaymentMethodLabel(method = PLUS_PAYMENT_METHOD_PAYPAL) {
      const paymentMethod = normalizePlusPaymentMethod(method);
      if (paymentMethod === PLUS_PAYMENT_METHOD_GPC_HELPER) {
        return 'GPC';
      }
      return paymentMethod === PLUS_PAYMENT_METHOD_GOPAY ? 'GoPay' : 'PayPal';
    }

    function shouldWaitForHostedCheckoutSuccess(state = {}, paymentMethod = PLUS_PAYMENT_METHOD_PAYPAL) {
      return normalizePlusPaymentMethod(paymentMethod) === PLUS_PAYMENT_METHOD_PAYPAL
        && state?.plusHostedCheckoutIsFinalStep !== false;
    }

    function isCheckoutReadyUrl(url = '') {
      return CHECKOUT_READY_URL_PATTERN.test(String(url || ''));
    }

    function isPaymentsSuccessUrl(url = '') {
      return HOSTED_CHECKOUT_SUCCESS_URL_PATTERN.test(String(url || ''));
    }

    function isPayPalUrl(url = '') {
      return /paypal\./i.test(String(url || ''));
    }

    function isPayPalHermesUrl(url = '') {
      return /paypal\.com\/webapps\/hermes/i.test(String(url || ''));
    }

    function isHostedCheckoutNonFreeTrialFailure(error) {
      const message = String(typeof error === 'string' ? error : error?.message || '');
      return /PLUS_CHECKOUT_NON_FREE_TRIAL::|今日应付金额不是\s*0|没有免费试用资格/i.test(message);
    }

    function stripHostedCheckoutNonFreeTrialPrefix(message = '') {
      return String(message || '').replace(/^PLUS_CHECKOUT_NON_FREE_TRIAL::/i, '').trim();
    }

    function normalizeNonFreeTrialLogMessage(message = '', options = {}) {
      const normalized = stripHostedCheckoutNonFreeTrialPrefix(message);
      const fallback = '步骤 6：检测到当前账号没有免费试用资格。';
      if (!options?.willRetry) {
        return normalized || `${fallback}已自动停止整个流程。`;
      }
      return (normalized || fallback)
        .replace(/，?已自动停止整个流程。?/g, '')
        .replace(/当前账号没有免费试用资格。?$/g, '当前账号没有免费试用资格。');
    }

    function normalizeHostedCheckoutVerificationPopupDelaySeconds(
      value,
      fallback = HOSTED_CHECKOUT_VERIFICATION_POPUP_DELAY_DEFAULT_SECONDS
    ) {
      const rawValue = String(value ?? '').trim();
      const fallbackValue = Math.min(
        HOSTED_CHECKOUT_VERIFICATION_POPUP_DELAY_MAX_SECONDS,
        Math.max(
          HOSTED_CHECKOUT_VERIFICATION_POPUP_DELAY_MIN_SECONDS,
          Math.floor(Number(fallback) || HOSTED_CHECKOUT_VERIFICATION_POPUP_DELAY_DEFAULT_SECONDS)
        )
      );
      if (!rawValue) {
        return fallbackValue;
      }

      const numeric = Number(rawValue);
      if (!Number.isFinite(numeric)) {
        return fallbackValue;
      }

      return Math.min(
        HOSTED_CHECKOUT_VERIFICATION_POPUP_DELAY_MAX_SECONDS,
        Math.max(HOSTED_CHECKOUT_VERIFICATION_POPUP_DELAY_MIN_SECONDS, Math.floor(numeric))
      );
    }

    function normalizeCheckoutConversionProxyUrl(value = '') {
      return String(value || '').trim();
    }

    function normalizePlusCheckoutCloudConversionApiUrl(value = '') {
      const rawValue = String(value || '').trim();
      if (!rawValue) {
        return '';
      }
      try {
        const parsed = new URL(rawValue);
        parsed.hash = '';
        return parsed.toString();
      } catch {
        return rawValue;
      }
    }

    function isPlusCheckoutCloudConversionEnabled(state = {}, paymentMethod = PLUS_PAYMENT_METHOD_PAYPAL) {
      return normalizePlusPaymentMethod(paymentMethod) === PLUS_PAYMENT_METHOD_PAYPAL
        && Boolean(state?.plusCheckoutCloudConversionEnabled);
    }

    function getCheckoutBillingDetailsForPaymentMethod(paymentMethod = PLUS_PAYMENT_METHOD_PAYPAL) {
      return normalizePlusPaymentMethod(paymentMethod) === PLUS_PAYMENT_METHOD_GOPAY
        ? { country: 'ID', currency: 'IDR' }
        : { country: 'US', currency: 'USD' };
    }

    function formatCloudCheckoutErrorDetail(value, fallback = '') {
      if (typeof value === 'string') {
        return value.trim() || fallback;
      }
      if (value && typeof value === 'object') {
        return String(value.message || value.detail || value.error || JSON.stringify(value)).trim() || fallback;
      }
      return String(value ?? fallback).trim() || fallback;
    }

    function isDoneNodeStatus(status = '') {
      return ['completed', 'manual_completed', 'skipped'].includes(String(status || '').trim().toLowerCase());
    }

    function isCloudCheckoutAlreadyPaidMessage(value = '') {
      const message = formatCloudCheckoutErrorDetail(value);
      return /\buser\s+is\s+already\s+paid\b|already\s+(?:paid|subscribed)|already\s+has\s+(?:an?\s+)?(?:active\s+)?subscription|(?:用户|账号|账户)[\s\S]*(?:已|已经)[\s\S]*(?:付费|订阅|开通)|(?:已|已经)[\s\S]*(?:付费|订阅|开通)[\s\S]*(?:用户|账号|账户)|该账号已经开通过\s*ChatGPT\s*订阅套餐/i.test(message);
    }

    async function markPaymentNodesSkippedAfterAlreadyPaid(state = {}) {
      const latestState = typeof getState === 'function'
        ? await getState().catch(() => state || {})
        : (state || {});
      const nodeStatuses = latestState?.nodeStatuses && typeof latestState.nodeStatuses === 'object'
        ? latestState.nodeStatuses
        : {};
      const skippedNodes = [];
      const batchSkippedNodes = [];

      for (const nodeId of PLUS_CHECKOUT_PAYMENT_NODE_IDS) {
        if (!Object.prototype.hasOwnProperty.call(nodeStatuses, nodeId) || isDoneNodeStatus(nodeStatuses[nodeId])) {
          continue;
        }
        skippedNodes.push(nodeId);
        if (typeof setNodeStatus === 'function') {
          await setNodeStatus(nodeId, 'skipped');
        } else {
          batchSkippedNodes.push(nodeId);
        }
      }

      if (batchSkippedNodes.length && typeof setState === 'function') {
        const nextNodeStatuses = { ...nodeStatuses };
        for (const nodeId of batchSkippedNodes) {
          nextNodeStatuses[nodeId] = 'skipped';
        }
        await setState({ nodeStatuses: nextNodeStatuses });
      }

      return skippedNodes;
    }

    async function completeCloudCheckoutAlreadyPaid(tabId, result = {}, state = {}) {
      const detail = formatCloudCheckoutErrorDetail(result?.alreadyPaidDetail, 'User is already paid');
      const skippedNodes = await markPaymentNodesSkippedAfterAlreadyPaid(state);
      await setState({
        plusCheckoutTabId: Number(tabId) || null,
        plusCheckoutUrl: '',
        plusCheckoutCountry: result.country || 'US',
        plusCheckoutCurrency: result.currency || 'USD',
        plusReturnUrl: '',
        plusCheckoutSource: CLOUD_CHECKOUT_ALREADY_PAID_SOURCE,
        plusCheckoutAlreadyPaid: true,
        plusCheckoutAlreadyPaidAt: Date.now(),
        plusCheckoutAlreadyPaidDetail: detail,
      });
      await addLog(
        skippedNodes.length
          ? `步骤 6：云端服务确认当前用户已有订阅（${detail}），已跳过后续支付节点：${skippedNodes.join('、')}，继续下一流程节点。`
          : `步骤 6：云端服务确认当前用户已有订阅（${detail}），继续下一流程节点。`,
        'ok'
      );
      await completeNodeFromBackground('plus-checkout-create', {
        plusCheckoutCountry: result.country || 'US',
        plusCheckoutCurrency: result.currency || 'USD',
        plusCheckoutSource: CLOUD_CHECKOUT_ALREADY_PAID_SOURCE,
        plusCheckoutAlreadyPaid: true,
      });
    }

    function normalizeCheckoutConversionProxyProtocol(value = '') {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'socks5h') {
        return 'socks5';
      }
      return ['http', 'https', 'socks4', 'socks5'].includes(normalized) ? normalized : '';
    }

    function normalizeCheckoutConversionProxyPort(value = '') {
      const numeric = Number.parseInt(String(value || '').trim(), 10);
      if (!Number.isInteger(numeric) || numeric <= 0 || numeric > 65535) {
        return 0;
      }
      return numeric;
    }

    function parseCheckoutConversionProxyUrl(value = '') {
      const rawValue = normalizeCheckoutConversionProxyUrl(value);
      if (!rawValue) {
        return null;
      }

      let parsed = null;
      try {
        parsed = new URL(rawValue);
      } catch {
        throw new Error('支付转换代理不是有效 URL，请填写 http://host:port 或 socks5h://user:pass@host:port。');
      }

      const protocol = normalizeCheckoutConversionProxyProtocol(String(parsed.protocol || '').replace(/:$/g, ''));
      if (!protocol) {
        throw new Error('支付转换代理仅支持 http / https / socks4 / socks5 / socks5h。');
      }

      const host = String(parsed.hostname || '').trim();
      if (!host) {
        throw new Error('支付转换代理缺少主机名。');
      }

      const port = normalizeCheckoutConversionProxyPort(parsed.port);
      if (!port) {
        throw new Error('支付转换代理缺少有效端口。');
      }

      return {
        protocol,
        host,
        port,
        username: parsed.username ? decodeURIComponent(parsed.username) : '',
        password: parsed.password ? decodeURIComponent(parsed.password) : '',
      };
    }

    function describeCheckoutConversionProxyEntry(entry = null) {
      if (!entry || typeof entry !== 'object') {
        return '';
      }
      return `${String(entry.protocol || '').toLowerCase()}://${String(entry.host || '').trim()}:${Number(entry.port) || 0}`;
    }

    function buildCheckoutConversionProxyPacScript(entry = null, options = {}) {
      if (!entry?.host || !entry?.port) {
        return '';
      }
      let pacScheme = 'PROXY';
      if (entry.protocol === 'https') {
        pacScheme = 'HTTPS';
      } else if (entry.protocol === 'socks4') {
        pacScheme = 'SOCKS4';
      } else if (entry.protocol === 'socks5' || entry.protocol === 'socks5h') {
        pacScheme = 'SOCKS5';
      }
      const targetPatterns = (
        Array.isArray(options?.targetHostPatterns) && options.targetHostPatterns.length
          ? options.targetHostPatterns
          : CHECKOUT_CONVERSION_PROXY_TARGET_HOST_PATTERNS
      ).map((pattern) => `'${String(pattern).replace(/'/g, "\\'")}'`).join(', ');
      const bypassList = CHECKOUT_CONVERSION_PROXY_BYPASS_LIST
        .map((pattern) => `'${String(pattern).replace(/'/g, "\\'")}'`)
        .join(', ');
      const proxyEndpoint = `${pacScheme} ${entry.host}:${entry.port}`;
      return `
function FindProxyForURL(url, host) {
  if (!host) return "DIRECT";
  if (isInNet(host, "10.0.0.0", "255.0.0.0")
    || isInNet(host, "172.16.0.0", "255.240.0.0")
    || isInNet(host, "192.168.0.0", "255.255.0.0")
    || isInNet(host, "127.0.0.0", "255.0.0.0")) {
    return "DIRECT";
  }
  var bypassList = [${bypassList}];
  for (var i = 0; i < bypassList.length; i++) {
    var bypass = bypassList[i];
    if (shExpMatch(host, bypass) || host === bypass) {
      return "DIRECT";
    }
  }
  var targets = [${targetPatterns}];
  for (var j = 0; j < targets.length; j++) {
    var pattern = targets[j];
    if (pattern.indexOf('*.') === 0) {
      var suffix = pattern.substring(1);
      var direct = pattern.substring(2);
      if (dnsDomainIs(host, suffix) || host === direct) {
        return "${proxyEndpoint}";
      }
      continue;
    }
    if (host === pattern || dnsDomainIs(host, '.' + pattern)) {
      return "${proxyEndpoint}";
    }
  }
  return "DIRECT";
}`.trim();
    }

    function buildCheckoutConversionFixedProxyConfig(entry = null) {
      if (!entry?.host || !entry?.port) {
        return null;
      }
      const scheme = String(entry.protocol || '').trim().toLowerCase();
      return {
        mode: 'fixed_servers',
        rules: {
          singleProxy: {
            scheme: scheme === 'socks5h' ? 'socks5' : scheme,
            host: entry.host,
            port: entry.port,
          },
          bypassList: CHECKOUT_CONVERSION_PROXY_BYPASS_LIST.slice(),
        },
      };
    }

    function validateCheckoutProxyControlAfterApply(details = {}, entry = null) {
      const level = String(details?.levelOfControl || '').trim();
      if (level && level !== 'controlled_by_this_extension') {
        return {
          ok: false,
          message: `代理控制权不在当前扩展（levelOfControl=${level || 'unknown'}）`,
        };
      }

      const mode = String(details?.value?.mode || '').trim().toLowerCase();
      if (mode !== 'fixed_servers') {
        return {
          ok: false,
          message: `代理模式不是 fixed_servers（当前为 ${mode || 'unknown'}）`,
        };
      }

      const singleProxy = details?.value?.rules?.singleProxy || null;
      const appliedHost = String(singleProxy?.host || '').trim().toLowerCase();
      const appliedPort = Number.parseInt(String(singleProxy?.port || ''), 10) || 0;
      const expectedHost = String(entry?.host || '').trim().toLowerCase();
      const expectedPort = Number.parseInt(String(entry?.port || ''), 10) || 0;
      if (!appliedHost || !appliedPort || appliedHost !== expectedHost || appliedPort !== expectedPort) {
        return {
          ok: false,
          message: `fixed_servers 未绑定到当前代理节点 ${expectedHost}:${expectedPort}，疑似被其他代理配置覆盖`,
        };
      }

      return { ok: true };
    }

    function getCheckoutProxySettings(details = { incognito: false }) {
      const proxySettings = chrome?.proxy?.settings;
      if (!proxySettings || typeof proxySettings.get !== 'function') {
        return Promise.reject(new Error('当前浏览器不支持扩展代理 API。'));
      }
      return new Promise((resolve, reject) => {
        proxySettings.get(details, (value) => {
          const runtimeError = chrome?.runtime?.lastError;
          if (runtimeError) {
            reject(new Error(runtimeError.message || '读取浏览器代理配置失败。'));
            return;
          }
          resolve(value || {});
        });
      });
    }

    function setCheckoutProxySettings(value) {
      const proxySettings = chrome?.proxy?.settings;
      if (!proxySettings || typeof proxySettings.set !== 'function') {
        return Promise.reject(new Error('当前浏览器不支持扩展代理 API。'));
      }
      return new Promise((resolve, reject) => {
        proxySettings.set({
          value,
          scope: CHECKOUT_CONVERSION_PROXY_SETTINGS_SCOPE,
        }, () => {
          const runtimeError = chrome?.runtime?.lastError;
          if (runtimeError) {
            reject(new Error(runtimeError.message || '写入浏览器代理配置失败。'));
            return;
          }
          resolve();
        });
      });
    }

    function clearCheckoutProxySettings() {
      const proxySettings = chrome?.proxy?.settings;
      if (!proxySettings || typeof proxySettings.clear !== 'function') {
        return Promise.reject(new Error('当前浏览器不支持扩展代理 API。'));
      }
      return new Promise((resolve, reject) => {
        proxySettings.clear({
          scope: CHECKOUT_CONVERSION_PROXY_SETTINGS_SCOPE,
        }, () => {
          const runtimeError = chrome?.runtime?.lastError;
          if (runtimeError) {
            reject(new Error(runtimeError.message || '清理浏览器代理配置失败。'));
            return;
          }
          resolve();
        });
      });
    }

    async function defaultApplyCheckoutScopedProxyFromUrl(proxyUrl, options = {}) {
      const entry = parseCheckoutConversionProxyUrl(proxyUrl);
      if (!entry) {
        return null;
      }

      const previousProxySettings = await getCheckoutProxySettings({ incognito: false }).catch(() => ({}));
      const previousAuthEntry = typeof currentIpProxyAuthEntry === 'undefined'
        ? null
        : (currentIpProxyAuthEntry ? { ...currentIpProxyAuthEntry } : null);
      const fixedProxyConfig = buildCheckoutConversionFixedProxyConfig(entry);
      if (!fixedProxyConfig) {
        throw new Error('支付转换代理配置不完整，无法生成 fixed_servers 规则。');
      }

      try {
        if (typeof installIpProxyAuthListener === 'function') {
          installIpProxyAuthListener();
        }
        if (typeof installIpProxyErrorListener === 'function') {
          installIpProxyErrorListener();
        }
        if (typeof currentIpProxyAuthEntry !== 'undefined') {
          currentIpProxyAuthEntry = entry.username
            ? {
                host: entry.host,
                port: entry.port,
                username: entry.username,
                password: String(entry.password || ''),
              }
            : null;
        }
        await setCheckoutProxySettings(fixedProxyConfig);
        const appliedSettings = await getCheckoutProxySettings({ incognito: false }).catch(() => null);
        const takeoverCheck = validateCheckoutProxyControlAfterApply(appliedSettings || {}, entry);
        if (!takeoverCheck?.ok) {
          throw new Error(takeoverCheck.message || '支付转换代理接管校验失败。');
        }
      } catch (error) {
        if (typeof currentIpProxyAuthEntry !== 'undefined') {
          currentIpProxyAuthEntry = previousAuthEntry ? { ...previousAuthEntry } : null;
        }
        try {
          const restoreValue = previousProxySettings?.value;
          if (restoreValue && restoreValue.mode) {
            await setCheckoutProxySettings(restoreValue);
          } else {
            await clearCheckoutProxySettings();
          }
        } catch {
          // Ignore restore failures here and surface the original apply error.
        }
        throw error;
      }

      return {
        applied: true,
        entry,
        displayName: describeCheckoutConversionProxyEntry(entry),
        previousProxySettings,
        previousAuthEntry,
      };
    }

    async function defaultRestoreCheckoutScopedProxySnapshot(snapshot = null) {
      if (!snapshot?.applied) {
        return;
      }
      if (typeof currentIpProxyAuthEntry !== 'undefined') {
        currentIpProxyAuthEntry = snapshot.previousAuthEntry ? { ...snapshot.previousAuthEntry } : null;
      }
      const restoreValue = snapshot?.previousProxySettings?.value;
      if (restoreValue && restoreValue.mode) {
        await setCheckoutProxySettings(restoreValue);
        return;
      }
      await clearCheckoutProxySettings();
    }

    function summarizeCheckoutConversionProxyDiagnostics(items = [], maxItems = 3) {
      const normalizedItems = Array.isArray(items)
        ? Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean)))
        : [];
      if (!normalizedItems.length) {
        return '';
      }
      if (typeof buildProbeDiagnosticsSummary === 'function') {
        return buildProbeDiagnosticsSummary(normalizedItems, maxItems);
      }
      return normalizedItems.slice(0, Math.max(1, Number(maxItems) || 3)).join(' | ');
    }

    async function testCheckoutConversionProxy(options = {}) {
      const proxyUrl = normalizeCheckoutConversionProxyUrl(options?.proxyUrl);
      if (!proxyUrl) {
        throw new Error('请先填写支付转换代理地址。');
      }

      const parsedEntry = parseCheckoutConversionProxyUrl(proxyUrl);
      const applyProxy = typeof applyCheckoutScopedProxyFromUrl === 'function'
        ? applyCheckoutScopedProxyFromUrl
        : defaultApplyCheckoutScopedProxyFromUrl;
      const restoreProxy = typeof restoreCheckoutScopedProxySnapshot === 'function'
        ? restoreCheckoutScopedProxySnapshot
        : defaultRestoreCheckoutScopedProxySnapshot;
      const probeDiagnostics = [];
      const targetDiagnostics = [];
      let snapshot = null;

      try {
        snapshot = await applyProxy(proxyUrl, {
          targetHostPatterns: CHECKOUT_CONVERSION_PROXY_TEST_TARGET_HOST_PATTERNS,
        });

        let exit = null;
        if (typeof detectProxyExitInfoByPageContext === 'function') {
          exit = await detectProxyExitInfoByPageContext({
            timeoutMs: 12000,
            errors: probeDiagnostics,
            probeEndpoints: CHECKOUT_CONVERSION_PROXY_TEST_PROBE_ENDPOINTS,
          }).catch((error) => {
            probeDiagnostics.push(`probe:page_context:${error?.message || error}`);
            return { ip: '', region: '', source: 'page_context_unavailable', endpoint: '' };
          });
        }
        if (!exit?.ip && typeof detectProxyExitInfoByBackgroundFetch === 'function') {
          exit = await detectProxyExitInfoByBackgroundFetch({
            timeoutMs: 12000,
            errors: probeDiagnostics,
            probeEndpoints: CHECKOUT_CONVERSION_PROXY_TEST_PROBE_ENDPOINTS,
          }).catch((error) => {
            probeDiagnostics.push(`probe:background:${error?.message || error}`);
            return exit || { ip: '', region: '', source: 'background_unavailable', endpoint: '' };
          });
        }

        const exitIp = String(exit?.ip || '').trim();
        const exitRegion = String(exit?.region || '').trim();
        if (!exitIp) {
          const diagnostics = summarizeCheckoutConversionProxyDiagnostics(probeDiagnostics, 4);
          throw new Error(diagnostics
            ? `未检测到代理出口 IP。诊断：${diagnostics}`
            : '未检测到代理出口 IP。');
        }

        let reachability = { reachable: true, skipped: true, endpoint: '', source: '' };
        if (typeof detectIpProxyTargetReachabilityByPageContext === 'function') {
          reachability = await detectIpProxyTargetReachabilityByPageContext({
            timeoutMs: 12000,
            errors: targetDiagnostics,
            targetReachabilityEndpoints: CHECKOUT_CONVERSION_PROXY_TEST_TARGET_ENDPOINTS,
          }).catch((error) => {
            targetDiagnostics.push(`target:${error?.message || error}`);
            return {
              reachable: false,
              endpoint: CHECKOUT_CONVERSION_PROXY_TEST_TARGET_ENDPOINTS[0],
              source: 'target_page_context',
              error: error?.message || String(error || '目标站点连通性检测失败'),
            };
          });
        }

        if (reachability?.reachable === false && reachability?.skipped !== true) {
          const failureMessage = typeof buildTargetReachabilityFailureMessage === 'function'
            ? buildTargetReachabilityFailureMessage({
              exitIp,
              exitRegion,
            }, reachability)
            : `已检测到出口 IP ${exitIp}${exitRegion ? ` [${exitRegion}]` : ''}，但 chatgpt.com 不可达。`;
          throw new Error(failureMessage);
        }

        return {
          ok: true,
          proxyDisplayName: describeCheckoutConversionProxyEntry(parsedEntry),
          exitIp,
          exitRegion,
          exitSource: String(exit?.source || '').trim(),
          exitEndpoint: String(exit?.endpoint || '').trim(),
          targetEndpoint: String(reachability?.endpoint || CHECKOUT_CONVERSION_PROXY_TEST_TARGET_ENDPOINTS[0] || '').trim(),
          diagnostics: summarizeCheckoutConversionProxyDiagnostics([
            ...probeDiagnostics,
            ...targetDiagnostics,
          ], 4),
        };
      } finally {
        if (snapshot?.applied) {
          await restoreProxy(snapshot).catch(() => {});
        }
      }
    }

    async function maybeApplyCheckoutConversionProxy(state = {}, paymentMethod = PLUS_PAYMENT_METHOD_PAYPAL) {
      if (normalizePlusPaymentMethod(paymentMethod) !== PLUS_PAYMENT_METHOD_PAYPAL) {
        return null;
      }
      if (isPlusCheckoutCloudConversionEnabled(state, paymentMethod)) {
        const proxyUrl = normalizeCheckoutConversionProxyUrl(state?.plusCheckoutConversionProxyUrl);
        if (proxyUrl) {
          await addLog('步骤 6：已启用云端支付转换，本地支付转换代理配置已忽略。', 'info');
        }
        return null;
      }
      const proxyUrl = normalizeCheckoutConversionProxyUrl(state?.plusCheckoutConversionProxyUrl);
      if (!proxyUrl) {
        return null;
      }
      const applyProxy = typeof applyCheckoutScopedProxyFromUrl === 'function'
        ? applyCheckoutScopedProxyFromUrl
        : defaultApplyCheckoutScopedProxyFromUrl;
      const snapshot = await applyProxy(proxyUrl, {
        targetHostPatterns: CHECKOUT_CONVERSION_PROXY_TARGET_HOST_PATTERNS,
      });
      const displayName = String(snapshot?.displayName || describeCheckoutConversionProxyEntry(snapshot?.entry) || proxyUrl).trim();
      await addLog(`步骤 6：已启用支付转换代理 ${displayName}，仅临时接管 checkout session 到 hosted checkout 的跳转链路。`, 'info');
      return snapshot;
    }

    async function maybeRestoreCheckoutConversionProxy(snapshot = null) {
      if (!snapshot?.applied) {
        return;
      }
      const restoreProxy = typeof restoreCheckoutScopedProxySnapshot === 'function'
        ? restoreCheckoutScopedProxySnapshot
        : defaultRestoreCheckoutScopedProxySnapshot;
      await restoreProxy(snapshot);
      await addLog('步骤 6：支付转换代理已释放，后续步骤恢复原网络/原代理环境。', 'info');
    }

    function normalizeHostedCheckoutPoolText(value = '') {
      return String(value || '')
        .replace(/\r/g, '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n');
    }

    function normalizeHostedCheckoutUsPhoneDigits(value = '') {
      const rawValue = String(value || '').trim();
      const digits = rawValue.replace(/\D+/g, '');
      if (digits.length === 11 && digits.startsWith('1')) {
        return digits.slice(1);
      }
      return digits || rawValue;
    }

    function normalizeHostedCheckoutPoolPhone(value = '') {
      return normalizeHostedCheckoutUsPhoneDigits(value);
    }

    function normalizeHostedCheckoutPoolUrl(value = '') {
      const rawValue = String(value || '').trim();
      if (!rawValue) {
        return '';
      }
      try {
        const parsed = new URL(rawValue);
        parsed.searchParams.delete('t');
        return parsed.toString();
      } catch {
        return rawValue
          .replace(/([?&])t=\d+(?=(&|$))/i, '$1')
          .replace(/[?&]$/g, '');
      }
    }

    function buildHostedCheckoutPoolKey(phone = '', verificationUrl = '') {
      const normalizedPhone = normalizeHostedCheckoutPoolPhone(phone);
      const normalizedUrl = normalizeHostedCheckoutPoolUrl(verificationUrl);
      return normalizedPhone && normalizedUrl
        ? `${normalizedPhone}${HOSTED_CHECKOUT_SMS_POOL_SEPARATOR}${normalizedUrl}`
        : '';
    }

    function isHostedCheckoutSampleEntry(phone = '', verificationUrl = '') {
      return normalizeHostedCheckoutPoolPhone(phone) === HOSTED_CHECKOUT_SAMPLE_PHONE
        && normalizeHostedCheckoutPoolUrl(verificationUrl) === HOSTED_CHECKOUT_SAMPLE_VERIFICATION_URL;
    }

    function parseHostedCheckoutSmsPoolEntries(text = '') {
      const lines = normalizeHostedCheckoutPoolText(text).split('\n').filter(Boolean);
      const seen = new Set();
      const entries = [];
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const separatorIndex = line.indexOf(HOSTED_CHECKOUT_SMS_POOL_SEPARATOR);
        const hasSeparator = separatorIndex > 0;
        const phone = hasSeparator
          ? normalizeHostedCheckoutPoolPhone(line.slice(0, separatorIndex))
          : normalizeHostedCheckoutPoolPhone(line);
        const verificationUrl = hasSeparator
          ? normalizeHostedCheckoutPoolUrl(line.slice(separatorIndex + HOSTED_CHECKOUT_SMS_POOL_SEPARATOR.length))
          : normalizeHostedCheckoutPoolUrl(lines[index + 1] || '');
        if (!hasSeparator && verificationUrl) {
          index += 1;
        }
        const key = buildHostedCheckoutPoolKey(phone, verificationUrl);
        if (!phone || !verificationUrl || !key || seen.has(key) || isHostedCheckoutSampleEntry(phone, verificationUrl)) {
          continue;
        }
        seen.add(key);
        entries.push({
          index: entries.length,
          key,
          phone,
          verificationUrl,
        });
      }
      return entries;
    }

    function normalizeHostedCheckoutSmsPoolUsage(value = {}) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
      }
      return Object.fromEntries(Object.entries(value).map(([key, item]) => {
        const usage = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
        const legacyUsedCount = Number(usage.usedAt) > 0 ? 1 : 0;
        const useCount = Math.max(0, Math.floor(Number(usage.useCount ?? usage.usageCount ?? legacyUsedCount) || 0));
        return [String(key || '').trim(), {
          useCount,
          usedAt: Math.max(0, Number(usage.usedAt) || 0),
          lastAttemptAt: Math.max(0, Number(usage.lastAttemptAt) || 0),
          lastError: String(usage.lastError || '').trim(),
          disabledUntil: Math.max(0, Number(usage.disabledUntil) || 0),
          unavailableCount: Math.max(0, Math.floor(Number(usage.unavailableCount) || 0)),
          lastUnavailableAt: Math.max(0, Number(usage.lastUnavailableAt) || 0),
        }];
      }).filter(([key]) => Boolean(key)));
    }

    function normalizeHostedCheckoutCurrentSmsEntry(entry = null, entries = []) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null;
      }
      const key = String(
        entry.key
        || buildHostedCheckoutPoolKey(entry.phone, entry.verificationUrl)
      ).trim();
      if (!key) {
        return null;
      }
      const matchedEntry = Array.isArray(entries)
        ? entries.find((candidate) => candidate.key === key)
        : null;
      if (matchedEntry) {
        return { ...matchedEntry };
      }
      const phone = normalizeHostedCheckoutPoolPhone(entry.phone);
      const verificationUrl = normalizeHostedCheckoutPoolUrl(entry.verificationUrl);
      if (!phone || !verificationUrl) {
        return null;
      }
      return {
        key,
        phone,
        verificationUrl,
      };
    }

    function chooseHostedCheckoutSmsPoolEntry(entries = [], usage = {}) {
      if (!Array.isArray(entries) || entries.length === 0) {
        return null;
      }
      const normalizedUsage = normalizeHostedCheckoutSmsPoolUsage(usage);
      const now = Date.now();
      const candidates = entries
        .map((entry, index) => {
          const itemUsage = normalizedUsage[entry.key] || {};
          const disabledUntil = Math.max(0, Number(itemUsage.disabledUntil) || 0);
          return {
            ...entry,
            index: Number.isFinite(entry.index) ? entry.index : index,
            useCount: Math.max(0, Math.floor(Number(itemUsage.useCount) || 0)),
            usedAt: Math.max(0, Number(itemUsage.usedAt) || 0),
            disabledUntil,
            disabled: disabledUntil > now,
          };
        })
        .filter((entry) => !entry.disabled);
      if (candidates.length === 0) {
        return null;
      }
      return candidates
        .sort((left, right) => {
          if (left.useCount !== right.useCount) {
            return left.useCount - right.useCount;
          }
          if (left.usedAt !== right.usedAt) {
            return left.usedAt - right.usedAt;
          }
          return left.index - right.index;
        })[0] || null;
    }

    function buildHostedCheckoutConfigDiagnostics({
      state = {},
      stored = {},
      poolEntries = [],
      selectedSmsEntry = null,
    } = {}) {
      return {
        stateHostedCheckoutPhoneNumber: String(state?.hostedCheckoutPhoneNumber || '').trim(),
        localHostedCheckoutPhoneNumber: String(stored?.hostedCheckoutPhoneNumber || '').trim(),
        stateHostedCheckoutVerificationUrl: String(state?.hostedCheckoutVerificationUrl || '').trim(),
        localHostedCheckoutVerificationUrl: String(stored?.hostedCheckoutVerificationUrl || '').trim(),
        stateHostedCheckoutSmsPoolTextLines: parseHostedCheckoutSmsPoolEntries(state?.hostedCheckoutSmsPoolText || '').length,
        localHostedCheckoutSmsPoolTextLines: parseHostedCheckoutSmsPoolEntries(stored?.hostedCheckoutSmsPoolText || '').length,
        effectiveHostedSmsPoolEntries: Array.isArray(poolEntries) ? poolEntries.length : 0,
        selectedHostedSmsPoolPhone: String(selectedSmsEntry?.phone || '').trim(),
        selectedHostedSmsPoolVerificationUrl: String(selectedSmsEntry?.verificationUrl || '').trim(),
      };
    }

    async function applyHostedCheckoutRuntimePatch(patch = {}) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).length === 0) {
        return;
      }
      if (typeof setState === 'function') {
        await setState(patch);
      }
      if (typeof broadcastDataUpdate === 'function') {
        broadcastDataUpdate(patch);
      }
    }

    async function clearHostedCheckoutCurrentSmsEntry() {
      await applyHostedCheckoutRuntimePatch({
        hostedCheckoutCurrentSmsEntry: null,
      });
    }

    async function updateHostedCheckoutPoolUsage(entry = null, options = {}) {
      const normalizedEntry = normalizeHostedCheckoutCurrentSmsEntry(entry);
      if (!normalizedEntry?.key || typeof getState !== 'function') {
        return null;
      }
      const state = await getState().catch(() => ({}));
      const usage = normalizeHostedCheckoutSmsPoolUsage(state?.hostedCheckoutSmsPoolUsage || {});
      const previous = usage[normalizedEntry.key] || {};
      const now = Date.now();
      const incrementUseCount = Boolean(options.incrementUseCount);
      const success = options.success === true;
      const previousDisabledUntil = Math.max(0, Number(previous.disabledUntil) || 0);
      // 显式传入 disabledUntil 时直接覆盖（包含传 0 表示清除冷却）；
      // 未显式传入时保留上次的 disabledUntil 值。
      const hasExplicitDisabledUntil = Object.prototype.hasOwnProperty.call(options, 'disabledUntil');
      const nextDisabledUntil = hasExplicitDisabledUntil
        ? Math.max(0, Number(options.disabledUntil) || 0)
        : (success ? 0 : previousDisabledUntil);
      const previousUnavailableCount = Math.max(0, Math.floor(Number(previous.unavailableCount) || 0));
      const incrementUnavailable = Boolean(options.incrementUnavailable);
      const resetUnavailable = Boolean(options.resetUnavailable);
      const nextUnavailableCount = (() => {
        if (resetUnavailable) return 0;
        if (incrementUnavailable) return previousUnavailableCount + 1;
        return previousUnavailableCount;
      })();
      const nextLastUnavailableAt = incrementUnavailable
        ? now
        : (resetUnavailable ? 0 : Math.max(0, Number(previous.lastUnavailableAt) || 0));
      const nextUsage = {
        ...usage,
        [normalizedEntry.key]: {
          useCount: incrementUseCount
            ? Math.max(0, Math.floor(Number(previous.useCount) || 0)) + 1
            : Math.max(0, Math.floor(Number(previous.useCount) || 0)),
          usedAt: incrementUseCount
            ? now
            : Math.max(0, Number(previous.usedAt) || 0),
          lastAttemptAt: now,
          lastError: success ? '' : String(options.error || '').trim(),
          disabledUntil: nextDisabledUntil,
          unavailableCount: nextUnavailableCount,
          lastUnavailableAt: nextLastUnavailableAt,
        },
      };
      await applyHostedCheckoutRuntimePatch({
        hostedCheckoutCurrentSmsEntry: normalizedEntry,
        hostedCheckoutSmsPoolUsage: nextUsage,
      });
      return nextUsage;
    }

    async function getHostedCheckoutRuntimeConfig(options = {}) {
      const {
        ensureCurrentSmsEntry = false,
      } = options || {};
      const state = typeof getState === 'function' ? await getState().catch(() => ({})) : {};
      let stored = {};
      if (chrome?.storage?.local?.get) {
        stored = await chrome.storage.local.get([
          'hostedCheckoutVerificationUrl',
          'hostedCheckoutVerificationPopupDelaySeconds',
          'hostedCheckoutPhoneNumber',
          'hostedCheckoutSmsPoolText',
          'hostedCheckoutSmsPoolUsage',
        ]).catch(() => ({}));
      }
      const poolEntries = parseHostedCheckoutSmsPoolEntries(
        stored?.hostedCheckoutSmsPoolText
        || state?.hostedCheckoutSmsPoolText
        || ''
      );
      const poolUsage = normalizeHostedCheckoutSmsPoolUsage(
        stored?.hostedCheckoutSmsPoolUsage
        || state?.hostedCheckoutSmsPoolUsage
        || {}
      );
      let selectedSmsEntry = normalizeHostedCheckoutCurrentSmsEntry(state?.hostedCheckoutCurrentSmsEntry, poolEntries);
      if (!selectedSmsEntry && ensureCurrentSmsEntry && poolEntries.length > 0) {
        selectedSmsEntry = chooseHostedCheckoutSmsPoolEntry(poolEntries, poolUsage);
        if (selectedSmsEntry) {
          const nextUsage = await updateHostedCheckoutPoolUsage(selectedSmsEntry, {
            incrementUseCount: true,
            success: true,
          });
          await addLog(
            `步骤 6：PayPal 接码池已选择号码 ${selectedSmsEntry.phone}（最少使用次数优先，当前累计 ${Math.max(0, Number(nextUsage?.[selectedSmsEntry.key]?.useCount) || 0)} 次）。`,
            'info'
          );
        }
      }
      const verificationUrl = String(
        selectedSmsEntry?.verificationUrl
        || (
          poolEntries.length > 0 && !selectedSmsEntry
            ? chooseHostedCheckoutSmsPoolEntry(poolEntries, poolUsage)?.verificationUrl
            : ''
        )
        || ''
      ).trim() || String(
        stored?.hostedCheckoutVerificationUrl
        || state?.hostedCheckoutVerificationUrl
        || ''
      ).trim();
      const phone = String(
        selectedSmsEntry?.phone
        || (
          poolEntries.length > 0 && !selectedSmsEntry
            ? chooseHostedCheckoutSmsPoolEntry(poolEntries, poolUsage)?.phone
            : ''
        )
        || ''
      ).trim() || String(
        stored?.hostedCheckoutPhoneNumber
        || state?.hostedCheckoutPhoneNumber
        || ''
      ).trim();
      const verificationPopupDelaySeconds = normalizeHostedCheckoutVerificationPopupDelaySeconds(
        stored?.hostedCheckoutVerificationPopupDelaySeconds ?? state?.hostedCheckoutVerificationPopupDelaySeconds
      );
      const diagnostics = buildHostedCheckoutConfigDiagnostics({
        state,
        stored,
        poolEntries,
        selectedSmsEntry,
      });
      return {
        verificationUrl,
        verificationPopupDelaySeconds,
        phone,
        hostedCheckoutCurrentSmsEntry: selectedSmsEntry,
        hostedCheckoutUsesSmsPool: Boolean(selectedSmsEntry),
        diagnostics,
      };
    }

    async function waitForCheckoutSurface(tabId) {
      if (!chrome?.tabs?.get) {
        return null;
      }
      if (typeof waitForTabUrlMatchUntilStopped === 'function') {
        try {
          return await Promise.race([
            waitForTabUrlMatchUntilStopped(tabId, (url) => isCheckoutReadyUrl(url)),
            new Promise((resolve) => {
              setTimeout(() => resolve(null), CHECKOUT_REDIRECT_WAIT_TIMEOUT_MS);
            }),
          ]);
        } catch {
          return null;
        }
      }

      const startedAt = Date.now();
      while (Date.now() - startedAt < CHECKOUT_REDIRECT_WAIT_TIMEOUT_MS) {
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (!tab) {
          return null;
        }
        if (isCheckoutReadyUrl(tab.url || '')) {
          return tab;
        }
        await sleepWithStop(300);
      }
      return null;
    }

    async function waitForUrlMatch(tabId, matcher, timeoutMs = 30000, retryDelayMs = 400) {
      if (typeof waitForTabUrlMatchUntilStopped === 'function') {
        const timeout = Date.now() + Math.max(1000, Number(timeoutMs) || 30000);
        while (Date.now() < timeout) {
          throwIfStopped();
          const remainingMs = Math.max(1000, timeout - Date.now());
          const result = await Promise.race([
            waitForTabUrlMatchUntilStopped(tabId, matcher, { retryDelayMs }),
            new Promise((resolve) => {
              setTimeout(() => resolve(null), Math.min(remainingMs, 1000));
            }),
          ]);
          if (result) {
            return result;
          }
        }
        return null;
      }

      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        throwIfStopped();
        const tab = await chrome?.tabs?.get?.(tabId).catch(() => null);
        if (!tab) {
          return null;
        }
        if (typeof matcher === 'function' && matcher(tab.url || '', tab)) {
          return tab;
        }
        await sleepWithStop(retryDelayMs);
      }
      return null;
    }

    async function openFreshChatGptTabForCheckoutCreate() {
      const tab = typeof createAutomationTab === 'function'
        ? await createAutomationTab({ url: PLUS_CHECKOUT_ENTRY_URL, active: true })
        : await chrome.tabs.create({ url: PLUS_CHECKOUT_ENTRY_URL, active: true });
      const tabId = Number(tab?.id);
      if (!Number.isInteger(tabId)) {
        throw new Error('步骤 6：打开 ChatGPT 页面失败，无法创建订阅页。');
      }
      if (typeof registerTab === 'function') {
        await registerTab(PLUS_CHECKOUT_SOURCE, tabId);
      }
      return tabId;
    }

    function buildHostedCheckoutRandomEmail() {
      const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let localPart = '';
      for (let index = 0; index < 16; index += 1) {
        localPart += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      return `${localPart}@gmail.com`;
    }

    function buildHostedCheckoutRandomPassword() {
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const digits = '0123456789';
      const symbols = '!@#$%^';
      const alphabet = `${lowercase}${uppercase}${digits}${symbols}`;
      const values = [
        lowercase[Math.floor(Math.random() * lowercase.length)],
        uppercase[Math.floor(Math.random() * uppercase.length)],
        digits[Math.floor(Math.random() * digits.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
      ];
      while (values.length < 14) {
        values.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
      }
      return values.sort(() => Math.random() - 0.5).join('');
    }

    function buildHostedCheckoutVisaCard() {
      const prefixes = [
        [4, 1, 4, 7],
        [4, 1, 0, 0],
      ];
      const digits = prefixes[Math.floor(Math.random() * prefixes.length)].slice();
      while (digits.length < 15) {
        digits.push(Math.floor(Math.random() * 10));
      }
      const reversed = digits.slice().reverse();
      let sum = 0;
      for (let index = 0; index < reversed.length; index += 1) {
        let digit = reversed[index];
        if (index % 2 === 0) {
          digit *= 2;
          if (digit > 9) {
            digit -= 9;
          }
        }
        sum += digit;
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      digits.push(checkDigit);
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      const currentYear = new Date().getFullYear() % 100;
      const year = currentYear + Math.floor(Math.random() * 4) + 2;
      const cvv = String(Math.floor(100 + Math.random() * 900));
      return {
        number: digits.join(''),
        expiry: `${month} / ${year}`,
        cvv,
      };
    }

    async function fetchHostedCheckoutAddress() {
      const { response, data } = await fetchJsonWithTimeout(HOSTED_CHECKOUT_ADDRESS_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: '/',
          method: 'address',
        }),
      }, 30000);
      if (!response?.ok) {
        throw new Error(`获取 hosted checkout 地址失败（HTTP ${response?.status || 0}）。`);
      }
      const address = data?.address || data || {};
      return {
        street: String(address.Address || address.street || '123 Main St').trim(),
        city: String(address.City || address.city || 'New York').trim(),
        state: String(address.State_Full || address.State || address.state || 'New York').trim(),
        zip: String(address.Zip_Code || address.zip || '10001').trim().slice(0, 5) || '10001',
      };
    }

    function buildHostedCheckoutAddressSeed(address = {}) {
      return {
        countryCode: 'US',
        skipAutocomplete: true,
        autoCheckAgreement: true,
        fallback: {
          address1: String(address.street || '123 Main St').trim(),
          city: String(address.city || 'New York').trim(),
          region: String(address.state || 'New York').trim(),
          postalCode: String(address.zip || '10001').trim(),
        },
      };
    }

    function buildHostedCheckoutGuestProfile(address = {}, config = {}) {
      const card = buildHostedCheckoutVisaCard();
      return {
        email: buildHostedCheckoutRandomEmail(),
        password: buildHostedCheckoutRandomPassword(),
        phone: String(config?.phone || '').trim(),
        firstName: 'James',
        lastName: 'Smith',
        fullName: 'James Smith',
        cardNumber: card.number,
        cardExpiry: card.expiry,
        cardCvv: card.cvv,
        address,
      };
    }

    function hostedCheckoutPayloadIndicatesNoSms(payload = {}) {
      // 把整段响应铺平成一段字符串，用于识别"暂无验证码 / no sms / no message" 这类"没新短信"的语义提示。
      let aggregated = '';
      const seenLocal = new Set();
      function walk(value) {
        if (value === null || value === undefined) return;
        if (typeof value === 'string' || typeof value === 'number') {
          aggregated += `${value} `;
          return;
        }
        if (typeof value !== 'object') return;
        if (seenLocal.has(value)) return;
        seenLocal.add(value);
        if (Array.isArray(value)) {
          value.forEach(walk);
        } else {
          Object.values(value).forEach(walk);
        }
      }
      walk(payload);
      const text = aggregated.trim();
      if (!text) return false;
      // 中文："暂无/没有/未收到/尚未/无" + "验证码/短信/消息"
      if (/(?:暂无|没有|未收到|尚未|未到达|未刷新)\s*(?:验证码|短信|消息|新.{0,4}短信)/.test(text)) {
        return true;
      }
      // 英文：no/none/empty/null/pending + sms/code/message/data
      if (/\b(?:no|none|empty|null|pending|not\s+received)\s+(?:new\s+)?(?:sms|code|message|messages|verification|otp|data|record)/i.test(text)) {
        return true;
      }
      // 接码服务常见的 "no|..." / "false|..." 起始标识。
      if (/^\s*(?:no|false|fail|failed|error|err)\s*(?:\||,|:)/i.test(text)) {
        return true;
      }
      return false;
    }

    function extractHostedCheckoutVerificationCode(payload = {}) {
      // 上游接口在"没新短信"时常返回 `no|暂无验证码|到期时间：YYYY-MM-DD` 之类，
      // 这种情况下我们直接判定为暂无验证码，否则下面正则会把 YYYY-MM-DD 当成 6 位数字 (202607) 误识别。
      if (hostedCheckoutPayloadIndicatesNoSms(payload)) {
        return '';
      }
      const trustedTextKeyPattern = /^(sms|message|msg|text|content|body|code|otp|verification_code|verificationCode)$/i;
      const metadataKeyPattern = /(^|[_-])(phone|mobile|tel|id|order|time|date|expired|expire|status)([_-]|$)/i;
      // 关键词收紧：standalone "code" 移除（很多 SMS 接口在没有新短信时会返回类似
      // "Error code 100001" / "status code 200" 的公共错误页，旧规则会把状态码当成验证码）。
      // 仅保留与"验证/安全/动态密码"明确相关的强上下文词。
      const KEYWORD = '(?:security\\s*code|verification\\s*code|one[-\\s]?time\\s*(?:passcode|code)|passcode|otp|verification|verify|验证码|安全码|动态密码|登录码)';
      // 6 位数字之间只允许"无分隔"或"空格"，不再允许 dash —— 不然 `2026-07-29` 这种日期会被当成 `202607`。
      const DIGITS = '(\\d\\s?\\d\\s?\\d\\s?\\d\\s?\\d\\s?\\d)';
      // 关键词与 6 位数字的间距从 50 缩短为 30，避免跨段误匹配。
      const contextualCodePattern = new RegExp(
        `${KEYWORD}[\\s\\S]{0,30}?${DIGITS}|${DIGITS}[\\s\\S]{0,30}?${KEYWORD}`,
        'i'
      );
      // 单字段精确匹配（如 `code: "201412"`）也禁止 dash。
      const exactCodePattern = /^\D*(\d\s?\d\s?\d\s?\d\s?\d\s?\d)\D*$/;
      const seen = new Set();
      function collectCandidates(value, path = '') {
        if (value === null || value === undefined) {
          return [];
        }
        if (typeof value === 'string' || typeof value === 'number') {
          const text = String(value).trim();
          return text ? [{
            key: String(path).split('.').pop() || '',
            path,
            text,
          }] : [];
        }
        if (typeof value !== 'object') {
          return [];
        }
        if (seen.has(value)) {
          return [];
        }
        seen.add(value);
        if (Array.isArray(value)) {
          return value.flatMap((item, index) => collectCandidates(item, `${path}[${index}]`));
        }
        return Object.entries(value).flatMap(([key, child]) => (
          collectCandidates(child, path ? `${path}.${key}` : key)
        ));
      }

      function extractContextualCode(text) {
        const match = String(text || '').match(contextualCodePattern);
        return match ? (match[1] || match[2]).replace(/\D+/g, '') : '';
      }

      const candidates = collectCandidates(payload);

      for (const candidate of candidates) {
        const code = extractContextualCode(candidate.text);
        if (code) {
          return code;
        }
      }

      for (const candidate of candidates) {
        const key = String(candidate.key || '');
        const path = String(candidate.path || '');
        const isRootText = !path;
        if (!isRootText && (!trustedTextKeyPattern.test(key) || metadataKeyPattern.test(key) || metadataKeyPattern.test(path))) {
          continue;
        }
        const match = candidate.text.match(exactCodePattern);
        if (match) {
          return match[1].replace(/\D+/g, '');
        }
      }

      return '';
    }

    function extractHostedCheckoutVerificationCodeTimestamp(payload = {}) {
      // 在接码池/SMS 接口返回里找一个可用的"短信发出时间"。
      // 优先字段：以 _time / _at / _date 结尾，或精确匹配 time/timestamp/date 等的字段，
      // 但要排除 expire(d)/expiry（这些是订阅截止时间，不是短信时间）。
      const acceptedKeyPattern = /(^|[_-])(code|sms|message|msg|text|content|body|recv|received|sent|send|created|update|updated|notify|notified)[_-](time|at|date|datetime|timestamp|ts)$|^(time|timestamp|ts|date|datetime|sent_at|sentAt|created_at|createdAt|received_at|receivedAt)$/i;
      const excludedKeyPattern = /expire|expiry|expir|deadline|valid_until|validUntil/i;
      const seen = new Set();

      function collect(value, path = '', key = '') {
        if (value === null || value === undefined) {
          return [];
        }
        if (typeof value === 'string' || typeof value === 'number') {
          return [{ key, path, value }];
        }
        if (typeof value !== 'object') {
          return [];
        }
        if (seen.has(value)) {
          return [];
        }
        seen.add(value);
        if (Array.isArray(value)) {
          return value.flatMap((item, index) => collect(item, `${path}[${index}]`, ''));
        }
        return Object.entries(value).flatMap(([childKey, childValue]) => (
          collect(childValue, path ? `${path}.${childKey}` : childKey, childKey)
        ));
      }

      function parseTimestamp(value) {
        if (value === null || value === undefined || value === '') {
          return null;
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          // 容忍秒级或毫秒级时间戳。
          const ms = value > 1e12 ? value : value * 1000;
          const date = new Date(ms);
          return Number.isFinite(date.getTime()) ? date : null;
        }
        const text = String(value).trim();
        if (!text) {
          return null;
        }
        if (/^\d{10,13}$/.test(text)) {
          const numeric = Number(text);
          const ms = numeric > 1e12 ? numeric : numeric * 1000;
          const date = new Date(ms);
          return Number.isFinite(date.getTime()) ? date : null;
        }
        // "2026-05-22 12:25:10" -> 把空格转成 T 让 Date 正确按本地时区解析。
        const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(text)
          ? text.replace(' ', 'T')
          : text;
        const date = new Date(normalized);
        return Number.isFinite(date.getTime()) && date.getTime() > 0 ? date : null;
      }

      const candidates = collect(payload).filter((candidate) => {
        const key = String(candidate.key || '');
        const path = String(candidate.path || '');
        if (!acceptedKeyPattern.test(key)) {
          return false;
        }
        return !(excludedKeyPattern.test(key) || excludedKeyPattern.test(path));
      });

      let bestDate = null;
      let bestText = '';
      for (const candidate of candidates) {
        const date = parseTimestamp(candidate.value);
        if (!date) {
          continue;
        }
        if (!bestDate || date.getTime() > bestDate.getTime()) {
          bestDate = date;
          bestText = String(candidate.value).trim();
        }
      }

      if (!bestDate) {
        return { codeTime: '', codeTimeMs: 0, codeTimeText: '' };
      }
      return {
        codeTime: bestDate.toISOString(),
        codeTimeMs: bestDate.getTime(),
        codeTimeText: bestText,
      };
    }

    async function fetchHostedCheckoutVerificationCode() {
      const runtimeConfig = await getHostedCheckoutRuntimeConfig({
        ensureCurrentSmsEntry: true,
      });
      const verificationUrl = runtimeConfig.verificationUrl;
      await addLog(`步骤 6：当前 hosted checkout 验证码接口配置为 ${verificationUrl || '(空)'}。`, 'info');
      const fetcher = typeof fetchImpl === 'function'
        ? fetchImpl
        : (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
      if (typeof fetcher !== 'function') {
        throw new Error('当前运行环境不支持 fetch，无法获取 hosted checkout 验证码。');
      }
      if (!verificationUrl) {
        throw new Error('当前未配置 hosted checkout 验证码接口地址。');
      }
      const separator = verificationUrl.includes('?') ? '&' : '?';
      const response = await fetcher(`${verificationUrl}${separator}t=${Date.now()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json,text/plain,*/*',
        },
      });
      const text = await response.text().catch(() => '');
      let payload = text;
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = text;
      }
      const code = extractHostedCheckoutVerificationCode(payload);
      if (!code) {
        if (runtimeConfig.hostedCheckoutUsesSmsPool && runtimeConfig.hostedCheckoutCurrentSmsEntry) {
          await updateHostedCheckoutPoolUsage(runtimeConfig.hostedCheckoutCurrentSmsEntry, {
            success: false,
            error: 'hosted checkout 验证码接口暂未返回有效验证码。',
          });
        }
        throw new Error('hosted checkout 验证码接口暂未返回有效验证码。');
      }
      if (runtimeConfig.hostedCheckoutUsesSmsPool && runtimeConfig.hostedCheckoutCurrentSmsEntry) {
        // 成功取到验证码说明这个号码本轮是可用的，清零 unavailableCount。
        await updateHostedCheckoutPoolUsage(runtimeConfig.hostedCheckoutCurrentSmsEntry, {
          success: true,
          resetUnavailable: true,
        });
      }
      return code;
    }

    async function fetchHostedCheckoutVerificationCodeManually(options = {}) {
      const manualVerificationUrl = String(options?.verificationUrl || '').trim();
      if (manualVerificationUrl) {
        const fetcher = typeof fetchImpl === 'function'
          ? fetchImpl
          : (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
        if (typeof fetcher !== 'function') {
          throw new Error('当前运行环境不支持 fetch，无法获取 hosted checkout 验证码。');
        }
        const separator = manualVerificationUrl.includes('?') ? '&' : '?';
        const response = await fetcher(`${manualVerificationUrl}${separator}t=${Date.now()}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json,text/plain,*/*',
          },
        });
        const text = await response.text().catch(() => '');
        let payload = text;
        try {
          payload = text ? JSON.parse(text) : {};
        } catch {
          payload = text;
        }
        const code = extractHostedCheckoutVerificationCode(payload);
        const timestamp = extractHostedCheckoutVerificationCodeTimestamp(payload);
        const responseSnippet = (() => {
          const snippetSource = typeof payload === 'string'
            ? text
            : (() => {
              try { return JSON.stringify(payload); } catch { return text; }
            })();
          return String(snippetSource || '').slice(0, 400);
        })();
        if (!code) {
          const error = new Error(
            `hosted checkout 验证码接口暂未返回有效验证码。接口响应片段：${responseSnippet || '(空)'}`
          );
          error.responseSnippet = responseSnippet;
          throw error;
        }
        return {
          code,
          verificationUrl: manualVerificationUrl,
          codeTime: String(timestamp?.codeTime || ''),
          codeTimeMs: Number(timestamp?.codeTimeMs) || 0,
          codeTimeText: String(timestamp?.codeTimeText || ''),
          fetchedAtMs: Date.now(),
          responseSnippet,
        };
      }
      try {
        const code = await fetchHostedCheckoutVerificationCode();
        const runtimeConfig = await getHostedCheckoutRuntimeConfig();
        return {
          code,
          verificationUrl: String(runtimeConfig?.verificationUrl || '').trim(),
          codeTime: '',
          codeTimeMs: 0,
          codeTimeText: '',
          fetchedAtMs: Date.now(),
          responseSnippet: '',
        };
      } finally {
        await clearHostedCheckoutCurrentSmsEntry();
      }
    }

    async function pollHostedCheckoutVerificationCode() {
      let lastError = null;
      for (let attempt = 1; attempt <= HOSTED_CHECKOUT_VERIFICATION_POLL_ATTEMPTS; attempt += 1) {
        throwIfStopped();
        try {
          const code = await fetchHostedCheckoutVerificationCode();
          await addLog(`步骤 6：已获取 hosted checkout 验证码（${attempt}/${HOSTED_CHECKOUT_VERIFICATION_POLL_ATTEMPTS}）。`, 'info');
          return code;
        } catch (error) {
          lastError = error;
          await addLog(
            `步骤 6：hosted checkout 验证码暂不可用（${attempt}/${HOSTED_CHECKOUT_VERIFICATION_POLL_ATTEMPTS}）：${error?.message || error}`,
            'warn'
          );
          if (attempt < HOSTED_CHECKOUT_VERIFICATION_POLL_ATTEMPTS) {
            await sleepWithStop(HOSTED_CHECKOUT_VERIFICATION_POLL_INTERVAL_MS);
          }
        }
      }
      throw lastError || new Error('hosted checkout 验证码轮询失败。');
    }

    async function waitForHostedCheckoutVerificationPopupDelay() {
      const runtimeConfig = await getHostedCheckoutRuntimeConfig({
        ensureCurrentSmsEntry: true,
      });
      const delaySeconds = normalizeHostedCheckoutVerificationPopupDelaySeconds(
        runtimeConfig?.verificationPopupDelaySeconds
      );
      if (delaySeconds <= 0) {
        return;
      }
      await addLog(`步骤 6：已检测到 hosted checkout 验证码弹窗，按设置等待 ${delaySeconds} 秒后再获取验证码。`, 'info');
      await sleepWithStop(delaySeconds * 1000);
    }

    async function resendHostedCheckoutVerificationCodeAndRefill(tabId, guestProfile = {}, attempt = 1) {
      await addLog(`步骤 6：PayPal 提示验证码错误，3 秒后自动点击 Resend 重新发送验证码（${attempt}/${HOSTED_CHECKOUT_VERIFICATION_RESEND_MAX_ATTEMPTS}）...`, 'warn');
      await sleepWithStop(HOSTED_CHECKOUT_VERIFICATION_INVALID_RESEND_DELAY_MS);
      await runHostedCheckoutPayPalStep(tabId, {
        resendVerificationCode: true,
      });
      await addLog('步骤 6：已点击 PayPal 验证码 Resend，等待弹窗延迟后重新获取验证码...', 'info');
      await waitForHostedCheckoutVerificationPopupDelay();
      const verificationCode = await pollHostedCheckoutVerificationCode();
      await runHostedCheckoutPayPalStep(tabId, {
        ...guestProfile,
        verificationCode,
      });
    }

    async function requestHostedCheckoutGenericErrorChoice(tabId, pageState = {}) {
      const requestId = `paypal-hosted-generic-error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const pageMessage = String(pageState?.hostedGenericErrorMessage || '').trim()
        || 'Things don’t appear to be working at the moment.';
      const latestState = typeof getState === 'function'
        ? await getState().catch(() => ({}))
        : {};
      if (latestState?.autoRunRetryPaypalCallback) {
        await addLog('步骤 6：PayPal hosted checkout 返回 genericError，PAYPAL回调自动重试已开启，将换新邮箱重走流程。', 'warn');
        throw new Error(`${HOSTED_CHECKOUT_GENERIC_ERROR_PREFIX}${pageMessage}`);
      }
      const patch = {
        plusManualConfirmationPending: true,
        plusManualConfirmationRequestId: requestId,
        plusManualConfirmationStep: 6,
        plusManualConfirmationMethod: 'paypal-hosted-generic-error',
        plusManualConfirmationTitle: 'PayPal Checkout 异常',
        plusManualConfirmationMessage: `${pageMessage} 请检查 PLUS 是否正常开通，或重新创建 Plus Checkout。`,
      };
      await setState(patch);
      if (typeof broadcastDataUpdate === 'function') {
        broadcastDataUpdate(patch);
      }
      await addLog('步骤 6：PayPal hosted checkout 返回 genericError，已停止当前支付链路并等待你选择“检查”或“重试”。', 'error');
      throw new Error(`${HOSTED_CHECKOUT_GENERIC_ERROR_PREFIX}${pageMessage}`);
    }

    function buildHostedCheckoutVerificationResendLimitError() {
      return new Error(
        `${HOSTED_CHECKOUT_VERIFICATION_RESEND_LIMIT_PREFIX}PayPal 验证码自动 Resend 重试已达到上限，请尝试在页面手动获取验证码并填入。`
      );
    }

    async function pickHostedCheckoutPoolEntryExcluding(failedKeys) {
      const state = typeof getState === 'function' ? await getState().catch(() => ({})) : {};
      let stored = {};
      if (chrome?.storage?.local?.get) {
        stored = await chrome.storage.local.get([
          'hostedCheckoutSmsPoolText',
          'hostedCheckoutSmsPoolUsage',
        ]).catch(() => ({}));
      }
      const poolEntries = parseHostedCheckoutSmsPoolEntries(
        stored?.hostedCheckoutSmsPoolText
        || state?.hostedCheckoutSmsPoolText
        || ''
      );
      const poolUsage = normalizeHostedCheckoutSmsPoolUsage(
        stored?.hostedCheckoutSmsPoolUsage
        || state?.hostedCheckoutSmsPoolUsage
        || {}
      );
      const filtered = (failedKeys instanceof Set && failedKeys.size > 0)
        ? poolEntries.filter((entry) => !failedKeys.has(entry.key))
        : poolEntries;
      const now = Date.now();
      const activeCount = filtered.filter((entry) => {
        const usage = poolUsage[entry.key] || {};
        const disabledUntil = Math.max(0, Number(usage.disabledUntil) || 0);
        return disabledUntil <= now;
      }).length;
      // chooseHostedCheckoutSmsPoolEntry 内部已会跳过冷却中的号码，
      // 此处用 active/total 数量供错误信息提示。
      const nextEntry = chooseHostedCheckoutSmsPoolEntry(filtered, poolUsage);
      // 计算最近的冷却到期时间，用于"全部冷却中"时的等待提示。
      let nearestDisabledUntil = 0;
      for (const entry of filtered) {
        const usage = poolUsage[entry.key] || {};
        const disabledUntil = Math.max(0, Number(usage.disabledUntil) || 0);
        if (disabledUntil > now && (nearestDisabledUntil === 0 || disabledUntil < nearestDisabledUntil)) {
          nearestDisabledUntil = disabledUntil;
        }
      }
      return {
        nextEntry,
        poolSize: poolEntries.length,
        remainingCount: filtered.length,
        activeCount,
        nearestDisabledUntil,
      };
    }

    async function handleHostedCheckoutExceedPhone(tabId, guestProfile, pageState = {}) {
      const pageMessage = String(pageState?.hostedExceedPhoneMessage || '').trim()
        || 'Try a different phone number.';

      const failedConfig = await getHostedCheckoutRuntimeConfig({
        ensureCurrentSmsEntry: false,
      });
      const failedEntry = failedConfig?.hostedCheckoutCurrentSmsEntry || null;
      const failedPhone = String(failedEntry?.phone || failedConfig?.phone || '').trim();
      // 查询当前号码累计的不可用次数。本次失败后将变为 previous+1，
      // 若达到长冷却阈值（默认 3 次）就启用更长的冷却，避免反复重试已知不可用的号码。
      const failedUsageSnapshot = failedEntry?.key
        ? (await (async () => {
          const stateNow = typeof getState === 'function' ? await getState().catch(() => ({})) : {};
          const usageMap = normalizeHostedCheckoutSmsPoolUsage(stateNow?.hostedCheckoutSmsPoolUsage || {});
          return usageMap[failedEntry.key] || null;
        })())
        : null;
      const previousUnavailableCount = Math.max(0, Math.floor(Number(failedUsageSnapshot?.unavailableCount) || 0));
      const nextUnavailableCount = previousUnavailableCount + 1;
      const useLongCooldown = nextUnavailableCount >= HOSTED_CHECKOUT_EXCEED_PHONE_LONG_COOLDOWN_THRESHOLD;
      const cooldownMs = useLongCooldown
        ? HOSTED_CHECKOUT_EXCEED_PHONE_LONG_COOLDOWN_MS
        : HOSTED_CHECKOUT_EXCEED_PHONE_COOLDOWN_MS;
      const cooldownMinutes = Math.round(cooldownMs / 60000);

      await addLog(
        `步骤 6：PayPal hosted checkout 提示 "${pageMessage}"（当前号码：${failedPhone || '(空)'}，累计不可用 ${nextUnavailableCount} 次），将该号码冷却 ${cooldownMinutes} 分钟后再放回池中，并切换其它号码继续。`,
        'warn'
      );

      if (failedEntry?.key) {
        await updateHostedCheckoutPoolUsage(failedEntry, {
          incrementUseCount: false,
          success: false,
          error: pageMessage,
          disabledUntil: Date.now() + cooldownMs,
          incrementUnavailable: true,
        });
      }
      await clearHostedCheckoutCurrentSmsEntry();

      // 关闭 PayPal 的拦截弹窗，让页面回到 guest checkout 表单。
      try {
        await runHostedCheckoutPayPalStep(tabId, {
          ...guestProfile,
          dismissExceedPhoneInterstitial: true,
        });
      } catch (error) {
        await addLog(
          `步骤 6：关闭 PayPal "Try a different phone number." 拦截弹窗失败：${error?.message || error}`,
          'warn'
        );
      }

      const { nextEntry, poolSize, activeCount, nearestDisabledUntil } = await pickHostedCheckoutPoolEntryExcluding();
      if (!nextEntry) {
        if (!failedEntry?.key) {
          throw new Error(
            '步骤 6：PayPal hosted checkout 提示 "Try a different phone number."，但当前未配置 PayPal 接码池，无法自动换号。请在号码池中导入更多号码后重试。'
          );
        }
        const waitSeconds = nearestDisabledUntil > 0
          ? Math.max(1, Math.ceil((nearestDisabledUntil - Date.now()) / 1000))
          : 0;
        const waitSuffix = waitSeconds > 0
          ? `（最快约 ${waitSeconds} 秒后第一个号码恢复可用）`
          : '';
        throw new Error(
          `步骤 6：PayPal hosted checkout 提示 "Try a different phone number."，但接码池中暂无可用号码（池总数 ${poolSize}，当前活跃 ${activeCount}）${waitSuffix}，请补充新号码或等待冷却结束后重试。`
        );
      }

      const nextUsage = await updateHostedCheckoutPoolUsage(nextEntry, {
        incrementUseCount: true,
        success: true,
      });
      await addLog(
        `步骤 6：PayPal 接码池已切换至号码 ${nextEntry.phone}（累计使用 ${Math.max(0, Number(nextUsage?.[nextEntry.key]?.useCount) || 0)} 次），准备重新填写并提交 guest checkout。`,
        'info'
      );

      if (guestProfile && typeof guestProfile === 'object') {
        // 同步更新 guestProfile.phone，避免后续 hostedStage===guest_checkout 回退到旧号码。
        guestProfile.phone = nextEntry.phone;
      }
    }

    async function runHostedCheckoutOpenAiFlow(tabId, guestProfile) {
      await ensureContentScriptReadyOnTabUntilStopped(PLUS_CHECKOUT_SOURCE, tabId, {
        inject: PLUS_CHECKOUT_INJECT_FILES,
        injectSource: PLUS_CHECKOUT_SOURCE,
        logMessage: '步骤 6：hosted checkout 页面仍在加载，等待脚本就绪...',
      });
      await addLog('步骤 6：hosted checkout 已打开，正在按油猴脚本顺序自动切换 PayPal、填写地址并提交...', 'info');
      const initialResult = await sendTabMessageUntilStopped(tabId, PLUS_CHECKOUT_SOURCE, {
        type: 'RUN_HOSTED_OPENAI_CHECKOUT_STEP',
        source: 'background',
        payload: {
          address: guestProfile.address,
        },
      });
      if (initialResult?.error) {
        throw new Error(initialResult.error);
      }

      // Stripe 偶尔识别不到我们填的地址（"The customer's location isn't recognized."），
      // 这时换一个地址重填重交。最多重试 3 次（含初始那次不算），过则报错。
      const HOSTED_OPENAI_ADDRESS_RETRY_MAX = 3;
      let addressRetryCount = 0;
      let addressErrorHandledAt = 0;

      const startedAt = Date.now();
      let verificationSubmitted = false;
      while (Date.now() - startedAt < HOSTED_CHECKOUT_TRANSITION_TIMEOUT_MS) {
        throwIfStopped();
        const tab = await chrome?.tabs?.get?.(tabId).catch(() => null);
        if (!tab) {
          throw new Error('步骤 6：hosted checkout 标签页已关闭。');
        }
        const currentUrl = String(tab.url || '').trim();
        if (isPayPalUrl(currentUrl) || isPaymentsSuccessUrl(currentUrl)) {
          return {
            transitioned: true,
            url: currentUrl,
          };
        }

        const state = await sendTabMessageUntilStopped(tabId, PLUS_CHECKOUT_SOURCE, {
          type: 'PLUS_CHECKOUT_GET_STATE',
          source: 'background',
          payload: {},
        });
        if (state?.error) {
          throw new Error(state.error);
        }

        // 地址错误优先级最高：先解决了再继续，否则后续 verification 等都会卡住。
        // 加 5 秒去抖防止刚换完地址、Stripe 还没刷新就又触发一次。
        if (state?.hostedAddressError && (Date.now() - addressErrorHandledAt > 5000)) {
          if (addressRetryCount >= HOSTED_OPENAI_ADDRESS_RETRY_MAX) {
            throw new Error(
              `步骤 6：Stripe 连续 ${HOSTED_OPENAI_ADDRESS_RETRY_MAX} 次拒绝填写的账单地址（${state?.hostedAddressErrorMessage || '地址校验失败'}），已达到自动换地址重试上限，请检查地址源接口或换代理后重试。`
            );
          }
          addressRetryCount += 1;
          addressErrorHandledAt = Date.now();
          const prevAddress = guestProfile.address || {};
          await addLog(
            `步骤 6：检测到 Stripe 地址校验失败（${state?.hostedAddressErrorMessage || '位置不可识别'}），正在更换地址重新填写（${addressRetryCount}/${HOSTED_OPENAI_ADDRESS_RETRY_MAX}）...`,
            'warn'
          );
          let nextAddress;
          try {
            nextAddress = await fetchHostedCheckoutAddress();
          } catch (error) {
            throw new Error(`步骤 6：换地址时调用地址接口失败：${error?.message || error}`);
          }
          await addLog(
            `步骤 6：替换地址 ${JSON.stringify(prevAddress)} -> ${JSON.stringify(nextAddress)}`,
            'info'
          );
          // 同步更新 guestProfile，后面 PayPal 阶段填账单地址时也用新地址。
          guestProfile.address = nextAddress;
          // 重新派发 RUN_HOSTED_OPENAI_CHECKOUT_STEP，让 content script 用新地址重填并再次提交。
          const retryResult = await sendTabMessageUntilStopped(tabId, PLUS_CHECKOUT_SOURCE, {
            type: 'RUN_HOSTED_OPENAI_CHECKOUT_STEP',
            source: 'background',
            payload: {
              address: nextAddress,
            },
          });
          if (retryResult?.error) {
            throw new Error(retryResult.error);
          }
          // 给 Stripe 一点时间重新校验，再进下一轮 poll。
          await sleepWithStop(2500);
          continue;
        }

        if (state?.hostedVerificationVisible && !verificationSubmitted) {
          await addLog('步骤 6：检测到 hosted checkout OpenAI 验证码弹窗，正在获取并填写验证码...', 'info');
          const verificationCode = await pollHostedCheckoutVerificationCode();
          const verifyResult = await sendTabMessageUntilStopped(tabId, PLUS_CHECKOUT_SOURCE, {
            type: 'RUN_HOSTED_OPENAI_CHECKOUT_STEP',
            source: 'background',
            payload: {
              verificationCode,
            },
          });
          if (verifyResult?.error) {
            throw new Error(verifyResult.error);
          }
          verificationSubmitted = true;
        }
        await sleepWithStop(500);
      }

      throw new Error('步骤 6：hosted checkout OpenAI/Stripe 页面提交后长时间未跳转到 PayPal 或成功页。');
    }

    async function runHostedCheckoutPayPalStep(tabId, payload = {}) {
      await waitForTabCompleteUntilStopped(tabId);
      await sleepWithStop(1000);
      await ensureContentScriptReadyOnTabUntilStopped(PAYPAL_SOURCE, tabId, {
        inject: PAYPAL_INJECT_FILES,
        injectSource: PAYPAL_SOURCE,
        logMessage: '步骤 6：PayPal hosted checkout 页面仍在加载，等待脚本就绪...',
      });
      const result = await sendTabMessageUntilStopped(tabId, PAYPAL_SOURCE, {
        type: 'PAYPAL_RUN_HOSTED_CHECKOUT_STEP',
        source: 'background',
        payload,
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function getHostedCheckoutPayPalState(tabId) {
      await ensureContentScriptReadyOnTabUntilStopped(PAYPAL_SOURCE, tabId, {
        inject: PAYPAL_INJECT_FILES,
        injectSource: PAYPAL_SOURCE,
        logMessage: '步骤 6：正在等待 PayPal hosted checkout 页面脚本就绪...',
      });
      const result = await sendTabMessageUntilStopped(tabId, PAYPAL_SOURCE, {
        type: 'PAYPAL_HOSTED_GET_STATE',
        source: 'background',
        payload: {},
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function waitForHostedCheckoutPaymentsSuccess(tabId) {
      const successTab = await waitForUrlMatch(
        tabId,
        (url) => isPaymentsSuccessUrl(url),
        HOSTED_CHECKOUT_SUCCESS_WAIT_TIMEOUT_MS,
        500
      );
      if (!successTab?.url || !isPaymentsSuccessUrl(successTab.url)) {
        throw new Error('步骤 6：hosted checkout 已离开 PayPal，但长时间未回到 ChatGPT 支付成功页。');
      }
      await addLog('步骤 6：hosted checkout 已回到 ChatGPT 支付成功页，等待扩展继续后续 OAuth 流程。', 'ok');
      return successTab;
    }

    async function runHostedCheckoutPayPalFlow(tabId, guestProfile) {
      const startedAt = Date.now();
      let hostedVerificationResendAttempts = 0;
      let hostedVerificationSubmitted = false;
      let loggedWaitingForHostedVerificationResult = false;
      // 同一次 PayPal 链路里允许尝试自动过 DataDome 滑块的次数；过多就直接转人工兜底，
      // 防止脚本一直在被风控的会话里继续打 captcha 进一步污染该会话。
      const HOSTED_CHECKOUT_SLIDE_CAPTCHA_MAX_ATTEMPTS = 3;
      let hostedSlideCaptchaAttempts = 0;
      while (Date.now() - startedAt < HOSTED_CHECKOUT_PAYPAL_LOOP_TIMEOUT_MS) {
        throwIfStopped();
        const tab = await chrome?.tabs?.get?.(tabId).catch(() => null);
        if (!tab) {
          throw new Error('步骤 6：hosted checkout PayPal 标签页已关闭。');
        }
        const currentUrl = String(tab.url || '').trim();
        if (!currentUrl) {
          await sleepWithStop(500);
          continue;
        }
        if (isPaymentsSuccessUrl(currentUrl)) {
          await addLog('步骤 6：hosted checkout 已直接进入 ChatGPT 支付成功页。', 'ok');
          return;
        }
        if (!isPayPalUrl(currentUrl)) {
          await addLog(`步骤 6：hosted checkout 已离开 PayPal（${currentUrl}），继续等待 ChatGPT 支付成功页...`, 'info');
          await waitForHostedCheckoutPaymentsSuccess(tabId);
          return;
        }

        if (isPayPalHermesUrl(currentUrl)) {
          hostedVerificationSubmitted = false;
          loggedWaitingForHostedVerificationResult = false;
          await addLog(`步骤 6：检测到 PayPal Hermes 复核页（${currentUrl}），按油猴脚本方式直接等待并点击 Agree and Continue...`, 'info');
          await runHostedCheckoutPayPalStep(tabId, {
            ...guestProfile,
          });
          await sleepWithStop(1000);
          continue;
        }

        const pageState = await getHostedCheckoutPayPalState(tabId);
        if (pageState.hostedStage === 'slide_captcha' || pageState.hostedSlideCaptchaVisible) {
          hostedVerificationSubmitted = false;
          loggedWaitingForHostedVerificationResult = false;
          hostedSlideCaptchaAttempts += 1;
          await addLog(
            `步骤 6：检测到 PayPal DataDome 滑块验证码，准备第 ${hostedSlideCaptchaAttempts}/${HOSTED_CHECKOUT_SLIDE_CAPTCHA_MAX_ATTEMPTS} 次尝试自动拖动通过...`,
            'info'
          );
          let slideResult = null;
          try {
            slideResult = await runHostedCheckoutPayPalStep(tabId, {
              ...guestProfile,
              slideCaptchaMaxAttempts: 1,
            });
          } catch (error) {
            await addLog(
              `步骤 6：PayPal DataDome 滑块拖动派发失败：${error?.message || error}`,
              'warn'
            );
          }
          if (slideResult?.solved) {
            await addLog('步骤 6：PayPal DataDome 滑块已通过，继续后续支付链路。', 'ok');
            // 服务端校验返回需要一点时间；这里再额外等一下避免立即检查时状态没刷新。
            await sleepWithStop(1500);
            continue;
          }
          if (hostedSlideCaptchaAttempts >= HOSTED_CHECKOUT_SLIDE_CAPTCHA_MAX_ATTEMPTS) {
            throw new Error(
              `${HOSTED_CHECKOUT_SLIDE_CAPTCHA_FAILED_PREFIX}PayPal 触发 DataDome 滑块验证码，自动连续 ${HOSTED_CHECKOUT_SLIDE_CAPTCHA_MAX_ATTEMPTS} 次拖动均未通过。请在 PayPal 标签页手动完成滑块后再继续，或检查是否已被风控临时拉黑。`
            );
          }
          await sleepWithStop(1500 + Math.floor(Math.random() * 800));
          continue;
        }

        if (pageState.hostedStage === 'generic_error' || pageState.hostedGenericError) {
          await requestHostedCheckoutGenericErrorChoice(tabId, pageState);
          return;
        }

        if (pageState.hostedStage === 'exceed_phone' || pageState.hostedExceedPhoneError) {
          hostedVerificationSubmitted = false;
          loggedWaitingForHostedVerificationResult = false;
          await handleHostedCheckoutExceedPhone(tabId, guestProfile, pageState);
          await sleepWithStop(1500);
          continue;
        }

        if (
          pageState.hostedStage === 'verification'
          && pageState.verificationInputsVisible
          && pageState.hostedVerificationInvalidCode
        ) {
          if (hostedVerificationResendAttempts >= HOSTED_CHECKOUT_VERIFICATION_RESEND_MAX_ATTEMPTS) {
            const error = buildHostedCheckoutVerificationResendLimitError();
            await addLog(error.message.replace(HOSTED_CHECKOUT_VERIFICATION_RESEND_LIMIT_PREFIX, ''), 'error');
            throw error;
          }
          hostedVerificationResendAttempts += 1;
          await resendHostedCheckoutVerificationCodeAndRefill(tabId, guestProfile, hostedVerificationResendAttempts);
          hostedVerificationSubmitted = true;
          loggedWaitingForHostedVerificationResult = false;
          await sleepWithStop(1000);
          continue;
        }

        if (pageState.hostedStage === 'verification' && pageState.verificationInputsVisible) {
          if (hostedVerificationSubmitted) {
            if (!loggedWaitingForHostedVerificationResult) {
              loggedWaitingForHostedVerificationResult = true;
              await addLog('步骤 6：PayPal 验证码已提交，正在等待校验结果或错误提示...', 'info');
            }
            await sleepWithStop(1000);
            continue;
          }
          await addLog('步骤 6：检测到 PayPal hosted checkout 验证码弹窗，正在获取并填写验证码...', 'info');
          await waitForHostedCheckoutVerificationPopupDelay();
          const verificationCode = await pollHostedCheckoutVerificationCode();
          await runHostedCheckoutPayPalStep(tabId, {
            ...guestProfile,
            verificationCode,
          });
          hostedVerificationSubmitted = true;
          loggedWaitingForHostedVerificationResult = false;
          await sleepWithStop(1000);
          continue;
        }

        if (pageState.hostedStage === 'account_create_email' || pageState.hostedAccountCreateEmail) {
          hostedVerificationSubmitted = false;
          loggedWaitingForHostedVerificationResult = false;
          await addLog('步骤 6：检测到 PayPal 创建账户邮箱页，正在填写邮箱并继续付款...', 'info');
          await runHostedCheckoutPayPalStep(tabId, {
            ...guestProfile,
          });
          await sleepWithStop(1000);
          continue;
        }

        if (pageState.hostedStage === 'pay_login') {
          hostedVerificationSubmitted = false;
          loggedWaitingForHostedVerificationResult = false;
          await addLog('步骤 6：检测到 PayPal hosted checkout 登录页，正在填写邮箱并继续...', 'info');
          await runHostedCheckoutPayPalStep(tabId, {
            ...guestProfile,
            email: guestProfile.email,
          });
          await sleepWithStop(1000);
          continue;
        }

        if (pageState.hostedStage === 'guest_checkout') {
          hostedVerificationSubmitted = false;
          loggedWaitingForHostedVerificationResult = false;
          const runtimeConfig = await getHostedCheckoutRuntimeConfig({
            ensureCurrentSmsEntry: true,
          });
          const configuredPhone = String(runtimeConfig?.phone || '').trim();
          await addLog(`步骤 6：当前 hosted checkout 电话配置为 ${configuredPhone || '(空，将回退默认值)'}。`, 'info');
          await addLog(`步骤 6：发送到 PayPal guest checkout 的 payload：${JSON.stringify({
            phone: String(runtimeConfig?.phone || guestProfile.phone || '').trim(),
            address: guestProfile.address || {},
          })}`, 'info');
          await addLog('步骤 6：检测到 PayPal hosted checkout 卡支付页，正在填写卡资料并提交...', 'info');
          await runHostedCheckoutPayPalStep(tabId, {
            ...guestProfile,
            phone: String(runtimeConfig?.phone || guestProfile.phone || '').trim(),
          });
          await sleepWithStop(1500);
          continue;
        }

        if (pageState.hostedStage === 'review_consent') {
          hostedVerificationSubmitted = false;
          loggedWaitingForHostedVerificationResult = false;
          await addLog('步骤 6：检测到 PayPal hosted checkout 账单确认页，正在点击继续...', 'info');
          await runHostedCheckoutPayPalStep(tabId, {
            ...guestProfile,
          });
          await sleepWithStop(1000);
          continue;
        }

        if (pageState.hostedStage === 'approval') {
          throw new Error('步骤 6：hosted checkout 流程意外进入了普通 PayPal 授权页，当前流程未配置 PayPal 账号授权。');
        }

        await sleepWithStop(1000);
      }
      throw new Error('步骤 6：hosted checkout PayPal 自动化超时，长时间未完成支付链路。');
    }

    async function runHostedCheckoutAutomation(tabId, completionPayload = {}) {
      const runtimeConfig = await getHostedCheckoutRuntimeConfig({
        ensureCurrentSmsEntry: true,
      });
      const address = await fetchHostedCheckoutAddress();
      await addLog(`步骤 6：hosted checkout 配置快照：${JSON.stringify(runtimeConfig?.diagnostics || {})}`, 'info');
      await addLog(`步骤 6：hosted checkout 初始电话配置为 ${runtimeConfig.phone || '(空)'}。`, 'info');
      await addLog(`步骤 6：hosted checkout 地址数据：${JSON.stringify(address)}`, 'info');
      const guestProfile = buildHostedCheckoutGuestProfile(address, runtimeConfig);
      await runHostedCheckoutOpenAiFlow(tabId, guestProfile);

      const transitionTab = await waitForUrlMatch(
        tabId,
        (url) => isPayPalUrl(url) || isPaymentsSuccessUrl(url),
        HOSTED_CHECKOUT_TRANSITION_TIMEOUT_MS,
        500
      );
      const transitionUrl = String(transitionTab?.url || '').trim();
      if (!transitionUrl) {
        throw new Error('步骤 6：hosted checkout 提交后长时间未跳转到 PayPal 或 ChatGPT 支付成功页。');
      }
      if (isPaymentsSuccessUrl(transitionUrl)) {
        await addLog('步骤 6：hosted checkout 在提交后已直接进入 ChatGPT 支付成功页。', 'ok');
        await completeNodeFromBackground('plus-checkout-create', completionPayload);
        return;
      }

      await addLog('步骤 6：hosted checkout 已跳转到 PayPal，准备继续 guest/card 流自动化。', 'info');
      await runHostedCheckoutPayPalFlow(tabId, guestProfile);
      await addLog('步骤 6：hosted checkout 支付链路已完成，准备进入下一步。', 'ok');
      await completeNodeFromBackground('plus-checkout-create', completionPayload);
    }

    function startHostedCheckoutAutomation(tabId, completionPayload = {}) {
      if (!enableHostedCheckoutAutomation) {
        return;
      }
      void runHostedCheckoutAutomation(tabId, completionPayload)
        .catch(async (error) => {
          const message = error?.message || String(error || 'hosted checkout automation failed');
          if (isHostedCheckoutNonFreeTrialFailure(error)) {
            const latestState = typeof getState === 'function'
              ? await getState().catch(() => ({}))
              : {};
            const shouldRetryNonFreeTrial = Boolean(latestState?.autoRunRetryNonFreeTrial);
            const stopReason = normalizeNonFreeTrialLogMessage(message, {
              willRetry: shouldRetryNonFreeTrial,
            });
            await addLog(
              shouldRetryNonFreeTrial
                ? `${stopReason} 无试用套餐自动重试已开启，将换新邮箱重走流程。`
                : stopReason,
              'warn'
            );
            if (shouldRetryNonFreeTrial && typeof failNodeFromBackground === 'function') {
              await failNodeFromBackground('plus-checkout-create', `PLUS_CHECKOUT_NON_FREE_TRIAL::${stopReason}`);
              return;
            }
            if (typeof requestStop === 'function') {
              await requestStop({ logMessage: false });
              return;
            }
          }
          await addLog(`步骤 6：hosted checkout 自动化失败：${message}`, 'error');
          if (typeof failNodeFromBackground === 'function') {
            await failNodeFromBackground('plus-checkout-create', message);
          }
        })
        .finally(async () => {
          await clearHostedCheckoutCurrentSmsEntry();
        });
    }

    function normalizeHelperCountryCode(countryCode = '86') {
      const digits = String(countryCode || '').replace(/\D/g, '');
      return digits || '86';
    }

    function normalizeHelperPhoneNumber(phone = '', countryCode = '86') {
      const cleaned = String(phone || '').replace(/\D/g, '');
      const countryDigits = normalizeHelperCountryCode(countryCode);
      if (countryDigits && cleaned.startsWith(countryDigits) && cleaned.length > countryDigits.length) {
        return cleaned.slice(countryDigits.length);
      }
      return cleaned;
    }

    function normalizeGpcHelperPhoneMode(value = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.normalizeGpcHelperPhoneMode) {
        return rootScope.GoPayUtils.normalizeGpcHelperPhoneMode(value);
      }
      const normalized = String(value || '').trim().toLowerCase();
      return normalized === GPC_HELPER_PHONE_MODE_AUTO || normalized === 'builtin'
        ? GPC_HELPER_PHONE_MODE_AUTO
        : GPC_HELPER_PHONE_MODE_MANUAL;
    }

    function normalizeGpcOtpChannel(value = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.normalizeGpcOtpChannel) {
        return rootScope.GoPayUtils.normalizeGpcOtpChannel(value);
      }
      return String(value || '').trim().toLowerCase() === 'sms' ? 'sms' : 'whatsapp';
    }

    function resolveGpcHelperApiKey(state = {}) {
      const apiKey = String(
        state?.gopayHelperApiKey
        || state?.gpcApiKey
        || state?.apiKey
        || ''
      ).trim();
      if (!apiKey) {
        throw new Error('创建 GPC 订单失败：缺少 API Key。');
      }
      return apiKey;
    }

    function normalizeGpcHelperBaseUrl(apiUrl = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.normalizeGpcHelperBaseUrl) {
        return rootScope.GoPayUtils.normalizeGpcHelperBaseUrl(apiUrl);
      }
      let normalized = String(apiUrl || DEFAULT_GPC_HELPER_API_URL).trim().replace(/\/+$/g, '');
      normalized = normalized.replace(/\/api\/checkout\/start$/i, '');
      normalized = normalized.replace(/\/api\/gopay\/(?:otp|pin)$/i, '');
      normalized = normalized.replace(/\/api\/gp\/tasks(?:\/[^/?#]+)?(?:\/(?:otp|pin|stop))?(?:\?.*)?$/i, '');
      normalized = normalized.replace(/\/api\/gp\/balance(?:\?.*)?$/i, '');
      normalized = normalized.replace(/\/api\/card\/balance(?:\?.*)?$/i, '');
      normalized = normalized.replace(/\/api\/card\/redeem-api-key(?:\?.*)?$/i, '');
      return normalized || DEFAULT_GPC_HELPER_API_URL;
    }

    function buildGpcHelperApiUrl(apiUrl = '', path = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.buildGpcHelperApiUrl) {
        return rootScope.GoPayUtils.buildGpcHelperApiUrl(apiUrl, path);
      }
      const baseUrl = normalizeGpcHelperBaseUrl(apiUrl);
      if (!baseUrl) {
        return '';
      }
      const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`;
      return `${baseUrl}${normalizedPath}`;
    }

    function buildGpcTaskCreateUrl(apiUrl = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.buildGpcTaskCreateUrl) {
        return rootScope.GoPayUtils.buildGpcTaskCreateUrl(apiUrl);
      }
      return buildGpcHelperApiUrl(apiUrl, '/api/gp/tasks');
    }

    function buildGpcBalanceUrl(apiUrl = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.buildGpcApiKeyBalanceUrl) {
        return rootScope.GoPayUtils.buildGpcApiKeyBalanceUrl(apiUrl);
      }
      if (rootScope.GoPayUtils?.buildGpcCardBalanceUrl) {
        return rootScope.GoPayUtils.buildGpcCardBalanceUrl(apiUrl);
      }
      return buildGpcHelperApiUrl(apiUrl, '/api/gp/balance');
    }

    function unwrapGpcResponse(payload = {}) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.unwrapGpcResponse) {
        return rootScope.GoPayUtils.unwrapGpcResponse(payload);
      }
      if (payload && typeof payload === 'object' && !Array.isArray(payload)
        && Object.prototype.hasOwnProperty.call(payload, 'data')
        && (Object.prototype.hasOwnProperty.call(payload, 'code') || Object.prototype.hasOwnProperty.call(payload, 'message'))) {
        return payload.data ?? {};
      }
      return payload;
    }

    function isGpcUnifiedResponseOk(payload = {}) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.isGpcUnifiedResponseOk) {
        return rootScope.GoPayUtils.isGpcUnifiedResponseOk(payload);
      }
      if (!payload || typeof payload !== 'object' || !Object.prototype.hasOwnProperty.call(payload, 'code')) {
        return true;
      }
      const code = Number(payload.code);
      return Number.isFinite(code) ? code >= 200 && code < 300 : String(payload.code || '').trim() === '200';
    }

    function getGpcResponseErrorDetail(payload = {}, status = 0) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.extractGpcResponseErrorDetail) {
        return rootScope.GoPayUtils.extractGpcResponseErrorDetail(payload, status);
      }
      return payload?.data?.detail || payload?.detail || payload?.message || payload?.error || `HTTP ${status || 0}`;
    }

    function getGpcRemainingUses(payload = {}) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.getGpcBalanceRemainingUses) {
        return rootScope.GoPayUtils.getGpcBalanceRemainingUses(payload);
      }
      const data = unwrapGpcResponse(payload);
      const numeric = Number(data?.remaining_uses ?? data?.remainingUses ?? data?.balance ?? data?.remaining);
      return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : null;
    }

    function normalizeGpcAutoModePermissionValue(value) {
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'number') {
        if (value === 1) return true;
        if (value === 0) return false;
      }
      const normalized = String(value ?? '').trim().toLowerCase();
      if (!normalized) {
        return null;
      }
      if (['true', '1', 'yes', 'y', 'on', 'enabled', 'enable'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', 'off', 'disabled', 'disable'].includes(normalized)) {
        return false;
      }
      return null;
    }

    function getGpcAutoModePermission(payload = {}) {
      const data = unwrapGpcResponse(payload);
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return null;
      }
      return normalizeGpcAutoModePermissionValue(
        data.auto_mode_enabled
        ?? data.autoModeEnabled
        ?? data.auto_enabled
        ?? data.autoEnabled
      );
    }

    function isGpcAutoModePermissionDenied(payload = {}) {
      return getGpcAutoModePermission(payload) === false;
    }

    async function assertGpcApiKeyReadyForCreate(state = {}, phoneMode = GPC_HELPER_PHONE_MODE_MANUAL, apiKey = '') {
      const apiUrl = buildGpcBalanceUrl(state?.gopayHelperApiUrl);
      if (!apiUrl) {
        throw new Error('创建 GPC 订单失败：缺少 API 地址。');
      }
      const { response, data } = await fetchJsonWithTimeout(apiUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-API-Key': apiKey,
        },
      }, 30000);
      if (!response?.ok || !isGpcUnifiedResponseOk(data)) {
        const detail = getGpcResponseErrorDetail(data, response?.status || 0);
        throw new Error(`创建 GPC 订单失败：API Key 校验失败：${detail}`);
      }
      const balanceData = unwrapGpcResponse(data);
      const remainingUses = getGpcRemainingUses(balanceData);
      const status = String(balanceData?.status || balanceData?.card_status || balanceData?.cardStatus || '').trim().toLowerCase();
      if (status && status !== 'active') {
        throw new Error(`创建 GPC 订单失败：API Key 状态不可用（${status}）。`);
      }
      if (remainingUses !== null && remainingUses <= 0) {
        throw new Error('创建 GPC 订单失败：API Key 剩余次数不足。');
      }
      if (phoneMode === GPC_HELPER_PHONE_MODE_AUTO && isGpcAutoModePermissionDenied(balanceData)) {
        throw new Error('创建 GPC 订单失败：当前 GPC API Key 未开通自动模式。');
      }
    }

    async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 30000) {
      const fetcher = typeof fetchImpl === 'function'
        ? fetchImpl
        : (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
      if (typeof fetcher !== 'function') {
        throw new Error('当前运行环境不支持 fetch，无法调用 GPC API。');
      }
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const effectiveTimeoutMs = Math.max(1000, Number(timeoutMs) || 30000);
      let didTimeout = false;
      let timer = null;
      const buildTimeoutError = () => new Error(`GPC API 请求超时（>${Math.round(effectiveTimeoutMs / 1000)} 秒）：${url}`);
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          didTimeout = true;
          reject(buildTimeoutError());
          if (controller) {
            controller.abort();
          }
        }, effectiveTimeoutMs);
      });
      try {
        const response = await Promise.race([
          fetcher(url, { ...options, ...(controller ? { signal: controller.signal } : {}) }),
          timeoutPromise,
        ]);
        const data = await Promise.race([
          response.json().catch(() => ({})),
          timeoutPromise,
        ]);
        return { response, data };
      } catch (error) {
        if (didTimeout || error?.name === 'AbortError') {
          throw buildTimeoutError();
        }
        throw error;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    async function readAccessTokenFromChatGptSessionTab(tabId) {
      await waitForTabCompleteUntilStopped(tabId);
      await sleepWithStop(1000);
      await ensureContentScriptReadyOnTabUntilStopped(PLUS_CHECKOUT_SOURCE, tabId, {
        inject: PLUS_CHECKOUT_INJECT_FILES,
        injectSource: PLUS_CHECKOUT_SOURCE,
        logMessage: '步骤 6：正在等待 ChatGPT 页面完成加载，再继续获取 accessToken...',
      });

      const sessionResult = await sendTabMessageUntilStopped(tabId, PLUS_CHECKOUT_SOURCE, {
        type: 'PLUS_CHECKOUT_GET_STATE',
        source: 'background',
        payload: {
          includeSession: true,
          includeAccessToken: true,
        },
      });
      if (sessionResult?.error) {
        throw new Error(sessionResult.error);
      }
      return String(sessionResult?.accessToken || sessionResult?.session?.accessToken || '').trim();
    }

    async function generateCloudCheckoutFromApi(accessToken = '', paymentMethod = PLUS_PAYMENT_METHOD_PAYPAL, state = {}) {
      const token = String(accessToken || '').trim();
      if (!token) {
        throw new Error('步骤 6：云端支付转换缺少 accessToken。');
      }

      const apiUrl = normalizePlusCheckoutCloudConversionApiUrl(
        state?.plusCheckoutCloudConversionApiUrl || BUILTIN_PLUS_CHECKOUT_CLOUD_CONVERSION_API_URL
      );
      if (!apiUrl) {
        throw new Error('步骤 6：已启用云端支付转换，但未配置云端服务地址。');
      }
      try {
        const parsed = new URL(apiUrl);
        if (!/^https?:$/i.test(String(parsed.protocol || ''))) {
          throw new Error('unsupported protocol');
        }
      } catch {
        throw new Error('步骤 6：云端支付转换服务地址不是有效的 HTTP/HTTPS URL。');
      }

      const billingDetails = getCheckoutBillingDetailsForPaymentMethod(paymentMethod);
      const headers = {
        Accept: 'application/json',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Content-Type': 'application/json',
      };
      const apiKey = String(state?.plusCheckoutCloudConversionApiKey || BUILTIN_PLUS_CHECKOUT_CLOUD_CONVERSION_API_KEY).trim();
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }

      const { response, data } = await fetchJsonWithTimeout(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          accessToken: token,
          paymentMethod: normalizePlusPaymentMethod(paymentMethod),
          country: billingDetails.country,
          currency: billingDetails.currency,
        }),
      }, 45000);

      const targetCheckoutUrl = String(
        data?.preferredCheckoutUrl
        || data?.hostedCheckoutUrl
        || data?.convertedCheckoutUrl
        || data?.chatgptCheckoutUrl
        || data?.checkoutUrl
        || ''
      ).trim();
      if (!response?.ok || !targetCheckoutUrl) {
        const detail = formatCloudCheckoutErrorDetail(
          data?.detail || data?.message || data?.error || data,
          `HTTP ${response?.status || 0}`
        );
        if (isCloudCheckoutAlreadyPaidMessage(detail)) {
          return {
            checkoutUrl: '',
            chatgptCheckoutUrl: '',
            checkoutSessionId: String(data?.checkoutSessionId || '').trim(),
            processorEntity: String(data?.processorEntity || '').trim(),
            hostedCheckoutUrl: '',
            convertedCheckoutUrl: '',
            preferredCheckoutUrl: '',
            country: String(data?.country || billingDetails.country).trim() || billingDetails.country,
            currency: String(data?.currency || billingDetails.currency).trim() || billingDetails.currency,
            checkoutSource: CLOUD_CHECKOUT_ALREADY_PAID_SOURCE,
            alreadyPaid: true,
            alreadyPaidDetail: detail,
          };
        }
        throw new Error(`步骤 6：云端支付转换失败：${detail}`);
      }

      return {
        checkoutUrl: String(data?.checkoutUrl || '').trim(),
        chatgptCheckoutUrl: String(data?.chatgptCheckoutUrl || '').trim(),
        checkoutSessionId: String(data?.checkoutSessionId || '').trim(),
        processorEntity: String(data?.processorEntity || '').trim(),
        hostedCheckoutUrl: String(data?.hostedCheckoutUrl || '').trim(),
        convertedCheckoutUrl: String(data?.chatgptCheckoutUrl || data?.convertedCheckoutUrl || '').trim(),
        preferredCheckoutUrl: targetCheckoutUrl,
        country: String(data?.country || billingDetails.country).trim() || billingDetails.country,
        currency: String(data?.currency || billingDetails.currency).trim() || billingDetails.currency,
        checkoutSource: 'cloud-converted-checkout',
      };
    }

    async function generateGpcCheckoutFromApi(accessToken = '', state = {}) {
      const token = String(accessToken || '').trim();
      if (!token) {
        throw new Error('创建 GPC 订单失败：缺少 accessToken。');
      }
      const apiUrl = buildGpcTaskCreateUrl(state?.gopayHelperApiUrl);
      if (!apiUrl) {
        throw new Error('创建 GPC 订单失败：缺少 API 地址。');
      }
      const phoneMode = normalizeGpcHelperPhoneMode(state?.gopayHelperPhoneMode || state?.phoneMode);
      const isAutoMode = phoneMode === GPC_HELPER_PHONE_MODE_AUTO;
      const phoneNumber = String(state?.gopayHelperPhoneNumber || '').trim();
      const countryCode = normalizeHelperCountryCode(state?.gopayHelperCountryCode || '86');
      const pin = String(state?.gopayHelperPin || '').trim();
      const apiKey = resolveGpcHelperApiKey(state);
      if (!isAutoMode && !phoneNumber) {
        throw new Error('创建 GPC 订单失败：手动模式缺少手机号。');
      }
      if (!isAutoMode && !pin) {
        throw new Error('创建 GPC 订单失败：手动模式缺少 PIN。');
      }

      throwIfStopped();
      await assertGpcApiKeyReadyForCreate(state, phoneMode, apiKey);
      throwIfStopped();
      const payload = {
        access_token: token,
        phone_mode: phoneMode,
      };
      if (!isAutoMode) {
        payload.country_code = countryCode;
        payload.phone_number = normalizeHelperPhoneNumber(phoneNumber, countryCode);
        payload.otp_channel = normalizeGpcOtpChannel(state?.gopayHelperOtpChannel);
      }

      const orderCreatedAt = Date.now();
      const { response, data } = await fetchJsonWithTimeout(apiUrl, {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(payload),
      }, 30000);

      const taskData = unwrapGpcResponse(data);
      const taskId = String(taskData?.task_id || taskData?.taskId || '').trim();

      if (!response?.ok || !isGpcUnifiedResponseOk(data) || !taskId) {
        const detail = getGpcResponseErrorDetail(data, response?.status || 0);
        throw new Error(`创建 GPC 订单失败：${detail}`);
      }

      return {
        taskId,
        taskStatus: String(taskData?.status || '').trim(),
        statusText: String(taskData?.status_text || taskData?.statusText || '').trim(),
        remoteStage: String(taskData?.remote_stage || taskData?.remoteStage || '').trim(),
        orderCreatedAt,
        responsePayload: taskData && typeof taskData === 'object' && !Array.isArray(taskData) ? taskData : null,
        phoneMode: normalizeGpcHelperPhoneMode(taskData?.phone_mode || taskData?.phoneMode || phoneMode),
        country: 'ID',
        currency: 'IDR',
        checkoutSource: PLUS_PAYMENT_METHOD_GPC_HELPER,
      };
    }

    async function executeGpcCheckoutCreate(state = {}) {
      let accessToken = String(state?.contributionAccessToken || state?.accessToken || state?.chatgptAccessToken || '').trim();
      if (!accessToken) {
        await addLog('步骤 6：正在获取 accessToken...', 'info');
        const tokenTabId = await openFreshChatGptTabForCheckoutCreate();
        try {
          accessToken = await readAccessTokenFromChatGptSessionTab(tokenTabId);
        } finally {
          if (chrome?.tabs?.remove && Number.isInteger(tokenTabId)) {
            await chrome.tabs.remove(tokenTabId).catch(() => {});
          }
        }
      }
      if (!accessToken) {
        throw new Error('步骤 6：GPC 模式获取 accessToken 失败。');
      }

      await addLog('步骤 6：正在调用 GPC 接口创建订单...', 'info');
      const result = await generateGpcCheckoutFromApi(accessToken, state);
      await setState({
        plusCheckoutTabId: null,
        plusCheckoutUrl: '',
        plusCheckoutCountry: result.country || 'ID',
        plusCheckoutCurrency: result.currency || 'IDR',
        plusCheckoutSource: result.checkoutSource,
        gopayHelperTaskId: result.taskId,
        gopayHelperTaskStatus: result.taskStatus,
        gopayHelperStatusText: result.statusText,
        gopayHelperRemoteStage: result.remoteStage,
        gopayHelperTaskPayload: result.responsePayload,
        gopayHelperTaskProgressSignature: '',
        gopayHelperTaskProgressAt: 0,
        gopayHelperTaskProgressTaskId: result.taskId,
        gopayHelperReferenceId: '',
        gopayHelperGoPayGuid: '',
        gopayHelperRedirectUrl: '',
        gopayHelperNextAction: '',
        gopayHelperFlowId: '',
        gopayHelperChallengeId: '',
        gopayHelperStartPayload: null,
        gopayHelperOrderCreatedAt: result.orderCreatedAt || Date.now(),
      });
      await addLog(`步骤 6：GPC ${result.phoneMode === GPC_HELPER_PHONE_MODE_AUTO ? '自动' : '手动'}模式任务已创建（task_id: ${result.taskId}），准备继续下一步。`, 'info');
      await completeNodeFromBackground('plus-checkout-create', {
        plusCheckoutCountry: result.country || 'ID',
        plusCheckoutCurrency: result.currency || 'IDR',
        plusCheckoutSource: result.checkoutSource,
      });
    }

    async function executePlusCheckoutCreate(state = {}) {
      const paymentMethod = normalizePlusPaymentMethod(state?.plusPaymentMethod);
      if (paymentMethod === PLUS_PAYMENT_METHOD_GPC_HELPER) {
        await executeGpcCheckoutCreate(state);
        return;
      }
      await clearHostedCheckoutCurrentSmsEntry();
      let checkoutScopedProxySnapshot = null;
      try {
        checkoutScopedProxySnapshot = await maybeApplyCheckoutConversionProxy(state, paymentMethod);

        const paymentMethodLabel = getPlusPaymentMethodLabel(paymentMethod);
        const checkoutModeLabel = getCheckoutModeLabel(state);
        await addLog(`步骤 6：正在打开新的 ChatGPT 会话，准备创建${checkoutModeLabel}...`, 'info');
        const tabId = await openFreshChatGptTabForCheckoutCreate();

        await waitForTabCompleteUntilStopped(tabId);
        await sleepWithStop(1000);
        await ensureContentScriptReadyOnTabUntilStopped(PLUS_CHECKOUT_SOURCE, tabId, {
          inject: PLUS_CHECKOUT_INJECT_FILES,
          injectSource: PLUS_CHECKOUT_SOURCE,
          logMessage: '步骤 6：正在等待 ChatGPT 页面完成加载，再继续创建订阅页...',
        });

        const useCloudCheckoutConversion = isPlusCheckoutCloudConversionEnabled(state, paymentMethod);
        let result = null;
        if (useCloudCheckoutConversion) {
          await addLog('步骤 6：已启用云端支付转换，正在读取 accessToken 并请求云端服务生成订阅链接...', 'info');
          const accessToken = await readAccessTokenFromChatGptSessionTab(tabId);
          if (!accessToken) {
            throw new Error('步骤 6：云端支付转换未获取到可用 accessToken。');
          }
          result = await generateCloudCheckoutFromApi(accessToken, paymentMethod, state);
        } else {
          await addLog(
            paymentMethod === PLUS_PAYMENT_METHOD_PAYPAL
              ? '步骤 6：正在由扩展内部直连生成美国 US Stripe/外部支付链接...'
              : `步骤 6：正在由扩展内部创建${checkoutModeLabel}...`,
            'info'
          );
          result = await sendTabMessageUntilStopped(tabId, PLUS_CHECKOUT_SOURCE, {
            type: 'CREATE_PLUS_CHECKOUT',
            source: 'background',
            payload: { paymentMethod },
          });

          if (result?.error) {
            throw new Error(result.error);
          }
        }
        if (result?.alreadyPaid) {
          await completeCloudCheckoutAlreadyPaid(tabId, result, state);
          return;
        }
        const targetCheckoutUrl = String(
          result?.preferredCheckoutUrl
          || result?.hostedCheckoutUrl
          || result?.hostedCheckoutBaseUrl
          || result?.convertedCheckoutUrl
          || result?.chatgptCheckoutUrl
          || result?.checkoutUrl
          || ''
        ).trim();
        if (!targetCheckoutUrl) {
          throw new Error(`步骤 6：${checkoutModeLabel}未返回可用的订阅链接。`);
        }

        await addLog(`步骤 6：${checkoutModeLabel}已创建，正在打开订阅页面...`, 'ok');
        await chrome.tabs.update(tabId, { url: targetCheckoutUrl, active: true });
        await waitForTabCompleteUntilStopped(tabId);
        const landedTab = await waitForCheckoutSurface(tabId);
        if (landedTab?.url && landedTab.url !== targetCheckoutUrl) {
          await addLog(`步骤 6：订阅页已继续跳转到 ${landedTab.url}，准备进入自动填写。`, 'info');
        }

        if (checkoutScopedProxySnapshot?.applied) {
          try {
            await maybeRestoreCheckoutConversionProxy(checkoutScopedProxySnapshot);
          } catch (restoreError) {
            await addLog(`步骤 6：支付转换代理释放失败：${restoreError?.message || String(restoreError || '未知错误')}`, 'warn');
          } finally {
            checkoutScopedProxySnapshot = null;
          }
        }

        await sleepWithStop(1000);
        await ensureContentScriptReadyOnTabUntilStopped(PLUS_CHECKOUT_SOURCE, tabId, {
          inject: PLUS_CHECKOUT_INJECT_FILES,
          injectSource: PLUS_CHECKOUT_SOURCE,
          logMessage: '步骤 6：正在等待订阅页面完成加载...',
        });

        const finalCheckoutUrl = String((landedTab?.url || targetCheckoutUrl || '')).trim();
        await setState({
          plusCheckoutTabId: tabId,
          plusCheckoutUrl: finalCheckoutUrl,
          plusCheckoutCountry: result.country || 'DE',
          plusCheckoutCurrency: result.currency || 'EUR',
          plusReturnUrl: '',
          plusCheckoutSource: targetCheckoutUrl === String(result?.convertedCheckoutUrl || '').trim()
            ? 'converted-chatgpt-checkout'
            : '',
        });

        await addLog(`步骤 6：Plus Checkout 页面已就绪（${paymentMethodLabel} / ${result.country || 'DE'} ${result.currency || 'EUR'}），准备继续下一步。`, 'info');

        if (shouldWaitForHostedCheckoutSuccess(state, paymentMethod)) {
          await addLog('步骤 6：当前 hosted checkout 流程将等待支付成功页出现后，再继续 OAuth 流程。', 'info');
          startHostedCheckoutAutomation(tabId, {
            plusCheckoutCountry: result.country || 'DE',
            plusCheckoutCurrency: result.currency || 'EUR',
          });
          return;
        }

        await completeNodeFromBackground('plus-checkout-create', {
          plusCheckoutCountry: result.country || 'DE',
          plusCheckoutCurrency: result.currency || 'EUR',
        });
      } finally {
        if (checkoutScopedProxySnapshot?.applied) {
          try {
            await maybeRestoreCheckoutConversionProxy(checkoutScopedProxySnapshot);
          } catch (restoreError) {
            await addLog(`步骤 6：支付转换代理释放失败：${restoreError?.message || String(restoreError || '未知错误')}`, 'warn');
          }
        }
      }
    }

    return {
      executePlusCheckoutCreate,
      fetchHostedCheckoutVerificationCodeManually,
      testCheckoutConversionProxy,
    };
  }

  return {
    createPlusCheckoutCreateExecutor,
  };
});
