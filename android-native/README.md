# POS Flow Native Android

Aplikasi Android native terpisah dari web app, dibangun dengan Kotlin, Jetpack Compose, dan Material 3. Aplikasi web pada root repository tetap dipertahankan.

## Status
Fondasi proyek Android awal. UI login adalah kerangka native; autentikasi Supabase dan modul bisnis belum diaktifkan. Jangan gunakan untuk transaksi produksi sampai integrasi dan pengujian selesai.

## Persyaratan
- Android Studio stabil yang mendukung Android Gradle Plugin di proyek.
- JDK 17.
- Android SDK platform 35.
- Perangkat/emulator Android API 26 atau lebih baru.

Buka folder `android-native/` di Android Studio lalu tunggu Gradle Sync.

## Konfigurasi Supabase
Jangan masukkan Supabase service-role key atau kredensial Midtrans ke aplikasi Android. Aplikasi nantinya menggunakan URL proyek dan publishable/anon key saja; RLS serta Edge Functions tetap menjadi batas keamanan di server.

Nilai build lokal melalui environment:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Nilai tersebut tidak disimpan di Git. Build awal dapat dibuka tanpa konfigurasi backend; integrasi akan diaktifkan setelah kontrak data diverifikasi.

## Arsitektur yang dituju
- UI: Jetpack Compose + Material 3.
- State: ViewModel, Kotlin coroutines/Flow.
- Navigasi: Navigation Compose.
- Backend: Supabase Auth, PostgREST, Realtime, dan Edge Functions.
- Keamanan tenant: `store_memberships` + Row Level Security (RLS).
- QRIS tetap melalui Edge Functions; rahasia merchant tidak boleh berada di aplikasi.
- Kamera/barcode, Bluetooth printer, dan notifikasi ditambahkan setelah alur inti tervalidasi.

## Urutan migrasi fitur
1. Login/sesi dan pemilihan toko.
2. Dashboard.
3. Inventaris dan pergerakan stok.
4. Kasir, checkout atomik, dan transaksi.
5. QRIS statis/dinamis melalui backend yang ada.
6. Laporan dan ekspor.
7. Karyawan, peran, pengaturan, dan administrator.
8. Kamera barcode, printer Bluetooth, notifikasi, serta pengujian isolasi multi-toko.

## Skema backend yang diaudit
Tabel utama: `profiles`, `stores`, `store_memberships`, `store_membership_roles`, `products`, `employees`, `sales`, `sale_items`, `stock_movements`, `store_qris_settings`, `store_qris_credentials`, `push_subscriptions`, `employee_session_revocations`, dan `admin_audit_logs`.

Edge Functions yang ditemukan aktif:
`save-qris-settings`, `create-qris-payment`, `midtrans-webhook`, `invite-employee`, `manage-employee`, `admin-accounts`, `confirm-static-qris-payment`, `create-static-qris-sale`, `daily-report`, `expire-static-qris-sales`, dan `notify-low-stock`.

Fungsi pembayaran yang ada tidak diubah oleh scaffold Android ini.
