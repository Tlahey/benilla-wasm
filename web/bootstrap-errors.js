// Surface fatal startup failures in the bootstrap overlay.
//
// index.html's module script only catches rejected `init()` promises; a wasm
// trap after init resolves (e.g. bevy/wgpu failing to create a WebGL2 surface
// on a phone) leaves the overlay at "Loading client…" forever. Report the first
// real error instead, so a mobile user can see why the client did not start.
(() => {
  // iOS Safari has no Fullscreen API for arbitrary elements. winit calls
  // webkitRequestFullscreen() and throws when it is absent; a no-op keeps the
  // canvas windowed (the www client fills its parent anyway).
  if (typeof HTMLCanvasElement !== 'undefined'
      && !HTMLCanvasElement.prototype.webkitRequestFullscreen) {
    HTMLCanvasElement.prototype.webkitRequestFullscreen = function () {};
  }
  let lastCause = '';

  // Keep the most useful cause: wasm traps surface as a generic "unreachable"
  // after console.error already printed the real panic reason.
  const keep = (text) => {
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    return lines.find((line) => /Failed to|webgl2|webgl|webgpu/i.test(line))
      || lines[0] || '';
  };

  const show = (error) => {
    const status = document.getElementById('benilla-bootstrap-status');
    if (!status) return;
    const text = typeof error === 'string' ? error : (error?.message || String(error || ''));
    const cause = keep(text).slice(0, 240);
    if (!cause) return;
    // A trap's "unreachable" never replaces an explanation already shown.
    if (cause === 'unreachable' && lastCause && lastCause !== 'unreachable') return;
    lastCause = cause;
    let failed = 'Could not start the client. Refresh the page or check the gateway.';
    try {
      failed = globalThis.BENILLA_I18N?.text?.('client_failed') || failed;
    } catch (_) { /* i18n messages are not loaded yet; the fallback is fine */ }
    status.hidden = false;
    status.style.whiteSpace = 'pre-wrap';
    status.style.padding = '1rem';
    status.style.textAlign = 'center';
    status.textContent = `${failed}\n${cause}`;
  };

  // wasm panics are printed with console.error (the trap then surfaces as a
  // generic "unreachable"). Keep that explanation, but keep the original logs.
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const text = args.map((arg) => String(arg)).join(' ');
    if (text.includes('panicked at')) show(text);
    return originalConsoleError.apply(console, args);
  };

  addEventListener('error', (event) => {
    show(event.error || event.message || '');
  });
  addEventListener('unhandledrejection', (event) => {
    show(event.reason);
  });
})();
