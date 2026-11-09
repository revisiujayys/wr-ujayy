import { useEffect, useRef, type ReactNode } from 'react';

// Tumpukan sheet yang terbuka: Escape hanya menutup yang paling atas.
const openSheets: object[] = [];

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const me = {};
    openSheets.push(me);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openSheets[openSheets.length - 1] === me) closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      openSheets.splice(openSheets.indexOf(me), 1);
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Tutup" data-nopress className="sheet-backdrop absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="sheet-panel relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" aria-label="Tutup" onClick={onClose} className="grid size-8 place-items-center rounded-full bg-stone-100 text-stone-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
