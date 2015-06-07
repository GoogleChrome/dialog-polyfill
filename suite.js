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
  var dialog;  // global dialog for all tests

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

  setup(function() {
    dialog = document.createElement('dialog');
    dialog.innerText = 'Hello';
    document.body.appendChild(dialog);
    dialogPolyfill.registerDialog(dialog);
  });

  teardown(function() {
    try {
      dialog.close();
    } catch (e) {}
    if (dialog && dialog.parentElement) {
      dialog.parentElement.removeChild(dialog);
    }
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
      var big = document.createElement('div');
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
        document.body.removeChild(big);
        window.scrollTo(pX, pY);
      }
    });
  });

  suite('backdrop', function() {
    test('backdrop div on modal', function() {
      dialog.show();
      assert.isNull(document.querySelector('.backdrop'));
      dialog.close();

      dialog.showModal();
      assert.isNotNull(document.querySelector('.backdrop'));
    });
  });

}();
