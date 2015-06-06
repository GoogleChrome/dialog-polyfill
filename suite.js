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


/**
 * Builds a test suite that has a default dialog.
 *
 * @param {string} name
 * @param {!Function(!HTMLDialogElement)} fn to run
 */
function dialogTest(name, fn) {
  test(name, function() {
    var dialog = document.createElement('dialog');
    dialog.innerText = 'Hello';
    document.body.appendChild(dialog);
    dialogPolyfill.registerDialog(dialog);

    try {
      fn(dialog);
    } finally {
      if (dialog.parentElement) {
        dialog.parentElement.removeChild(dialog);
      }
    }
  });
}

dialogTest('open', function(dialog) {
  assert(!dialog.hasAttribute('open'));
  dialog.show();
  assert(dialog.hasAttribute('open'));

  var returnValue = 1234;
  dialog.close(returnValue);
  assert(!dialog.hasAttribute('open'));
  assert.equal(dialog.returnValue, returnValue);
});

suite('centering', function() {

  dialogTest('default centering', function(dialog) {
    dialog.show();

    var expectedTop = (window.innerHeight - dialog.offsetHeight) / 2;
    var expectedLeft = (window.innerWidth - dialog.offsetWidth) / 2;
    var rect = dialog.getBoundingClientRect();

    assert(Math.abs(rect.top - expectedTop) < 2, 'expected almost equal top');
    assert(Math.abs(rect.left - expectedLeft) < 2,
        'expected almost equal left');
  });

});

suite('backdrop', function() {

});
