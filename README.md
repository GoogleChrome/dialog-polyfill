dialog-polyfill.js is a polyfill for `<dialog>` and `<form method="dialog">`.
Check out [some demos](https://googlechrome.github.io/dialog-polyfill/)!

`<dialog>` is an element for a popup box in a web page, including a modal option which will make the rest of the page inert during use.
This could be useful to block a user's interaction until they give you a response, or to confirm an action.
See the [HTML spec](https://html.spec.whatwg.org/multipage/forms.html#the-dialog-element).

## Usage

### Installation

You may optionally install via NPM -

    $ npm install dialog-polyfill


There are several ways that to include the dialog polyfill:

* include `dist/dialog-polyfill.js` script directly in your HTML, which exposes a global `dialogPolyfill` function.
* `import` (es modules)
* `require` (commonjs/node)


```javascript
// direct import (script module, deno)
import dialogPolyfill from './node_modules/dialog-polyfill/dist/dialog-polyfill.esm.js';

// *OR*

// modern es modules with rollup/webpack bundlers, and node via esm module
import dialogPolyfill from 'dialog-polyfill'

// *OR*

// traditional commonjs/node and browserify bundler
const dialogPolyfill = require('dialog-polyfill')
```


### Supports

This polyfill works on modern versions of all major browsers.
It also supports IE9 and above.
It can work when used inside Shadow DOM, but it's not recommended.

### Steps

1. Include the CSS in the `<head>` of your document, and the JS anywhere before referencing `dialogPolyfill`.
2. Create your dialog elements within the document. See [limitations](#limitations) for more details.
3. Register the elements using `dialogPolyfill.registerDialog()`, passing it one node at a time. This polyfill won't replace native support.
4. Use your `<dialog>` elements!

## Script Global Example

```html
<head>
  <link rel="stylesheet" type="text/css" href="dist/dialog-polyfill.css" />
</head>
<body>
  <dialog>
    I'm a dialog!
    <form method="dialog">
      <input type="submit" value="Close" />
    </form>
  </dialog>
  <script src="dist/dialog-polyfill.js"></script>
  <script>
    var dialog = document.querySelector('dialog');
    dialogPolyfill.registerDialog(dialog);
    // Now dialog always acts like a native <dialog>.
    dialog.showModal();
  </script>
</body>
```

### ::backdrop

In native `<dialog>`, the backdrop is a pseudo-element.
When using the polyfill, the backdrop will be an adjacent element:

```css
dialog::backdrop { /* native */
  background-color: green;
}
dialog + .backdrop { /* polyfill */
  background-color: green;
}
```

## Limitations

In the polyfill, modal dialogs have limitations-

- They should not be contained by parents that create a stacking context, see below
- The browser's chrome may not always be accessible via the tab key
- Changes to the CSS top/bottom values while open aren't retained

### Stacking Context

The major limitation of the polyfill is that dialogs should not have parents that create [a stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Positioning/Understanding_z_index/The_stacking_context).
The easiest way to solve this is to move your `<dialog>` element to be a child of `<body>`.

If this isn't possible you may still be able to use the dialog.
However, you may want to resolve it for two major reasons-

1. The polyfill can't guarantee that the dialog will be the top-most element of your page
2. The dialog may be positioned incorrectly as they are positioned as part of the page layout _where they are opened_ (defined by spec), and not at a fixed position in the user's browser.

To position a dialog in the center (regardless of user scroll position or stacking context), you can specify the following CSS-

```css
dialog {
  position: fixed;
  top: 50%;
  transform: translate(0, -50%);
}
```

This is also provided as a helper CSS class in the polyfill CSS, `.fixed`.
You can apply by using HTML like `<dialog class="fixed">`.

## Extensions

### Focus

The WAI-ARIA doc suggests returning focus to the previously focused element after a modal dialog is closed.
However, this is not part of the dialog spec itself.
See [this snippet](https://gist.github.com/samthor/babe9fad4a65625b301ba482dad284d1) to add this, even to the native `dialog`.
