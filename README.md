# Snake Vibe 3D

Starter project based on the GDD:
- Classic snake gameplay with infinite score progression.
- Three.js rendering with vibrant floor texture, animated lights, and neon style.
- Juice effects: richer particles, moving glow halo, ambient floating VFX, and lightweight sound.
- Mobile-ready controls (swipe + on-screen pad).
- V2 camera modes: `Cinematic` (dynamic follow) and `Arcade` (top overview).
- V2 localization: Portuguese (Brazil), English, and Spanish.
- V2 rewards: daily reward, level rewards, achievement rewards, and rewarded ad coins.
- Full game states: start menu, pause, game over, and settings panel.
- Persistent local profile (`playerName`, `highScore`, sound, sensitivity).
- Deterministic obstacle/challenge patterns by level (instead of random obstacles).
- Capacitor setup for Android build pipeline.

## Controls
- `WASD` / Arrow Keys: move snake
- `Esc`: pause/resume
- Touch swipe or touch pad: mobile movement

## Settings
- Sound: ON/OFF
- Control sensitivity: `0.6x` to `1.8x`
- Camera mode: `Cinematic` / `Arcade`
- Language: `pt-BR` / `en-US` / `es-ES`
- Profile and high score are saved in browser/app local storage.

## Play Store Ads (AdMob)
The V2 app has a mobile ad integration layer ready for Android Capacitor builds.

1. Install plugin in `snake_game`:
```bash
npm install @capacitor-community/admob@7.2.0
npm run android:sync
```
2. Configure release App ID in `android/gradle.properties`:
```properties
ADMOB_APP_ID_RELEASE=ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy
```
3. Configure unit IDs via env vars:
```bash
cp .env.example .env
# Fill values
VITE_ADMOB_ANDROID_BANNER=ca-app-pub-xxxxxxxxxxxxxxxx/zzzzzzzzzz
VITE_ADMOB_ANDROID_REWARDED=ca-app-pub-xxxxxxxxxxxxxxxx/wwwwwwwwww
```
4. Build and sync:
```bash
npm run build
npx cap sync android
```

Notes:
- On web, ads are gracefully disabled.
- On Android debug, test App ID is used automatically.
- In production builds, if env IDs are missing, the app falls back to test ads.
- On Android, rewarded ads grant in-game coins.

## Requirements
- Node.js 20+
- Java 21 (JDK)
- Android Studio (for Android packaging)

## Local Development
```bash
npm install
npm run dev
```

## Web Build
```bash
npm run build
npm run preview
```

## Android (Capacitor)
```bash
npm run build
npx cap add android
npm run cap:sync
npm run cap:android
```

## Android Emulator Run
```bash
npm run build
npx cap sync android
npx cap run android --target emulator-5554
```

## Android Release (Google Play)
```bash
npm run android:release:aab
```

Release output:
- `android/app/build/outputs/bundle/release/app-release.aab`

Full publishing guide:
- `docs/PLAY_STORE_RELEASE.md`

This opens Android Studio for signing and generating your Google Play release artifacts.
