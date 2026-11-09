import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Splash } from './components/Splash';
import { CartProvider } from './lib/cart';
import './index.css';

// Cegah menu tekan-lama (salin/unduh gambar/cari di Google) di luar kolom isian.
document.addEventListener('contextmenu', (e) => {
  const target = e.target;
  if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"], .allow-select')) return;
  e.preventDefault();
});

// Admin dimuat terpisah agar halaman pelanggan tetap ringan.
const AdminApp = lazy(() => import('./admin/AdminApp'));
const isAdminRoute = window.location.pathname.startsWith('/admin');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? (
      <Suspense fallback={<Splash />}>
        <AdminApp />
      </Suspense>
    ) : (
      <CartProvider>
        <App />
      </CartProvider>
    )}
  </StrictMode>,
);
