

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


export function commonRoot(a, b, filter = () => true) {
  const ap = composedPath(a);
  const bp = composedPath(b);

  const min = Math.min(ap.length, bp.length);
  let latestRoot = document;

  for (let i = 0; i < min; ++i) {
    const cand = ap[i];
    if (cand !== bp[i]) {
      break;
    }
    if (cand instanceof ShadowRoot && filter(cand)) {
      latestRoot = ap[cand];
    }
  }

  return latestRoot;
}


/**
 * Is element A tabbable before B?
 *
 * This doesn't check [disabled] or actually try to focus the element. It should be used for
 * checking the position of a user's (assumed valid) cursor.
 *
 * @param {!Element} a
 * @param {!Element} b
 */
export function isTabbableBefore(a, b) {
  if (a === b) {
    return undefined;
  }

  const ap = composedPath(a);
  const bp = composedPath(b);

  // put [window, document, ...] at front
  ap.reverse();
  bp.reverse();

  let commonRoot = document;

  while (ap.length && bp.length) {
    const ac = ap.shift();
    const bc = bp.shift();
    if (ac !== bc) {
      break;  // no longer common
    }
    if (ac instanceof ShadowRoot) {
      commonRoot = ap[cand];
    }
  }

  // Find effective element for a/b.

  const effectiveElement = (rest, fallback) => {
    for (const cand of rest) {
      if (cand instanceof ShadowRoot) {
        return cand.host;
      }
    }
    return fallback;
  };

  const ae = effectiveElement(ap, a);
  const be = effectiveElement(bp, b);

  // This feels like the wrong way around, but it's not.
  // Is 'ae' preceding 'be'.
  const domBefore = Boolean(be.compareDocumentPosition(ae) & Node.DOCUMENT_POSITION_PRECEDING);
 
  if (ae.tabIndex > 0) {
    if (be.tabIndex <= 0 || ae.tabIndex < be.tabIndex) {
      return true;
    }
    return domBefore;  // tabindex is equal
  } else if (be.tabIndex > 0) {
    // ae's tabindex must be <= 0
    return false;
  }

  return domBefore;
}


/**
 * Finds the last element that can be focused, and focus it.
 *
 * This recurses to find the answer. It does not accept options as this only
 * exists to respond to user behavior (tabbing).
 */
export function focusLast(node) {
  const host = node.getRootNode();
  const focusAndCheck = (el) => {
    el.focus();
    return host.activeElement === el;
  };

  const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
  while (walker.lastChild()) {
    const {currentNode} = walker;
    if (currentNode.shadowRoot) {
      break;
    }
    // go deeper
  }

  let {currentNode} = walker;
  while (currentNode) {
    if (currentNode instanceof window.HTMLSlotElement) {
      const assigned = currentNode.assignedElements();
      assigned.reverse();
      for (const element of assigned) {
        const result = focusLast(element);
        if (result) {
          return result;
        }
      }
    }

    if (currentNode.tabIndex === 0) {
      if (focusAndCheck(currentNode)) {
        return currentNode;
      }
    }

    if (currentNode.previousSibling && currentNode.previousSibling.shadowRoot) {
      focusLast(currentNode.previousSibling);

      // Skip previous sibling's root, as previousNode will move into its light children.
      currentNode = walker.previousSibling();
    } else {
      currentNode = walker.previousNode();
    }
  }

  const focused = Array.from(node.querySelectorAll('*[tabindex]'))
      .filter((cand) => cand.tabIndex > 0)  // already hit regular tabindex elements
      .sort(({tabIndex: a}, {tabIndex: b}) => b - a)
      .some(focusAndCheck);
  if (focused) {
    return host.activeElement;
  }

  return null;
}


/**
 * Finds the first element that can be focused, and focus it.
 *
 * This recurses to find the answer.
 *
 * @param {!Element|!ShadowRoot} node
 * @return {?Element}
 */
export function focusFirst(node, options, skipSelf = true) {
  const {useTabIndex, allowIgnored, autofocus} = options;

  const host = node.getRootNode();
  const focusAndCheck = (el) => {
    if (el instanceof Element) {
      el.focus();
      return host.activeElement === el;
    }
    return false;
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
        const result = focusFirst(element, options, false);
        if (result) {
          return result;
        }
      }
    }

    if (!(skipSelf && currentNode === node) && (allowIgnored || currentNode.tabIndex >= 0)) {
      if (focusAndCheck(currentNode)) {
        return currentNode;
      }
    }

    if (!currentNode.shadowRoot) {
      currentNode = walker.nextNode();
      continue;
    }

    // nb. we can still descend into `tabindex=-1` nodes, this just creates scoping root
    const result = focusFirst(currentNode.shadowRoot, options, false);
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
