

/**
 * Finds the complete composed path of the specified element, from the root.
 *
 * TODO: this abuses Event.composed. Is there a better way to do this?
 *
 * @param {?Element} element to get composed path of
 * @return {!Array<!Element|!ShadowRoot>} path
 */
export function composedPath(element) {
  if (!element) {
    return [];
  }
  let composedPath;
  const eventName = `__composed_${Math.random()}`;
  element.addEventListener(eventName, (e) => {
    composedPath = e.composedPath();
  }, {once: true});
  element.dispatchEvent(new Event(eventName, {composed: true}));
  return composedPath;
}


/**
 * Finds the first element that can be focused, and focus it.
 *
 * This recurses to find the answer.
 *
 * @param {!Element|!ShadowRoot} node
 * @return {?Element}
 */
export function focusFirst(node, {useTabIndex, autofocus} = {}) {
  const host = node.getRootNode();
  const focusAndCheck = (el) => {
    el.focus();
    return host.activeElement === cand;
  };

  if (autofocus) {
    const focused = Array.from(node.querySelectorAll('*[autofocus]')).some(focusAndCheck);
    if (focused) {
      return host.activeElement;
    }
  }

  // This isn't used for initial dialog focus, as Chrome's native implementation literally finds
  // the first focusable in DOM order.
  if (useTabIndex) {
    const focused = Array.from(node.querySelectorAll('*[tabindex]'))
        .filter((cand) => cand.tabIndex > 0)  // ignore "0" as they're normal
        .sort(({tabIndex: a}, {tabIndex: b}) => a - b)
        .some(focusAndCheck);
    if (focused) {
      return host.activeElement;
    }
  }

  // Walk through every element and find the first focusable.
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
  let {currentNode} = walker;
  while (currentNode) {
    if (currentNode instanceof window.HTMLSlotElement) {
      const assigned = currentNode.assignedElements();
      for (const element of assigned) {
        const result = focusFirst(element);
        if (result) {
          return result;
        }
      }
    }

    if (currentNode !== node) {
      currentNode.focus();
      if (host.activeElement === currentNode) {
        return currentNode;
      }
    }

    if (!currentNode.shadowRoot) {
      currentNode = walker.nextNode();
      continue;
    }

    const result = focusFirst(currentNode.shadowRoot);
    if (result) {
      return result;
    }
    // We don't want to descend into the subtree, because we find our elements via the shadowRoot.
    // So skip over it, or go up if there's no more siblings.
    do {
      if (currentNode = walker.nextSibling()) {
        continue;
      }
    } while (currentNode = walker.parentNode());
  }

  return null;
}


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
