// Ikon keranjang dengan bubble jumlah item. Kosong = abu-abu & tidak bisa ditekan.
export function CartButton({ count, disabled, onOpen }: { count: number; disabled?: boolean; onOpen: () => void }) {
  const hasItems = count > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled || !hasItems}
      aria-label={hasItems ? `Buka keranjang, ${count} item` : 'Keranjang kosong'}
      className={`relative grid size-10 place-items-center rounded-full transition-colors ${
        hasItems ? 'bg-brand text-white shadow-sm' : 'bg-stone-100 text-stone-400'
      } disabled:cursor-default`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="20" r="1.3" />
        <circle cx="18" cy="20" r="1.3" />
        <path d="M2 3h3l2.7 12.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6" />
      </svg>
      {hasItems && (
        <span
          key={count}
          className="badge-pop absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-stone-900 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white tabular-nums"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
