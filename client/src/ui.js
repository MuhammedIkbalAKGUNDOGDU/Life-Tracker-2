// Tiny event-based helpers so any component can show a confirm dialog or toast
// without prop drilling. Rendered by <DialogHost /> (confirm) and App (toast).

export const confirmDialog = ({
  title = 'Emin misiniz?',
  message = '',
  confirmText = 'Evet',
  cancelText = 'Vazgeç',
  danger = false
} = {}) =>
  new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent('ui-confirm', {
      detail: { title, message, confirmText, cancelText, danger, resolve }
    }));
  });

// action = { label, onClick } shows a button in the toast (e.g. "Geri al")
export const notify = (message, type = 'info', action = null) => {
  window.dispatchEvent(new CustomEvent('ui-toast', { detail: { message, type, action } }));
};

// Text prompt in the app's own dialog. Resolves to the entered text, or null if cancelled.
export const promptDialog = ({ title = '', label = '', defaultValue = '', confirmText = 'Kaydet' } = {}) =>
  new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent('ui-confirm', {
      detail: { title, message: label, confirmText, cancelText: 'Vazgeç', danger: false, input: { defaultValue }, resolve }
    }));
  });
