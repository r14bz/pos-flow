# POS Flow Android (Capacitor)

This branch wraps the existing React + Vite POS Flow app in a native Android WebView using Capacitor. The web application remains the source of truth; Supabase Auth, row-level security, database RPCs, and existing Edge Functions continue to handle authentication and business operations.

## App identity

- App name: POS Flow
- Application ID: `id.posflow.app`
- Web build directory: `dist`
- Capacitor major: 7

## Build prerequisites

- Node.js 20+
- Android Studio with Android SDK and a compatible JDK
- Android platform generated locally with Capacitor

## First-time setup

```sh
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

Then build and run the app from Android Studio, or build a debug APK:

```sh
npm run android:debug
```

After changing web code, run `npm run cap:sync` to rebuild the Vite app and copy it into the Android project.

## Safety boundaries

- This work is isolated on `feature/capacitor-android`; do not merge it into `main` or deploy production without review.
- Do not add Supabase service-role keys, Midtrans server keys, or other server secrets to Vite variables or the Android app. Only public client configuration belongs in the app.
- Payment creation, payment verification, checkout, and stock mutations must remain server-side / enforced by Supabase policies and RPCs.
- The generated `android/` project is created by `npx cap add android` on a machine with Node/Android tooling. Commit the generated project after checking that no local secrets or machine-specific files are included.
- Native integrations such as Bluetooth receipt printing, push notifications, and camera/barcode scanning require separate device-level implementation and testing; wrapping the web app alone does not prove these work natively.
