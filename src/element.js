
import {ensureNamedEvents, focusFirst, composedPath} from './dom.js';


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

/** @type {boolean|undefined} */
let forwardTab = undefined;

/**
 */
function updateStack() {
  // The polyfill element only shows the top-most modal dialog, and its parents which are _also_
  // modal dialogs (as they are guaranteed to be behind the top-most). Others are hidden.
  const top = modalStack.find((dialog) => dialog.open) || null;
  const path = composedPath(top);
  modalStack.forEach((modal) => {
    if (path.indexOf(modal) !== -1) {
      modal[mainSymbol].classList.remove('removed');
    } else {
      modal[mainSymbol].classList.add('removed');
    }
  });

  if (top === topOpenModal) {
    return;
  }
  const blockingChange = (top === null || topOpenModal === null);
  topOpenModal = top;

  if (blockingChange) {
    if (top === null) {
      document.removeEventListener('focusin', focusHandler, true);
      window.removeEventListener('click', clickHandler, true);
      window.removeEventListener('keydown', keyHandler);
    } else {
      document.addEventListener('focusin', focusHandler, true);
      window.addEventListener('click', clickHandler, true);
      window.addEventListener('keydown', keyHandler);
    }
  }
}

const focusHandler = (e) => {
  if (topOpenModal.contains(e.target)) {
    return;  // fine
  }

  // This descends into the deepest possible root to find the actual active element, as the focusin
  // handler is only added on document.
  // TODO(samthor): Descend only from the root of `topOpenModal` to save frames (adding a listener
  // there is basically the same thing)
  let curr = e.target;
  while (curr && curr.shadowRoot && curr.shadowRoot.activeElement) {
    curr = curr.shadowRoot.activeElement;
  }

  const path = composedPath(curr);
  if (path.indexOf(topOpenModal) !== -1) {
    return;
  }

  const position = topOpenModal.compareDocumentPosition(event.target);
  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    console.warn('invalid focus before');
  } else {
    console.warn('invalid focus after');
  }

  e.preventDefault();

  console.warn('got INVALID focus', curr, 'top', topOpenModal, position);
};


const clickHandler = (e) => {
  forwardTab = false;
};


const keyHandler = (e) => {
  if (e.key === 'Tab' || e.keyCode === 9) {
    forwardTab = !e.shiftKey;
    return;
  }
  forwardTab = undefined;

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
#after {
  position: fixed;
}
</style>
<main><slot></slot></main>
<div id="after" tabindex="0"></div>
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

    const main = root.querySelector('main');

    // By creating a second element with tabindex="0", we contain focus within this element. So
    // once we _get_ focus within this element, users can't escape as all tabindex is scoped within
    // this. This is a weird side-effect of the Shadow DOM spec. (The tabindex can also be on the
    // outer element, but we can hide it from the light DOM this way).
    const innerRoot = main.attachShadow({mode: 'open'});
    innerRoot.append(document.createElement('slot'));
    main.tabIndex = -1;

    this[mainSymbol] = main;
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
    focusFirst(this[mainSymbol], {autofocus: true});
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
    focusFirst(this[mainSymbol], {autofocus: true});
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
