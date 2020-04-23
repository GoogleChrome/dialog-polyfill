

/**
 * Ensure that the passed event names work as on... events.
 *
 * These have interesting semantics:
 *   - setting 'onfoo' ensures its place in the queue
 *   - updating 'onfoo' retains this place
 *   - clearing 'onfoo' removes from the queue
 *
 * @param {!Array<string>} events
 */
export function ensureNamedEvents(events) {
  for (const eventName of events) {
    const property = `on${eventName}`;
    if (property in HTMLElement.prototype) {
      continue;
    }

    const key = Symbol(property);
    Object.defineProperty(HTMLElement.prototype, property, {
      set(v) {
        const isFunction = (typeof v === 'function');
        if (typeof v !== 'object' && !isFunction) {
          v = null;
        }
        // TODO: we allow `object` here, for EventListener.handleEvent(), but Chrome and other
        // modern browsers don't seem to call this.

        let data = this[key];
        if (!v) {
          if (data) {
            this.removeEventListener(eventName, data.handler);
            delete this[key];
          }
          return;
        }

        if (!data) {
          const handler = (e) => this[key].internal(e);
          this.addEventListener(eventName, handler);
          data = this[key] = {handler, internal: v};
        } else {
          data.internal = v;
        }
      },
      get() {
        const data = this[key];
        return data && data.handler || null;
      },
    });
  }
}

/**
 * @param {?Element} el to check for stacking context
 * @return {boolean} whether this el or its parents creates a stacking context
 */
export function createsStackingContext(el) {
  // TODO: check for SD roots
  while (el && el !== document.body) {
    const s = window.getComputedStyle(el);
    const invalid = (key, ok) => {
      return !(s[key] === undefined || s[key] === ok);
    };

    if (s.opacity < 1 ||
        invalid('zIndex', 'auto') ||
        invalid('transform', 'none') ||
        invalid('mixBlendMode', 'normal') ||
        invalid('filter', 'none') ||
        invalid('perspective', 'none') ||
        s['isolation'] === 'isolate' ||
        s.position === 'fixed' ||
        s.webkitOverflowScrolling === 'touch') {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * Finds the nearest <dialog> from the passed element.
 *
 * TODO: this should maybe include searching through Shadow DOM
 *
 * @param {?Element} el to search from
 * @return {?HTMLDialogElement} dialog found
 */
export function findNearestDialog(el) {
  while (el) {
    if (el.localName === 'dialog') {
      return /** @type {HTMLDialogElement} */ (el);
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * Blurs the passed element, or if the element is within a shadow root, its ancestor closest to
 * the <body>.
 *
 * TODO: why do we care about SD?
 *
 * This also prevents blur on the <body>, working around an IE10 and earlier bug: blurring the body
 * causes Windows to hide the browser.
 *
 * @param {?Element} el to blur
 */
export function safeBlur(el) {
  // Find the actual focused element when the active element is inside a shadow root
  while (el && el.shadowRoot && el.shadowRoot.activeElement) {
    el = el.shadowRoot.activeElement;
  }

  if (el && el.blur && el !== document.body) {
    el.blur();
  }
}

/**
 * @param {!NodeList} nodeList to search
 * @param {?Node} node to find
 * @return {boolean} whether node is inside nodeList
 */
export function inNodeList(nodeList, node) {
  for (let i = 0; i < nodeList.length; ++i) {
    if (nodeList[i] === node) {
      return true;
    }
  }
  return false;
}

/**
 * @param {?HTMLFormElement} el to check
 * @return {boolean} whether this form has method="dialog"
 */
export function isFormMethodDialog(el) {
  if (!el || !el.hasAttribute('method')) {
    return false;
  }
  return el.getAttribute('method').toLowerCase() === 'dialog';
}

/**
 * Determines if an element is attached to the DOM, including within a shadow root.
 *
 * @param {?Element} element to check
 * @return {Boolean} whether the element is in DOM
 */
export function isConnected(element) {
  if (element.isConnected !== undefined) {
    return element.isConnected;
  }
  return document.body.contains(element);
}
