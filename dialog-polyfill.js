var dialogPolyfill = (function() {

  var addEventListenerFn = (window.document.addEventListener
      ? function(element, type, fn) { element.addEventListener(type, fn); }
      : function(element, type, fn) { element.attachEvent('on' + type, fn); });
  var removeEventListenerFn = (window.document.removeEventListener
      ? function(element, type, fn) { element.removeEventListener(type, fn); }
      : function(element, type, fn) { element.detachEvent('on' + type, fn); });

  var dialogPolyfill = {};

  dialogPolyfill.reposition = function(element) {
    var scrollTop = document.body.scrollTop || document.documentElement.scrollTop,
    windowHeight = ('undefined' == typeof window.innerHeight) && document.body && document.body.clientHeight ? 
      document.body.clientHeight :
      window.innerHeight,
    topValue = scrollTop + (windowHeight - element.offsetHeight) / 2;
    if (0 > topValue) {
      topValue = 0;
    }
    element.style.top = topValue + 'px';
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
    if ('undefined' == typeof getComputedStyle) {
      if (dialog.currentStyle && 'absolute' != dialog.currentStyle['position']) {
        return false;
      }
    } else {
      var computedStyle = getComputedStyle(dialog);
      if (computedStyle.position != 'absolute')
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
    this.open = true;
    this.setAttribute('open', 'open');

    if (isModal) {
      // Find element with `autofocus` attribute or first form control
      var first_form_ctrl = null;
      var autofocus = null;
      var findElementToFocus = function(root) {
        for (var i = 0; i < root.children.length; i++) {
          var elem = root.children[i];
          if (first_form_ctrl === null && !elem.disabled && (
              elem.nodeName == 'BUTTON' ||
              elem.nodeName == 'INPUT'  ||
              elem.nodeName == 'KEYGEN' ||
              elem.nodeName == 'SELECT' ||
              elem.nodeName == 'TEXTAREA')) {
            first_form_ctrl = elem;
          }
          if (elem.autofocus) {
            autofocus = elem;
            return;
          }
          findElementToFocus(elem);
          if (autofocus !== null) return;
        }
      };

      findElementToFocus(this);

      if (autofocus !== null) {
        autofocus.focus();
      } else if (first_form_ctrl !== null) {
        first_form_ctrl.focus();
      }
    }

    if (dialogPolyfill.needsCentering(this))
      dialogPolyfill.reposition(this);
    if (isModal) {
      this.dialogPolyfillInfo.modal = true;
      dialogPolyfill.dm.pushDialog(this);
    }

    // IE sometimes complains when calling .focus() that it
    // "Can't move focus to the control because it is invisible, not enabled, or of a type that does not accept the focus."
    try {
      if (autofocus !== null) {
        autofocus.focus();
      } else if (first_form_ctrl !== null) {
        first_form_ctrl.focus();
      }
    } catch(e) {}
    this.style.zoom = 1;
  };

  dialogPolyfill.close = function(retval) {
    if (!this.open)
      throw 'InvalidStateError: close called on closed dialog';
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
    var event;
    if (this.dispatchEvent) {
      if (document.createEvent) {
        event = document.createEvent('HTMLEvents');
        event.initEvent('close', true, true);
      } else {
        event = new Event('close');
      }
      this.dispatchEvent(event);
    }

    return this.returnValue;
  };

  dialogPolyfill.registerDialog = function(element) {
    if (element.show) {
      console.warn("This browser already supports <dialog>, the polyfill " +
          "may not work correctly.");
    }
    addEventListenerFn(element, 'dialog_submit', function(e) {
      element.close(e.detail.target.value);
      e.preventDefault();
      e.stopPropagation();
    });
    element.show = function() { dialogPolyfill.showDialog.call(element, false); }
    element.showModal = function() { dialogPolyfill.showDialog.call(element, true); }
    element.close = function(retval) { dialogPolyfill.close.call(element, retval); }
    element.dialogPolyfillInfo = {};
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
    this.overlay.style.width = '100%';
    this.overlay.style.height = '100%';
    this.overlay.style.position = 'fixed';
    this.overlay.style.left = '0px';
    this.overlay.style.top = '0px';
    try {
      this.overlay.style.backgroundColor = 'rgba(0,0,0,0.0)';
    } catch(e) {
      this.overlay.style.backgroundColor = '#000';
      this.overlay.style.filter = 'alpha(opacity=0)';
    }

    this.focusPageLast = this.createFocusable();
    this.overlay.appendChild(this.focusPageLast);

    addEventListenerFn(this.overlay, 'click', function(e) {
      var redirectedEvent = document.createEvent('MouseEvents');
      redirectedEvent.initMouseEvent(e.type, e.bubbles, e.cancelable, window,
          e.detail, e.screenX, e.screenY, e.clientX, e.clientY, e.ctrlKey,
          e.altKey, e.shiftKey, e.metaKey, e.button, e.relatedTarget);
      document.body.dispatchEvent(redirectedEvent);
    });
    addEventListenerFn(window, 'load', function() {
      var forms = document.getElementsByTagName('form'),
      i = forms.length;
      while(i--) {
        (function(form) {
          if (form.getAttribute('method') == 'dialog') { // form.method won't return 'dialog'
            addEventListenerFn(form, 'click', function(e) {
              if (e.target.type == 'submit') {
                var event;
                if (CustomEvent) {
                  event = new CustomEvent('dialog_submit', {
                    bubbles:  true,
                    detail:   { target: e.target }
                  });
                } else {
                  event = document.createEvent('HTMLEvents');
                  event.initEvent('dialog_submit', true, true);
                  event.detail = {target: e.target};
                }
                this.dispatchEvent(event);
                e.preventDefault();
              }
            });
          }
        })(forms[i]);
      }
    })
  };

  dialogPolyfill.DialogManager.prototype.createFocusable = function(tabIndex) {
    var span = document.createElement('span');
    span.tabIndex = tabIndex || 0;
    span.style.opacity = 0;
    span.style.position = 'static';
    return span;
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

  dialogPolyfill.DialogManager.prototype.handleKey = function(event) {
    if (this.pendingDialogStack.length == 0) {
      return;
    }
    var dialog = this.pendingDialogStack.slice(-1)[0];

    if (event.keyCode == 9 /* tab */) {
      var activeElement = document.activeElement;
      var forward = !event.shiftKey;
      if (forward) {
        if (activeElement == document.documentElement ||
            activeElement == document.body ||
            activeElement == dialog.dialogPolyfillInfo.backdrop) {
          dialog.dialogPolyfillInfo.focusFirst.focus();
        } else if (activeElement == dialog.dialogPolyfillInfo.focusLast) {
          // TODO: Instead of wrapping to focusFirst, escape to browser chrome.
          dialog.dialogPolyfillInfo.focusFirst.focus();
        }
      } else {  // backward
        if (activeElement == pfi.focusFirst) {
          // TODO: Instead of wrapping to focusLast, escape to browser chrome.
          dialog.dialogPolyfillInfo.focusLast.focus();
        } else if (activeElement == this.focusPageLast) {
          // The focus element is at the end of the page (e.g., shift-tab from
          // the window chrome): move current focus to the last element in the
          // dialog instead.
          dialog.dialogPolyfillInfo.focusLast.focus();
        }
      }
    }

    if (event.keyCode === 27 /* esc */) {
      event.preventDefault();
      event.stopPropagation();
      var cancelEvent;
      if (dialog) {
        if (CustomEvent) {
          cancelEvent = new CustomEvent('cancel', {
            bubbles: false,
            cancelable: true
          });
        } else {
          cancelEvent = document.createEvent('HTMLEvents');
          cancelEvent.initEvent('cancel', false, true);
        }
        if (dialog.dispatchEvent(cancelEvent)) {
          dialog.close();
        }
      }
    }
  };

  dialogPolyfill.DialogManager.prototype.pushDialog = function(dialog) {
    if (this.pendingDialogStack.length >= MAX_PENDING_DIALOGS) {
      throw "Too many modal dialogs";
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    addEventListenerFn(backdrop, 'click', function(e) {
      var redirectedEvent = document.createEvent('MouseEvents');
      redirectedEvent.initMouseEvent(e.type, e.bubbles, e.cancelable, window,
          e.detail, e.screenX, e.screenY, e.clientX, e.clientY, e.ctrlKey,
          e.altKey, e.shiftKey, e.metaKey, e.button, e.relatedTarget);
      dialog.dispatchEvent(redirectedEvent);
    });
    dialog.parentNode.insertBefore(backdrop, dialog.nextSibling);
    dialog.dialogPolyfillInfo.backdrop = backdrop;
    this.pendingDialogStack.push(dialog);
    this.updateStacking();

    dialog.dialogPolyfillInfo.focusFirst = this.createFocusable();
    dialog.dialogPolyfillInfo.focusLast = this.createFocusable();
    dialog.appendChild(dialog.dialogPolyfillInfo.focusLast);
    dialog.insertBefore(
        dialog.dialogPolyfillInfo.focusFirst, dialog.firstChild);
  };

  dialogPolyfill.DialogManager.prototype.removeDialog = function(dialog) {
    if ('undefined' == typeof Array.prototype.indexOf) {
      var index = (function(stack, dialog) {
        for(var i = 0; i < stack.length; i++) {
          if (stack[i] === dialog) {
            return i;
          }
        }
        return -1;
      })(this.pendingDialogStack, dialog);
    } else {
      var index = this.pendingDialogStack.indexOf(dialog);
    }
    if (index == -1)
      return;
    this.pendingDialogStack.splice(index, 1);
    var backdrop = dialog.dialogPolyfillInfo.backdrop;
    backdrop.parentNode.removeChild(backdrop);
    dialog.dialogPolyfillInfo.backdrop = null;
    this.updateStacking();

    dialog.removeChild(dialog.dialogPolyfillInfo.focusFirst);
    dialog.removeChild(dialog.dialogPolyfillInfo.focusLast);
    dialog.dialogPolyfillInfo.focusFirst = null;
    dialog.dialogPolyfillInfo.focusLast = null;
  };

  dialogPolyfill.dm = new dialogPolyfill.DialogManager();

  addEventListenerFn(document, 'keydown', function(ev) { dialogPolyfill.dm.handleKey.call(dialogPolyfill.dm, ev) });

  return dialogPolyfill;
})();
