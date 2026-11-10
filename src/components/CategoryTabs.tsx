import type { Category } from '../lib/types';

type Props = {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
};

export function CategoryTabs({ categories, value, onChange }: Props) {
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
      active ? 'bg-brand text-white shadow-md' : 'tile !rounded-full text-stone-700'
    }`;

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]" role="tablist" aria-label="Kategori">
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
