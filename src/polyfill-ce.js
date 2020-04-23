
let ce = window.CustomEvent;
if (typeof ce === 'object') {
  ce = function CustomEvent(type, x = {}) {
    const ev = document.createEvent('CustomEvent');
    ev.initCustomEvent(type, x.bubbles, x.cancelable, x.detail);
    return ev;
  };
  ce.prototype = window.CustomEvent.prototype;
}

export const supportCustomEvent = ce;
