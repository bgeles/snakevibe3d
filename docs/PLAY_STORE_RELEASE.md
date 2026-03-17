# Google Play Release Guide

## 1) Pre-release Checklist
- Confirm `applicationId` is final: `com.bgeles.snakevibe`.
- Increase `versionCode` and `versionName` in `android/app/build.gradle` for every new upload.
- Test in emulator and at least one physical Android device.
- Prepare app assets: icon, feature graphic, screenshots, short/long description.
- Have a public privacy policy URL ready.

## 2) Create Signing Key (one time)
Create a keystore folder and key:

```bash
mkdir -p keystore
keytool -genkey -v -keystore keystore/snakevibe-release.jks -alias snakevibe -keyalg RSA -keysize 2048 -validity 10000
```

Create `android/key.properties` from `android/key.properties.example`:

```properties
storeFile=../keystore/snakevibe-release.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=snakevibe
keyPassword=YOUR_KEY_PASSWORD
```

Important:
- Never commit `android/key.properties` or `.jks` files.
- Back up keystore and passwords safely.

## 3) Build Release Artifact
Use Java 21.

AAB (recommended for Play Store):

```bash
npm run android:release:aab
```

Output path:
- `android/app/build/outputs/bundle/release/app-release.aab`

Optional APK build:

```bash
npm run android:release:apk
```

## 4) Create Google Play Console App
- Open Play Console and create app.
- Complete App access, Ads, Content rating, Data safety, and Target audience.
- Upload privacy policy URL.

## 5) Upload First Build
- Go to `Testing > Internal testing`.
- Create release and upload `app-release.aab`.
- Add release notes.
- Review and roll out to internal testers.

## 6) Production Rollout
- Fix issues found in testing.
- Promote to `Production` with staged rollout (for example 10%, then 50%, then 100%).

## 7) Subsequent Updates
For every new update:
1. Bump `versionCode` (must always increase).
2. Update `versionName`.
3. Run `npm run android:release:aab`.
4. Upload the new AAB in Play Console.
