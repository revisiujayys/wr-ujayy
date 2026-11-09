import { useEffect, useRef } from 'react';

// Layar pembuka penuh: latar bergradasi bergerak, mangkuk beruap, dan huruf yang muncul satu per satu.
export function Splash({ leaving = false, onGone }: { leaving?: boolean; onGone?: () => void }) {
  const goneRef = useRef(onGone);
  goneRef.current = onGone;

  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(() => goneRef.current?.(), 550);
    return () => window.clearTimeout(id);
  }, [leaving]);

  const title = 'Wr. Ujayy';
  return (
    <div className={`splash ${leaving ? 'splash-leave' : ''}`} role="status" aria-label="Memuat">
      <span className="splash-blob splash-blob-a" aria-hidden="true" />
      <span className="splash-blob splash-blob-b" aria-hidden="true" />
      <div className="relative flex flex-col items-center gap-5">
        <svg viewBox="0 0 32 32" className="splash-bowl size-24 text-brand" aria-hidden="true">
          <path className="splash-steam" style={{ animationDelay: '0s' }} d="M11 7c0 2 2 2 2 5" />
          <path className="splash-steam" style={{ animationDelay: '0.25s' }} d="M17 5c0 2 2 2 2 5" />
          <path className="splash-steam" style={{ animationDelay: '0.5s' }} d="M23 7c0 2 2 2 2 5" />
          <path d="M4 16h24a12 12 0 0 1-24 0z" fill="currentColor" />
        </svg>
        <p className="select-none text-3xl font-extrabold tracking-tight text-stone-800" aria-hidden="true">
          {title.split('').map((ch, i) => (
            <span key={i} className="splash-letter" style={{ animationDelay: `${0.15 + i * 0.06}s` }}>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </p>
        <div className="splash-bar" aria-hidden="true">
          <span />
        </div>
        <p className="select-none text-xs text-stone-500">Menyiapkan menu…</p>
      </div>
    </div>
  );
}
