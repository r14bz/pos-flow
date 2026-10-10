# TokoFlow POS — checklist sebelum go-live

## 1. GitHub dan Vercel

1. Buat repository GitHub kosong, misalnya `tokoflow-pos`, lalu upload **isi** folder ini (bukan file ZIP-nya).
2. Import repository itu pada Vercel. Gunakan framework Vite, build command `npm run build`, dan output directory `dist`.
3. Tambahkan environment variable Production dan Preview berikut di Vercel:
   - `VITE_SUPABASE_URL` — Project URL dari Supabase.
   - `VITE_SUPABASE_ANON_KEY` — publishable/anon key Supabase; tidak boleh service-role key.
   - `VITE_VAPID_PUBLIC_KEY` — opsional, public VAPID key untuk push.
   - `CRON_SECRET` — rahasia acak panjang untuk endpoint laporan terjadwal.
4. Deploy lalu salin URL produksi Vercel ke Supabase Auth → URL Configuration → Site URL dan Redirect URLs.

## 2. Supabase

1. Terapkan semua migrasi melalui Supabase CLI (`npx supabase db push`), termasuk `202610100001_init_pos.sql` dan `202610100002_store_qris_modes.sql`. Jika tabel baru tidak dapat diakses dari aplikasi, periksa Data API settings dan pastikan `store_qris_settings` terekspos; jangan beri akses aplikasi ke `store_qris_credentials`.
2. Aktifkan Email provider di Supabase Auth. Uji pendaftaran, login, logout, reset password, dan redirect pada domain produksi.
3. Setelah akun administrator tepercaya dibuat, set `profiles.is_super_admin = true` melalui SQL Editor. Jangan memberi nilai ini dari browser/user metadata.
4. Deploy Edge Functions:

   ```bash
   npx supabase functions deploy save-qris-settings
   npx supabase functions deploy create-static-qris-sale
   npx supabase functions deploy confirm-static-qris-payment
   npx supabase functions deploy expire-static-qris-sales
   npx supabase functions deploy create-qris-payment
   npx supabase functions deploy midtrans-webhook
   npx supabase functions deploy invite-employee
   npx supabase functions deploy notify-low-stock
   npx supabase functions deploy daily-report
   ```

5. Tambahkan secrets ke Supabase Edge Functions sesuai fitur yang diaktifkan:
   - `CRON_SECRET` harus sama dengan nilai `CRON_SECRET` di Vercel.
   - QRIS per toko: `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` (hasil `openssl rand -base64 32`). Server Key merchant dimasukkan pemilik masing-masing melalui Pengaturan QRIS, bukan sebagai secret global.
   - `CRON_SECRET` juga disimpan sebagai Supabase Edge Function Secret untuk kedaluwarsa QRIS statis dan laporan harian.
   - Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, dan `VAPID_SUBJECT`.
6. Di dashboard Midtrans, set notification URL ke `https://<PROJECT_REF>.supabase.co/functions/v1/midtrans-webhook`. Uji status pending, berhasil, gagal, dan kedaluwarsa di Sandbox.

## 3. Periksa isolasi tenant

Sebelum memasukkan data bisnis nyata, gunakan minimal dua akun pengguna yang berbeda. Buat toko terpisah pada tiap akun, lalu pastikan masing-masing tidak bisa membaca atau mengubah produk, transaksi, anggota, maupun laporan toko akun lain. RLS di database adalah pengaman utama; jangan menonaktifkannya.

## 4. Pemeriksaan fitur pada perangkat target

- Uji transaksi tunai dan transfer serta ekspor XLSX di browser desktop dan ponsel.
- Uji pemindaian kamera pada HTTPS. Jika browser tidak mendukung `BarcodeDetector`, input barcode manual tetap tersedia.
- Uji PWA install dari halaman non-kasir; tombol install sengaja tidak ditampilkan pada halaman kasir.
- Printer Bluetooth berbeda-beda protokolnya. Pemilihan perangkat BLE tidak menjamin seluruh printer thermal dapat mencetak; gunakan model yang kompatibel atau fallback dialog cetak browser.
- Aktifkan notifikasi browser lalu uji notifikasi stok menipis dan laporan harian. Scheduler Vercel dikonfigurasi di `vercel.json` pada 17:05 UTC (00:05 WIB hari berikutnya).

## 5. Rahasia yang tidak boleh masuk GitHub

Jangan pernah commit `.env.local`, Supabase service-role/secret key, `PAYMENT_CREDENTIALS_ENCRYPTION_KEY`, Midtrans Server Key merchant, VAPID private key, atau `CRON_SECRET`. Di browser gunakan hanya `VITE_SUPABASE_URL`, publishable/anon key, dan public VAPID key.
