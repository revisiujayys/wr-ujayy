// Unduh semua gambar lebih dulu supaya saat layar pembuka hilang, tidak ada foto yang muncul menyusul.
// Dibatasi waktu agar koneksi lambat tidak menahan pelanggan terlalu lama.
export function preloadImages(urls: string[], timeoutMs = 6000): Promise<void> {
  const loads = urls.map(
    (url) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = url;
      }),
  );
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs));
  return Promise.race([Promise.all(loads).then(() => undefined), timeout]);
}
