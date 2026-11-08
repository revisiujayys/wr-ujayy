export type StoreSettings = {
  is_open: boolean;
  whatsapp_number: string | null;
  address: string | null;
  maps_url: string | null;
  open_time: string;
  close_time: string;
};

export type Category = { id: string; name: string };

export type CatalogVariant = { id: string; name: string; available: boolean };

export type CatalogProduct = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  productType: 'regular' | 'noodle';
  // false = tampil dengan label "Habis"
  available: boolean;
  variants: CatalogVariant[];
};
