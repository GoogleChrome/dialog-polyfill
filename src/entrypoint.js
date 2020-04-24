import polyfillElement from './element.js';
import nativeElement from './element-native.js';

if (!window.HTMLDialogElement) {
  customElements.define('x-dialog', polyfillElement);
} else {
  customElements.define('x-dialog', nativeElement);
}
