import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(
  new URL('../crates/benilla-app/src/web/config.rs', import.meta.url),
  'utf8',
);
const script = source.match(/inline_js = r#"([\s\S]*?)"#/)[1]
  .replaceAll('export function ', 'function ');
let reloads = 0;
const context = vm.createContext({
  window: { location: { reload() { reloads++; } } },
});
vm.runInContext(`${script}\nreturnToLogin();`, context);
assert.equal(reloads, 1, 'quitting restarts the browser client at login');
console.log('browser config: ok');
