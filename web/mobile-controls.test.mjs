import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./mobile-controls.js', import.meta.url));
const { joystickKeys } = await import(
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

console.log('mobile controls: ok');
