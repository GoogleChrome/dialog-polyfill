
const dialogSymbol = Symbol('dialog');


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
  display: none !important;
  align-items: center;
  justify-content: center;
  flex-flow: column;
  position: fixed;
  background: transparent;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
dialog[open] {
  display: flex !important;
}
dialog::backdrop {
  background: red;
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
      }
    });
  }

  show() {
    this[dialogSymbol].show();
  }

  showModal() {
    this[dialogSymbol].showModal();
  }

  close(returnValue) {
    this[dialogSymbol].close(returnValue);
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

