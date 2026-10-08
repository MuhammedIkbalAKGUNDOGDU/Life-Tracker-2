import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

// Phones: after scrolling down, a quick flick up reveals a button that glides back to the top
export default function ScrollTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let lastT = performance.now();
    let hideTimer;
    const onScroll = () => {
      const y = window.scrollY;
      const now = performance.now();
      const speed = (last - y) / Math.max(now - lastT, 1); // px/ms, positive when scrolling up
      if (y < 300) setShow(false);
      else if (speed > 1.2) {
        setShow(true);
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => setShow(false), 4000);
      }
      last = y;
      lastT = now;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(hideTimer); };
  }, []);

  const goTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setShow(false);
  };

  return (
    <button className={`scroll-top ${show ? 'visible' : ''}`} onClick={goTop} aria-label="Yukarı çık" tabIndex={show ? 0 : -1}>
      <ArrowUp size={20} />
    </button>
  );
}
