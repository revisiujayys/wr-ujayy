import type { Category } from '../lib/types';

type Props = {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
};

export function CategoryTabs({ categories, value, onChange }: Props) {
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
      active
        ? 'border-stone-900 bg-stone-900 text-white'
        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
    }`;

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Kategori">
      <button type="button" role="tab" aria-selected={value === null} className={chip(value === null)} onClick={() => onChange(null)}>
        Semua
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={value === c.id}
          className={chip(value === c.id)}
          onClick={() => onChange(c.id)}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
