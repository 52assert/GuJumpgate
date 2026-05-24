(function attachSidepanelHostedSmsPoolManager(globalScope) {
  const SEPARATOR = '----';

  function createHostedSmsPoolManager(context = {}) {
    const {
      dom = {},
      helpers = {},
      state = {},
      actions = {},
      constants = {},
    } = context;

    const copyIcon = constants.copyIcon || '';
    let renderedEntries = [];
    let searchTerm = '';
    let filterMode = 'all';
    let loading = false;
    let refreshQueued = false;
    let cooldownTickHandle = null;
    // 缓存每行最后一次成功手动获取到的验证码，用于刷新后仍可显示+复制。
    // key: pool entry key; value: { code, fetchedAt }
    const manualCodeCache = new Map();

    function formatCooldownRemaining(ms) {
      const seconds = Math.max(0, Math.ceil(Number(ms) / 1000));
      if (seconds >= 60) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return s > 0 ? `${m}分${s}秒` : `${m}分钟`;
      }
      return `${seconds}秒`;
    }

    function formatCodeAge(ageMs) {
      const seconds = Math.max(0, Math.floor(Number(ageMs) / 1000));
      if (!Number.isFinite(seconds) || seconds < 0) {
        return '刚刚';
      }
      if (seconds < 60) {
        return `${seconds} 秒前`;
      }
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) {
        const remSeconds = seconds % 60;
        return remSeconds > 0 ? `${minutes} 分 ${remSeconds} 秒前` : `${minutes} 分钟前`;
      }
      const hours = Math.floor(minutes / 60);
      const remMinutes = minutes % 60;
      return remMinutes > 0 ? `${hours} 小时 ${remMinutes} 分前` : `${hours} 小时前`;
    }

    function formatLocalDateTime(date) {
      try {
        return date.toLocaleString();
      } catch {
        return date.toISOString();
      }
    }

    function ensureCooldownTicker() {
      const usage = normalizeUsage(state.getUsage?.());
      const hasDisabled = renderedEntries.some((entry) => {
        const item = usage[entry.key] || {};
        return Math.max(0, Number(item.disabledUntil) || 0) > Date.now();
      });
      const hasFetchedCode = renderedEntries.some((entry) => Boolean(manualCodeCache.get(entry.key)?.code));
      const needsTicker = hasDisabled || hasFetchedCode;
      if (needsTicker && !cooldownTickHandle) {
        cooldownTickHandle = setInterval(() => {
          // 仅在面板可见时才重新渲染，避免后台空转。
          if (state.isVisible && !state.isVisible()) {
            return;
          }
          render(renderedEntries);
        }, 1000);
      } else if (!needsTicker && cooldownTickHandle) {
        clearInterval(cooldownTickHandle);
        cooldownTickHandle = null;
      }
    }

    function normalizeText(value = '') {
      return String(value || '').trim();
    }

    function normalizePoolText(value = '') {
      return String(value || '')
        .replace(/\r/g, '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n');
    }

    function normalizeUsHostedPhoneDigits(value = '') {
      const rawValue = normalizeText(value);
      const digits = rawValue.replace(/\D+/g, '');
      if (digits.length === 11 && digits.startsWith('1')) {
        return digits.slice(1);
      }
      return digits || rawValue;
    }

    function normalizePoolPhone(value = '') {
      return normalizeUsHostedPhoneDigits(value);
    }

    function normalizePoolUrl(value = '') {
      const rawValue = normalizeText(value);
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

    function formatPayPalLocalPhone(value = '') {
      return normalizeUsHostedPhoneDigits(value);
    }

    function buildKey(phone = '', verificationUrl = '') {
      const normalizedPhone = normalizePoolPhone(phone);
      const normalizedUrl = normalizePoolUrl(verificationUrl);
      return normalizedPhone && normalizedUrl ? `${normalizedPhone}${SEPARATOR}${normalizedUrl}` : '';
    }

    function parseEntries(text = '') {
      const lines = normalizePoolText(text).split('\n').filter(Boolean);
      const seen = new Set();
      const entries = [];
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const separatorIndex = line.indexOf(SEPARATOR);
        const hasSeparator = separatorIndex > 0;
        const phone = hasSeparator
          ? normalizePoolPhone(line.slice(0, separatorIndex))
          : normalizePoolPhone(line);
        const verificationUrl = hasSeparator
          ? normalizePoolUrl(line.slice(separatorIndex + SEPARATOR.length))
          : normalizePoolUrl(lines[index + 1] || '');
        if (!hasSeparator && verificationUrl) {
          index += 1;
        }
        const key = buildKey(phone, verificationUrl);
        if (!phone || !verificationUrl || !key || seen.has(key)) {
          continue;
        }
        seen.add(key);
        entries.push({
          index,
          key,
          phone,
          verificationUrl,
        });
      }
      return entries;
    }

    function entriesToText(entries = []) {
      return parseEntries(entries.map((entry) => `${entry.phone}${SEPARATOR}${entry.verificationUrl}`).join('\n'))
        .map((entry) => `${entry.phone}${SEPARATOR}${entry.verificationUrl}`)
        .join('\n');
    }

    function normalizeUsage(value = {}) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
      }
      return Object.fromEntries(Object.entries(value).map(([key, item]) => {
        const usage = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
        const legacyUsedCount = Number(usage.usedAt) > 0 ? 1 : 0;
        const useCount = Math.max(0, Math.floor(Number(usage.useCount ?? usage.usageCount ?? legacyUsedCount) || 0));
        return [normalizeText(key), {
          useCount,
          usedAt: Math.max(0, Number(usage.usedAt) || 0),
          lastAttemptAt: Math.max(0, Number(usage.lastAttemptAt) || 0),
          lastError: normalizeText(usage.lastError),
          disabledUntil: Math.max(0, Number(usage.disabledUntil) || 0),
          unavailableCount: Math.max(0, Math.floor(Number(usage.unavailableCount) || 0)),
          lastUnavailableAt: Math.max(0, Number(usage.lastUnavailableAt) || 0),
        }];
      }).filter(([key]) => Boolean(key)));
    }

    function getCurrentKey() {
      const current = state.getCurrentEntry?.() || null;
      return normalizeText(current?.key || buildKey(current?.phone, current?.verificationUrl));
    }

    function getEntriesWithState(entries = renderedEntries) {
      const usage = normalizeUsage(state.getUsage?.());
      const currentKey = getCurrentKey();
      const now = Date.now();
      return parseEntries(entriesToText(entries)).map((entry) => {
        const itemUsage = usage[entry.key] || {};
        const disabledUntil = Math.max(0, Number(itemUsage.disabledUntil) || 0);
        const disabledRemainingMs = Math.max(0, disabledUntil - now);
        return {
          ...entry,
          current: Boolean(currentKey && entry.key === currentKey),
          useCount: Math.max(0, Math.floor(Number(itemUsage.useCount) || 0)),
          used: Math.max(0, Math.floor(Number(itemUsage.useCount) || 0)) > 0,
          lastAttemptAt: Math.max(0, Number(itemUsage.lastAttemptAt) || 0),
          lastError: normalizeText(itemUsage.lastError),
          disabledUntil,
          disabled: disabledRemainingMs > 0,
          disabledRemainingMs,
          unavailableCount: Math.max(0, Math.floor(Number(itemUsage.unavailableCount) || 0)),
          lastUnavailableAt: Math.max(0, Number(itemUsage.lastUnavailableAt) || 0),
        };
      });
    }

    function getFilteredEntries(entries = renderedEntries) {
      const normalizedSearch = normalizeText(searchTerm).toLowerCase();
      return getEntriesWithState(entries).filter((entry) => {
        const matchesFilter = (() => {
          switch (filterMode) {
            case 'current': return Boolean(entry.current);
            case 'used': return Boolean(entry.used);
            case 'unused': return !entry.used;
            case 'error': return Boolean(entry.lastError);
            case 'disabled': return Boolean(entry.disabled);
            case 'unavailable': return entry.unavailableCount > 0;
            default: return true;
          }
        })();
        if (!matchesFilter) {
          return false;
        }
        if (!normalizedSearch) {
          return true;
        }
        return [
          entry.phone,
          entry.verificationUrl,
          entry.current ? 'current 当前' : '',
          entry.used ? 'used 已用' : 'unused 未用',
          entry.lastError ? `error 异常 ${entry.lastError}` : '',
          entry.disabled ? 'disabled cooldown 冷却中' : '',
          entry.unavailableCount > 0 ? `unavailable 不可用 ${entry.unavailableCount}` : '',
        ].join(' ').toLowerCase().includes(normalizedSearch);
      });
    }

    function setLoading(nextLoading, summary = '') {
      loading = Boolean(nextLoading);
      [
        dom.btnHostedSmsPoolRefresh,
        dom.btnHostedSmsPoolClearUsed,
        dom.btnHostedSmsPoolDeleteAll,
        dom.btnHostedSmsPoolImport,
      ].forEach((button) => {
        if (button) button.disabled = loading;
      });
      if (dom.inputHostedSmsPoolImport) {
        dom.inputHostedSmsPoolImport.disabled = loading;
      }
      if (summary && dom.hostedSmsPoolSummary) {
        dom.hostedSmsPoolSummary.textContent = summary;
      }
    }

    function updateControls(entries = renderedEntries) {
      const entriesWithState = getEntriesWithState(entries);
      const usedCount = entriesWithState.filter((entry) => entry.useCount > 0).length;
      if (dom.btnHostedSmsPoolClearUsed) {
        dom.btnHostedSmsPoolClearUsed.disabled = loading || usedCount === 0;
      }
      if (dom.btnHostedSmsPoolDeleteAll) {
        dom.btnHostedSmsPoolDeleteAll.disabled = loading || entriesWithState.length === 0;
      }
    }

    function render(entries = parseEntries(state.getText?.())) {
      if (!dom.hostedSmsPoolList || !dom.hostedSmsPoolSummary) {
        return;
      }
      renderedEntries = parseEntries(entriesToText(entries));
      dom.hostedSmsPoolList.innerHTML = '';

      const entriesWithState = getEntriesWithState(renderedEntries);
      if (!entriesWithState.length) {
        dom.hostedSmsPoolList.innerHTML = '<div class="luckmail-empty">还没有 PayPal 号码，先导入一批号码再开始。</div>';
        dom.hostedSmsPoolSummary.textContent = '导入 PayPal 接码号码，每行一个号码和验证码接口。';
        updateControls([]);
        return;
      }

      const usedCount = entriesWithState.filter((entry) => entry.useCount > 0).length;
      const totalUseCount = entriesWithState.reduce((sum, entry) => sum + Math.max(0, Number(entry.useCount) || 0), 0);
      dom.hostedSmsPoolSummary.textContent = `已加载 ${entriesWithState.length} 个号码，${usedCount} 个有使用记录，累计使用 ${totalUseCount} 次。`;

      const visibleEntries = getFilteredEntries(renderedEntries);
      if (!visibleEntries.length) {
        dom.hostedSmsPoolList.innerHTML = '<div class="luckmail-empty">没有匹配当前筛选条件的号码。</div>';
        updateControls(renderedEntries);
        return;
      }

      for (const entry of visibleEntries) {
        const item = document.createElement('div');
        item.className = `luckmail-item${entry.current ? ' is-current' : ''}${entry.disabled ? ' is-disabled' : ''}`;
        const localPhone = formatPayPalLocalPhone(entry.phone);
        const cachedManualEntry = manualCodeCache.get(entry.key) || null;
        const cachedManualCode = cachedManualEntry?.code || '';
        const safeManualCode = cachedManualCode ? (helpers.escapeHtml?.(cachedManualCode) || cachedManualCode) : '';
        const cachedCodeTimeMs = Number(cachedManualEntry?.codeTimeMs) || 0;
        const cachedFetchedAtMs = Number(cachedManualEntry?.fetchedAtMs) || 0;
        const cachedCodeTimeText = String(cachedManualEntry?.codeTimeText || '').trim();
        const cachedCodeTimeDate = cachedCodeTimeMs > 0 ? new Date(cachedCodeTimeMs) : null;
        const cachedCodeAgeMs = cachedCodeTimeMs > 0 ? Math.max(0, Date.now() - cachedCodeTimeMs) : 0;
        const codeMeta = (() => {
          if (!cachedManualCode) {
            return '';
          }
          if (cachedCodeTimeDate) {
            const ageLabel = formatCodeAge(cachedCodeAgeMs);
            const localText = formatLocalDateTime(cachedCodeTimeDate);
            const isStale = cachedCodeAgeMs > 5 * 60 * 1000;
            const tone = isStale ? 'warn' : (cachedCodeAgeMs > 2 * 60 * 1000 ? 'muted' : 'fresh');
            const staleSuffix = isStale ? '（可能已失效）' : '';
            const escapedLocal = helpers.escapeHtml?.(localText) || localText;
            const escapedAge = helpers.escapeHtml?.(ageLabel) || ageLabel;
            const escapedStale = helpers.escapeHtml?.(staleSuffix) || staleSuffix;
            return `<span class="hosted-sms-pool-manual-code-time hosted-sms-pool-manual-code-time--${tone}">短信时间 ${escapedLocal}（${escapedAge}）${escapedStale}</span>`;
          }
          const fetchedAgo = cachedFetchedAtMs > 0
            ? formatCodeAge(Math.max(0, Date.now() - cachedFetchedAtMs))
            : '';
          const extra = cachedCodeTimeText
            ? ` 接口原值：${helpers.escapeHtml?.(cachedCodeTimeText) || cachedCodeTimeText}`
            : '';
          return `<span class="hosted-sms-pool-manual-code-time hosted-sms-pool-manual-code-time--muted">接口未返回短信时间${fetchedAgo ? `，获取于 ${fetchedAgo}` : ''}${extra}</span>`;
        })();
        const disabledTag = entry.disabled
          ? `<span class="luckmail-tag warn hosted-sms-pool-cooldown" title="该号码触发了 PayPal 拒绝（Try a different phone number），冷却结束后自动恢复可用。">冷却中 剩余 ${formatCooldownRemaining(entry.disabledRemainingMs)}</span>`
          : '';
        const unavailableTag = entry.unavailableCount > 0
          ? `<span class="luckmail-tag warn hosted-sms-pool-unavailable" title="PayPal 累计拒绝该号码 ${entry.unavailableCount} 次；成功取到一次验证码后会清零。">不可用 ${entry.unavailableCount} 次</span>`
          : '';
        const errorTag = !entry.disabled && entry.lastError
          ? `<span class="luckmail-tag warn" title="${helpers.escapeHtml?.(entry.lastError) || entry.lastError}">上次异常</span>`
          : '';
        const manualCodeBlock = cachedManualCode
          ? `<div class="hosted-sms-pool-manual-code-row">
              <span class="hosted-sms-pool-manual-code-label">验证码</span>
              <button
                class="hosted-sms-pool-manual-code"
                type="button"
                data-action="copy-manual-code"
                title="点击复制验证码"
                aria-label="复制验证码 ${safeManualCode}"
              >${safeManualCode}</button>
              <button class="btn btn-outline btn-xs" type="button" data-action="manual-fetch-code">重新获取</button>
              <button class="btn btn-ghost btn-xs" type="button" data-action="clear-manual-code" title="清除显示的验证码">×</button>
            </div>
            ${codeMeta ? `<div class="hosted-sms-pool-manual-code-meta">${codeMeta}</div>` : ''}`
          : '';
        item.innerHTML = `
          <div class="luckmail-item-main">
            <div class="luckmail-item-email-row">
              <div class="luckmail-item-email hosted-sms-pool-phone">
                <span>${helpers.escapeHtml?.(entry.phone) || entry.phone}</span>
                ${entry.current ? '<span class="hosted-sms-pool-current-label">当前</span>' : ''}
                ${localPhone && localPhone !== entry.phone ? `<span class="hosted-sms-pool-phone-local">PayPal 填 ${helpers.escapeHtml?.(localPhone) || localPhone}</span>` : ''}
              </div>
              <button
                class="hotmail-copy-btn"
                type="button"
                data-action="copy-phone"
                title="复制号码"
                aria-label="复制号码 ${helpers.escapeHtml?.(entry.phone) || entry.phone}"
              >${copyIcon}</button>
            </div>
            <div class="hosted-sms-pool-url-row">
              <div class="luckmail-item-details mono hosted-sms-pool-url-text">${helpers.escapeHtml?.(entry.verificationUrl) || entry.verificationUrl}</div>
              <button
                class="hotmail-copy-btn"
                type="button"
                data-action="copy-verification-url"
                title="复制验证码接口地址"
                aria-label="复制验证码接口地址"
              >${copyIcon}</button>
            </div>
            ${manualCodeBlock}
            <div class="luckmail-item-meta">
              ${entry.current ? '<span class="luckmail-tag current">当前</span>' : ''}
              <span class="luckmail-tag active">使用 ${Math.max(0, Number(entry.useCount) || 0)} 次</span>
              ${disabledTag}
              ${unavailableTag}
              ${errorTag}
            </div>
          </div>
          <div class="luckmail-item-actions">
            ${cachedManualCode ? '' : '<button class="btn btn-outline btn-xs" type="button" data-action="manual-fetch-code">手动获取验证码</button>'}
            ${entry.disabled ? '<button class="btn btn-outline btn-xs" type="button" data-action="clear-cooldown">提前恢复</button>' : ''}
            <button class="btn btn-outline btn-xs" type="button" data-action="increment-usage">次数 +1</button>
            <button class="btn btn-outline btn-xs" type="button" data-action="reset-usage">清零</button>
            <button class="btn btn-outline btn-xs" type="button" data-action="delete">删除</button>
          </div>
        `;

        item.querySelector('[data-action="copy-phone"]')?.addEventListener('click', async () => {
          await helpers.copyTextToClipboard?.(entry.phone || '');
          helpers.showToast?.('号码已复制', 'success', 1600);
        });

        item.querySelector('[data-action="copy-verification-url"]')?.addEventListener('click', async () => {
          const url = String(entry.verificationUrl || '').trim();
          if (!url) {
            helpers.showToast?.('该号码缺少验证码接口地址。', 'warn');
            return;
          }
          try {
            await helpers.copyTextToClipboard?.(url);
            helpers.showToast?.('接口地址已复制', 'success', 1600);
          } catch (error) {
            helpers.showToast?.(`复制失败：${error?.message || error}`, 'error');
          }
        });

        item.querySelector('[data-action="copy-manual-code"]')?.addEventListener('click', async () => {
          const code = manualCodeCache.get(entry.key)?.code || '';
          if (!code) {
            helpers.showToast?.('当前没有可复制的验证码。', 'warn');
            return;
          }
          try {
            await helpers.copyTextToClipboard?.(code);
            helpers.showToast?.('验证码已复制', 'success', 1600);
          } catch (error) {
            helpers.showToast?.(`复制失败：${error?.message || error}`, 'error');
          }
        });

        item.querySelector('[data-action="clear-manual-code"]')?.addEventListener('click', () => {
          manualCodeCache.delete(entry.key);
          render(renderedEntries);
        });

        item.querySelectorAll('[data-action="manual-fetch-code"]').forEach((button) => {
          button.addEventListener('click', async () => {
            await runManualFetchVerificationCode(entry, button);
          });
        });

        item.querySelector('[data-action="clear-cooldown"]')?.addEventListener('click', async () => {
          await patchPool(({ entries: entriesList, usage }) => {
            const nextUsage = { ...usage };
            nextUsage[entry.key] = {
              ...(nextUsage[entry.key] || {}),
              disabledUntil: 0,
              lastError: '',
            };
            return { entries: entriesList, usage: nextUsage };
          });
          helpers.showToast?.(`已结束 ${entry.phone} 的冷却。`, 'success', 1800);
        });

        item.querySelector('[data-action="increment-usage"]')?.addEventListener('click', async () => {
          await patchPool(({ entries: entriesList, usage }) => {
            const nextUsage = { ...usage };
            nextUsage[entry.key] = {
              ...(nextUsage[entry.key] || {}),
              useCount: Math.max(0, Number(nextUsage[entry.key]?.useCount) || 0) + 1,
              usedAt: Date.now(),
              lastAttemptAt: Math.max(0, Number(nextUsage[entry.key]?.lastAttemptAt) || 0),
              lastError: normalizeText(nextUsage[entry.key]?.lastError),
            };
            return { entries: entriesList, usage: nextUsage };
          });
        });

        item.querySelector('[data-action="reset-usage"]')?.addEventListener('click', async () => {
          await patchPool(({ entries: entriesList, usage }) => {
            const nextUsage = { ...usage };
            nextUsage[entry.key] = {
              ...(nextUsage[entry.key] || {}),
              useCount: 0,
              usedAt: 0,
              lastError: '',
              disabledUntil: 0,
              unavailableCount: 0,
              lastUnavailableAt: 0,
            };
            return { entries: entriesList, usage: nextUsage };
          });
        });

        item.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
          const confirmed = await helpers.openConfirmModal?.({
            title: '删除 PayPal 号码',
            message: `确认删除 ${entry.phone} 吗？此操作不可撤销。`,
            confirmLabel: '确认删除',
            confirmVariant: 'btn-danger',
          });
          if (!confirmed) return;
          manualCodeCache.delete(entry.key);
          await patchPool(({ entries: entriesList, usage }) => {
            const nextUsage = { ...usage };
            delete nextUsage[entry.key];
            return {
              entries: entriesList.filter((candidate) => candidate.key !== entry.key),
              usage: nextUsage,
            };
          });
        });

        dom.hostedSmsPoolList.appendChild(item);
      }

      updateControls(renderedEntries);
      ensureCooldownTicker();
    }

    async function runManualFetchVerificationCode(entry, button) {
      if (!entry?.verificationUrl) {
        helpers.showToast?.('该号码缺少验证码接口地址。', 'warn');
        return;
      }
      const sendMessage = actions.sendRuntimeMessage
        || helpers.sendRuntimeMessage
        || (async (message, timeoutMs, label) => {
          if (typeof globalScope?.sendRuntimeMessageWithTimeout === 'function') {
            return globalScope.sendRuntimeMessageWithTimeout(message, timeoutMs, label);
          }
          throw new Error('无法调用后台获取验证码接口。');
        });
      const previousLabel = button?.textContent || '手动获取验证码';
      if (button) {
        button.disabled = true;
        button.textContent = '获取中...';
      }
      try {
        const response = await sendMessage({
          type: 'FETCH_HOSTED_CHECKOUT_VERIFICATION_CODE',
          source: 'sidepanel',
          payload: {
            verificationUrl: entry.verificationUrl,
          },
        }, 20000, '手动获取验证码');
        const responseSnippet = String(response?.responseSnippet || '');
        if (response?.error || response?.ok === false) {
          const message = String(response?.error || '未返回有效验证码。');
          throw Object.assign(new Error(message), { responseSnippet });
        }
        const code = normalizeText(response?.code);
        if (!code) {
          throw Object.assign(new Error('未返回有效验证码。'), { responseSnippet });
        }
        const codeTimeMs = Math.max(0, Number(response?.codeTimeMs) || 0);
        const fetchedAtMs = Math.max(0, Number(response?.fetchedAtMs) || Date.now());
        manualCodeCache.set(entry.key, {
          code,
          codeTime: String(response?.codeTime || '').trim(),
          codeTimeMs,
          codeTimeText: String(response?.codeTimeText || '').trim(),
          fetchedAtMs,
          responseSnippet,
        });
        if (codeTimeMs > 0) {
          const ageMs = Math.max(0, Date.now() - codeTimeMs);
          const ageLabel = formatCodeAge(ageMs);
          if (ageMs > 5 * 60 * 1000) {
            helpers.showToast?.(`验证码 ${code}（短信 ${ageLabel}，可能已失效）`, 'warn', 3200);
          } else {
            helpers.showToast?.(`已获取验证码 ${code}（${ageLabel}）`, 'success', 2600);
          }
        } else {
          helpers.showToast?.(`已获取验证码 ${code}（接口未返回短信时间）`, 'warn', 2800);
        }
        render(renderedEntries);
      } catch (error) {
        const message = error?.message || String(error || '手动获取验证码失败');
        const snippet = String(error?.responseSnippet || '').trim();
        // 把响应预览缓存下来即便没拿到验证码也能展示给用户，方便确认接口到底返回了什么。
        manualCodeCache.set(entry.key, {
          ...(manualCodeCache.get(entry.key) || {}),
          code: '',
          lastError: message,
          responseSnippet: snippet,
          fetchedAtMs: Date.now(),
        });
        if (snippet) {
          helpers.showToast?.(`${message}\n响应片段：${snippet.slice(0, 160)}`, 'error', 5200);
        } else {
          helpers.showToast?.(message, 'error');
        }
        render(renderedEntries);
      } finally {
        if (button && !button.isConnected) {
          // 重新渲染后旧 button 被替换，跳过状态恢复。
          return;
        }
        if (button) {
          button.disabled = false;
          button.textContent = previousLabel;
        }
      }
    }

    async function patchPool(mutator) {
      const previousText = normalizePoolText(state.getText?.());
      const previousUsage = normalizeUsage(state.getUsage?.());
      const previousEntries = parseEntries(previousText);
      const result = mutator({
        entries: previousEntries.map((entry) => ({ ...entry })),
        usage: { ...previousUsage },
      }) || {};
      const nextEntries = parseEntries(entriesToText(result.entries || previousEntries));
      const nextUsage = normalizeUsage(result.usage || previousUsage);
      const nextText = entriesToText(nextEntries);

      setLoading(true, '正在更新 PayPal 号池...');
      state.setText?.(nextText);
      state.setUsage?.(nextUsage);
      render(nextEntries);
      try {
        await actions.persistPool?.();
        return true;
      } catch (error) {
        state.setText?.(previousText);
        state.setUsage?.(previousUsage);
        render(previousEntries);
        helpers.showToast?.(`更新 PayPal 号池失败：${error.message}`, 'error');
        return false;
      } finally {
        setLoading(false);
      }
    }

    async function importEntries() {
      const text = normalizePoolText(dom.inputHostedSmsPoolImport?.value || '');
      if (!text) {
        helpers.showToast?.('请先粘贴 PayPal 号码，每行一个号码和验证码接口。', 'warn');
        return;
      }

      const previousEntries = parseEntries(state.getText?.());
      const knownKeys = new Set(previousEntries.map((entry) => entry.key));
      const imported = [];
      let skippedCount = 0;
      for (const entry of parseEntries(text)) {
        if (knownKeys.has(entry.key)) {
          skippedCount += 1;
          continue;
        }
        knownKeys.add(entry.key);
        imported.push(entry);
      }
      if (!imported.length) {
        helpers.showToast?.(skippedCount > 0 ? '没有可导入的新号码（可能都重复或格式无效）。' : '没有识别到有效号码。', 'warn');
        return;
      }

      const persisted = await patchPool(({ entries, usage }) => ({
        entries: [...entries, ...imported],
        usage,
      }));
      if (!persisted) {
        return;
      }
      if (dom.inputHostedSmsPoolImport) {
        dom.inputHostedSmsPoolImport.value = '';
      }
      helpers.showToast?.(
        skippedCount > 0
          ? `已导入 ${imported.length} 个号码，跳过 ${skippedCount} 条重复数据。`
          : `已导入 ${imported.length} 个号码。`,
        'success',
        2200
      );
    }

    async function clearUsedState() {
      const confirmed = await helpers.openConfirmModal?.({
        title: '清空使用次数',
        message: '确认清空 PayPal 号池的使用次数吗？号码本身会保留。',
        confirmLabel: '清空次数',
      });
      if (!confirmed) return;
      await patchPool(({ entries }) => ({ entries, usage: {} }));
    }

    async function deleteAll() {
      const confirmed = await helpers.openConfirmModal?.({
        title: '删除 PayPal 号池',
        message: '确认删除当前全部 PayPal 号码吗？此操作不可撤销。',
        confirmLabel: '确认删除',
        confirmVariant: 'btn-danger',
      });
      if (!confirmed) return;
      await patchPool(() => ({ entries: [], usage: {} }));
    }

    function refresh(options = {}) {
      const { silent = false } = options;
      if (state.isVisible && !state.isVisible()) {
        return;
      }
      if (!silent) setLoading(true, '正在刷新 PayPal 号池...');
      render(parseEntries(state.getText?.()));
      if (!silent) setLoading(false);
    }

    function queueRefresh() {
      if (refreshQueued) return;
      refreshQueued = true;
      setTimeout(() => {
        refreshQueued = false;
        refresh({ silent: true });
      }, 120);
    }

    function bindEvents() {
      dom.btnHostedSmsPoolRefresh?.addEventListener('click', () => refresh());
      dom.btnHostedSmsPoolImport?.addEventListener('click', () => {
        void importEntries();
      });
      dom.inputHostedSmsPoolImport?.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          void importEntries();
        }
      });
      dom.inputHostedSmsPoolSearch?.addEventListener('input', (event) => {
        searchTerm = normalizeText(event.target.value);
        render(renderedEntries);
      });
      dom.selectHostedSmsPoolFilter?.addEventListener('change', (event) => {
        filterMode = normalizeText(event.target.value) || 'all';
        render(renderedEntries);
      });
      dom.btnHostedSmsPoolClearUsed?.addEventListener('click', () => {
        void clearUsedState();
      });
      dom.btnHostedSmsPoolDeleteAll?.addEventListener('click', () => {
        void deleteAll();
      });
    }

    function reset() {
      searchTerm = '';
      filterMode = 'all';
      if (cooldownTickHandle) {
        clearInterval(cooldownTickHandle);
        cooldownTickHandle = null;
      }
      manualCodeCache.clear();
      if (dom.inputHostedSmsPoolSearch) dom.inputHostedSmsPoolSearch.value = '';
      if (dom.selectHostedSmsPoolFilter) dom.selectHostedSmsPoolFilter.value = 'all';
      if (dom.hostedSmsPoolList) dom.hostedSmsPoolList.innerHTML = '';
      if (dom.hostedSmsPoolSummary) {
        dom.hostedSmsPoolSummary.textContent = '导入 PayPal 接码号码，每行一个号码和验证码接口。';
      }
      updateControls([]);
    }

    return {
      bindEvents,
      queueRefresh,
      refresh,
      render,
      reset,
    };
  }

  globalScope.SidepanelHostedSmsPoolManager = {
    createHostedSmsPoolManager,
  };
})(typeof window !== 'undefined' ? window : globalThis);
