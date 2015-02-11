dialog-polyfill.js is a polyfill for `<dialog>`.

`<dialog>` is an element for a popup box in a web page. See
[more information and demos](http://falken-testing.appspot.com/dialog/index.html)
and the
[HTML spec](http://www.whatwg.org/specs/web-apps/current-work/multipage/commands.html#the-dialog-element).

## Usage

### Installation

You may optionally install via Bower-

    $ bower install dialog-polyfill

### Supports

This polyfill works on modern versions of all major browsers. It also supports IE9 and above.

## Example

```html
<head>
  <script src="dialog-polyfill.js"></script>
  <link rel="stylesheet" type="text/css" href="dialog-polyfill.css" />
</head>
<body>
  <dialog>I'm a dialog!</dialog>
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
#mydialog + .backdrop,
#mydialog::backdrop {
  background-color: green;
}
```

## Limitations

- Modailty isn't bulletproof. For example, `accessKey` can be used to focus inert elements.
  - While focus is inside a `<dialog>`, the browser's chrome cannot be tabbed to.
- The polyfill `<dialog>` should always be a child of `<body>`.
- Polyfill top layer stacking can be ruined by playing with z-index.
- The polyfill `<dialog>` does not retain dynamically set CSS top/bottom values
upon close.
- Anchored positioning is not implemented. The native `<dialog>` in Chrome
doesn't have it either.
