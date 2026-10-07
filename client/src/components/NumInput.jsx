import { useState } from 'react';

// Number field that can be freely edited: you can clear it, type 0, 00 or a minus sign.
// The parent receives a number on every valid keystroke; limits (min/max) are applied
// when leaving the field, so typing is never fought with.
//   <NumInput value={n} onChange={setN} min={1} integer />
export default function NumInput({ value, onChange, min, max, integer = false, emptyValue, ...rest }) {
  const toText = (v) => (v === null || v === undefined || Number.isNaN(v) ? '' : String(v));
  const [text, setText] = useState(toText(value));
  const [lastValue, setLastValue] = useState(value);

  // Keep in sync when the parent changes the value from outside (e.g. form reset)
  if (value !== lastValue) {
    setLastValue(value);
    const typed = integer ? parseInt(text, 10) : parseFloat(text);
    if (typed !== value) setText(toText(value));
  }

  const parse = (t) => {
    const n = integer ? parseInt(t, 10) : parseFloat(String(t).replace(',', '.'));
    return Number.isNaN(n) ? null : n;
  };
  const clamp = (n) => {
    let v = n;
    if (min !== undefined && v < min) v = min;
    if (max !== undefined && v > max) v = max;
    return v;
  };

  const handleChange = (e) => {
    const t = e.target.value;
    setText(t);
    const n = parse(t);
    if (n !== null) {
      setLastValue(n);
      onChange(n);
    }
  };

  const handleBlur = () => {
    const n = parse(text);
    if (n === null) {
      const fallback = emptyValue !== undefined ? emptyValue : (min !== undefined ? clamp(0) : 0);
      setText(emptyValue === '' ? '' : toText(fallback));
      setLastValue(fallback);
      onChange(fallback);
      return;
    }
    const c = clamp(n);
    setText(String(c));
    setLastValue(c);
    if (c !== n) onChange(c);
  };

  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      step={rest.step ?? (integer ? 1 : 'any')}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={(e) => e.target.select()}
    />
  );
}
