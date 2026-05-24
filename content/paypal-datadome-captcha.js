// content/paypal-datadome-captcha.js — DataDome 滑块（拖到最右型）自动通过。
// 通过 manifest 的 all_frames: true 注入到 paypal.com / *.captcha-delivery.com / *.ddc.paypal.com
// 各级 frame，因为 PayPal 偶发把 DataDome 验证码塞在跨域 iframe 里，
// 主页面的 paypal-flow.js 是访问不到的。
//
// 行为：document_idle 触发后，每 500ms 看一次 sliderContainer 是否出现；
// 出现后用人形轨迹（ease-in-out + Y 轴正弦/随机抖动 + 每步耗时扰动）一次拖完；
// 失败重试至多 3 次（每次随机等 1.5~2.4s 再试），全部失败就交回用户手动处理。

(function attachPayPalDataDomeCaptchaAutoSolver() {
  const SCRIPT_TAG = '[MultiPage:paypal-dd-captcha]';
  const SENTINEL_ATTR = 'data-multipage-paypal-dd-captcha-autorun';
  const MAX_AUTO_ATTEMPTS = 3;
  const POLL_INTERVAL_MS = 500;
  const POLL_TIMEOUT_MS = 15 * 60 * 1000; // 15 分钟内一直监听，超时退出

  // 同一个 document 只跑一次（每个 frame 是独立 document，所以 iframe / 主页面互不干扰）。
  if (document.documentElement.getAttribute(SENTINEL_ATTR) === '1') {
    console.log(SCRIPT_TAG, 'autosolver already attached on', location.href);
    return;
  }
  document.documentElement.setAttribute(SENTINEL_ATTR, '1');
  console.log(SCRIPT_TAG, 'autosolver attached on', location.href);

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
  }

  function isVisibleElement(el) {
    if (!el) return false;
    let node = el;
    while (node && node.nodeType === 1) {
      if (
        node.hidden
        || node.getAttribute?.('aria-hidden') === 'true'
        || node.getAttribute?.('inert') !== null
      ) {
        return false;
      }
      const style = window.getComputedStyle(node);
      if (
        style.display === 'none'
        || style.visibility === 'hidden'
        || style.visibility === 'collapse'
        || Number(style.opacity) === 0
      ) {
        return false;
      }
      node = node.parentElement;
    }
    const rect = el.getBoundingClientRect();
    return Number(rect.width) > 0 && Number(rect.height) > 0;
  }

  function findCaptchaContainer() {
    return document.getElementById('ddv1-captcha-container')
      || document.querySelector('[data-dd-ddv1-captcha-container]')
      || document.querySelector('.custom_captcha')
      || null;
  }

  function findSlideElements(container) {
    const root = container || findCaptchaContainer();
    if (!root) return null;
    const sliderContainer = root.querySelector('.sliderContainer');
    const slider = root.querySelector('.slider');
    const sliderBg = root.querySelector('.sliderbg');
    if (!sliderContainer || !slider || !sliderBg) {
      return null;
    }
    if (!isVisibleElement(slider) || !isVisibleElement(sliderBg)) {
      return null;
    }
    const sliderTarget = root.querySelector('.sliderTarget');
    return { container: root, sliderContainer, slider, sliderBg, sliderTarget };
  }

  function buildMainTrajectory(startX, startY, endX, endY) {
    // 主拖动段：ease-in-out + Y 轴正弦/随机抖动，30–48 步，总时长 700–1400ms。
    const totalDuration = 700 + Math.random() * 700;
    const stepCount = 30 + Math.floor(Math.random() * 19);
    const dx = endX - startX;
    const dy = endY - startY;
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
    const points = [];
    for (let i = 1; i <= stepCount; i += 1) {
      const linear = i / stepCount;
      const eased = easeInOut(linear);
      const baseX = startX + dx * eased;
      const baseY = startY + dy * eased;
      const jitterY = Math.sin(linear * Math.PI * 3) * 3 + (Math.random() - 0.5) * 1.5;
      const tElapsed = totalDuration * eased + (Math.random() - 0.5) * 8;
      points.push({ x: baseX, y: baseY + jitterY, t: tElapsed });
    }
    // 强制收尾两帧严格落在 endX，避免末段 ease 计算的浮点尾差让 DataDome 判位置不正确。
    if (points.length > 0) {
      points[points.length - 1].x = endX;
      points[points.length - 1].y = endY;
    }
    return { points, totalDuration };
  }

  function buildSettleTrajectory(prevX, prevY, endX, endY, baseT) {
    // 收尾段：小幅过冲 → 纠正回 endX → 在 endX 附近做 ~3 帧的"手停下来但抖一下"。
    // DataDome 会校验"final position + 末段 velocity → 0"，这一段对通过率影响很大。
    const points = [];
    let t = baseT;
    // 过冲 2–4px（人手的常见行为），耗时 50–90ms
    const overshoot = 2 + Math.random() * 2;
    t += 60 + Math.random() * 40;
    points.push({ x: endX + overshoot, y: endY + (Math.random() - 0.5) * 1.5, t });
    // 纠正回 endX，耗时 70–110ms
    t += 80 + Math.random() * 40;
    points.push({ x: endX, y: endY + (Math.random() - 0.5) * 1.0, t });
    // 静止 3 帧，每帧间隔 50–80ms，velocity 视作 0
    for (let i = 0; i < 3; i += 1) {
      t += 50 + Math.random() * 30;
      points.push({
        x: endX + (Math.random() - 0.5) * 0.6,
        y: endY + (Math.random() - 0.5) * 0.6,
        t,
      });
    }
    return points;
  }

  function buildEventInit(x, y, buttons) {
    return {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      screenX: x + (window.screenX || 0),
      screenY: y + (window.screenY || 0),
      button: 0,
      buttons,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      width: 1,
      height: 1,
      pressure: buttons ? 0.5 : 0,
    };
  }

  function dispatchPointerAndMouse(target, pointerType, init) {
    try {
      if (typeof PointerEvent === 'function') {
        target.dispatchEvent(new PointerEvent(pointerType, init));
      }
    } catch (error) {
      console.log(SCRIPT_TAG, `dispatch ${pointerType} (pointer) failed`, error?.message || error);
    }
    const mouseType = pointerType === 'pointerdown'
      ? 'mousedown'
      : (pointerType === 'pointerup' ? 'mouseup' : 'mousemove');
    try {
      target.dispatchEvent(new MouseEvent(mouseType, init));
    } catch (error) {
      console.log(SCRIPT_TAG, `dispatch ${mouseType} (mouse) failed`, error?.message || error);
    }
  }

  function buildTouchEvent(type, target, x, y) {
    // 部分 DataDome 实现只看 touch 事件（移动端模式），多发一份能扩大覆盖。
    if (typeof Touch !== 'function' || typeof TouchEvent !== 'function') {
      return null;
    }
    try {
      const touch = new Touch({
        identifier: 1,
        target,
        clientX: x,
        clientY: y,
        screenX: x + (window.screenX || 0),
        screenY: y + (window.screenY || 0),
        pageX: x + (window.scrollX || 0),
        pageY: y + (window.scrollY || 0),
        radiusX: 1,
        radiusY: 1,
        rotationAngle: 0,
        force: type === 'touchend' ? 0 : 0.5,
      });
      const touches = type === 'touchend' ? [] : [touch];
      const changedTouches = [touch];
      return new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        touches,
        targetTouches: type === 'touchend' ? [] : [touch],
        changedTouches,
      });
    } catch {
      return null;
    }
  }

  function dispatchTouch(target, type, x, y) {
    const event = buildTouchEvent(type, target, x, y);
    if (!event) return;
    try {
      target.dispatchEvent(event);
    } catch (error) {
      console.log(SCRIPT_TAG, `dispatch ${type} (touch) failed`, error?.message || error);
    }
  }

  async function dragSlider(slider, startX, startY, endX, endY) {
    // start
    const downInit = buildEventInit(startX, startY, 1);
    dispatchPointerAndMouse(slider, 'pointerdown', downInit);
    dispatchTouch(slider, 'touchstart', startX, startY);

    const { points: mainPoints, totalDuration } = buildMainTrajectory(startX, startY, endX, endY);
    const settlePoints = buildSettleTrajectory(endX, endY, endX, endY, totalDuration);
    const trajectory = mainPoints.concat(settlePoints);

    let lastT = 0;
    for (const point of trajectory) {
      const delay = Math.max(0, point.t - lastT);
      if (delay > 0) {
        await sleep(delay);
      }
      lastT = point.t;
      const init = buildEventInit(point.x, point.y, 1);
      // DataDome 一般同时在 slider 元素和 document 层挂监听，两个目标都派发。
      dispatchPointerAndMouse(slider, 'pointermove', init);
      dispatchPointerAndMouse(document, 'pointermove', init);
      dispatchTouch(slider, 'touchmove', point.x, point.y);
    }

    // 收尾再多停 80–160ms，模拟"人手放在终点想了一下"，再松手
    await sleep(80 + Math.random() * 80);
    const last = trajectory[trajectory.length - 1];
    const upInit = buildEventInit(last.x, last.y, 0);
    dispatchPointerAndMouse(slider, 'pointerup', upInit);
    dispatchPointerAndMouse(document, 'pointerup', upInit);
    dispatchTouch(slider, 'touchend', last.x, last.y);
  }

  async function attemptSolveOnce(elements, attempt) {
    const { slider, sliderBg, sliderTarget } = elements;
    // 给页面 100ms 沉淀，防止刚 mount 时 rect 还在变化
    await sleep(100);
    const sliderRect = slider.getBoundingClientRect();
    const bgRect = sliderBg.getBoundingClientRect();
    const targetRect = sliderTarget ? sliderTarget.getBoundingClientRect() : null;
    if (!sliderRect.width || !bgRect.width) {
      console.log(SCRIPT_TAG, `attempt ${attempt}: slider rect not ready`, { sliderRect, bgRect });
      return false;
    }

    const startX = sliderRect.left + sliderRect.width / 2;
    const startY = sliderRect.top + sliderRect.height / 2;

    // 优先用 .sliderTarget 真实位置算终点（DataDome 校验的就是滑块是否盖到这个 target 上）；
    // 没有 target 元素时退回到 sliderbg 右端减去 slider 一半的宽度。
    let intendedEndX;
    if (targetRect && targetRect.width) {
      intendedEndX = targetRect.left + targetRect.width / 2;
    } else {
      intendedEndX = bgRect.right - sliderRect.width / 2;
    }
    // 不再 +overshoot，避免落在轨道外被判位置不正确；过冲交给 settle 段在 endX 附近做。
    const endX = intendedEndX;
    const endY = startY + (Math.random() - 0.5) * 2;

    console.log(
      SCRIPT_TAG,
      `attempt ${attempt}/${MAX_AUTO_ATTEMPTS}: drag from (${Math.round(startX)},${Math.round(startY)}) to (${Math.round(endX)},${Math.round(endY)})`,
      { sliderWidth: Math.round(sliderRect.width), bgWidth: Math.round(bgRect.width), targetRect: targetRect ? { left: Math.round(targetRect.left), width: Math.round(targetRect.width) } : null }
    );
    await dragSlider(slider, startX, startY, endX, endY);

    // 静置等待服务端校验返回；DataDome 偶尔返回慢，给 2.4s
    await sleep(2400);

    // 校验后看页面状态：若已不存在 slideElements 视为成功；
    // 若 slider 仍可见但 DOM 里出现了"再试一次"提示，也认作失败（让外层重试）。
    const refreshed = findSlideElements(findCaptchaContainer());
    if (!refreshed) {
      console.log(SCRIPT_TAG, `attempt ${attempt} result: cleared`);
      return true;
    }
    const refreshedSliderRect = refreshed.slider.getBoundingClientRect();
    console.log(
      SCRIPT_TAG,
      `attempt ${attempt} result: still present, slider re-position=(${Math.round(refreshedSliderRect.left)},${Math.round(refreshedSliderRect.top)})`
    );
    return false;
  }

  async function attemptSolveViaCdp(elements, attempt) {
    const { slider, sliderBg, sliderTarget } = elements;
    // 给 DOM 100ms 沉淀，防止 rect 还在动
    await sleep(100);
    const sliderRect = slider.getBoundingClientRect();
    const bgRect = sliderBg.getBoundingClientRect();
    const targetRect = sliderTarget && isVisibleElement(sliderTarget)
      ? sliderTarget.getBoundingClientRect()
      : null;

    if (!sliderRect.width || !bgRect.width) {
      console.log(SCRIPT_TAG, `attempt ${attempt}: slider rect not ready`, { sliderRect, bgRect });
      return false;
    }

    // 终点用 .sliderTarget 真实位置；没有的话退回到 sliderBg 右端减半个 slider 宽。
    const localTargetRect = targetRect && targetRect.width
      ? { left: targetRect.left, top: targetRect.top, width: targetRect.width, height: targetRect.height }
      : {
        left: bgRect.right - sliderRect.width,
        top: bgRect.top,
        width: sliderRect.width,
        height: bgRect.height,
      };

    const payload = {
      frameUrl: location.href,
      sliderRect: {
        left: sliderRect.left,
        top: sliderRect.top,
        width: sliderRect.width,
        height: sliderRect.height,
      },
      targetRect: localTargetRect,
    };

    console.log(
      SCRIPT_TAG,
      `attempt ${attempt}/${MAX_AUTO_ATTEMPTS}: requesting CDP drag from background`,
      payload
    );

    const response = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { type: 'PAYPAL_DATADOME_SLIDE_REQUEST', payload },
          (resp) => {
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: chrome.runtime.lastError.message });
              return;
            }
            resolve(resp || { ok: false, error: 'background 未返回结果' });
          }
        );
      } catch (error) {
        resolve({ ok: false, error: error?.message || String(error) });
      }
    });

    if (!response?.ok) {
      console.log(SCRIPT_TAG, `attempt ${attempt}: CDP drag failed -> ${response?.error || 'unknown'}`);
      return false;
    }

    // 等服务端校验
    await sleep(2400);
    const stillPresent = Boolean(findSlideElements(findCaptchaContainer()));
    console.log(SCRIPT_TAG, `attempt ${attempt} result: ${stillPresent ? 'still present' : 'cleared'}`);
    return !stillPresent;
  }

  async function trySolveCaptcha() {
    for (let attempt = 1; attempt <= MAX_AUTO_ATTEMPTS; attempt += 1) {
      const elements = findSlideElements();
      if (!elements) {
        console.log(SCRIPT_TAG, 'captcha disappeared before attempt', attempt);
        return true;
      }
      try {
        const solved = await attemptSolveViaCdp(elements, attempt);
        if (solved) {
          console.log(SCRIPT_TAG, `solved on attempt ${attempt}`);
          return true;
        }
      } catch (error) {
        console.log(SCRIPT_TAG, `attempt ${attempt} threw`, error?.message || error);
      }
      if (attempt < MAX_AUTO_ATTEMPTS) {
        // 重试之间等一下，避免被 DataDome 当作"高频脚本"直接拉黑会话。
        const wait = 1500 + Math.random() * 900;
        console.log(SCRIPT_TAG, `waiting ${Math.round(wait)}ms before retry`);
        await sleep(wait);
      }
    }
    console.log(SCRIPT_TAG, 'all attempts exhausted, leaving captcha to manual solving');
    return false;
  }

  let solverRunning = false;
  let pollTimer = null;
  const pollStartedAt = Date.now();

  async function pollAndSolve() {
    if (solverRunning) return;
    if (Date.now() - pollStartedAt > POLL_TIMEOUT_MS) {
      console.log(SCRIPT_TAG, 'poll timeout reached, stopping');
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      return;
    }
    const elements = findSlideElements();
    if (!elements) {
      return;
    }
    solverRunning = true;
    console.log(SCRIPT_TAG, 'slider detected, starting auto solve');
    try {
      await trySolveCaptcha();
    } finally {
      solverRunning = false;
    }
  }

  // 首屏立即检查一次，然后周期性轮询直到滑块出现 / 超时退出。
  pollAndSolve();
  pollTimer = setInterval(pollAndSolve, POLL_INTERVAL_MS);

  // 滑块通常是动态插入的，加 MutationObserver 实现更快响应。
  try {
    const observer = new MutationObserver(() => {
      if (!solverRunning && findSlideElements()) {
        pollAndSolve();
      }
    });
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
    });
  } catch (error) {
    console.log(SCRIPT_TAG, 'MutationObserver setup failed', error?.message || error);
  }
})();
