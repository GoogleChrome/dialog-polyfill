(function() {

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

  /**
   * @param {!NodeList} nodeList to search
   * @param {Node} node to find
   * @return {boolean} whether node is inside nodeList
   */
  function inNodeList(nodeList, node) {
    for (var i = 0; i < nodeList.length; ++i) {
      if (nodeList[i] == node) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {!Element} dialog to upgrade
   * @constructor
   */
  function dialogPolyfillInfo(dialog) {
    this.dialog_ = dialog;
    this.open_ = dialog.hasAttribute('open');
    this.modal_ = false;
    this.replacedStyleTop_ = false;

    dialog.show = this.show.bind(this, false);
    dialog.showModal = this.show.bind(this, true);
    dialog.close = this.close.bind(this);

    Object.defineProperty(dialog, 'open', {
      set: this.setOpen.bind(this), get: this.getOpen.bind(this)
    });

    this.backdrop_ = document.createElement('div');
    this.backdrop_.className = 'backdrop';
    this.backdropClick_ = this.backdropClick_.bind(this);
  }

  dialogPolyfillInfo.prototype = {

    /**
     * @param {boolean} value whether to open or close this dialog
     */
    setOpen: function(value) {
      if (value && !this.open_) {
        this.show();
      } else if (!value && this.open_) {
        this.close();
      }
    },

    /**
     * @return {boolean} whether this dialog is open
     */
    getOpen: function() {
      return this.open_;
    },

    /**
     * Handles clicks on the fake .backdrop element, redirecting them as if
     * they were on the dialog itself.
     *
     * @param {!Event} e to redirect
     */
    backdropClick_: function(e) {
      var redirectedEvent = document.createEvent('MouseEvents');
      redirectedEvent.initMouseEvent(e.type, e.bubbles, e.cancelable, window,
          e.detail, e.screenX, e.screenY, e.clientX, e.clientY, e.ctrlKey,
          e.altKey, e.shiftKey, e.metaKey, e.button, e.relatedTarget);
      this.dialog_.dispatchEvent(redirectedEvent);
      e.stopPropagation();
    },

    /**
     * Shows the dialog.
     *
     * @param {boolean=} opt_modal whether to display modal
     */
    show: function(opt_modal) {
      if (this.open_) {
        throw 'InvalidStateError: showDialog called on open dialog';
      }
      this.open_ = true;
      this.dialog_.setAttribute('open', '');
      if (opt_modal !== undefined) {
        this.modal_ = opt_modal;
      }

      if (this.modal_) {
        // Insert backdrop.
        this.backdrop_.addEventListener('click', this.backdropClick_);
        this.dialog_.parentNode.insertBefore(this.backdrop_,
            this.dialog_.nextSibling);

        // Find element with `autofocus` attribute or first form control.
        var target = this.dialog_.querySelector('[autofocus]:not([disabled])');
        if (!target) {
          // TODO: technically this is 'any focusable area'
          var opts = ['button', 'input', 'keygen', 'select', 'textarea'];
          var query = opts.map(function(el) {
            return el + ':not([disabled])';
          }).join(', ');
          target = this.dialog_.querySelector(query);
        }
        document.activeElement && document.activeElement.blur();
        target && target.focus();
      }

      if (dialogPolyfill.needsCentering(this.dialog_)) {
        dialogPolyfill.reposition(this.dialog_);
        this.replacedStyleTop_ = true;
      } else {
        this.replacedStyleTop_ = false;
      }
      if (this.modal_) {
        dialogPolyfill.dm.pushDialog(this.dialog_, this.backdrop_);
      }
    },

    /**
     * Closes this HTMLDialogElement.
     *
     * @param {*=} opt_returnValue to use as the returnValue
     */
    close: function(opt_returnValue) {
      if (!this.open_) {
        throw 'InvalidStateError: close called on closed dialog';
      }
      this.open_ = false;
      this.dialog_.removeAttribute('open');

      // Leave returnValue untouched in case it was set directly on the element
      if (opt_returnValue !== undefined) {
        this.dialog_.returnValue = opt_returnValue;
      }

      // This won't match the native <dialog> exactly because if the user set
      // top on a centered polyfill dialog, that top gets thrown away when the
      // dialog is closed. Not sure it's possible to polyfill this perfectly.
      if (this.replacedStyleTop_) {
        this.dialog_.style.top = 'auto';
      }

      if (this.modal_) {
        this.backdrop_.removeEventListener('click', this.backdropClick_);
        if (this.backdrop_.parentElement) {
          this.backdrop_.parentElement.removeChild(this.backdrop_);
        }
        dialogPolyfill.dm.removeDialog(this.dialog_);
      }

      // Triggering "close" event for any attached listeners on the <dialog>.
      var closeEvent = new supportCustomEvent('close', {
        bubbles: true,
        cancelable: false
      });
      this.dialog_.dispatchEvent(closeEvent);
    }

  };

  var dialogPolyfill = {};

  dialogPolyfill.reposition = function(element) {
    var scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
    var topValue = scrollTop + (window.innerHeight - element.offsetHeight) / 2;
    element.style.top = Math.max(0, topValue) + 'px';
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
        if (!selectedNodes || !inNodeList(selectedNodes, element))
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

  /**
   * @export
   * @param {!Element} element upgrade
   */
  dialogPolyfill.registerDialog = function(element) {
    if (element.show) {
      console.warn("This browser already supports <dialog>, the polyfill " +
          "may not work correctly.");
    }
    var pfi = new dialogPolyfillInfo(element);
    // TODO: ?
  };

  // The overlay is used to simulate how a modal dialog blocks the document. The
  // blocking dialog is positioned on top of the overlay, and the rest of the
  // dialogs on the pending dialog stack are positioned below it. In the actual
  // implementation, the modal dialog stacking is controlled by the top layer,
  // where z-index has no effect.
  var TOP_LAYER_ZINDEX = 100000;
  var MAX_PENDING_DIALOGS = 100000;

  /**
   * @constructor
   */
  dialogPolyfill.DialogManager = function() {
    this.pendingDialogStack = [];
    this.overlay = document.createElement('div');
    this.overlay.className = '_dialog_overlay';

    this.overlay.addEventListener('click', function(e) {
      e.stopPropagation();
    });

    this.handleKey_ = this.handleKey_.bind(this);
    this.handleFocus_ = this.handleFocus_.bind(this);
  };

  /**
   * @return {Element} the top HTML dialog element, if any
   */
  dialogPolyfill.DialogManager.prototype.topDialogElement = function() {
    return this.pendingDialogStack[this.pendingDialogStack.length - 1].dialog;
  };

  /**
   * Called on the first modal dialog being shown. Adds the overlay and related
   * handlers.
   */
  dialogPolyfill.DialogManager.prototype.blockDocument = function() {
    document.body.appendChild(this.overlay);
    document.body.addEventListener('focus', this.handleFocus_, true);
    document.addEventListener('keydown', this.handleKey_);
  };

  /**
   * Called on the first modal dialog being removed, i.e., when no more modal
   * dialogs are visible.
   */
  dialogPolyfill.DialogManager.prototype.unblockDocument = function() {
    document.body.removeChild(this.overlay);
    document.body.removeEventListener('focus', this.handleFocus_, true);
    document.removeEventListener('keydown', this.handleKey_);
  };

  dialogPolyfill.DialogManager.prototype.updateStacking = function() {
    var zIndex = TOP_LAYER_ZINDEX;
    for (var i = 0; i < this.pendingDialogStack.length; i++) {
      if (i == this.pendingDialogStack.length - 1) {
        this.overlay.style.zIndex = zIndex++;
      }
      var ds = this.pendingDialogStack[i];
      ds.backdrop.style.zIndex = zIndex++;
      ds.dialog.style.zIndex = zIndex++;
    }
  };

  dialogPolyfill.DialogManager.prototype.handleFocus_ = function(event) {
    var candidate = findNearestDialog(/** @type {Element} */ (event.target));
    if (candidate != this.topDialogElement()) {
      event.preventDefault();
      event.stopPropagation();
      event.target.blur();
      // TODO: Focus on the browser chrome (aka document) or the dialog itself
      // depending on the tab direction.
      return false;
    }
  };

  dialogPolyfill.DialogManager.prototype.handleKey_ = function(event) {
    if (event.keyCode == 27) {
      event.preventDefault();
      event.stopPropagation();
      var cancelEvent = new supportCustomEvent('cancel', {
        bubbles: false,
        cancelable: true
      });
      var dialog = this.topDialogElement();
      if (dialog.dispatchEvent(cancelEvent)) {
        dialog.close();
      }
    }
  };

  dialogPolyfill.DialogManager.prototype.pushDialog = function(dialog, backdrop) {
    if (this.pendingDialogStack.length >= MAX_PENDING_DIALOGS) {
      throw "Too many modal dialogs";
    }
    this.pendingDialogStack.push({dialog: dialog, backdrop: backdrop});
    if (this.pendingDialogStack.length == 1) {
      this.blockDocument();
    }
    this.updateStacking();
  };

  dialogPolyfill.DialogManager.prototype.removeDialog = function(dialog) {
    var index = -1;
    for (var i = 0; i < this.pendingDialogStack.length; ++i) {
      if (this.pendingDialogStack[i].dialog == dialog) {
        index = i;
        break;
      }
    }
    if (index == -1) {
      return;
    }

    this.pendingDialogStack.splice(index, 1);
    this.updateStacking();
    if (this.pendingDialogStack.length == 0) {
      this.unblockDocument();
    }
  };

  dialogPolyfill.dm = new dialogPolyfill.DialogManager();

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

  window['dialogPolyfill'] = dialogPolyfill;
  dialogPolyfill['registerDialog'] = dialogPolyfill.registerDialog;
})();
