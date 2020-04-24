
import {composedPath} from './dom.js';
import * as shared from './shared.js';


const dialogSymbol = Symbol('dialog');


// Chrome won't .submit() a `<form method="dialog">` when it's actually in a nearby Shadow Root.
// We fix this for cases that match the custom element.
const nativeFormSubmit = HTMLFormElement.prototype.submit;
HTMLFormElement.prototype.submit = function() {
  if (this.method !== 'dialog') {
    return nativeFormSubmit.call(this);
  }

  const p = composedPath(this);

  // Find the nearest containing <dialog>, which exists even within <x-dialog>.
  const nativeDialogIndex = p.findIndex((cand) => cand.localName === 'dialog');
  if (nativeDialogIndex === -1) {
    return nativeFormSubmit.call(this);
  }
  const dialog = p[nativeDialogIndex];

  // Now, find the nearest <dialog> or <x-dialog>. If we find the native element or null, do nothing
  // as this means (somehow) we're just a native element (double dialog or no parent).
  const hit = p.slice(0, nativeDialogIndex).find((cand) => cand.localName === 'dialog' || cand instanceof NativeXDialogElement);
  if (!hit || hit.localName === 'dialog') {
    return nativeFormSubmit.call(this);
  }

  // The submit method doesn't dispatch an event.
  dialog.close();
};


/**
 * Native version of `x-dialog`, for Chrome and friends.
 */
export default class NativeXDialogElement extends HTMLElement {
  static get observedAttributes() {
    return ['open'];
  }

  constructor() {
    super();

    const root = this.attachShadow({mode: 'open'});
    root.innerHTML = `
<style>
dialog {
  padding: 0;
  border: 0;
  align-items: center;
  justify-content: center;
  flex-flow: column;
  background: transparent;
  display: none;
}
dialog[open] {
  display: flex;
}
dialog::backdrop {
  display: none;
}
dialog.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: auto;
  background: var(--backdrop-color, transparent);
  height: auto;
  width: auto;
}
</style>
<dialog><slot></slot></dialog>
    `;

    const d = /** @type {!HTMLDialogElement} */ (root.querySelector('dialog'));;
    this[dialogSymbol] = d;

    const mo = new MutationObserver(() => {
      if (d.open) {
        this.setAttribute('open', '');
      } else {
        this.removeAttribute('open');
      }
    });
    mo.observe(d, {attributes: true, attributeFilter: ['open']});

    d.addEventListener('close', (e) => {
      this.dispatchEvent(new Event('close', {bubbles: false, cancelable: false}));
    });

    d.addEventListener('cancel', (e) => {
      const clone = new Event('cancel', {bubbles: false, cancelable: true});
      if (!this.dispatchEvent(clone)) {
        e.preventDefault();
      } else {
        // In the polyfill, cancel calls close() which removes modal-ness.
        d.classList.remove('modal');
      }
    });

    // This isn't triggered by the <dialog>, it's actually by any enclosed form, and we just catch
    // the event as it bubbles.
    this.addEventListener('submit', shared.internalSubmitHandler.bind(this));
  }

  show() {
    this[dialogSymbol].show();
  }

  showModal() {
    const d = this[dialogSymbol];
    d.classList.add('modal');
    d.showModal();
  }

  close(returnValue) {
    const d = this[dialogSymbol];
    d.close(returnValue);
    d.classList.remove('modal');
  }

  disconnectedCallback() {
    const d = this[dialogSymbol];
    d.classList.remove('modal');
  }

  get open() {
    return this[dialogSymbol].open;
  }

  set open(v) {
    this[dialogSymbol].open = v;
  }

  get returnValue() {
    return this[dialogSymbol].returnValue;
  }

  set returnValue(v) {
    this[dialogSymbol].returnValue = v;
  }

  attributeChangedCallback(attrName, oldValue, newValue) {
    if (attrName === 'open') {
      const update = this.hasAttribute('open');
      if (update !== this[dialogSymbol].open) {
        this[dialogSymbol].open = update;
      }
    }
  }
}

