
import {ensureNamedEvents, focusFirst, focusLast, composedPath, isTabbableBefore} from './dom.js';


const mainSymbol = Symbol('mainElement');
const outerSymbol = Symbol('outerElement');
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

  const outer = dialog[outerSymbol];
  if (modal) {
    modalStack.unshift(dialog);  // most recent is 0th index
    outer.classList.add('modal');
  } else {
    modalStack.splice(modalIndex, 1);
    outer.classList.remove('modal', 'removed');  // we can't be removed if not modal
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
    const outer = modal[outerSymbol];
    if (path.indexOf(modal) !== -1) {
      outer.classList.remove('removed');
    } else {
      outer.classList.add('removed');
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
    return;  // simple case
  }

  // This descends into the deepest possible root to find the actual active element, as the focusin
  // handler is only added on document.
  // TODO(samthor): Descend only from the root of `topOpenModal` to save frames (adding a listener
  // there is basically the same thing), but this might not work because of odd <slot> arrangement.
  let curr = e.target;
  while (curr && curr.shadowRoot && curr.shadowRoot.activeElement) {
    curr = curr.shadowRoot.activeElement;
  }

  const focusPath = composedPath(curr);
  if (focusPath.indexOf(topOpenModal) !== -1) {
    return;
  }

  const isBefore = isTabbableBefore(curr, topOpenModal);
  const main = topOpenModal[mainSymbol];
  console.warn('got unknown focus', isBefore);
  if (isBefore) {
    focusFirst(main, {useTabIndex: true});
  } else {
    focusLast(main);
  }
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
  display: flex;
  align-items: center;
  justify-content: center;
  flex-flow: column;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
:host(:not([open])) #outer,
#outer.removed {
  display: none;
}
#outer:not(.modal) main {
  pointer-events: none;
}
#outer:not(.modal) main ::slotted(*) {
  pointer-events: auto;
}
#outer.modal main {
  background: rgba(255, 0, 0, 0.5);
}
div {
  position: fixed;
}
</style>
<div id="outer" tabindex="0">
  <main><slot></slot></main>
  <div id="after" tabindex="0"></div>
</div>
`;


// Ensures that 'onclose' and 'oncancel' properties are on HTMLElement.
ensureNamedEvents(['close', 'cancel']);


/**
 * Configures the passed element with a no-op Shadow Root and a default negative tabindex.
 *
 * Naïvely, this appears pointless. In reality, it scopes tab focusing within this element, so that
 * all contained elements (until another 'scoped' tabindex root) are tabbed to together.
 *
 * @param {!Element} el to attach root to
 */
function configureEmptySlot(el, tabIndex = -1) {
  const root = el.attachShadow({mode: 'open'});
  root.appendChild(document.createElement('slot'));
}


export default class SupportDialogElement extends HTMLElement {
  static get observedAttributes() {
    return ['open'];
  }

  constructor() {
    super();

    const root = this.attachShadow({mode: 'open'});
    root.append(supportTemplate.content.cloneNode(true));

    const outer = root.getElementById('outer');
    this[outerSymbol] = outer;

    const main = root.querySelector('main');
    this[mainSymbol] = main;

    // Naïvely, this appears pointless. In reality, it scopes tab focusing within this element, so
    // that all contained elements (until another 'scoped' tabindex root) are tabbed to together.
    // This ensures that 'outer' and 'after' both are ordered correctly.
    main.attachShadow({mode: 'open'}).appendChild(document.createElement('slot'));

    const after = root.getElementById('after');

    outer.addEventListener('focus', () => {
      if (forwardTab === false) {
        // The user tabbed backwards out of the dialog. Move to the end.
        focusLast(main);
      } else {
        // Unknown, focus on first.
        focusFirst(main, {useTabIndex: true});
      }
    });
    after.addEventListener('focus', () => {
      if (forwardTab === true) {
        // The user tabbed forward out of the dialog. Move to the start.
        focusFirst(main, {useTabIndex: true});
      } else {
        // Unknown, focus on last.
        focusLast(main);
      }
    });
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
    focusFirst(this[mainSymbol], {autofocus: true, allowIgnored: true});
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
    const show = focusFirst(this[mainSymbol], {autofocus: true, allowIgnored: true});
    console.warn('showing', show);
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
