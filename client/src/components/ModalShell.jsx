import { useEffect, useRef } from 'react';
import { confirmDialog } from '../ui';
import { registerBack } from '../backStack';

// Open modals, topmost last: only the topmost reacts to Esc / Ctrl+Enter
const stack = [];

// Shared modal behaviour:
//  - Esc closes, Ctrl/Cmd+Enter submits the form inside
//  - clicking the backdrop closes, but only if the press also started there
//    (selecting text and releasing outside no longer closes the modal)
//  - if the user typed anything, closing asks for confirmation first
//  - `resetKey` clears the "unsaved changes" state (e.g. after a successful save)
export default function ModalShell({ onClose, className = '', style, resetKey, children }) {
  const ref = useRef(null);
  const dirty = useRef(false);
  const pressedOnBackdrop = useRef(false);
  const requestCloseRef = useRef(null);

  // `fromBack`: the user pressed the phone's back button (history entry already gone)
  requestCloseRef.current = async (fromBack = false, handle = null) => {
    if (dirty.current) {
      const leave = await confirmDialog({
        title: 'Kaydedilmemiş değişiklikler var',
        message: 'Çıkarsanız yazdığınız değişiklikler kaybolacak.',
        confirmText: 'Kaydetmeden çık',
        cancelText: 'Düzenlemeye dön',
        danger: true
      });
      if (!leave) {
        if (fromBack && handle) handle.repush(); // stay open: put the history entry back
        return;
      }
    }
    onClose();
  };

  useEffect(() => { dirty.current = false; }, [resetKey]);

  useEffect(() => {
    const id = {};
    stack.push(id);
    const back = registerBack(() => requestCloseRef.current(true, back));
    const el = ref.current;

    const markDirty = () => { dirty.current = true; };
    el?.addEventListener('input', markDirty);
    el?.addEventListener('change', markDirty);

    const onKey = (e) => {
      if (stack[stack.length - 1] !== id) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        requestCloseRef.current();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        const form = el?.querySelector('form');
        if (form) {
          e.preventDefault();
          form.requestSubmit();
        }
      }
    };
    document.addEventListener('keydown', onKey);

    // Focus the first field so typing can start right away
    if (el && !el.contains(document.activeElement)) {
      el.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=date]):not([type=number]), textarea')?.focus();
    }

    return () => {
      document.removeEventListener('keydown', onKey);
      el?.removeEventListener('input', markDirty);
      el?.removeEventListener('change', markDirty);
      stack.splice(stack.indexOf(id), 1);
      back.release();
    };
  }, []);

  return (
    <div
      className="modal-backdrop open"
      onMouseDown={(e) => { pressedOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (pressedOnBackdrop.current && e.target === e.currentTarget) requestCloseRef.current();
        pressedOnBackdrop.current = false;
      }}
    >
      <div
        ref={ref}
        className={`modal ${className} glass-card`}
        style={style}
        onClick={(e) => {
          // Buttons marked data-modal-close go through the same unsaved-changes check
          if (e.target.closest('[data-modal-close]')) requestCloseRef.current();
        }}
      >
        {children}
      </div>
    </div>
  );
}
