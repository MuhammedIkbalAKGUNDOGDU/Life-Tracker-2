// Makes the phone's "back" button close the top-most open modal / sheet instead of leaving the page.
// Each open overlay pushes one history entry; closing it any other way removes that entry again.
const stack = [];
let ignorePops = 0;

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (ignorePops > 0) { ignorePops -= 1; return; }
    const top = stack[stack.length - 1];
    if (top) {
      top.popped = true; // the browser already removed our history entry
      top.onBack();
    }
  });
}

// onBack() is called when the user presses back. Return value is ignored; call `repush()`
// afterwards if the overlay decided to stay open (e.g. unsaved changes).
export function registerBack(onBack) {
  let entry = null;
  let timer = setTimeout(() => {
    timer = null;
    entry = { onBack, popped: false };
    stack.push(entry);
    window.history.pushState({ overlay: true }, '');
  }, 0); // deferred so React StrictMode's instant mount/unmount/mount does not touch history

  return {
    repush() {
      if (!entry) return;
      entry.popped = false;
      window.history.pushState({ overlay: true }, '');
    },
    release() {
      if (timer) { clearTimeout(timer); timer = null; return; }
      if (!entry) return;
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (!entry.popped) {
        ignorePops += 1;
        window.history.back();
      }
      entry = null;
    }
  };
}
