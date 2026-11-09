import { formatTime } from '../lib/format';
import type { StoreSettings } from '../lib/types';

export function WelcomeBanner({ settings }: { settings: StoreSettings | null }) {
  return (
    <section className="select-none overflow-hidden rounded-3xl bg-orange-50 px-6 py-8 text-center">
      <p className="welcome-drop text-base font-medium text-stone-600">Selamat datang</p>
      <h1 className="welcome-pop mt-1 text-4xl font-extrabold tracking-tight">di Wr. Ujayy</h1>
      {settings && (
        <p className="mt-3 text-sm text-stone-500">
          Jam operasional {formatTime(settings.open_time)}–{formatTime(settings.close_time)} WIB
        </p>
      )}
    </section>
  );
}
