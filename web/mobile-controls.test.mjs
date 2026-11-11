import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./mobile-controls.js', import.meta.url));
const { joystickKeys, actionVisibility, shouldForwardTouchPointer, isSmallTouchScreen } = await import(
  `data:text/javascript;base64,${source.toString('base64')}`
);

assert.deepEqual(joystickKeys(0, 0), []);
assert.deepEqual(joystickKeys(0.1, 0.1), []);
assert.deepEqual(joystickKeys(0, -0.8), ['KeyW']);
assert.deepEqual(joystickKeys(0, 0.8), ['KeyS']);
assert.deepEqual(joystickKeys(-0.8, 0), ['KeyA']);
assert.deepEqual(joystickKeys(0.8, 0), ['KeyD']);
assert.deepEqual(joystickKeys(-0.8, 0.8), ['KeyS', 'KeyA']);
assert.deepEqual(joystickKeys(0.8, -0.8), ['KeyW', 'KeyD']);
assert.deepEqual(
  actionVisibility({ hasTarget: false, canAttack: false, canInteract: false }),
  {
    target: true,
    autoRun: true,
    jump: true,
    attack: false,
    primary: false,
    interact: false,
  }
);
assert.deepEqual(
  actionVisibility({ hasTarget: true, canAttack: true, canInteract: false }),
  {
    target: true,
    autoRun: true,
    jump: true,
    attack: true,
    primary: true,
    interact: false,
  }
);
assert.deepEqual(
  actionVisibility({ hasTarget: true, canAttack: true, canInteract: true }),
  {
    target: true,
    autoRun: true,
    jump: true,
    attack: true,
    primary: true,
    interact: true,
  }
);

assert.equal(shouldForwardTouchPointer(true, 'touch'), true);
assert.equal(shouldForwardTouchPointer(false, 'touch'), false);
assert.equal(shouldForwardTouchPointer(true, 'mouse'), false);
assert.equal(isSmallTouchScreen(true, 390, 844), true);
assert.equal(isSmallTouchScreen(true, 844, 390), true);
assert.equal(isSmallTouchScreen(true, 1024, 768), false);
assert.equal(isSmallTouchScreen(false, 390, 844), false);

class FakeElement extends EventTarget {
  constructor() {
    super();
    this.style = {};
    this.dataset = {};
    this.children = [];
  }
  append(...children) { this.children.push(...children); }
  setAttribute() {}
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, bottom: 768, width: 1024, height: 768 }; }
  contains(element) { return this.children.includes(element); }
  focus() {}
}
class FakePointerEvent extends Event {
  constructor(type, options) {
    super(type, options);
    for (const [key, value] of Object.entries(options)) {
      if (!['bubbles', 'cancelable'].includes(key)) this[key] = value;
    }
  }
  getCoalescedEvents() { return []; }
}
const canvas = new FakeElement();
const document = new FakeElement();
document.head = new FakeElement();
document.body = new FakeElement();
document.createElement = () => new FakeElement();
document.getElementById = id => id === 'benilla' ? canvas : null;
globalThis.document = document;
globalThis.PointerEvent = FakePointerEvent;
globalThis.KeyboardEvent = FakePointerEvent;
Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 1 }, configurable: true });
globalThis.addEventListener = () => {};
globalThis.matchMedia = () => ({ matches: true });

await import(`data:text/javascript;base64,${source.toString('base64')}#dom`);
const controls = document.body.children.find(child => child.id === 'benilla-mobile-controls');
globalThis.BENILLA_MOBILE.setMode('game', true);
assert.equal(controls.dataset.visible, 'false');
globalThis.BENILLA_MOBILE.setMode('game', false);
assert.equal(controls.dataset.visible, 'true');
const keys = [];
canvas.addEventListener('keydown', event => keys.push([event.type, event.code]));
canvas.addEventListener('keyup', event => keys.push([event.type, event.code]));
const joystick = controls.children[0];
joystick.dispatchEvent(new FakePointerEvent('pointerdown', {
  pointerId: 3, clientX: 512, clientY: 0, cancelable: true,
}));
globalThis.BENILLA_MOBILE.setMode('game', true);
assert.equal(controls.dataset.visible, 'false');
joystick.dispatchEvent(new FakePointerEvent('pointermove', {
  pointerId: 3, clientX: 512, clientY: 0,
}));
assert.deepEqual(keys, [['keydown', 'KeyW'], ['keyup', 'KeyW']]);
globalThis.BENILLA_MOBILE.setMode('off', false);
assert.equal(controls.dataset.visible, 'false');
const forwarded = [];
for (const type of ['pointermove', 'pointerdown', 'pointerup']) {
  canvas.addEventListener(type, event => {
    forwarded.push([event.type, event.pointerType, event.button, event.buttons, event.clientX, event.clientY]);
    if (type === 'pointermove') assert.deepEqual(event.getCoalescedEvents(), [event]);
  });
}
globalThis.BENILLA_MOBILE.setMode('login');
canvas.dispatchEvent(new FakePointerEvent('pointerdown', {
  pointerType: 'touch', pointerId: 7, clientX: 120, clientY: 210, buttons: 1, cancelable: true,
}));
canvas.dispatchEvent(new FakePointerEvent('pointerup', {
  pointerType: 'touch', pointerId: 7, clientX: 120, clientY: 210, buttons: 0, cancelable: true,
}));
assert.deepEqual(forwarded, [
  ['pointermove', 'mouse', -1, 0, 120, 210],
  ['pointerdown', 'mouse', 0, 1, 120, 210],
  ['pointerup', 'mouse', 0, 0, 120, 210],
]);
forwarded.length = 0;
globalThis.BENILLA_MOBILE.setMode('off');
canvas.dispatchEvent(new FakePointerEvent('pointerdown', {
  pointerType: 'touch', pointerId: 8, clientX: 20, clientY: 30, buttons: 1, cancelable: true,
}));
canvas.dispatchEvent(new FakePointerEvent('pointerup', {
  pointerType: 'touch', pointerId: 8, clientX: 20, clientY: 30, buttons: 0, cancelable: true,
}));
assert.deepEqual(forwarded.map(event => event[0]), ['pointermove', 'pointerdown', 'pointerup']);

console.log('mobile controls: ok');
