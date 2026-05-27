// phone-sms/providers/zhusms.js - ZhuSMS 接码平台适配层
(function attachZhuSmsProvider(root, factory) {
  root.PhoneSmsZhuSmsProvider = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createZhuSmsProviderModule(root) {
  const PROVIDER_ID = 'zhusms';
  const PROVIDER_LABEL = 'ZhuSMS';
  const DEFAULT_BASE_URL = 'https://zhusms.com';
  const DEFAULT_SERVICE_CODE = 'codex';
  const DEFAULT_COUNTRY_ID = 187;
  const DEFAULT_COUNTRY_LABEL = 'USA';
  const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
  const DEFAULT_PROXY_BASE_URL = 'http://127.0.0.1:17373';
  const PHONE_CODE_TIMEOUT_ERROR_PREFIX = 'PHONE_CODE_TIMEOUT::';

  function normalizeText(value = '') {
    return String(value || '').trim();
  }

  function normalizeZhuSmsSid(value = '') {
    const text = normalizeText(value);
    if (!text) {
      return '';
    }
    const cookieMatch = text.match(/(?:^|;\s*)zhusms_sid=([^;]+)/i);
    const rawSid = cookieMatch ? cookieMatch[1] : text.replace(/^zhusms_sid\s*=\s*/i, '').split(';')[0];
    return normalizeText(rawSid).replace(/[\r\n;]/g, '');
  }

  function normalizeZhuSmsServiceCode(value = '', fallback = DEFAULT_SERVICE_CODE) {
    const normalized = normalizeText(value).toLowerCase().replace(/[^a-z0-9_-]+/g, '');
    if (normalized) {
      return normalized;
    }
    const fallbackNormalized = normalizeText(fallback).toLowerCase().replace(/[^a-z0-9_-]+/g, '');
    return fallbackNormalized || DEFAULT_SERVICE_CODE;
  }

  function normalizeZhuSmsBaseUrl(value = '') {
    const trimmed = normalizeText(value) || DEFAULT_BASE_URL;
    try {
      return new URL(trimmed).toString().replace(/\/+$/, '');
    } catch {
      return DEFAULT_BASE_URL;
    }
  }

  function normalizeZhuSmsProxyBaseUrl(value = '') {
    const trimmed = normalizeText(value) || DEFAULT_PROXY_BASE_URL;
    try {
      const parsed = new URL(trimmed);
      if (!/^https?:$/.test(parsed.protocol)) {
        return DEFAULT_PROXY_BASE_URL;
      }
      if (parsed.pathname === '/zhusms') {
        parsed.pathname = '';
        parsed.search = '';
        parsed.hash = '';
      }
      return parsed.toString().replace(/\/+$/, '');
    } catch {
      return DEFAULT_PROXY_BASE_URL;
    }
  }

  function normalizeUsLocalPhone(value = '') {
    const digits = normalizeText(value).replace(/\D+/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return digits.slice(1);
    }
    return digits;
  }

  function parsePayload(text = '') {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  function describePayload(payload) {
    if (typeof payload === 'string') {
      return payload.trim();
    }
    if (payload && typeof payload === 'object') {
      const direct = normalizeText(payload.message || payload.msg || payload.error || payload.detail || payload.status);
      if (direct) {
        return direct;
      }
      try {
        return JSON.stringify(payload);
      } catch {
        return String(payload);
      }
    }
    return normalizeText(payload);
  }

  function decodeMaybeJsonString(value = '') {
    const text = normalizeText(value);
    if (!text) {
      return '';
    }
    if (
      (text.startsWith('"') && text.endsWith('"'))
      || (text.startsWith("'") && text.endsWith("'"))
    ) {
      try {
        const parsed = JSON.parse(text);
        return normalizeText(parsed) || text;
      } catch {
        return text.replace(/^['"]|['"]$/g, '');
      }
    }
    return text;
  }

  function extractCodeFromText(value = '') {
    const text = decodeMaybeJsonString(value);
    if (!text) {
      return '';
    }
    const contextualMatch = text.match(/(?:verification\s*code|one[-\s]?time\s*(?:passcode|code)|passcode|otp|code|验证码|安全码)[\s\S]{0,50}?(\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d(?:[\s-]?\d)?(?:[\s-]?\d)?(?:[\s-]?\d)?)/i);
    if (contextualMatch) {
      const code = contextualMatch[1].replace(/\D+/g, '');
      if (code.length >= 4 && code.length <= 8) {
        return code;
      }
    }
    const exactMatch = text.match(/^\D*(\d[\s-]?\d[\s-]?\d[\s-]?\d(?:[\s-]?\d)?(?:[\s-]?\d)?(?:[\s-]?\d)?(?:[\s-]?\d)?)\D*$/);
    if (exactMatch) {
      const code = exactMatch[1].replace(/\D+/g, '');
      if (code.length >= 4 && code.length <= 8) {
        return code;
      }
    }
    const looseMatch = text.match(/\b(\d{4,8})\b/);
    return looseMatch?.[1] || '';
  }

  function extractVerificationCode(payload = {}) {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const directCode = extractCodeFromText(payload.code);
      if (directCode) {
        return directCode;
      }
      const fields = [
        payload.raw_sms,
        payload.sms,
        payload.message,
        payload.msg,
        payload.text,
        payload.content,
        payload.body,
      ];
      for (const field of fields) {
        const code = extractCodeFromText(field);
        if (code) {
          return code;
        }
      }
      return '';
    }
    return extractCodeFromText(payload);
  }

  function resolveConfig(state = {}, deps = {}) {
    return {
      sid: normalizeZhuSmsSid(state.zhuSmsSid || state.heroSmsApiKey || ''),
      baseUrl: normalizeZhuSmsBaseUrl(state.zhuSmsBaseUrl || DEFAULT_BASE_URL),
      proxyBaseUrl: normalizeZhuSmsProxyBaseUrl(
        state.zhuSmsProxyBaseUrl || deps.proxyBaseUrl || DEFAULT_PROXY_BASE_URL
      ),
      useProxy: state.zhuSmsUseProxy !== false && deps.useProxy !== false,
      serviceCode: normalizeZhuSmsServiceCode(state.zhuSmsServiceCode, DEFAULT_SERVICE_CODE),
      fetchImpl: deps.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null),
      requestTimeoutMs: deps.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS,
    };
  }

  function buildUrl(config, path = '') {
    return new URL(path, `${normalizeZhuSmsBaseUrl(config.baseUrl)}/`).toString();
  }

  function buildHeaders(config, extraHeaders = {}, options = {}) {
    const headers = {
      Accept: 'application/json,*/*',
      ...extraHeaders,
    };
    const hasCookiesApi = Boolean((root?.chrome || globalThis.chrome)?.cookies?.set);
    if ((!hasCookiesApi || options.forceCookieHeader === true) && config.sid) {
      headers.Cookie = `zhusms_sid=${config.sid}`;
    }
    return headers;
  }

  function buildProxyEndpoint(config) {
    return new URL('/zhusms', `${normalizeZhuSmsProxyBaseUrl(config.proxyBaseUrl)}/`).toString();
  }

  function serializeRequestBody(body) {
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
      return new URLSearchParams(Array.from(body.entries())).toString();
    }
    return String(body);
  }

  function buildProxyPayload(config, url, init = {}) {
    const target = new URL(url);
    const base = new URL(config.baseUrl);
    return {
      method: normalizeText(init.method || 'GET').toUpperCase() || 'GET',
      path: `${target.pathname}${target.search}`,
      sid: config.sid,
      baseUrl: base.origin,
      headers: init.headers || {},
      body: serializeRequestBody(init.body),
    };
  }

  function shouldRetryWithoutProxy(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return /无法连接|failed to fetch|load failed|networkerror|connection refused|err_connection_refused|err_failed|本地.*助手|local.*helper/.test(message);
  }

  async function fetchViaProxy(config, url, init = {}, actionLabel = 'ZhuSMS request') {
    const response = await config.fetchImpl(buildProxyEndpoint(config), {
      cache: 'no-store',
      method: 'POST',
      headers: {
        Accept: 'application/json,*/*',
        'Content-Type': 'application/json;charset=UTF-8',
      },
      body: JSON.stringify(buildProxyPayload(config, url, init)),
    });
    const text = await response.text().catch(() => '');
    const payload = parsePayload(text);
    if (!response.ok || (payload && typeof payload === 'object' && payload.ok === false)) {
      const detail = describePayload(payload) || `HTTP ${response.status}`;
      const error = new Error(`${actionLabel}失败：${detail}`);
      error.payload = payload;
      error.status = response.status;
      throw error;
    }
    return payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'payload')
      ? payload.payload
      : payload;
  }

  async function installSessionCookie(config) {
    const chromeCookies = (root?.chrome || globalThis.chrome)?.cookies;
    if (!chromeCookies?.set || !config.sid) {
      return false;
    }
    let origin = DEFAULT_BASE_URL;
    try {
      origin = new URL(config.baseUrl || DEFAULT_BASE_URL).origin;
    } catch {
      origin = DEFAULT_BASE_URL;
    }
    const details = {
      url: origin,
      name: 'zhusms_sid',
      value: config.sid,
      secure: true,
      sameSite: 'lax',
    };
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (!settled) {
          settled = true;
          resolve(Boolean(value));
        }
      };
      try {
        const maybePromise = chromeCookies.set(details, (cookie) => finish(cookie));
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then((cookie) => finish(cookie)).catch(() => finish(false));
        }
      } catch {
        finish(false);
      }
    });
  }

  async function fetchPayload(config, url, init = {}, actionLabel = 'ZhuSMS request') {
    if (!config.sid) {
      throw new Error('ZhuSMS session cookie 缺失，请在 ZhuSMS Cookie 填写 zhusms_sid 或完整 Cookie。');
    }
    if (typeof config.fetchImpl !== 'function') {
      throw new Error('ZhuSMS 网络请求实现不可用。');
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), Math.max(1000, Number(config.requestTimeoutMs) || DEFAULT_REQUEST_TIMEOUT_MS))
      : null;
    try {
      if (config.useProxy) {
        try {
          return await fetchViaProxy(config, url, init, actionLabel);
        } catch (error) {
          if (shouldRetryWithoutProxy(error)) {
            throw new Error(`${actionLabel}失败：无法连接 ZhuSMS 本地代理（${buildProxyEndpoint(config)}）。请重启 start-hotmail-helper 后重试。原始错误：${error?.message || error}`);
          }
          throw error;
        }
      }

      const installedCookie = await installSessionCookie(config);
      const response = await config.fetchImpl(url, {
        cache: 'no-store',
        credentials: 'include',
        ...init,
        headers: buildHeaders(config, init.headers || {}, { forceCookieHeader: !installedCookie }),
        signal: controller?.signal,
      });
      const text = await response.text().catch(() => '');
      const payload = parsePayload(text);
      if (!response.ok) {
        const error = new Error(`${actionLabel}失败：${describePayload(payload) || `HTTP ${response.status}`}`);
        error.payload = payload;
        error.status = response.status;
        throw error;
      }
      if (payload && typeof payload === 'object' && payload.ok === false) {
        const error = new Error(`${actionLabel}失败：${describePayload(payload) || '接口返回 ok=false'}`);
        error.payload = payload;
        throw error;
      }
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`${actionLabel}超时。`);
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  async function requestActivation(state = {}, _options = {}, deps = {}) {
    const config = resolveConfig(state, deps);
    const body = typeof FormData === 'function' ? new FormData() : new URLSearchParams();
    body.append('service', config.serviceCode);
    const headers = body instanceof URLSearchParams
      ? { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }
      : {};
    const payload = await fetchPayload(config, buildUrl(config, '/api/order/take'), {
      method: 'POST',
      body,
      headers,
    }, 'ZhuSMS take order');
    const orderNo = normalizeText(payload?.order_no || payload?.orderNo || payload?.activationId);
    const rawPhone = normalizeText(payload?.phone || payload?.phoneNumber || payload?.number);
    const phoneNumber = normalizeUsLocalPhone(rawPhone);
    if (!orderNo || !phoneNumber) {
      throw new Error(`ZhuSMS 获取手机号失败：${describePayload(payload) || '响应缺少 order_no 或 phone'}`);
    }
    return {
      activationId: orderNo,
      phoneNumber,
      provider: PROVIDER_ID,
      serviceCode: config.serviceCode,
      countryId: DEFAULT_COUNTRY_ID,
      countryLabel: DEFAULT_COUNTRY_LABEL,
      maxUses: 1,
      ...(Number(payload?.ttl_sec) > 0 ? { expiresAt: Date.now() + (Math.floor(Number(payload.ttl_sec)) * 1000) } : {}),
    };
  }

  function isTerminalStatus(status = '') {
    return /^(?:cancelled|canceled|expired|timeout|failed|fail|error|closed|refunded)$/i.test(normalizeText(status));
  }

  async function pollActivationCode(state = {}, activation = null, options = {}, deps = {}) {
    const config = resolveConfig(state, deps);
    const orderNo = normalizeText(activation?.activationId || activation?.order_no || activation?.orderNo);
    if (!orderNo) {
      throw new Error('缺少 ZhuSMS 手机号接码订单。');
    }
    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 180000);
    const intervalMs = Math.max(1000, Number(options.intervalMs) || 5000);
    const maxRoundsRaw = Math.floor(Number(options.maxRounds));
    const maxRounds = Number.isFinite(maxRoundsRaw) && maxRoundsRaw > 0 ? maxRoundsRaw : 0;
    const startedAt = Date.now();
    let pollCount = 0;
    let lastStatus = '';

    while (Date.now() - startedAt < timeoutMs) {
      if (maxRounds > 0 && pollCount >= maxRounds) {
        break;
      }
      deps.throwIfStopped?.();
      pollCount += 1;

      const url = new URL(buildUrl(config, '/api/order/status'));
      url.searchParams.set('order_no', orderNo);
      const payload = await fetchPayload(config, url.toString(), { method: 'GET' }, 'ZhuSMS order status');
      const status = normalizeText(payload?.status || '');
      const code = extractVerificationCode(payload);
      lastStatus = status || describePayload(payload) || 'waiting';

      if (typeof options.onStatus === 'function') {
        await options.onStatus({
          activation,
          elapsedMs: Date.now() - startedAt,
          pollCount,
          statusText: code ? `got:${code}` : lastStatus,
          timeoutMs,
        });
      }
      if (code) {
        return code;
      }
      if (isTerminalStatus(status)) {
        throw new Error(`ZhuSMS 订单在短信到达前已结束：${lastStatus}`);
      }
      if (typeof options.onWaitingForCode === 'function') {
        await options.onWaitingForCode({
          activation,
          elapsedMs: Date.now() - startedAt,
          pollCount,
          statusText: lastStatus,
          timeoutMs,
        });
      }
      if (Date.now() - startedAt >= timeoutMs) {
        break;
      }
      await deps.sleepWithStop?.(intervalMs);
    }

    throw new Error(`${PHONE_CODE_TIMEOUT_ERROR_PREFIX}等待手机验证码超时。ZhuSMS 最后状态：${lastStatus || 'waiting'}`);
  }

  async function finishActivation() {
    return 'OK';
  }

  async function cancelActivation() {
    return 'UNSUPPORTED';
  }

  async function requestAdditionalSms() {
    return 'UNSUPPORTED';
  }

  async function fetchBalance() {
    throw new Error('ZhuSMS 使用 session cookie，无余额接口。');
  }

  function resolveCountryCandidates() {
    return [{ id: DEFAULT_COUNTRY_ID, label: DEFAULT_COUNTRY_LABEL }];
  }

  function createProvider(deps = {}) {
    const providerDeps = {
      fetchImpl: deps.fetchImpl,
      proxyBaseUrl: deps.proxyBaseUrl,
      useProxy: deps.useProxy,
      sleepWithStop: deps.sleepWithStop || (async (ms) => new Promise((resolve) => setTimeout(resolve, ms))),
      throwIfStopped: deps.throwIfStopped,
      requestTimeoutMs: deps.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS,
    };
    return {
      id: PROVIDER_ID,
      label: PROVIDER_LABEL,
      defaultCountryId: DEFAULT_COUNTRY_ID,
      defaultCountryLabel: DEFAULT_COUNTRY_LABEL,
      defaultServiceCode: DEFAULT_SERVICE_CODE,
      normalizeSid: normalizeZhuSmsSid,
      normalizeServiceCode: normalizeZhuSmsServiceCode,
      normalizeCountryId: (value, fallback = DEFAULT_COUNTRY_ID) => {
        const parsed = Math.floor(Number(value));
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
      },
      normalizeCountryLabel: (value = '', fallback = DEFAULT_COUNTRY_LABEL) => normalizeText(value) || fallback,
      normalizeMaxPrice: () => '',
      resolveCountryCandidates,
      requestActivation: (state, options) => requestActivation(state, options, providerDeps),
      finishActivation,
      cancelActivation,
      banActivation: cancelActivation,
      requestAdditionalSms,
      pollActivationCode: (state, activation, options) => pollActivationCode(state, activation, options, providerDeps),
      fetchBalance,
      describePayload,
    };
  }

  return {
    PROVIDER_ID,
    PROVIDER_LABEL,
    DEFAULT_BASE_URL,
    DEFAULT_COUNTRY_ID,
    DEFAULT_COUNTRY_LABEL,
    DEFAULT_SERVICE_CODE,
    DEFAULT_PROXY_BASE_URL,
    extractVerificationCode,
    normalizeUsLocalPhone,
    normalizeZhuSmsBaseUrl,
    normalizeZhuSmsProxyBaseUrl,
    normalizeZhuSmsServiceCode,
    normalizeZhuSmsSid,
    createProvider,
  };
});
