var dialogPolyfill = (function() {

  var supportCustomEvent = window.CustomEvent;
  if (!supportCustomEvent || typeof supportCustomEvent == 'object') {
    supportCustomEvent = function CustomEvent(event, x) {
      x = x || {};
      var ev = document.createEvent('CustomEvent');
      ev.initCustomEvent(event, !!x.bubbles, !!x.cancelable, x.detail || null);
      return ev;
    };
    supportCustomEvent.prototype = window.Event.prototype;
  }

  /**
   * Finds the nearest <dialog> from the passed element.
   *
   * @param {Element} el to search from
   * @return {HTMLDialogElement} dialog found
   */
  function findNearestDialog(el) {
    while (el) {
      if (el.nodeName == 'DIALOG') {
        return /** @type {HTMLDialogElement} */ (el);
      }
      el = el.parentElement;
    }
    return null;
  }

  var dialogPolyfill = {};

  dialogPolyfill.reposition = function(element) {
    var scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
    var topValue = scrollTop + (window.innerHeight - element.offsetHeight) / 2;
    element.style.top = Math.max(0, topValue) + 'px';
    element.dialogPolyfillInfo.isTopOverridden = true;
  };

  dialogPolyfill.inNodeList = function(nodeList, node) {
    for (var i = 0; i < nodeList.length; ++i) {
      if (nodeList[i] == node)
        return true;
    }
    return false;
  };

  dialogPolyfill.isInlinePositionSetByStylesheet = function(element) {
    for (var i = 0; i < document.styleSheets.length; ++i) {
      var styleSheet = document.styleSheets[i];
      var cssRules = null;
      // Some browsers throw on cssRules.
      try {
        cssRules = styleSheet.cssRules;
      } catch (e) {}
      if (!cssRules)
        continue;
      for (var j = 0; j < cssRules.length; ++j) {
        var rule = cssRules[j];
        var selectedNodes = null;
        // Ignore errors on invalid selector texts.
        try {
          selectedNodes = document.querySelectorAll(rule.selectorText);
        } catch(e) {}
        if (!selectedNodes || !dialogPolyfill.inNodeList(selectedNodes, element))
          continue;
        var cssTop = rule.style.getPropertyValue('top');
        var cssBottom = rule.style.getPropertyValue('bottom');
        if ((cssTop && cssTop != 'auto') || (cssBottom && cssBottom != 'auto'))
          return true;
      }
    }
    return false;
  };

  dialogPolyfill.needsCentering = function(dialog) {
    var computedStyle = window.getComputedStyle(dialog);
    if (computedStyle.position != 'absolute') {
      return false;
    }

    // We must determine whether the top/bottom specified value is non-auto.  In
    // WebKit/Blink, checking computedStyle.top == 'auto' is sufficient, but
    // Firefox returns the used value. So we do this crazy thing instead: check
    // the inline style and then go through CSS rules.
    if ((dialog.style.top != 'auto' && dialog.style.top != '') ||
        (dialog.style.bottom != 'auto' && dialog.style.bottom != ''))
      return false;
    return !dialogPolyfill.isInlinePositionSetByStylesheet(dialog);
  };

  dialogPolyfill.showDialog = function(isModal) {
    if (this.open) {
      throw 'InvalidStateError: showDialog called on open dialog';
    }
    this.open = true;  // TODO: should be a getter mapped to attribute
    this.setAttribute('open', 'open');

    if (isModal) {
      // Find element with `autofocus` attribute or first form control.
      var target = this.querySelector('[autofocus]:not([disabled])');
      if (!target) {
        var opts = ['button', 'input', 'keygen', 'select', 'textarea'];
        var query = opts.map(function(el) {
          return el + ':not([disabled])';
        }).join(', ');
        target = this.querySelector(query);
      }
      target && target.focus();
    }

    if (dialogPolyfill.needsCentering(this))
      dialogPolyfill.reposition(this);
    if (isModal) {
      this.dialogPolyfillInfo.modal = true;
      dialogPolyfill.dm.pushDialog(this);
    }
  };

  dialogPolyfill.close = function(retval) {
    if (!this.open && !window.HTMLDialogElement) {
      // Native implementations will set .open to false, so ignore this error.
      throw 'InvalidStateError: close called on closed dialog';
    }
    this.open = false;
    this.removeAttribute('open');

    // Leave returnValue untouched in case it was set directly on the element
    if (typeof retval != 'undefined') {
      this.returnValue = retval;
    }

    // This won't match the native <dialog> exactly because if the user sets top
    // on a centered polyfill dialog, that top gets thrown away when the dialog is
    // closed. Not sure it's possible to polyfill this perfectly.
    if (this.dialogPolyfillInfo.isTopOverridden) {
      this.style.top = 'auto';
    }

    if (this.dialogPolyfillInfo.modal) {
      dialogPolyfill.dm.removeDialog(this);
    }

    // Triggering "close" event for any attached listeners on the <dialog>
    var closeEvent = new supportCustomEvent('close', {
      bubbles: true,
      cancelable: true
    });
    this.dispatchEvent(closeEvent);  // TODO: handle cancelling this event

    return this.returnValue;
  };

  dialogPolyfill.registerDialog = function(element) {
    if (element.show) {
      console.warn("This browser already supports <dialog>, the polyfill " +
          "may not work correctly.");
    }
    element.show = dialogPolyfill.showDialog.bind(element, false);
    element.showModal = dialogPolyfill.showDialog.bind(element, true);
    element.close = dialogPolyfill.close.bind(element);
    element.dialogPolyfillInfo = {};
    element.open = false;
  };

  // The overlay is used to simulate how a modal dialog blocks the document. The
  // blocking dialog is positioned on top of the overlay, and the rest of the
  // dialogs on the pending dialog stack are positioned below it. In the actual
  // implementation, the modal dialog stacking is controlled by the top layer,
  // where z-index has no effect.
  var TOP_LAYER_ZINDEX = 100000;
  var MAX_PENDING_DIALOGS = 100000;

  dialogPolyfill.DialogManager = function() {
    this.pendingDialogStack = [];
    this.overlay = document.createElement('div');
    this.overlay.className = '_dialog_overlay';

    this.overlay.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  };

  dialogPolyfill.DialogManager.prototype.blockDocument = function() {
    if (!document.body.contains(this.overlay)) {
      document.body.appendChild(this.overlay);

      // On Safari/Mac (and possibly other browsers), the documentElement is
      // not focusable. This is required for modal dialogs as it is the first
      // element to be hit by a tab event, and further tabs are redirected to
      // the most visible dialog.
      if (this.needsDocumentElementFocus === undefined) {
        document.documentElement.focus();
        this.needsDocumentElementFocus =
            (document.activeElement != document.documentElement);
      }
      if (this.needsDocumentElementFocus) {
        document.documentElement.tabIndex = 1;
      }
    }
  };

  dialogPolyfill.DialogManager.prototype.unblockDocument = function() {
    document.body.removeChild(this.overlay);
    if (this.needsDocumentElementFocus) {
      // TODO: Restore the previous tabIndex, rather than clearing it.
      document.documentElement.tabIndex = '';
    }
  };

  dialogPolyfill.DialogManager.prototype.updateStacking = function() {
    if (this.pendingDialogStack.length == 0) {
      this.unblockDocument();
      return;
    }
    this.blockDocument();

    var zIndex = TOP_LAYER_ZINDEX;
    for (var i = 0; i < this.pendingDialogStack.length; i++) {
      if (i == this.pendingDialogStack.length - 1)
        this.overlay.style.zIndex = zIndex++;
      var dialog = this.pendingDialogStack[i];
      dialog.dialogPolyfillInfo.backdrop.style.zIndex = zIndex++;
      dialog.style.zIndex = zIndex++;
    }
  };

  var tabDirection = 0;

  dialogPolyfill.DialogManager.prototype.handleKey = function(event) {
    var dialogCount = this.pendingDialogStack.length;
    if (dialogCount == 0) {
      return;
    }
    var dialog = this.pendingDialogStack[dialogCount - 1];

    tabDirection = 0;

    switch (event.keyCode) {
    case 9: /* tab */
      tabDirection = event.shiftKey ? +1 : -1;
      break;

    case 27: /* esc */
      event.preventDefault();
      event.stopPropagation();
      var cancelEvent = new supportCustomEvent('cancel', {
        bubbles: false,
        cancelable: true
      });
      if (dialog.dispatchEvent(cancelEvent)) {
        dialog.close();
      }
      break;

    }
  };

  dialogPolyfill.DialogManager.prototype.pushDialog = function(dialog) {
    if (this.pendingDialogStack.length >= MAX_PENDING_DIALOGS) {
      throw "Too many modal dialogs";
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    var clickEventListener = function(e) {
      var redirectedEvent = document.createEvent('MouseEvents');
      redirectedEvent.initMouseEvent(e.type, e.bubbles, e.cancelable, window,
          e.detail, e.screenX, e.screenY, e.clientX, e.clientY, e.ctrlKey,
          e.altKey, e.shiftKey, e.metaKey, e.button, e.relatedTarget);
      dialog.dispatchEvent(redirectedEvent);
      e.stopPropagation();
    };
    backdrop.addEventListener('click', clickEventListener);
    dialog.parentNode.insertBefore(backdrop, dialog.nextSibling);
    dialog.dialogPolyfillInfo.backdrop = backdrop;
    dialog.dialogPolyfillInfo.clickEventListener = clickEventListener;
    this.pendingDialogStack.push(dialog);
    this.updateStacking();
  };

  dialogPolyfill.DialogManager.prototype.removeDialog = function(dialog) {
    var index = this.pendingDialogStack.indexOf(dialog);
    if (index == -1) {
      return;
    }
    this.pendingDialogStack.splice(index, 1);
    var backdrop = dialog.dialogPolyfillInfo.backdrop;
    var clickEventListener = dialog.dialogPolyfillInfo.clickEventListener;
    backdrop.removeEventListener('click', clickEventListener);
    backdrop.parentNode.removeChild(backdrop);
    dialog.dialogPolyfillInfo.backdrop = null;
    dialog.dialogPolyfillInfo.clickEventListener = null;
    this.updateStacking();
  };

  dialogPolyfill.dm = new dialogPolyfill.DialogManager();

  document.addEventListener('keydown',
      dialogPolyfill.dm.handleKey.bind(dialogPolyfill.dm));

  /**
   * Global form 'dialog' method handler. Closes a dialog correctly on submit
   * and possibly sets its return value.
   */
  document.addEventListener('submit', function(ev) {
    var method = ev.target.getAttribute('method').toLowerCase();
    if (method != 'dialog') { return; }
    ev.preventDefault();

    var dialog = findNearestDialog(/** @type {Element} */ (ev.target));
    if (!dialog) { return; }

    // FIXME: The original event doesn't contain the INPUT element used to
    // submit the form (if any). Look in some possible places.
    var returnValue;
    var cands = [document.activeElement, ev.explicitOriginalTarget];
    cands.some(function(cand) {
      if (cand && cand.nodeName == 'INPUT' && cand.form == ev.target) {
        returnValue = cand.value;
        return true;
      }
    });
    dialog.close(returnValue);
  }, true);

  return dialogPolyfill;
})();
