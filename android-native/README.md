# POS Flow Native Android

Aplikasi Android native terpisah dari web app, dibangun dengan Kotlin, Jetpack Compose, dan Material 3. Aplikasi web pada root repository tetap dipertahankan.

## Status

Fondasi native kini mencakup:
- Form login yang memanggil Supabase Auth menggunakan email dan kata sandi.
- Pemulihan sesi autentikasi saat aplikasi dibuka kembali.
- Pembacaan keanggotaan melalui `store_memberships`, kemudian validasi toko aktif melalui `stores`.
- Pemilihan toko dan tampilan awal untuk toko yang dipilih.
- Tombol keluar yang mengakhiri sesi Supabase.
- Workflow GitHub Actions untuk mencoba build debug APK saat ada perubahan Android.

Build dan pengujian pada perangkat/emulator belum dikonfirmasi. Aplikasi belum siap untuk transaksi produksi; dashboard, inventaris, kasir, dan integrasi pembayaran native belum dibuat.

## Persyaratan build

- Android Studio stabil yang mendukung Android Gradle Plugin 8.10.1.
- JDK 17.
- Gradle 8.11.1.
- Android SDK platform 35.
- Perangkat/emulator Android API 26 atau lebih baru.

Folder proyek Android: `android-native/`.

## Konfigurasi Supabase

Jangan masukkan Supabase service-role key atau kredensial Midtrans ke aplikasi Android. Aplikasi menggunakan URL proyek dan publishable/anon key saja; RLS serta Edge Functions tetap menjadi batas keamanan di server.

Sebelum menjalankan build yang akan digunakan untuk login, atur environment variables pada proses Gradle:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Contoh shell:
```bash
export SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export SUPABASE_PUBLISHABLE_KEY="YOUR_PUBLISHABLE_OR_ANON_KEY"
gradle --no-daemon -p android-native :app:assembleDebug
```

Jangan commit file rahasia atau menaruh service-role/Midtrans key di kode Android. Build tanpa kedua variabel tersebut tetap dapat dikompilasi untuk pemeriksaan UI, tetapi login dinonaktifkan secara eksplisit.

## Arsitektur

- UI: Jetpack Compose + Material 3.
- State: ViewModel, Kotlin coroutines/Flow.
- Backend: Supabase Auth, PostgREST, Realtime, dan Edge Functions.
- Keamanan tenant: `store_memberships` + Row Level Security (RLS).
- QRIS tetap melalui Edge Functions; rahasia merchant tidak boleh berada di aplikasi.

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
