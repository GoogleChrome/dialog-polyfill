
interface DialogPolyfillType {
  registerDialog(dialog: HTMLDialogElement): void;
  forceRegisterDialog(dialog: HTMLDialogElement): void;
}

/**
 * If used as CJS, then "dialogPolyfill" is added to the global scope. Just assert it exists.
 */
declare global {
  const dialogPolyfill: DialogPolyfillType;
}

/**
 * If used as ESM, then we export a const of type "DialogPolyfillType" as the default.
 */
declare const dialogPolyfill: DialogPolyfillType
export default dialogPolyfill;
