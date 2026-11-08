import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' };

export function Btn({ variant = 'primary', className = '', ...rest }: BtnProps) {
  const styles = {
    primary: 'bg-stone-900 text-white',
    ghost: 'border border-stone-300 bg-white text-stone-800',
    danger: 'bg-red-600 text-white',
  }[variant];
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

export function Field({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-stone-700">{label}</span>
      <input
        {...rest}
        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 outline-none focus:border-stone-500"
      />
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-stone-300'}`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-stone-200 bg-white p-4 ${className}`}>{children}</section>;
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

export function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const { message, code } = e as { message: unknown; code?: unknown };
    if (code === '23503') return 'Masih dipakai data lain, jadi tidak bisa dihapus. Nonaktifkan saja.';
    if (code === '23505') return 'Nama sudah dipakai, gunakan nama lain.';
    return String(message);
  }
  return 'Terjadi kesalahan';
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });
}
