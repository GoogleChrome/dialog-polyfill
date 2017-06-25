/*
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */


void function() {

  /**
   * Asserts that the displayed dialog is in the center of the screen.
   *
   * @param {HTMLDialogElement?} opt_dialog to check, or test default
   */
  function checkDialogCenter(opt_dialog) {
    var d = opt_dialog || dialog;
    var expectedTop = (window.innerHeight - d.offsetHeight) / 2;
    var expectedLeft = (window.innerWidth - d.offsetWidth) / 2;
    var rect = d.getBoundingClientRect();
    assert.closeTo(rect.top, expectedTop, 1, 'top should be nearby');
    assert.closeTo(rect.left, expectedLeft, 1, 'left should be nearby');
  }

  /**
   * Creates a fake KeyboardEvent.
   *
   * @param {number} keyCode to press
   * @param {string?} opt_type to use, default keydown
   * @return {!Event} event
   */
  function createKeyboardEvent(keyCode, opt_type) {
    var ev = document.createEvent('Events');
    ev.initEvent(opt_type || 'keydown', true, true);
    ev.keyCode = keyCode;
    ev.which = keyCode;
    return ev;
  }

  /**
   * Cleans up any passed DOM elements.
   *
   * @param {!Element} el to clean up
   * @return {!Element} the same element, for chaining
   */
  var cleanup = (function() {
    var e = [];
    teardown(function() {
      e.forEach(function(el) {
        try {
          el.close();  // try to close dialogs
        } catch (e) {}
        el.parentElement && el.parentElement.removeChild(el);
      });
      e = [];
    });

    return function(el) {
      e.push(el);
      return el;
    };
  })();

  /**
   * Creates a dialog for testing that will be cleaned up later.
   *
   * @param {string?} opt_content to be used as innerHTML
   */
  function createDialog(opt_content) {
    var dialog = document.createElement('dialog');
    dialog.innerHTML = opt_content || 'Dialog #' + (cleanup.length);
    document.body.appendChild(dialog);
    if (window.location.search == '?force') {
      dialogPolyfill.forceRegisterDialog(dialog);
    } else {
      dialogPolyfill.registerDialog(dialog);
    }
    return cleanup(dialog);
  }

  var dialog;  // global dialog for all tests
  setup(function() {
    dialog = createDialog('Default Dialog');
  });

  suite('basic', function() {
    test('show and close', function() {
      assert.isFalse(dialog.hasAttribute('open'));
      dialog.show();
      assert.isTrue(dialog.hasAttribute('open'));
      assert.isTrue(dialog.open);

      var returnValue = 1234;
      dialog.close(returnValue);
      assert.isFalse(dialog.hasAttribute('open'));
      assert.equal(dialog.returnValue, returnValue);

      dialog.show();
      dialog.close();
      assert.isFalse(dialog.open);
      assert.equal(dialog.returnValue, returnValue);
    });
    test('open property', function() {
      assert.isFalse(dialog.hasAttribute('open'));
      dialog.show();
      assert.isTrue(dialog.hasAttribute('open'));
      assert.isTrue(dialog.open);

      dialog.open = false;
      assert.isFalse(dialog.open);
      assert.isFalse(dialog.hasAttribute('open'),
          'open property should clear attribute');
      assert.throws(dialog.close);

      var overlay = document.querySelector('._dialog_overlay');
      assert.isNull(overlay);
    });
    test('show/showModal interaction', function() {
      assert.isFalse(dialog.hasAttribute('open'));
      dialog.show();

      // If the native dialog is being tested, show/showModal are not already
      // bound, so wrap them in helper methods for throws/doesNotThrow.
      var show = function() { dialog.show(); };
      var showModal = function() { dialog.showModal(); };

      assert.doesNotThrow(show);
      assert.throws(showModal);

      dialog.open = false;
      assert.doesNotThrow(showModal);
      assert.doesNotThrow(show);  // show after showModal does nothing
      assert.throws(showModal);
      // TODO: check dialog is still modal

      assert.isTrue(dialog.open);
    });
    test('setAttribute reflects property', function() {
      dialog.setAttribute('open', '');
      assert.isTrue(dialog.open, 'attribute opens dialog');
    });
    test('changing open to dummy value is ignored', function() {
      dialog.showModal();

      dialog.setAttribute('open', 'dummy, ignored');
      assert.isTrue(dialog.open, 'dialog open with dummy open value');

      var overlay = document.querySelector('._dialog_overlay');
      assert(overlay, 'dialog is still modal');
    });
    test('show/showModal outside document', function() {
      dialog.open = false;
      dialog.parentNode.removeChild(dialog);

      assert.throws(function() { dialog.showModal(); });

      assert.doesNotThrow(function() { dialog.show(); });
      assert.isTrue(dialog.open, 'can open non-modal outside document');
      assert.isFalse(document.body.contains(dialog));
    });
    test('has a11y property', function() {
      assert.equal(dialog.getAttribute('role'), 'dialog', 'role should be dialog');
    });
  });

  suite('DOM', function() {
    setup(function(done) {
      // DOM tests wait for modal to settle, so MutationOberver doesn't coalesce attr changes
      dialog.showModal();
      window.setTimeout(done, 0);
    });
    test('DOM direct removal', function(done) {
      assert.isTrue(dialog.open);
      assert.isNotNull(document.querySelector('.backdrop'));

      var parentNode = dialog.parentNode;
      parentNode.removeChild(dialog);

      // DOMNodeRemoved defers its task a frame (since it occurs before removal, not after). This
      // doesn't effect MutationObserver, just delays the test a frame.
      window.setTimeout(function() {
        assert.isNull(document.querySelector('.backdrop'), 'dialog removal should clear modal');

        assert.isTrue(dialog.open, 'removed dialog should still be open');
        parentNode.appendChild(dialog);

        assert.isTrue(dialog.open, 're-added dialog should still be open');
        assert.isNull(document.querySelector('.backdrop'), 're-add dialog should not be modal');

        done();
      }, 0);
    });
    test('DOM removal inside other element', function(done) {
      var div = cleanup(document.createElement('div'));
      document.body.appendChild(div);
      div.appendChild(dialog);

      document.body.removeChild(div);

      window.setTimeout(function() {
        assert.isNull(document.querySelector('.backdrop'), 'dialog removal should clear modal');
        assert.isTrue(dialog.open, 'removed dialog should still be open');
        done();
      }, 0);
    });
    test('DOM instant remove/add', function(done) {
      var div = cleanup(document.createElement('div'));
      document.body.appendChild(div);
      dialog.parentNode.removeChild(dialog);
      div.appendChild(dialog);

      window.setTimeout(function() {
        assert.isNull(document.querySelector('.backdrop'), 'backdrop should disappear');
        assert.isTrue(dialog.open);
        done();
      }, 0);
    });
  });

  suite('position', function() {
    test('non-modal is not centered', function() {
      var el = cleanup(document.createElement('div'));
      dialog.parentNode.insertBefore(el, dialog);
      var testRect = el.getBoundingClientRect();

      dialog.show();
      var rect = dialog.getBoundingClientRect();

      assert.equal(rect.top, testRect.top, 'dialog should not be centered');
    });
    test('default modal centering', function() {
      dialog.showModal();
      checkDialogCenter();
      assert.ok(dialog.style.top, 'expected top to be set');
      dialog.close();
      assert.notOk(dialog.style.top, 'expected top to be cleared');
    });
    test('modal respects static position', function() {
      dialog.style.top = '10px';
      dialog.showModal();

      var rect = dialog.getBoundingClientRect();
      assert.equal(rect.top, 10);
    });
    test('modal recentering', function() {
      var pX = document.body.scrollLeft;
      var pY = document.body.scrollTop;
      var big = cleanup(document.createElement('div'));
      big.style.height = '200vh';  // 2x view height
      document.body.appendChild(big);

      try {
        var scrollValue = 200;  // don't use incredibly large values
        dialog.showModal();
        dialog.close();

        window.scrollTo(0, scrollValue);
        dialog.showModal();
        checkDialogCenter();  // must be centered, even after scroll
        var rectAtScroll = dialog.getBoundingClientRect();

        // after scroll, we aren't recentered, check offset
        window.scrollTo(0, 0);
        var rect = dialog.getBoundingClientRect();
        assert.closeTo(rectAtScroll.top + scrollValue, rect.top, 1);
      } finally {
        window.scrollTo(pX, pY);
      }
    });
    test('clamped to top of page', function() {
      var big = cleanup(document.createElement('div'));
      big.style.height = '200vh';  // 2x view height
      document.body.appendChild(big);
      document.documentElement.scrollTop = document.documentElement.scrollHeight / 2;

      dialog.style.height = document.documentElement.scrollHeight + 200 + 'px';
      dialog.showModal();

      var visibleRect = dialog.getBoundingClientRect();
      assert.equal(visibleRect.top, 0, 'large dialog should be visible at top of page');

      var style = window.getComputedStyle(dialog);
      assert.equal(style.top, document.documentElement.scrollTop + 'px',
          'large dialog should be absolutely positioned at scroll top');
    });
  });

  suite('backdrop', function() {
    test('backdrop div on modal', function() {
      dialog.showModal();
      var foundBackdrop = document.querySelector('.backdrop');
      assert.isNotNull(foundBackdrop);

      var sibling = dialog.nextElementSibling;
      assert.strictEqual(foundBackdrop, sibling);
    });
    test('no backdrop on non-modal', function() {
      dialog.show();
      assert.isNull(document.querySelector('.backdrop'));
      dialog.close();
    });
    test('backdrop click appears as dialog', function() {
      dialog.showModal();
      var backdrop = dialog.nextElementSibling;

      var clickFired = 0;
      var helper = function(ev) {
        assert.equal(ev.target, dialog);
        ++clickFired;
      };

      dialog.addEventListener('click', helper)
      backdrop.click();
      assert.equal(clickFired, 1);
    });
    test('backdrop click focuses dialog', function() {
      dialog.showModal();
      dialog.tabIndex = 0;

      var input = document.createElement('input');
      input.type = 'text';
      dialog.appendChild(input);

      // TODO: It would be nice to check `input` instead here, but there's no more reliable ways
      // to emulate a browser tab event (Firefox, Chrome etc have made it a security violation).

      var backdrop = dialog.nextElementSibling;
      backdrop.click();
      assert.equal(document.activeElement, dialog);
    });
  });

  suite('form focus', function() {
    test('non-modal inside modal is focusable', function() {
      var sub = createDialog();
      dialog.appendChild(sub);

      var input = document.createElement('input');
      input.type = 'text';
      sub.appendChild(input);

      dialog.showModal();
      sub.show();

      input.focus();
      assert.equal(input, document.activeElement);
    });
    test('clear focus when nothing focusable in modal', function() {
      var input = cleanup(document.createElement('input'));
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();

      var previous = document.activeElement;
      dialog.showModal();
      assert.notEqual(previous, document.activeElement);
    });
    test('default focus on modal', function() {
      var input = cleanup(document.createElement('input'));
      input.type = 'text';
      dialog.appendChild(input);

      var anotherInput = cleanup(document.createElement('input'));
      anotherInput.type = 'text';
      dialog.appendChild(anotherInput);

      dialog.showModal();
      assert.equal(document.activeElement, input);
    });
    test('default focus on non-modal', function() {
      var div = cleanup(document.createElement('div'));
      div.tabIndex = 4;
      dialog.appendChild(div);

      dialog.show();
      assert.equal(document.activeElement, div);
    });
    test('autofocus element chosen', function() {
      var input = cleanup(document.createElement('input'));
      input.type = 'text';
      dialog.appendChild(input);

      var inputAF = cleanup(document.createElement('input'));
      inputAF.type = 'text';
      inputAF.autofocus = true;
      dialog.appendChild(inputAF);

      dialog.showModal();
      assert.equal(document.activeElement, inputAF);
    });
    test('child modal dialog', function() {
      dialog.showModal();

      var input = cleanup(document.createElement('input'));
      input.type = 'text';
      dialog.appendChild(input);
      input.focus();
      assert.equal(document.activeElement, input);

      // NOTE: This is a single sub-test, but all the above tests could be run
      // again in a sub-context (i.e., dialog within dialog).
      var child = createDialog();
      child.showModal();
      assert.notEqual(document.activeElement, input,
          'additional modal dialog should clear parent focus');

      child.close();
      assert.notEqual(document.activeElement, input,
          'parent focus should not be restored');
    });
    test('don\'t scroll anything into focus', function() {
      // https://github.com/GoogleChrome/dialog-polyfill/issues/119

      var div = cleanup(document.createElement('div'));
      document.body.appendChild(div);

      var inner = document.createElement('div');
      inner.style.height = '10000px';
      div.appendChild(inner);

      div.appendChild(dialog);

      var input = cleanup(document.createElement('input'));
      input.type = 'text';
      dialog.appendChild(input);

      var prev = document.documentElement.scrollTop;
      dialog.showModal();
      assert.equal(document.documentElement.scrollTop, prev);
    });
  });

  suite('top layer / inert', function() {
    test('background focus allowed on non-modal', function() {
      var input = cleanup(document.createElement('input'));
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();

      dialog.show();
      assert.notEqual(document.activeElement, input,
        'non-modal dialog should clear focus, even with no dialog content');

      document.body.focus();
      input.focus();
      assert.equal(document.activeElement, input,
          'non-modal should allow background focus');
    });
    test('modal disallows background focus', function() {
      var input = cleanup(document.createElement('input'));
      input.type = 'text';
      document.body.appendChild(input);

      dialog.showModal();
      input.focus();

      if (!document.hasFocus()) {
        // Browsers won't trigger a focus event if they're not in the
        // foreground, so we can't intercept it. However, they'll fire one when
        // restored, before a user can get to any incorrectly focused element.
        console.warn('background focus test requires document focus');
        document.documentElement.focus();
      }
      assert.notEqual(document.activeElement, input,
          'modal should disallow background focus');
    });
    test('overlay is a sibling of topmost dialog', function() {
      var stacking = cleanup(document.createElement('div'));
      stacking.style.opacity = 0.8;  // creates stacking context
      document.body.appendChild(stacking);
      stacking.appendChild(dialog);
      dialog.showModal();

      var overlay = document.querySelector('._dialog_overlay');
      assert.isNotNull(overlay);
      assert.equal(overlay.parentNode, dialog.parentNode);
    });
    test('overlay is between topmost and remaining dialogs', function() {
      dialog.showModal();

      var other = cleanup(createDialog());
      document.body.appendChild(other);
      other.showModal();

      var overlay = document.querySelector('._dialog_overlay');
      assert.isNotNull(overlay);
      assert.equal(overlay.parentNode, other.parentNode);

      assert.isAbove(+other.style.zIndex, +overlay.style.zIndex, 'top-most dialog above overlay');
      assert.isAbove(+overlay.style.zIndex, +dialog.style.zIndex, 'overlay above other dialogs');
    });
  });

  suite('events', function() {
    test('close event', function() {
      var closeFired = 0;
      dialog.addEventListener('close', function() {
        ++closeFired;
      });

      dialog.show();
      assert.equal(closeFired, 0);

      dialog.close();
      assert.equal(closeFired, 1);

      assert.throws(dialog.close);  // can't close already closed dialog
      assert.equal(closeFired, 1);

      dialog.showModal();
      dialog.close();
      assert.equal(closeFired, 2);
    });
    test('cancel event', function() {
      dialog.showModal();
      dialog.dispatchEvent(createKeyboardEvent(27));
      assert.isFalse(dialog.open, 'esc should close modal');

      var cancelFired = 0;
      dialog.addEventListener('cancel', function() {
        ++cancelFired;
      });
      dialog.showModal();
      dialog.dispatchEvent(createKeyboardEvent(27));
      assert.equal(cancelFired, 1, 'expected cancel to be fired');
      assert.isFalse(dialog.open), 'esc should close modal again';

      // Sanity-check that non-modals aren't effected.
      dialog.show();
      dialog.dispatchEvent(createKeyboardEvent(27));
      assert.isTrue(dialog.open, 'esc should only close modal dialog');
      assert.equal(cancelFired, 1);
    });
    test('overlay click is prevented', function() {
      dialog.showModal();

      var overlay = document.querySelector('._dialog_overlay');
      assert.isNotNull(overlay);

      var helper = function(ev) {
        throw Error('body should not be clicked');
      };
      try {
        document.body.addEventListener('click', helper);
        overlay.click();
      } finally {
        document.body.removeEventListener('click', helper);
      }
    });
  });

  suite('form', function() {
    test('dialog method input', function() {
      var value = 'ExpectedValue' + Math.random();

      var form = document.createElement('form');
      try {
        form.method = 'dialog';
      } catch (e) {
        // Setting the method directly throws an exception in <=IE9.
        form.setAttribute('method', 'dialog');
      }
      dialog.appendChild(form);

      var input = document.createElement('input');
      input.type = 'submit';
      input.value = value;
      form.appendChild(input);

      dialog.show();
      input.focus();  // emulate user focus action
      input.click();

      assert.isFalse(dialog.open);
      assert.equal(dialog.returnValue, value);
    });
    test('dialog with button preventDefault does not trigger submit', function() {
      var form = document.createElement('form');
      form.setAttribute('method', 'dialog');
      dialog.appendChild(form);

      var button = document.createElement('button');
      button.value = 'does not matter';
      form.appendChild(button);
      button.addEventListener('click', function(ev) {
        ev.preventDefault();
      });

      dialog.showModal();
      button.click();

      assert.isTrue(dialog.open, 'dialog should remain open');
      assert.equal(dialog.returnValue, '');
    });
    test('dialog programmatic submit does not change returnValue', function() {
      var form = document.createElement('form');
      form.setAttribute('method', 'dialog');

      dialog.returnValue = 'manually set';  // set before appending
      dialog.appendChild(form);

      dialog.showModal();
      form.submit();
      assert.isFalse(dialog.open);

      assert.equal(dialog.returnValue, 'manually set', 'returnValue should not change');
    });
    test('dialog method button', function() {
      var value = 'ExpectedValue' + Math.random();

      var form = document.createElement('form');
      form.setAttribute('method', 'dialog');
      dialog.appendChild(form);

      var button = document.createElement('button');
      button.value = value;
      form.appendChild(button);

      dialog.showModal();
      button.focus();  // emulate user focus action
      button.click();

      assert.isFalse(dialog.open);
      assert.equal(dialog.returnValue, value);

      // Clear button value, confirm textContent is not used as value.
      button.value = 'blah blah';
      button.removeAttribute('value');
      button.textContent = value;
      dialog.show();
      button.focus();  // emulate user focus action
      button.click();

      assert.equal(dialog.returnValue, button.value,
          'don\'t take button textContent as value');
    });
    test('boring form inside dialog', function() {
      var form = document.createElement('form');
      dialog.appendChild(form);  // don't specify method
      form.addEventListener('submit', function(ev) {
        ev.preventDefault();
      });

      var button = document.createElement('button');
      button.value = 'Moot';
      form.appendChild(button);

      dialog.showModal();
      button.focus();  // emulate user focus action
      button.click();

      assert.isTrue(dialog.open, 'non-dialog form should not close dialog')
      assert(!dialog.returnValue);
    });
    test('type="image" submitter', function() {
      var form = document.createElement('form');
      form.setAttribute('method', 'dialog');
      dialog.appendChild(form);
      dialog.show();

      var image = document.createElement('input');
      image.type = 'image';
      image.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
      image.setAttribute('value', 'image should not accept value');
      form.appendChild(image);
      image.click();

      assert.notEqual(image.getAttribute('value'), dialog.returnValue);
      assert.equal(dialog.returnValue, '0,0');
    });
    test('form submitter across dialogs', function() {
      var form1 = document.createElement('form');
      form1.setAttribute('method', 'dialog');
      dialog.appendChild(form1);

      var button1 = document.createElement('button');
      button1.value = 'from form1: first value';
      form1.appendChild(button1);
      dialog.showModal();

      var dialog2 = createDialog();
      dialog2.returnValue = 'dialog2 default close value';
      var form2 = document.createElement('form');
      form2.setAttribute('method', 'dialog');
      dialog2.appendChild(form2);
      dialog2.showModal();

      button1.click();
      assert.isFalse(dialog.open);

      // nb. this never fires 'submit' so the .returnValue can't be wrong: is there another way
      // to submit a form that doesn't involve a click (enter implicitly 'clicks') or submit?
      form2.submit();
      assert.isFalse(dialog2.open);

      assert.equal(dialog2.returnValue, 'dialog2 default close value',
          'second dialog shouldn\'t reuse formSubmitter');
    });
  });

  suite('order', function() {
    test('non-modal unchanged', function() {
      var one = createDialog();
      var two = createDialog();

      one.style.zIndex = 100;
      two.style.zIndex = 200;
      one.show();
      two.show();

      assert.equal(window.getComputedStyle(one).zIndex, 100);
      assert.equal(window.getComputedStyle(two).zIndex, 200);

      two.close();
      assert.equal(window.getComputedStyle(two).zIndex, 200);
    });
    test('modal stacking order', function() {
      dialog.showModal();

      // Create incorrectly-named dialogs: front has a lower z-index, and back
      // has a higher z-index.
      var front = createDialog();
      var back = createDialog();
      front.style.zIndex = 100;
      back.style.zIndex = 200;

      // Show back first, then front. Thus we expect back to be behind front.
      back.showModal();
      front.showModal();

      var zf = +window.getComputedStyle(front).zIndex;
      var zb = +window.getComputedStyle(back).zIndex;
      assert.isAbove(zf, zb, 'showModal order dictates z-index');

      var backBackdrop = back.nextElementSibling;
      var zbb = +window.getComputedStyle(backBackdrop).zIndex;
      assert.equal(backBackdrop.className, 'backdrop');
      assert.isBelow(zbb, zb, 'backdrop below dialog');

      var frontBackdrop = front.nextElementSibling;
      var zfb = +window.getComputedStyle(frontBackdrop).zIndex
      assert.equal(frontBackdrop.className, 'backdrop');
      assert.isBelow(zfb, zf,' backdrop below dialog');

      assert.isAbove(zfb, zb, 'front backdrop is above back dialog');

      front.close();
      assert.notOk(front.style.zIndex, 'modal close should clear zindex');
    });
  });

  suite('press tab key', function() {
    test('tab key', function() {
      var dialog = createDialog();
      dialog.showModal();

      document.documentElement.dispatchEvent(createKeyboardEvent(9));

      var ev = document.createEvent('Events');
      ev.initEvent('focus', true, true);
      document.documentElement.dispatchEvent(ev);

      dialog.close();
    });
  });
}();
