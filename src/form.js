
import {isFormMethodDialog, findNearestDialog} from './dom.js';

/**
 * Makes sure that `form.method` can return "dialog" if required. It's masked by browsers as they
 * treat it as an invalid state.
 *
 * @return {boolean} whether polyfilling was needed
 */
export function ensureFormMethodDialog() {
  const testForm = document.createElement('form');
  testForm.setAttribute('method', 'dialog');
  if (testForm.method === 'dialog') {
    return false;  // great
  }

  // If we're being polyfilled, also disable the default action (which is to actually submit the
  // form via GET or POST).)
  document.addEventListener('submit', (e) => {
    const origin = e.composedPath()[0];
    if (isFormMethodDialog(origin)) {
      e.preventDefault();
    }
  });

  const prop = Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, 'method');
  if (!prop) {
    // nb. Some older iOS and older PhantomJS fail to return the descriptor. Ignore.
    return true;
  }

  const {get: realGet, set: realSet} = prop;

  prop.get = function() {
    if (isFormMethodDialog(this)) {
      return 'dialog';
    }
    return realGet.call(this);
  };

  prop.set = function(v) {
    if (String(v).toLowerCase() === 'dialog') {
      return this.setAttribute('method', v);
    }
    return realSet.call(this, v);
  };

  Object.defineProperty(HTMLFormElement.prototype, 'method', prop);
  return true;
}


export function registerGlobalFormBehavior() {
  ensureFormMethodDialog();

  // /**
  //  * Global 'click' handler, to capture the <input type="submit"> or <button> element which has
  //  * submitted a <form method="dialog">. Needed as Safari and others don't report this inside
  //  * document.activeElement.
  //  */
  // document.addEventListener('click', function(ev) {
  //   dialogPolyfill.formSubmitter = null;
  //   dialogPolyfill.useValue = null;
  //   if (ev.defaultPrevented) { return; }  // e.g. a submit which prevents default submission

  //   var target = /** @type {Element} */ (ev.target);
  //   if (!target || !isFormMethodDialog(target.form)) { return; }

  //   var valid = (target.type === 'submit' && ['button', 'input'].indexOf(target.localName) > -1);
  //   if (!valid) {
  //     if (!(target.localName === 'input' && target.type === 'image')) { return; }
  //     // this is a <input type="image">, which can submit forms
  //     dialogPolyfill.useValue = ev.offsetX + ',' + ev.offsetY;
  //   }

  //   var dialog = findNearestDialog(target);
  //   if (!dialog) { return; }

  //   dialogPolyfill.formSubmitter = target;

  // }, false);

  // /**
  //  * Replace the native HTMLFormElement.submit() method, as it won't fire the
  //  * submit event and give us a chance to respond.
  //  */
  // var nativeFormSubmit = HTMLFormElement.prototype.submit;
  // var replacementFormSubmit = function () {
  //   if (!isFormMethodDialog(this)) {
  //     return nativeFormSubmit.call(this);
  //   }
  //   var dialog = findNearestDialog(this);
  //   dialog && dialog.close();
  // };
  // HTMLFormElement.prototype.submit = replacementFormSubmit;

  // /**
  //  * Global form 'dialog' method handler. Closes a dialog correctly on submit
  //  * and possibly sets its return value.
  //  */
  // document.addEventListener('submit', function(ev) {
  //   if (ev.defaultPrevented) {
  //     return;  // user code prevented this already
  //   }

  //   const form = /** @type {HTMLFormElement} */ (ev.target);
  //   if (!isFormMethodDialog(form)) {
  //     return;
  //   }
  //   ev.preventDefault();

  //   const dialog = findNearestDialog(form);
  //   if (!dialog) {
  //     return;
  //   }

  //   // Forms can only be submitted via .submit() or a click (?), but anyway: sanity-check that
  //   // the submitter is correct before using its value as .returnValue.
  //   var s = dialogPolyfill.formSubmitter;
  //   if (s && s.form === form) {
  //     dialog.close(dialogPolyfill.useValue || s.value);
  //   } else {
  //     dialog.close();
  //   }
  //   dialogPolyfill.formSubmitter = null;

  // }, false);

}