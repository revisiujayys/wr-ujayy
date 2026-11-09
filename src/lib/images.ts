import { supabase } from './supabase';

const BUCKET = 'product-images';

// Perkecil di browser (maks 900px, WebP) agar ringan dan muat batas 2 MB.
async function prepareImage(file: File, maxSize = 900): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Gambar tidak bisa diproses di perangkat ini');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  if (!blob) throw new Error('Gagal memproses gambar');
  return blob;
}

// Mengembalikan URL publik gambar yang tersimpan di Supabase Storage.
// `prefix` menandai asal foto (mis. "pexels-") agar kredit sumber bisa ditampilkan di katalog.
export async function uploadImage(file: File, folder: 'products' | 'qris', prefix = ''): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Pilih file gambar (JPG, PNG, atau WebP)');
  const blob = await prepareImage(file);
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
  const path = `${folder}/${prefix}${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
  });
  if (error) throw new Error('Upload gagal: ' + error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
