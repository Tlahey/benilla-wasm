import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*(const addonsDialog[\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'dialog script exists');

const elements = new Map();
function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      listeners: {},
      addEventListener(name, callback) { this.listeners[name] = callback; },
      showModal() { this.open = true; },
      close() { this.open = false; },
      focus() { this.focused = true; },
      select() { this.selected = true; },
    });
  }
  return elements.get(id);
}

let copied;
const context = {
  document: { getElementById: element },
  navigator: { clipboard: { async writeText(text) { copied = text; } } },
  BENILLA_I18N: { text: key => key },
};
runInNewContext(script, context);

const text = '#1 [load] x1\n<script>literal</script>';
assert.equal(context.openDiagnosticCopyDialog(text), true);
assert.equal(element('benilla-diagnostic-text').value, text);
assert.equal(element('benilla-diagnostic-text').selected, true);
await element('benilla-diagnostic-copy').listeners.click();
assert.equal(copied, text);
assert.equal(element('benilla-diagnostic-status').textContent, 'diagnostics.copied');

context.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
element('benilla-diagnostic-text').selected = false;
await element('benilla-diagnostic-copy').listeners.click();
assert.equal(element('benilla-diagnostic-status').textContent, 'diagnostics.manual_copy');
assert.equal(element('benilla-diagnostic-text').selected, true);
element('benilla-diagnostic-close').listeners.click();
assert.equal(element('benilla-diagnostic-dialog').open, false);
