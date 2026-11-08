import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CartProvider } from './lib/cart';
import './index.css';

// Admin dimuat terpisah agar halaman pelanggan tetap ringan.
const AdminApp = lazy(() => import('./admin/AdminApp'));
const isAdminRoute = window.location.pathname.startsWith('/admin');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    ) : (
      <CartProvider>
        <App />
      </CartProvider>
    )}
  </StrictMode>,
);
