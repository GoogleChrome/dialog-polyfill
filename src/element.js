
import {ensureNamedEvents, parentsOfName, focusFirst} from './dom.js';


const mainSymbol = Symbol('mainElement');
const returnSymbol = Symbol('returnValue');


/** @type {!Array<!SupportDialogElement>} */
const modalStack = [];

/**
 * @param {!SupportDialogElement} dialog
 * @param {boolean} modal
 */
function setModal(dialog, modal) {
  const modalIndex = modalStack.indexOf(dialog);
  const wasModal = (modalIndex !== -1);
  if (wasModal === modal) {
    return;  // nothing to do
  }

  const main = dialog[mainSymbol];
  if (modal) {
    modalStack.unshift(dialog);  // most recent is 0th index
    main.classList.add('modal');
  } else {
    modalStack.splice(modalIndex, 1);
    main.classList.remove('modal', 'removed');  // we can't be removed if not modal
  }
}

/** @type {?SupportDialogElement} */
let topOpenModal = null;

/**
 */
function updateStack() {
  // The polyfill element only shows the top-most modal dialog, and its parents which are _also_
  // modal dialogs (as they are guaranteed to be behind the top-most). Others are hidden.
  const top = modalStack.find((dialog) => dialog.open) || null;
  const parents = parentsOfName(top, dialog.localName);
  modalStack.forEach((modal) => {
    if (parents.has(modal)) {
      modal[mainSymbol].classList.remove('removed');
    } else {
      modal[mainSymbol].classList.add('removed');
    }
  });

  if (top === topOpenModal) {
    return;
  }
  console.warn('updating top', top, modalStack, new Error);
  topOpenModal = top;

  if (top === null) {
    window.removeEventListener('keydown', keyHandler);
  } else {
    window.addEventListener('keydown', keyHandler);
  }
}


const keyHandler = (e) => {
  if (e.key !== 'Escape' && e.keyCode !== 27) {
    return;
  }

  const event = new Event('cancel', {bubbles: false, cancelable: true});
  if (!topOpenModal.dispatchEvent(event)) {
    return;
  }

  topOpenModal.close();  // this'll get removed as a byproduct in setModal
  e.preventDefault();
  e.stopImmediatePropagation();
};


const supportTemplate = document.createElement('template');
supportTemplate.innerHTML = `
<style>
main {
  display: none;
  align-items: center;
  justify-content: center;
  flex-flow: column;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
:host([open]) main {
  display: flex;
}
main:not(.modal) {
  pointer-events: none;
}
main:not(.modal) ::slotted(*) {
  pointer-events: auto;
}
main.modal {
  background: rgba(255, 0, 0, 0.5);
}
main.removed {
  display: none !important;
}
</style>
<main><slot></slot></main>
`;


// Ensures that 'onclose' and 'oncancel' properties are on HTMLElement.
ensureNamedEvents(['close', 'cancel']);



export default class SupportDialogElement extends HTMLElement {
  static get observedAttributes() {
    return ['open'];
  }

  constructor() {
    super();

    const root = this.attachShadow({mode: 'open'});
    root.append(supportTemplate.content.cloneNode(true));
    this[mainSymbol] = root.querySelector('main');
 }

  show() {
    // If this was a modal, and .close() wasn't called, then this continues to be a modal.
    // So don't check or reset its state.
    this.open = true;

    if (modalStack.indexOf(this) !== -1) {
      // It's possible that we were hidden but set as modal.
      updateStack();
    }

    // TODO: this should fail if we're _not_ inside a modal
    // (but that's "as normal")
    focusFirst(this[mainSymbol]);
  }

  showModal() {
    const errorPrefix = `Failed to execute 'showModal' on 'HTMLDialogElement': The element`;
    if (this.open) {
      throw new DOMException(`${errorPrefix} already has an 'open' attribute, and therefore cannot be opened modally.`);
    } else if (!this.isConnected) {
      throw new DOMException(`${errorPrefix} is not in a Document.`);
    }
    this.open = true;
    setModal(this, true);
    updateStack();
    focusFirst(this[mainSymbol]);
  }

  close(returnValue) {
    if (this.open) {
      this.open = false;
      updateStack();
      setModal(this, false);

      if (returnValue !== undefined) {
        this.returnValue = returnValue;
      }
      this.dispatchEvent(new Event('close', {bubbles: false, cancelable: false}));
    }
  }

  disconnectedCallback() {
    // doesn't close, but does remove modal-ness
    updateStack();
    setModal(this, false);
  }

  get open() {
    return this.hasAttribute('open');
  }

  set open(v) {
    if (v) {
      this.setAttribute('open', '');
    } else {
      this.removeAttribute('open');
    }
  }

  get returnValue() {
    return this[returnSymbol];
  }

  set returnValue(v) {
    this[returnSymbol] = String(v);
  }

  attributeChangedCallback(attrName, oldValue, newValue) {
    if (attrName === 'open') {
      updateStack();
    }
  }
}
