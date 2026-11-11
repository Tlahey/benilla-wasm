export function joystickKeys(dx, dy, deadZone = 0.22, directionThreshold = 0.38) {
  const distance = Math.hypot(dx, dy);
  if (distance < deadZone) return [];

  const x = dx / distance;
  const y = dy / distance;
  const keys = [];
  if (y <= -directionThreshold) keys.push('KeyW');
  if (y >= directionThreshold) keys.push('KeyS');
  if (x <= -directionThreshold) keys.push('KeyA');
  if (x >= directionThreshold) keys.push('KeyD');
  return keys;
}

export function actionVisibility(hud = {}) {
  const hasTarget = Boolean(hud.hasTarget);
  const canAttack = Boolean(hud.canAttack);
  const canInteract = Boolean(hud.canInteract);
  return {
    target: true,
    autoRun: true,
    jump: true,
    attack: hasTarget && canAttack,
    primary: hasTarget && canAttack,
    interact: hasTarget && canInteract,
  };
}

export function shouldForwardTouchPointer(touchEnabled, mode, pointerType) {
  return touchEnabled && (mode === 'login' || mode === 'game') && pointerType === 'touch';
}

function installMobileControls() {
  const canvas = document.getElementById('benilla');
  if (!canvas) return;

  const isTouch = () =>
    navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
  const pressedKeys = new Set();
  let mode = 'off';
  let submitPending = false;
  const hudState = {
    hasTarget: false,
    inCombat: false,
    canAttack: false,
    canInteract: false,
  };

  const style = document.createElement('style');
  style.textContent = `
    #benilla-mobile-account, #benilla-mobile-password {
      position: fixed;
      z-index: 6;
      box-sizing: border-box;
      padding: 0;
      border: 0;
      outline: 0;
      opacity: .01;
      color: transparent;
      -webkit-text-fill-color: transparent;
      caret-color: transparent;
      background: transparent;
      font-size: 16px;
      touch-action: manipulation;
    }
    #benilla-mobile-controls {
      position: fixed;
      z-index: 5;
      inset: 0;
      display: none;
      pointer-events: none;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
    #benilla-mobile-controls[data-visible="true"] { display: block; }
    .benilla-mobile-joystick {
      position: absolute;
      left: calc(18px + env(safe-area-inset-left));
      bottom: calc(18px + env(safe-area-inset-bottom));
      width: 132px;
      height: 132px;
      border: 2px solid #e8c77d99;
      border-radius: 50%;
      background: #10131cb3;
      box-shadow: 0 2px 12px #0009;
      pointer-events: auto;
      touch-action: none;
    }
    .benilla-mobile-joystick::before {
      content: "";
      position: absolute;
      inset: 30%;
      border: 1px solid #e8c77d55;
      border-radius: 50%;
    }
    .benilla-mobile-stick {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 54px;
      height: 54px;
      border: 2px solid #f1d89b;
      border-radius: 50%;
      background: #7d663bbf;
      box-shadow: 0 2px 8px #000b;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .benilla-mobile-actions {
      position: absolute;
      right: calc(18px + env(safe-area-inset-right));
      bottom: calc(18px + env(safe-area-inset-bottom));
      width: 248px;
      height: 248px;
      pointer-events: none;
    }
    .benilla-mobile-orbit {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .benilla-mobile-slot {
      position: absolute;
      width: 46px;
      height: 46px;
      border: 2px solid #e8c77d66;
      border-radius: 50%;
      box-shadow: 0 2px 8px #0008 inset, 0 1px 5px #0009;
      background: #0b0f1744;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .benilla-mobile-slot[data-core="true"] {
      width: 56px;
      height: 56px;
      border-color: #e8c77da0;
      background: #0b0f175a;
    }
    .benilla-mobile-button {
      position: absolute;
      width: 56px;
      height: 56px;
      padding: 0;
      border: 2px solid #e8c77dcc;
      border-radius: 50%;
      background: #10131cbb;
      color: #ffe3a3;
      font: 600 11px/1 system-ui, sans-serif;
      text-shadow: 0 1px 3px #000;
      box-shadow: 0 2px 10px #0009;
      pointer-events: auto;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      transform: translate(-50%, -50%);
      transition: opacity 100ms ease;
    }
    .benilla-mobile-button[data-armed="true"] {
      box-shadow: 0 0 0 2px #ffe49a44, 0 2px 12px #0009;
    }
    .benilla-mobile-button[data-highlight="true"] {
      border-color: #f9dd9f;
      background: #2f2116d9;
    }
    .benilla-mobile-button[data-hidden="true"] {
      opacity: 0;
      pointer-events: none;
    }
    .benilla-mobile-button:active, .benilla-mobile-joystick:active {
      background-color: #4a3825e6;
    }
    .benilla-mobile-button .caption {
      display: block;
      letter-spacing: .2px;
      line-height: 1;
    }
    .benilla-mobile-button .hint {
      display: block;
      margin-top: 4px;
      font-size: 9px;
      opacity: .9;
      line-height: 1;
    }
    @media (max-height: 500px) {
      .benilla-mobile-joystick {
        left: calc(12px + env(safe-area-inset-left));
        bottom: calc(10px + env(safe-area-inset-bottom));
        width: 104px;
        height: 104px;
      }
      .benilla-mobile-stick { width: 44px; height: 44px; }
      .benilla-mobile-actions {
        right: calc(12px + env(safe-area-inset-right));
        bottom: calc(10px + env(safe-area-inset-bottom));
        width: 212px;
        height: 212px;
      }
      .benilla-mobile-button {
        width: 48px;
        height: 48px;
      }
      .benilla-mobile-slot {
        width: 40px;
        height: 40px;
      }
      .benilla-mobile-slot[data-core="true"] {
        width: 50px;
        height: 50px;
      }
    }
  `;
  document.head.append(style);

  const account = document.createElement('input');
  account.id = 'benilla-mobile-account';
  account.type = 'text';
  account.name = 'username';
  account.maxLength = 16;
  account.autocomplete = 'username';
  account.autocapitalize = 'none';
  account.enterKeyHint = 'next';
  account.autocorrect = 'off';
  account.spellcheck = false;

  const password = document.createElement('input');
  password.id = 'benilla-mobile-password';
  password.type = 'password';
  password.name = 'password';
  password.maxLength = 16;
  password.autocomplete = 'current-password';
  password.autocapitalize = 'none';
  password.enterKeyHint = 'go';
  password.autocorrect = 'off';
  password.spellcheck = false;

  const loginInput = document.createElement('form');
  loginInput.id = 'benilla-mobile-login';
  loginInput.noValidate = true;
  loginInput.append(account, password);
  document.body.append(loginInput);

  const controlRoot = document.createElement('div');
  controlRoot.id = 'benilla-mobile-controls';
  const joystick = document.createElement('div');
  joystick.className = 'benilla-mobile-joystick';
  joystick.setAttribute('role', 'group');
  const stick = document.createElement('div');
  stick.className = 'benilla-mobile-stick';
  joystick.append(stick);

  const actions = document.createElement('div');
  actions.className = 'benilla-mobile-actions';
  const orbit = document.createElement('div');
  orbit.className = 'benilla-mobile-orbit';
  const orbitSlots = [
    [20, 77, false],
    [38, 58, false],
    [58, 40, false],
    [77, 22, false],
    [76, 77, true],
    [60, 60, true],
    [43, 44, true],
    [58, 92, false],
    [83, 56, false],
    [92, 81, false],
  ];
  for (const [x, y, core] of orbitSlots) {
    const slot = document.createElement('span');
    slot.className = 'benilla-mobile-slot';
    slot.style.left = `${x}%`;
    slot.style.top = `${y}%`;
    slot.dataset.core = String(core);
    orbit.append(slot);
  }
  actions.append(orbit);

  const actionButtons = [
    { id: 'target', key: 'Tab', code: 'Tab', label: 'mobile.target', caption: 'TAB', hint: 'TGT', x: 58, y: 92 },
    { id: 'autoRun', key: 'NumLock', code: 'NumLock', label: 'mobile.auto_run', caption: 'RUN', hint: 'AUTO', x: 92, y: 81 },
    { id: 'jump', key: ' ', code: 'Space', label: 'mobile.jump', caption: 'JMP', hint: 'UP', x: 83, y: 56 },
    { id: 'attack', key: '1', code: 'Digit1', label: 'mobile.attack', caption: 'ATK', hint: '1', x: 76, y: 77 },
    { id: 'primary', key: '2', code: 'Digit2', label: 'mobile.primary', caption: 'SKL', hint: '2', x: 60, y: 60 },
    { id: 'interact', key: 'f', code: 'KeyF', label: 'mobile.interact', caption: 'INT', hint: 'F', x: 43, y: 44 },
  ];
  const buttonEls = actionButtons.map(action => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'benilla-mobile-button';
    button.style.left = `${action.x}%`;
    button.style.top = `${action.y}%`;
    button.dataset.actionId = action.id;
    button.dataset.key = action.key;
    button.dataset.code = action.code;
    button.dataset.labelKey = action.label;
    button.innerHTML = `<span class="caption">${action.caption}</span><span class="hint">${action.hint}</span>`;
    actions.append(button);
    return button;
  });
  controlRoot.append(joystick, actions);
  document.body.append(controlRoot);

  function updateLoginPosition() {
    const rect = canvas.getBoundingClientRect();
    const scale = rect.height / 768;
    const display = mode === 'login' && isTouch() ? 'block' : 'none';
    for (const [input, bottom] of [[account, 345], [password, 270]]) {
      const width = Math.max(160 * scale, 180);
      const height = Math.max(37 * scale, 44);
      const style = {
        left: `${rect.left + rect.width / 2 + 88 * scale - width / 2}px`,
        top: `${rect.bottom - (bottom + 18.5) * scale - height / 2}px`,
        width: `${width}px`,
        height: `${height}px`,
        display,
      };
      for (const [property, value] of Object.entries(style)) {
        if (input.style[property] !== value) input.style[property] = value;
      }
    }
  }

  function dispatchKey(type, key, code) {
    const event = new KeyboardEvent(type, {
      key,
      code,
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(event);
  }

  function setPressedKey(key, code, pressed) {
    const id = `${key}:${code}`;
    if (pressed && !pressedKeys.has(id)) {
      pressedKeys.add(id);
      canvas.focus({ preventScroll: true });
      dispatchKey('keydown', key, code);
    } else if (!pressed && pressedKeys.delete(id)) {
      dispatchKey('keyup', key, code);
    }
  }

  function updateJoystick(event) {
    const rect = joystick.getBoundingClientRect();
    const radius = Math.max(1, rect.width / 2 - 8);
    const dx = (event.clientX - (rect.left + rect.width / 2)) / radius;
    const dy = (event.clientY - (rect.top + rect.height / 2)) / radius;
    const length = Math.min(1, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const x = Math.cos(angle) * length;
    const y = Math.sin(angle) * length;
    const next = new Set(joystickKeys(x, y));
    for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      const keyName = key.slice(3).toLowerCase();
      setPressedKey(keyName, key, next.has(key));
    }
    stick.style.left = `${50 + x * 32}%`;
    stick.style.top = `${50 + y * 32}%`;
  }

  function releaseJoystick() {
    for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      setPressedKey(key.slice(3).toLowerCase(), key, false);
    }
    stick.style.left = '50%';
    stick.style.top = '50%';
  }

  let joystickPointer = null;
  joystick.addEventListener('pointerdown', event => {
    event.preventDefault();
    joystickPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    updateJoystick(event);
  });
  joystick.addEventListener('pointermove', event => {
    if (event.pointerId === joystickPointer) updateJoystick(event);
  });
  const endJoystick = event => {
    if (event.pointerId !== joystickPointer) return;
    joystickPointer = null;
    releaseJoystick();
  };
  joystick.addEventListener('pointerup', endJoystick);
  joystick.addEventListener('pointercancel', endJoystick);

  for (const button of buttonEls) {
    const press = event => {
      event.preventDefault();
      if (!button.hasPointerCapture(event.pointerId)) {
        button.setPointerCapture(event.pointerId);
      }
      setPressedKey(button.dataset.key, button.dataset.code, true);
    };
    const release = event => {
      setPressedKey(button.dataset.key, button.dataset.code, false);
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  function applyHudVisibility() {
    const visibleByAction = actionVisibility(hudState);
    for (const button of buttonEls) {
      const actionId = button.dataset.actionId;
      const visible = visibleByAction[actionId] !== false;
      button.dataset.hidden = String(!visible);
      const highlighted = actionId === 'attack' && hudState.inCombat;
      button.dataset.highlight = String(highlighted);
      if (!visible) {
        setPressedKey(button.dataset.key, button.dataset.code, false);
      }
    }
    controlRoot.dataset.combat = String(hudState.inCombat);
  }

  function layoutLoginInputs() {
    updateLoginPosition();
  }
  addEventListener('resize', layoutLoginInputs);
  addEventListener('orientationchange', layoutLoginInputs);
  globalThis.visualViewport?.addEventListener('resize', layoutLoginInputs);

  const loginField = input => input === account ? 1 : input === password ? 2 : 0;
  account.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      password.focus();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      password.focus();
    }
  });
  password.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitPending = true;
      password.blur();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      account.focus();
    }
  });
  loginInput.addEventListener('submit', event => {
    event.preventDefault();
    submitPending = true;
  });

  const mouseLikePointers = new Map();
  function forwardTouchPointer(type, event, buttons) {
    const synthetic = new PointerEvent(type, {
      pointerId: 10000 + event.pointerId,
      pointerType: 'mouse',
      isPrimary: true,
      button: type === 'pointerdown' ? 0 : -1,
      buttons,
      clientX: event.clientX,
      clientY: event.clientY,
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(synthetic);
  }
  canvas.addEventListener('pointerdown', event => {
    if (!shouldForwardTouchPointer(isTouch(), mode, event.pointerType)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    mouseLikePointers.set(event.pointerId, true);
    canvas.setPointerCapture(event.pointerId);
    forwardTouchPointer('pointerdown', event, 1);
  }, true);
  canvas.addEventListener('pointermove', event => {
    if (!mouseLikePointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    forwardTouchPointer('pointermove', event, event.buttons ? 1 : 0);
  }, true);
  const finishTouchPointer = (type, event) => {
    if (!mouseLikePointers.delete(event.pointerId)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    forwardTouchPointer(type, event, 0);
  };
  canvas.addEventListener('pointerup', event => finishTouchPointer('pointerup', event), true);
  canvas.addEventListener('pointercancel', event => finishTouchPointer('pointerup', event), true);
  function releaseAll() {
    for (const key of [...pressedKeys]) {
      const [name, code] = key.split(':');
      setPressedKey(name, code, false);
    }
    releaseJoystick();
  }
  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });

  function setMode(nextMode) {
    mode = nextMode;
    const visible = mode === 'game' && isTouch();
    controlRoot.dataset.visible = String(visible);
    if (mode !== 'login') {
      if (loginInput.contains(document.activeElement)) document.activeElement.blur();
    }
    updateLoginPosition();
    applyHudVisibility();
    if (mode !== 'game') releaseAll();
  }

  function syncLogin(accountText, passwordText, enabled) {
    const visible = enabled && mode === 'login' && isTouch();
    if (!visible && loginInput.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    const hidden = !visible;
    if (loginInput.hidden !== hidden) loginInput.hidden = hidden;
    if (account.value !== accountText) account.value = accountText;
    if (password.value !== passwordText) password.value = passwordText;
  }

  globalThis.BENILLA_MOBILE = Object.freeze({
    isTouch,
    setMode,
    loginAccount: () => account.value,
    loginPassword: () => password.value,
    loginField: () => loginField(document.activeElement),
    takeLoginSubmit: () => {
      const pending = submitPending;
      submitPending = false;
      return pending;
    },
    setHudState(nextState) {
      if (!nextState || typeof nextState !== 'object') return;
      hudState.hasTarget = Boolean(nextState.hasTarget);
      hudState.inCombat = Boolean(nextState.inCombat);
      hudState.canAttack = Boolean(nextState.canAttack);
      hudState.canInteract = Boolean(nextState.canInteract);
      applyHudVisibility();
    },
    syncLogin,
    setLabels(text) {
      account.setAttribute('aria-label', text('mobile.account'));
      password.setAttribute('aria-label', text('mobile.password'));
      joystick.setAttribute('aria-label', text('mobile.movement'));
      for (const button of buttonEls) {
        button.setAttribute('aria-label', text(button.dataset.labelKey));
        button.title = text(button.dataset.labelKey);
      }
    },
  });

  globalThis.BENILLA_I18N?.ready.then(() => {
    globalThis.BENILLA_MOBILE?.setLabels(globalThis.BENILLA_I18N.text);
  }).catch(error => console.error('Mobile controls localization failed', error));
  applyHudVisibility();
  layoutLoginInputs();
}

if (typeof document !== 'undefined') installMobileControls();
