# SEMAR — Sistem Manajemen Retail

Starter aplikasi POS berbahasa Indonesia untuk bisnis multi-toko. Frontend memakai React + Vite, database/auth memakai Supabase, dan deployment statis memakai Vercel.

## Yang sudah ada

- Dashboard penjualan, transaksi terbaru, komposisi metode bayar, tren mingguan, dan alarm stok minimum.
- Halaman kasir responsif dengan keranjang, kalkulasi diskon/kembalian, input barcode, pemindai kamera ponsel (di browser yang mendukung `BarcodeDetector`), serta struk cetak melalui dialog browser.
- Inventaris multi-toko: tambah barang, SKU/barcode, kategori, harga jual/modal, batas stok, dan penyesuaian stok yang tercatat pada ledger.
- Riwayat transaksi, ringkasan laporan, dan ekspor Excel `.xlsx` multi-sheet: Ringkasan, Transaksi, Detail Barang, dan Inventaris.
- Manajemen karyawan berbasis peran dan Edge Function undangan email ke Supabase Auth.
- Dukungan PWA/manifest/service worker, toggle mode terang/gelap, daftar toko dan panel administrator.
- Database Supabase dengan RLS per `store_id`, RPC checkout/penyesuaian stok atomik, QRIS statis/dinamis per toko, kredensial merchant terenkripsi di server, webhook, dan push notification.
- Tombol install aplikasi disembunyikan dari halaman kasir (`/cashier`).
- Demo interaktif untuk mencoba antarmuka tanpa konfigurasi Supabase. Data demo lokal bukan data produksi dan simulasi QRIS bukan pembayaran nyata.

## Jalankan lokal

```bash
npm install
cp .env.example .env.local
npm run dev
```

Untuk pratinjau UI, Anda bisa langsung membuka aplikasi lalu pilih **Buka demo interaktif**. Agar login, inventaris, dan sinkronisasi benar-benar terhubung, isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di `.env.local`.

## Siapkan Supabase

1. Buat proyek baru di [Supabase](https://supabase.com/dashboard).
2. Terapkan migrasi `supabase/migrations/202610100001_init_pos.sql` melalui SQL Editor atau Supabase CLI:

   ```bash
   npx supabase login
   npx supabase link --project-ref PROJECT_REF
   npx supabase db push
   ```

3. Ambil Project URL dan publishable/anon key dari **Project Settings → API**. Masukkan ke `.env.local`:

   ```dotenv
   VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
   ```

4. Aktifkan Email Auth di **Authentication → Providers**. Atur email confirmation, SMTP, callback URL, dan domain produksi sesuai kebutuhan.
5. Buat akun pertama melalui formulir daftar. Kebijakan RLS membatasi data toko ke anggota toko; tabel `store_memberships` merupakan sumber peran yang otoritatif.
6. Bila akun administrator platform dibutuhkan, set `profiles.is_super_admin = true` secara manual melalui SQL Editor hanya untuk akun tepercaya. Jangan memakai `user_metadata` dari browser untuk menentukan administrator.
7. Aktifkan Realtime untuk tabel `products` dan `sales` jika project tidak menerapkan publication dari migrasi. Migrasi mencoba menambahkan keduanya ke `supabase_realtime`.

### Kebijakan tenant

`stores.owner_id` menentukan pemilik awal. Pengguna harus punya baris `store_memberships` untuk membuka toko. Query dan mutasi tenant-owned menggunakan `store_id`; RLS menjalankan verifikasi di server. Tabel transaksi ditulis melalui RPC (`checkout_sale`, `create_pending_sale`), bukan insert langsung dari klien. RPC menghitung harga dari database, mengunci stok, dan menulis stock movement secara atomik.

Peran yang didukung: `owner`, `manager`, `cashier`, `inventory`, dan `viewer`. Invited user ditautkan dengan membership melalui Edge Function `invite-employee`.

## Deploy ke Vercel

1. Buat repository kosong di GitHub lalu upload/push seluruh isi folder proyek ini.
2. Di Vercel, pilih **Add New → Project**, import repo tersebut, gunakan build command `npm run build`, output directory `dist` (biasanya terdeteksi otomatis).
3. Tambahkan `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, dan opsional `VITE_VAPID_PUBLIC_KEY` ke Environment Variables untuk Preview/Production.
4. Deploy. Tambahkan domain Vercel ke Supabase Auth **Site URL / Redirect URLs**.

Contoh perintah Git:

```bash
git init
git add .
git commit -m "Build SEMAR starter"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

## QRIS statis + dinamis per toko

SEMAR menyimpan konfigurasi QRIS berdasarkan `store_id`. Setiap pemilik mengatur QRIS toko aktif di **Pengaturan Toko → Pembayaran QRIS**. Tidak ada satu Server Key global yang dipakai bersama semua toko.

- **QRIS statis:** unggah gambar QRIS resmi milik toko. File disimpan pada bucket privat `store-qris` dengan kebijakan Storage per toko. Kasir memasukkan total di POS, pelanggan memindai QR, lalu kasir wajib memeriksa pembayaran pada aplikasi/portal merchant sebelum menekan konfirmasi manual. Pembayaran statis tidak dapat diverifikasi otomatis hanya dari gambar atau tangkapan layar.
- **QRIS dinamis:** pemilik memasukkan ID merchant dan Server Key dari akun merchant miliknya. Kunci dienkripsi dengan AES-GCM di Edge Function dan disimpan dalam tabel `store_qris_credentials` yang tidak dapat dibaca oleh `anon`/`authenticated`. QR dibuat per transaksi. Webhook memetakan `provider_order_id` unik ke toko yang benar, mendekripsi kunci toko itu di server, memvalidasi signature, dan baru mengonfirmasi pembayaran.
- **Keduanya:** kasir dapat memilih statis (konfirmasi manual) atau dinamis (webhook).
- Integrasi dinamis yang disiapkan saat ini adalah Midtrans. Masing-masing toko harus memiliki akun/izin merchant yang mendukung penggunaan API tersebut. Jangan menggunakan Server Key dari toko lain.

### Migrasi dan secret QRIS

1. Terapkan migrasi awal dan migrasi QRIS baru:

   ```bash
   npx supabase db push
   ```

   Migrasi kedua menambahkan konfigurasi per toko, tabel kredensial privat, kolom mode/order ID, serta bucket privat untuk QRIS statis. Jika project Supabase tidak mengekspos tabel baru melalui Data API secara default, pastikan `public` atau tabel `store_qris_settings` tersedia pada Data API settings. Jangan memberi grant akses aplikasi pada `store_qris_credentials`; tabel ini sengaja hanya untuk fungsi server.

2. Buat kunci enkripsi 32 byte pada mesin tepercaya, bukan di browser:

   ```bash
   openssl rand -base64 32
   ```

   Simpan hasilnya sebagai secret `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` pada **Supabase → Edge Functions → Secrets**. Jangan masukkan ke GitHub, `.env` frontend, atau variabel berawalan `VITE_`. Jangan mengganti kunci setelah kredensial tersimpan kecuali Anda melakukan proses re-enkripsi kredensial yang ada.

3. Deploy fungsi:

   ```bash
   npx supabase functions deploy save-qris-settings
   npx supabase functions deploy create-static-qris-sale
   npx supabase functions deploy confirm-static-qris-payment
   npx supabase functions deploy expire-static-qris-sales
   npx supabase functions deploy create-qris-payment
   npx supabase functions deploy midtrans-webhook
   ```

4. Pada setiap akun merchant Midtrans, aktifkan QRIS/API dan masukkan **Server Key milik toko tersebut** melalui halaman pengaturan SEMAR. Jangan menyimpan Server Key pada Vercel `VITE_*`.
5. Atur URL notifikasi Midtrans ke `https://PROJECT_REF.supabase.co/functions/v1/midtrans-webhook` untuk setiap merchant yang mendukung URL webhook tersebut. Uji di Sandbox terlebih dahulu dan pastikan webhook terverifikasi sebelum produksi.
6. Jadwalkan `POST https://PROJECT_REF.supabase.co/functions/v1/expire-static-qris-sales` setiap 5 menit dengan header `x-cron-secret: <CRON_SECRET>`. Fungsi ini membatalkan QRIS statis yang kedaluwarsa dan melepas stok reservasi. Set `CRON_SECRET` sebagai Supabase Edge Function Secret.
7. QRIS statis harus diambil dari kanal resmi merchant. Untuk pengujian, gunakan instrumen Sandbox yang disediakan penyedia jika tersedia; jangan melakukan pembayaran percobaan ke QRIS produksi tanpa sengaja.

**Batasan keamanan operasional:** kunci terenkripsi di database tetap bergantung pada kerahasiaan `PAYMENT_CREDENTIALS_ENCRYPTION_KEY`. Batasi akses Dashboard Supabase, aktifkan MFA untuk pemilik proyek, uji isolasi menggunakan dua akun/toko, dan lakukan rekonsiliasi berkala untuk transaksi QRIS statis.

## Barcode dan printer

- Kamera memerlukan HTTPS (Vercel memenuhi syarat) dan izin kamera browser. Pemindaian otomatis memakai `BarcodeDetector`, yang dukungannya berbeda-beda antar-browser. Input barcode/manual keyboard wedge tetap tersedia sebagai fallback.
- Tombol printer mencoba menemukan perangkat BLE. Memilih perangkat tidak menjamin printer dapat mencetak: banyak printer thermal memakai Bluetooth Classic atau protokol khusus vendor. Fallback yang tersedia adalah `window.print()` untuk dialog cetak browser. Untuk integrasi yang konsisten dengan model printer tertentu, diperlukan adapter ESC/POS BLE yang cocok atau bridge/native app.

## Push notification & laporan harian

1. Buat pasangan VAPID di lingkungan tepercaya (misalnya `npx web-push generate-vapid-keys`), lalu set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, dan `VAPID_SUBJECT` sebagai Supabase Edge Function Secrets. Hanya public key yang boleh dimasukkan ke `VITE_VAPID_PUBLIC_KEY`.
2. Deploy fungsi berikut:

   ```bash
   npx supabase functions deploy notify-low-stock
   npx supabase functions deploy daily-report
   ```

3. Atur `CRON_SECRET` sebagai secret. Jadwalkan POST ke `https://PROJECT_REF.supabase.co/functions/v1/daily-report` setiap hari pada pukul **00:05 WIB** (17:05 UTC pada hari sebelumnya) dengan header `x-cron-secret: <CRON_SECRET>`. Contoh jadwal bisa memakai Supabase Cron/pg_cron + pg_net atau scheduler eksternal tepercaya.
4. Pengingat stok menipis dipanggil oleh aplikasi setelah stok turun/penambahan barang menyentuh batas minimum. Browser perlu mengizinkan push dan perangkat perlu mendukung Web Push.

## Catatan sebelum produksi

- QRIS dinamis, invite email, dan push memerlukan akun/kunci provider yang valid serta pengujian end-to-end di lingkungan Sandbox. QRIS statis membutuhkan verifikasi manual oleh kasir.
- Verifikasi kebijakan RLS menggunakan minimal dua akun dan dua toko sebelum menyimpan data bisnis nyata. Migrasi adalah fondasi, bukan sertifikasi keamanan.
- Untuk laporan harian yang dikirim melalui email/WhatsApp, tambahkan provider pengiriman dan jadwal terpisah; starter ini mengirim ringkasan lewat push.
- Uji pemindai kamera, printer thermal, PWA install, dan mode offline pada perangkat target. Service worker saat ini meng-cache shell/static resources, bukan antrean transaksi offline.

## Struktur utama

```text
src/                         React app dan UI responsif
src/lib/supabase.js          Client Supabase + konfigurasi
src/lib/demoData.js          Data contoh untuk mode demo
public/manifest.webmanifest  Metadata PWA
public/sw.js                 Service worker & push notification
supabase/migrations/         Schema, RLS, RPC atomik, daily report view
supabase/functions/          QRIS per toko, webhook, invite karyawan, push notification
vercel.json                  Rewrite path /cashier
```
