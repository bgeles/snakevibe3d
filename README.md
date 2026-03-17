# Snake Vibe 3D

Starter project based on the GDD:
- Classic snake gameplay with infinite score progression.
- Three.js rendering with vibrant floor texture, animated lights, and neon style.
- Juice effects: richer particles, moving glow halo, ambient floating VFX, and lightweight sound.
- Mobile-ready controls (swipe + on-screen pad).
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
- Profile and high score are saved in browser/app local storage.

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
