# Native Mobile Build Guide — The Eagles Charge

This project is wrapped with Capacitor. The web build in `dist/` is loaded
by native iOS and Android shells. Follow this guide to produce a signed
IPA (App Store) and a signed AAB (Play Store).

## 1. One-time local setup

Requirements:
- macOS + Xcode 15+ (iOS builds only work on macOS)
- Android Studio Hedgehog+ with Android SDK 34
- Node 18+ and `npm install` completed

```bash
git pull
npm install
npm run build
npx cap add ios       # first time only
npx cap add android   # first time only
npx cap sync
```

Re-run `npm run build && npx cap sync` after every code change before
building in Xcode / Android Studio.

## 2. Icons & splash screens (both stores)

Source artwork lives in `resources/`:
- `resources/icon.png`   — 1024×1024, opaque, no transparency (App Store requirement)
- `resources/splash.png` — 1920×1920, logo centered in the middle ~25%

Generate every store-required size in one command:

```bash
npx capacitor-assets generate --iconBackgroundColor '#1a6b47' \
                              --iconBackgroundColorDark '#1a6b47' \
                              --splashBackgroundColor '#1a6b47' \
                              --splashBackgroundColorDark '#1a6b47'
```

This writes:
- iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset/` (all @1x/@2x/@3x, 1024 marketing icon)
- iOS: `ios/App/App/Assets.xcassets/Splash.imageset/`
- Android: `android/app/src/main/res/mipmap-*` (legacy + adaptive icons + round + monochrome)
- Android: `android/app/src/main/res/drawable-*/splash.png`

Commit the `resources/` folder; the generated native folders are recreated on demand.

## 3. iOS — App Store submission

**Bundle identifier** is already set to `app.lovable.theeaglescharge` in
`capacitor.config.ts` and propagates to Xcode on `cap sync`.

In Xcode (`npx cap open ios`):

1. Select the **App** target → **Signing & Capabilities**.
2. Team → your Apple Developer team. Enable **Automatically manage signing**
   (Xcode creates the certificate + provisioning profile via your Apple ID).
   For CI or manual profiles: uncheck it and pick a Distribution certificate
   and an **App Store** provisioning profile from Apple Developer portal.
3. **General** tab:
   - Display Name: `The Eagles Charge`
   - Bundle Identifier: `app.lovable.theeaglescharge`
   - Version: `1.0.0`, Build: `1` (bump Build for every TestFlight upload)
   - Deployment target: iOS 14.0
   - Device orientation: **Portrait** only (matches manifest)
4. **Info.plist** — add usage strings for anything the app touches:
   - `NSFaceIDUsageDescription` — "Used to unlock your wallet with Face ID."
   - `NSCameraUsageDescription` — only if you add camera features
5. Product → **Archive** → **Distribute App** → **App Store Connect** → **Upload**.

App Store Connect requires a 1024×1024 marketing icon (generated above),
screenshots for 6.7", 6.5", and 5.5" iPhones, a privacy policy URL, and
the app privacy questionnaire filled out.

## 4. Android — Play Store signed AAB

**Package name** is `app.lovable.theeaglescharge` (matches
`public/.well-known/assetlinks.json`). Do not change it after the first
Play Store upload — Google locks it.

### Create the upload keystore (one time, keep the file safe)

```bash
keytool -genkey -v -keystore eagles-upload.keystore \
  -alias eagles -keyalg RSA -keysize 2048 -validity 10000
```

Losing this keystore means you can never update the app on Play Store, so
back it up offline.

### Wire the keystore into Gradle

Create `android/keystore.properties` (do **not** commit it):

```
storeFile=/absolute/path/to/eagles-upload.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=eagles
keyPassword=YOUR_KEY_PASSWORD
```

Edit `android/app/build.gradle` — add above `android { ... }`:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Inside `android { ... }`:

```gradle
signingConfigs {
    release {
        storeFile file(keystoreProperties['storeFile'])
        storePassword keystoreProperties['storePassword']
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

In `android/app/build.gradle` also confirm:

```gradle
defaultConfig {
    applicationId "app.lovable.theeaglescharge"
    minSdkVersion 23
    targetSdkVersion 34
    versionCode 1
    versionName "1.0.0"
}
```

Bump `versionCode` for every Play upload.

### Build the signed AAB

```bash
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab` — upload
this to Play Console → your app → **Production** (or Internal testing) →
**Create new release**.

### Digital Asset Links (App Links)

`public/.well-known/assetlinks.json` has a placeholder SHA-256. After the
first release, Play Console will offer **Play App Signing** — copy the
SHA-256 it shows into `assetlinks.json`, republish the web app, then Play
will verify deep links.

## 5. Updating the app

```bash
git pull
npm install
npm run build
npx cap sync
# then Xcode Archive / ./gradlew bundleRelease
```

No `server.url` block exists anymore, so store builds always load the
bundled `dist/` assets — the app works fully offline for shell + assets,
and only network calls go to the backend.

## 6. Command-line release scripts

All wired in `package.json`:

```bash
npm run version:sync    # sync version/build across pkg + iOS + Android
npm run cap:sync        # version:sync + vite build + cap sync
npm run android:release # cap:sync + ./gradlew bundleRelease (signed AAB)
npm run ios:release     # cap:sync + xcodebuild archive + exportArchive (IPA)
```

Set the version explicitly:

```bash
APP_VERSION=1.2.3 APP_BUILD=42 npm run cap:sync
```

Otherwise `version:sync` reads `package.json` `version` and defaults the
build number to `1` (or `GITHUB_RUN_NUMBER` in CI). The single source of
truth is `package.json` `version` — the sync script rewrites
`ios/App/App/Info.plist`, `ios/App/App.xcodeproj/project.pbxproj`, and
`android/app/build.gradle` to match.

## 7. GitHub Actions — signed builds on tag push

`.github/workflows/mobile-release.yml` produces a signed AAB and IPA on
every tag matching `v*.*.*` (optionally `v1.2.3-42` to pin the build
number) and can also be dispatched manually.

Add these encrypted **repository secrets** (Settings → Secrets and
variables → Actions):

**iOS**
- `IOS_P12_BASE64` — `base64 -i Distribution.p12`
- `IOS_P12_PASSWORD`
- `IOS_PROVISIONING_PROFILE_BASE64` — `base64 -i AppStore.mobileprovision`
- `IOS_KEYCHAIN_PASSWORD` — any strong random string
- `IOS_TEAM_ID` — 10-char Apple Developer team ID
- `APPSTORE_API_KEY_ID`, `APPSTORE_API_ISSUER_ID`, `APPSTORE_API_KEY_BASE64`
  — App Store Connect API key for TestFlight upload (optional; omit to
  just get the IPA as an artifact)

**Android**
- `ANDROID_KEYSTORE_BASE64` — `base64 -i eagles-upload.keystore`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Cut a release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow parses the tag → marketing version + build, runs
`npm run cap:sync` with `APP_VERSION`/`APP_BUILD` env, builds and signs
both platforms, and uploads `ios-ipa` and `android-aab` as workflow
artifacts. If the App Store Connect API secrets are set, the IPA is also
pushed to TestFlight automatically.