import React, { useEffect, useRef, useState } from 'react';

/**
 * Smoothly animates between integer values. Avoids jarring jumps when counters update.
 */
export function AnimatedNumber({ value, duration = 500, className = '', style }) {
  const [displayed, setDisplayed] = useState(value);
  const frameRef = useRef(null);
  const fromRef = useRef(value);
  const startRef = useRef(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    startRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (to - from) * eased);
      setDisplayed(current);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  return (
    <span className={className} style={style}>
      {displayed.toLocaleString()}
    </span>
  );
}
