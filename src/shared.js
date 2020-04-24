
import {isFormMethodDialog} from './dom.js';


export const internalSubmitHandler = function(e) {
  const origin = e.composedPath()[0];
  if (!isFormMethodDialog(origin)) {
    return;
  }

  // TODO(samthor): The spec says the submitter can be an `<input type="image" />`, and we should
  // catch the x/y positions and use them as a returnValue `${x},${y}`.

  const submitter = origin.getRootNode().activeElement || e.submitter || null;
  this.close(submitter.value || undefined);
};
