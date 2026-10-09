# @verifyblind/react-native

[Türkçe](#türkçe) · [English](#english)

React Native wrapper for the native VerifyBlind SDKs:
Android `com.verifyblind:verifyblind-android:1.0.1` (Maven Central) and iOS Swift Package
`https://github.com/VerifyBlind/sdk-ios` (2.3.1+). It does not reimplement anything: key pair,
App Link and decryption all run in the native SDKs.

---

## Türkçe

VerifyBlind, kullanıcının kimliğini telefonundaki VerifyBlind uygulamasıyla doğrular. Kimlik
bilgisi ne size ne de bize gelir. Uygulamanız yalnızca sorduğu cevabı (ör. "18 yaşından büyük mü")
enclave imzalı bir `token` olarak alır.

> **Kararı telefonda vermeyin.** `token`'ı kendi sunucunuza gönderin. Sunucunuz imzayı doğrular,
> nonce'u tüketir ve sonucu sakladığı koşulla karşılaştırır. Telefonun gösterdiği sonuca tek başına
> güvenmeyin; uygulama değiştirilebilir.

### Kurulum

```sh
npm install @verifyblind/react-native
# iOS
cd ios && pod install
```

Gereksinimler: React Native 0.75+ (New Architecture / Turbo Module), Android minSdk 24 ve Java 17,
iOS'ta CocoaPods. Expo Go desteklenmez (yerel kod içerir); Expo'da development build gerekir.

Sunucu tarafında bir **generate proxy** (API anahtarını ekleyip VerifyBlind'a ileten uç) ve bir
**verify** ucu gerekir. Web ile aynı uçları kullanabilirsiniz:
https://verifyblind.com/ai-integration.md

### Android ayarı

1. Geri dönüş şemasını `AndroidManifest.xml` içinde ana Activity'ye ekleyin (`launchMode="singleTask"`
   kalsın):

   ```xml
   <intent-filter>
     <action android:name="android.intent.action.VIEW" />
     <category android:name="android.intent.category.DEFAULT" />
     <category android:name="android.intent.category.BROWSABLE" />
     <data android:scheme="myapp" android:host="callback" />
   </intent-filter>
   ```

2. Aynı şemayı (`myapp`) Partner Portal'da **Ayarlar → Uygulama Geri-Dönüş Şeması** alanına
   kaydedin (yalnız şema, `://` olmadan).
   Şema eşleşmezse VerifyBlind güvenlik gereği uygulamanıza geri dönmez.

Native SDK Maven Central'dan gelir; React Native projelerinde `mavenCentral()` zaten tanımlıdır.

### iOS ayarı

1. `Info.plist` içine URL şemasını ekleyin:

   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array><string>myapp</string></array>
     </dict>
   </array>
   ```

2. Aynı şemayı Partner Portal'da **Uygulama Geri-Dönüş Şeması** alanına kaydedin.
3. `pod install` çalıştırın. iOS SDK yalnızca Swift Package olarak yayınlanır; podspec onu React
   Native'in `spm_dependency` yardımcısıyla ekler. Bağlama (linker) hatası alırsanız
   `USE_FRAMEWORKS=dynamic pod install` deneyin.

### Kullanım

```tsx
import { AppState } from 'react-native';
import { createVerifyBlind, isVerifyBlindError } from '@verifyblind/react-native';

const vb = createVerifyBlind({
  partnerBackendUrl: 'https://sunucunuz.com/api', // generate proxy'nizin tabanı
  generateEndpoint: 'generate',
});

// 1) Başlat: geçici anahtar üretilir, proxy'niz çağrılır, VerifyBlind uygulaması açılır.
const { nonce } = await vb.startAuthentication({ returnUrl: 'myapp://callback' });

// 2) Uygulama öne gelince yokla (null = kullanıcı henüz bitirmedi).
AppState.addEventListener('change', async (state) => {
  if (state !== 'active') return;
  try {
    const result = await vb.checkVerificationResult(nonce);
    if (!result) return; // biraz sonra tekrar dene
    // 3) token'ı SUNUCUNUZA gönderin; kararı sunucu verir.
    await fetch('https://sunucunuz.com/api/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: result.token }),
    });
  } catch (e) {
    if (isVerifyBlindError(e) && e.code === 'USER_CANCELLED') console.warn(e.cancelReason);
  }
});
```

Tam örnek: [`example/src/App.tsx`](example/src/App.tsx) (ön planda saniyede bir yoklar, `token`'ı
`https://test.verifyblind.com/api/verify`'a gönderir).

Notlar:

- `user_id`, `nsbd_id`, `doc_id` gibi alanları loglamayın.
- Geçici anahtar bellekte tutulur. Kullanıcı VerifyBlind'dayken işletim sistemi uygulamanızı
  kapatırsa `checkVerificationResult` `NO_ACTIVE_SESSION` hatası verir; doğrulamayı yeniden başlatın.
- İşiniz bitince `vb.release()` çağırın.

### Hatalar

Tüm hatalar `VerifyBlindError`'dır: `code` ve (yalnız `USER_CANCELLED` için) `cancelReason`.

| `code` | Anlamı |
| --- | --- |
| `NETWORK_ERROR` | Proxy'nize ulaşılamadı |
| `PARTNER_BACKEND_ERROR` | Proxy'niz hata döndü (402 bakiye, 403, 429 ...) |
| `INVALID_RESPONSE` | Proxy yanıtında `nonce` yok |
| `APP_LINK_FAILED` | VerifyBlind uygulaması da tarayıcı da açılamadı |
| `USER_CANCELLED` | Kullanıcı vazgeçti; `cancelReason`: `user_cancelled`, `no_card_registered`, `user_declined`, `fingerprint_failed`, `session_expired` |
| `CRYPTO_ERROR` | Anahtar üretimi veya çözme hatası (iOS) |
| `NO_ACTIVE_SESSION` | Yoklanacak oturum yok (başlatılmadı, bırakıldı ya da uygulama yeniden açıldı) |
| `INVALID_CONFIG` | Ayar eksik (ör. boş `partnerBackendUrl`) |
| `UNKNOWN` | Diğer |

---

## English

VerifyBlind verifies the user with the VerifyBlind app on their phone. Identity data reaches neither
you nor us. Your app gets only the answer it asked for (e.g. "over 18") as an enclave-signed `token`.

> **Never decide on the phone.** Send `token` to your own server. The server verifies the signature,
> consumes the nonce and checks the result against the condition it stored. Do not trust what the
> phone shows on its own; an app can be modified.

### Install

```sh
npm install @verifyblind/react-native
# iOS
cd ios && pod install
```

Requirements: React Native 0.75+ (New Architecture / Turbo Module), Android minSdk 24 and Java 17,
CocoaPods on iOS. Expo Go is not supported (native code); use an Expo development build.

You also need a **generate proxy** on your server (adds the API key and forwards to VerifyBlind) and a
**verify** endpoint. They are the same ones the web integration uses:
https://verifyblind.com/ai-integration.md

### Android setup

1. Add the return scheme to your main Activity in `AndroidManifest.xml` (keep
   `launchMode="singleTask"`):

   ```xml
   <intent-filter>
     <action android:name="android.intent.action.VIEW" />
     <category android:name="android.intent.category.DEFAULT" />
     <category android:name="android.intent.category.BROWSABLE" />
     <data android:scheme="myapp" android:host="callback" />
   </intent-filter>
   ```

2. Register the same scheme (`myapp`, scheme only) in the Partner Portal under
   **Settings → App Return Scheme**.
   If it does not match, VerifyBlind will not return to your app (by design).

The native SDK comes from Maven Central, which React Native projects already include.

### iOS setup

1. Add the URL scheme to `Info.plist`:

   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array><string>myapp</string></array>
     </dict>
   </array>
   ```

2. Register the same scheme as **App Return Scheme** in the Partner Portal.
3. Run `pod install`. The iOS SDK ships only as a Swift Package; the podspec adds it with React
   Native's `spm_dependency` helper. If you hit linker errors, try `USE_FRAMEWORKS=dynamic pod install`.

### Usage

```tsx
import { AppState } from 'react-native';
import { createVerifyBlind, isVerifyBlindError } from '@verifyblind/react-native';

const vb = createVerifyBlind({
  partnerBackendUrl: 'https://your-server.com/api', // base of your generate proxy
  generateEndpoint: 'generate',
});

// 1) Start: makes a temporary key, calls your proxy, opens the VerifyBlind app.
const { nonce } = await vb.startAuthentication({ returnUrl: 'myapp://callback' });

// 2) Poll when the app is in the foreground again (null = user not finished yet).
AppState.addEventListener('change', async (state) => {
  if (state !== 'active') return;
  try {
    const result = await vb.checkVerificationResult(nonce);
    if (!result) return; // try again shortly
    // 3) Send the token to YOUR server; the server decides.
    await fetch('https://your-server.com/api/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: result.token }),
    });
  } catch (e) {
    if (isVerifyBlindError(e) && e.code === 'USER_CANCELLED') console.warn(e.cancelReason);
  }
});
```

Full example: [`example/src/App.tsx`](example/src/App.tsx) (polls once a second while in the
foreground and posts `token` to `https://test.verifyblind.com/api/verify`).

Notes:

- Do not log fields such as `user_id`, `nsbd_id`, `doc_id`.
- The temporary key lives in memory. If the OS kills your app while the user is in VerifyBlind,
  `checkVerificationResult` rejects with `NO_ACTIVE_SESSION`; start again.
- Call `vb.release()` when you are done.

### Errors

Every error is a `VerifyBlindError` with `code` and, for `USER_CANCELLED` only, `cancelReason`.

| `code` | Meaning |
| --- | --- |
| `NETWORK_ERROR` | Your proxy could not be reached |
| `PARTNER_BACKEND_ERROR` | Your proxy returned an error (402 balance, 403, 429 ...) |
| `INVALID_RESPONSE` | No `nonce` in the proxy response |
| `APP_LINK_FAILED` | Neither the VerifyBlind app nor a browser could be opened |
| `USER_CANCELLED` | User cancelled; `cancelReason`: `user_cancelled`, `no_card_registered`, `user_declined`, `fingerprint_failed`, `session_expired` |
| `CRYPTO_ERROR` | Key generation or decryption failed (iOS) |
| `NO_ACTIVE_SESSION` | Nothing to poll (not started, released, or the app was restarted) |
| `INVALID_CONFIG` | Missing setting (e.g. empty `partnerBackendUrl`) |
| `UNKNOWN` | Anything else |

## Example app

```sh
yarn            # in the repo root (Yarn 4 is vendored: node .yarn/releases/yarn-4.11.0.cjs)
yarn example android
```

On Windows, a deep folder path can break the C++ (CMake/ninja) step with a `mkdir ... No such file
or directory` error (260-character path limit). Build from a short path, e.g.
`subst V: <repo>` and run `cd V:\examplendroid && gradlew.bat assembleDebug`.

The example uses the public test partner (`https://test.verifyblind.com/api`, return scheme
`verifyblinddemo`). It needs the VerifyBlind app on an NFC phone.

## License

Apache-2.0
