dialog-polyfill.js is a polyfill for `<dialog>`.

### Example

    <head>
      <script src="dialog-polyfill.js"></script>
      <link rel="stylesheet" type="text/css" href="dialog-polyfill.css">
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

### ::backdrop

In native `<dialog>`, the backdrop is a pseudo-element:

    #mydialog::backdrop {
      background-color: green;
    }

With the polyfill, you do it like:

    #mydialog + .backdrop {
      background-color: green;
    }

### Known limitations

- Modality isn't bulletproof (you can tab to inert elements)
- The polyfill `<dialog>` should always be a child of `<body>`
- Polyfill top layer stacking can be ruined by playing with z-index.
- The polyfill `<dialog>` does not retain dynamically set CSS top/bottom values
upon close
