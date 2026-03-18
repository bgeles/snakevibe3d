# Google Play Release Guide

## 1) Pre-release Checklist
- Confirm `applicationId` is final: `com.bgeles.snakevibe`.
- Increase `versionCode` and `versionName` in `android/app/build.gradle` for every new upload.
  - Current: `versionCode = 2`, `versionName = "0.2.0"`
- Test in emulator and at least one physical Android device.
- Prepare app assets: icon, feature graphic, screenshots, short/long description.
- Have a public privacy policy URL ready.
- Obtain real AdMob App ID and Ad Unit IDs from Google AdMob Console.

## 2) Create Signing Key (one time)
Create a keystore folder and key:

```bash
mkdir -p keystore
keytool -genkey -v -keystore keystore/snakevibe-release.jks -alias snakevibe -keyalg RSA -keysize 2048 -validity 10000
```

When prompted:
- **What is your first and last name?** Bruno Geles
- **What is your organizational unit name?** (personal - can leave blank or put "Dev")
- **What is your organization name?** (personal) Bruno Geles
- **What is the name of your City or Locality?** (your city)
- **What is the name of your State or Province?** (your state)
- **What is the two-letter country code for this unit?** BR
- **Is CN=...correct?** Yes
- **Enter key password** (use a strong password, remember it!)
- **Using same password for storePass?** Press Enter for yes

Create `android/key.properties` from `android/key.properties.example`:

```bash
cp android/key.properties.example android/key.properties
```

Then edit `android/key.properties` with your actual passwords:

```properties
storeFile=../keystore/snakevibe-release.jks
storePassword=YOUR_STRONG_KEYSTORE_PASSWORD_HERE
keyAlias=snakevibe
keyPassword=YOUR_STRONG_KEY_PASSWORD_HERE
```

Important:
- **Never commit** `android/key.properties` or `.jks` files to Git
- Back up keystore and passwords in a secure location (password manager)
- Keep the same keystore for all future releases (required for updates)

## 3) Build Release Artifact (AAB for Play Store)
Use Java 21. Run from the project root:

```bash
npm run android:release:aab
```

This command:
1. Builds web assets with vite (`npm run build:prod`)
2. Syncs with Capacitor (`npm run android:sync`)
3. Builds Android App Bundle (`./gradlew bundleRelease`)

Output path:
```
android/app/build/outputs/bundle/release/app-release.aab
```

**Expected duration**: 2-3 minutes

## 4) Configure AdMob App ID and Ad Units
For production (Play Store), you need real AdMob IDs instead of test ones.

### 4a) Create Google AdMob Account
1. Go to [AdMob Console](https://admob.google.com)
2. Sign in with your Google account
3. Create an AdMob account if you don't have one
4. Link it to your Play Console account

### 4b) Get Your AdMob App ID
1. In AdMob Console → **Apps** → **Add App**
2. Select "Android"
3. Enter app name: "Snake Vibe"
4. Upload your app's Icon (512×512 PNG)
5. You'll receive an **App ID** like: `ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy`
   - Save this ID, you'll need it

### 4c) Create Ad Units (Banner + Rewarded)
After creating the app, create two ad units:

**Banner Ad Unit:**
1. **Ad units** → **Create Ad Unit** → **Banner**
   - Name: "Game Banner"
   - Format: Banner (320×50 or 320×100)
   - Your **Banner Ad Unit ID** will be like: `ca-app-pub-3940256099942544/6300978111`

**Rewarded Ad Unit:**
1. **Ad units** → **Create Ad Unit** → **Rewarded**
   - Name: "Game Reward"
   - Your **Rewarded Ad Unit ID** will be like: `ca-app-pub-3940256099942544/5224354917`

### 4d) Configure Production IDs in Build
Option A: **Environment Variables (Recommended)**

Set the AdMob App ID as an environment variable before building:

```bash
export ADMOB_APP_ID_RELEASE="ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy"
npm run android:release:aab
```

Option B: **Direct Edit in android/app/build.gradle**

Edit `android/app/build.gradle` and update the release manifestPlaceholders:

```gradle
buildTypes {
    release {
        manifestPlaceholders = [
            ADMOB_APP_ID: "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy"
        ]
        // ... rest of config
    }
}
```

### 4e) Update Web Code with Real Ad Unit IDs
Edit `src/mobile/adService.js` and replace test IDs with production Ad Unit IDs:

**Current (Test Mode):**
```javascript
// Line for banner
adUnitId: "ca-app-pub-3940256099942544/6300978111"  // Test banner

// Line for rewarded
adUnitId: "ca-app-pub-3940256099942544/5224354917"  // Test rewarded
```

**Update to Production:**
```javascript
// Banner Ad Unit ID from step 4c
bannerAdUnitId: "ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy"

// Rewarded Ad Unit ID from step 4c
rewardedAdUnitId: "ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy"
```

Also ensure `isTesting: false` in production:

```javascript
// Only set isTesting: true during development
const isTesting = false; // Set to true only for debug builds
```

## 5) Create Google Play Console App
1. Open [Google Play Console](https://play.google.com/console)
2. Click **Create app**
3. Enter app name: "Snake Vibe"
4. Select app type: Game
5. Complete all required sections:
   - **App access**: Game
   - **Ads**: Yes (you have AdMob configured)
   - **Content rating**: Complete questionnaire
   - **Target audience**: Age rating appropriate for casual game
   - **Data safety**: Declare any data collection (unlikely for offline game)
   - **Privacy policy**: Upload URL to your privacy policy
6. Click **Create app**

## 6) Upload First Build
1. In Play Console → **Release** → **Production**
2. Click **Create new release**
3. **Add APK/AAB**:
   - Upload `android/app/build/outputs/bundle/release/app-release.aab`
4. **Release notes** (en-US):
   ```
   Version 0.2.0 - Initial Release
   - 3D snake game with modern graphics
   - Isometric camera and particle effects
   - Multi-language support (Portuguese, English, Spanish)
   - AdMob ad integration
   ```
5. **Review** all information
6. Click **Save** (don't submit yet - review in internal testing first)

## 7) Internal Testing First
Before production, release to internal testers:

1. Go to **Testing** → **Internal testing**
2. Click **Create new release**
3. Upload same AAB file
4. Add testers: your Gmail account or team members
5. Review release
6. Submit
7. Testers will receive email with install link
8. Test thoroughly for 2-3 days

**Checklist for testing:**
- [ ] App installs successfully
- [ ] Game loads without crashes
- [ ] Ads display (banner and rewarded)
- [ ] Coins/rewards work correctly
- [ ] Touch controls responsive
- [ ] Games complete normally
- [ ] All languages work (Portuguese/English/Spanish)

## 8) Production Rollout
After internal testing passes:

1. Go back to **Release** → **Production**
2. Click **Create new release**
3. Upload same AAB (version 0.2.0)
4. Add release notes again
5. Select **Staged rollout** (start with 10%)
   - Day 1: 10% users
   - Monitor crashes/ratings
   - Day 3: 50% users
   - Day 5: 100% users
6. Click **Save** then **Review release**
7. Click **Start rollout to Production**

## 9) Subsequent Updates
For version 0.2.1, 0.3.0, etc:

1. Make code changes in your project
2. Bump version in `android/app/build.gradle`:
   ```gradle
   versionCode 3       // Increment by 1 (must always increase)
   versionName "0.2.1" // Your version string
   ```
3. Rebuild and upload:
   ```bash
   export ADMOB_APP_ID_RELEASE="ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy"
   npm run android:release:aab
   ```
4. Upload new AAB in Play Console → Production
5. Repeat staged rollout process

## Quick Reference: Commands

**Build Release AAB:**
```bash
npm run android:release:aab
```

**Build Debug APK (testing):**
```bash
npm run android:release:apk
```

**With AdMob ID Set:**
```bash
export ADMOB_APP_ID_RELEASE="ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy"
npm run android:release:aab
```

**Output files:**
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK: `android/app/build/outputs/apk/release/app-release.apk`

## Troubleshooting

**Build fails with "keystore not found":**
- Verify `android/key.properties` exists and has correct paths
- Verify keystore file exists at `keystore/snakevibe-release.jks`

**Play Store rejects build:**
- Check that versionCode is higher than previous release
- Verify App ID is exactly `com.bgeles.snakevibe`
- Ensure all required app sections are complete in Play Console

**AdMob ads not showing:**
- Verify Ad Unit IDs in `src/mobile/adService.js` match Play Console
- Remember test IDs when `isTesting: true` is set
- Production IDs when `isTesting: false` is set
- Check AdMob Console for account approval (can take 24 hours)
