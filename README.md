dialog-polyfill.js is a polyfill for `<dialog>`.

#### [Demo](http://demo.agektmr.com/dialog/)

`<dialog>` is an element for a popup box in a web page, including a modal option. See
[more information and demos](http://falken-testing.appspot.com/dialog/index.html)
and the
[HTML spec](http://www.whatwg.org/specs/web-apps/current-work/multipage/commands.html#the-dialog-element).

## Usage

### Installation

You may optionally install via NPM or Bower-

    $ npm install dialog-polyfill
    $ bower install dialog-polyfill

### Supports

This polyfill works on modern versions of all major browsers. It also supports IE9 and above.

### Steps

1. Include the JavaScript, followed by the CSS in the `<head>` of your document.
2. Create your dialog elements within the document. See [limitations](#limitations) for more details.
3. Register the elements using `dialogPolyfill.registerDialog()`, passing it one node at a time. This polyfill won't replace native support.
4. Use your `<dialog>` elements!

## Example

```html
<head>
  <script src="dialog-polyfill.js"></script>
  <link rel="stylesheet" type="text/css" href="dialog-polyfill.css" />
</head>
<body>
  <dialog>
    I'm a dialog!
    <form method="dialog">
      <input type="submit" value="Close" />
    </form>
  </dialog>
  <script>
    var dialog = document.querySelector('dialog');
    dialogPolyfill.registerDialog(dialog);
    // Now dialog acts like a native <dialog>.
    dialog.showModal();
  </script>
</body>
```

### ::backdrop

In native `<dialog>`, the backdrop is a pseudo-element:

```css
#mydialog::backdrop {
  background-color: green;
}
```

When using the polyfill, the backdrop will be an adjacent element:

```css
#mydialog + .backdrop {
  background-color: green;
}

#mydialog::backdrop {
  background-color: green;
}
```

## Limitations

- Modal dialogs have limitations-
  - They should be a child of `<body>` or have parents without layout (aka, no position `absolute` or `relative` elements), see below for more
  - The browser's chrome may not be accessible via the tab key
  - Stacking can be ruined by playing with z-index
  - Changes to the CSS top/bottom values while open aren't retained

- Anchored positioning is not implemented, but the native `<dialog>` in Chrome doesn't have it either

### Position

One major limitation of the polyfill is that dialogs must have parents without layout.
This is required as the spec positions dialogs as part of the page layout _where they are opened_, and not positioned at a fixed position in the user's browser.

You can use a fixed layout, which allows the dialog to be positioned anywhere, by specifying the following CSS (works for both native and polyfill)-

```css
dialog {
  position: fixed;
  top: 50%;
  transform: translate(0, -50%);
}
```
