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
    assert.closeTo(rect.top, expectedTop, 1);
    assert.closeTo(rect.left, expectedLeft, 1);
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
    dialogPolyfill.registerDialog(dialog);
    return cleanup(dialog);
  }

  var dialog;  // global dialog for all tests
  setup(function() {
    dialog = createDialog('Default Dialog');
  });

  test('basic', function() {
    assert.isFalse(dialog.hasAttribute('open'));
    dialog.show();
    assert.isTrue(dialog.hasAttribute('open'));

    var returnValue = 1234;
    dialog.close(returnValue);
    assert.isFalse(dialog.hasAttribute('open'));
    assert.equal(dialog.returnValue, returnValue);
  });

  suite('position', function() {
    test('default centering', function() {
      dialog.show();
      checkDialogCenter();
    });
    test('respect static position', function() {
      dialog.style.top = '10px';
      dialog.show();

      var rect = dialog.getBoundingClientRect();
      assert.equal(rect.top, 10);
    });
    test('recentering', function() {
      var pX = document.body.scrollLeft;
      var pY = document.body.scrollTop;
      var big = cleanup(document.createElement('div'));
      big.style.height = '200vh';  // 2x view height
      document.body.appendChild(big);

      try {
        var scrollValue = 200;  // don't use incredibly large values
        dialog.show();
        dialog.close();

        window.scrollTo(0, scrollValue);
        dialog.show();
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
    test('focus allowed on non-modal', function() {
      var input = cleanup(document.createElement('input'));
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();

      dialog.show();
      assert.equal(document.activeElement, input,
          'non-modal dialog shouldn\'t clear focus');

      document.body.focus();
      input.focus();
      assert.equal(document.activeElement, input,
          'non-modal should allow background focus');
    });
    test('focus should be cleared on modal', function() {
      var input = cleanup(document.createElement('input'));
      input.type = 'text';
      document.body.appendChild(input);

      input.focus();
      assert.equal(document.activeElement, input);

      dialog.showModal();
      assert.notEqual(document.activeElement, input,
          'modal should clear background focus');
    });
    test('modal disallows background focus', function() {
      var input = cleanup(document.createElement('input'));
      input.type = 'text';
      document.body.appendChild(input);

      dialog.showModal();
      input.focus();
      assert.notEqual(document.activeElement, input,
          'modal should disallow background focus');
    });
    test('sub-modal dialog focus enforced', function() {
      var subDialog = createDialog();
      dialog.showModal();

      var input = cleanup(document.createElement('input'));
      input.type = 'text';
      dialog.appendChild(input);
      input.focus();
      assert.equal(document.activeElement, input);

      subDialog.showModal();
      assert.notEqual(document.activeElement, input,
          'additional modal dialog should clear parent focus');

      subDialog.close();
      assert.notEqual(document.activeElement, input,
          'parent focus should not be restored');
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

      var zf = window.getComputedStyle(front).zIndex;
      var zb = window.getComputedStyle(back).zIndex;
      assert.isAbove(zf, zb, 'showModal order dictates z-index');

      var backBackdrop = back.nextElementSibling;
      var zbb = window.getComputedStyle(backBackdrop).zIndex;
      assert.equal(backBackdrop.className, 'backdrop');
      assert.isBelow(zbb, zb, 'backdrop below dialog');

      var frontBackdrop = front.nextElementSibling;
      var zfb = window.getComputedStyle(frontBackdrop).zIndex
      assert.equal(frontBackdrop.className, 'backdrop');
      assert.isBelow(zfb, zf,' backdrop below dialog');

      assert.isAbove(zfb, zb, 'front backdrop is above back dialog');
    });
  });

}();
