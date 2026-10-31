# Kisaan Mitra AI

A cross-platform farming companion prototype built with Expo, React Native, TypeScript, and Expo Router. The same screens run on web, iOS, and Android. All values and AI responses are sample data for now.

## Run locally

```sh
npm install
npm run web
npm run android
npm run ios
```

For iOS native builds, use macOS with Xcode or an Expo development build. Web runs in any supported browser.

## Screen flow

1. Splash → Welcome / sign in → Farmer profile setup → Home dashboard
2. Dashboard → Farm plan, crop disease scan, weather advisory, farm health map, yield forecast, market prices, AI assistant, government schemes, notifications, community, and profile
3. Closing / thank-you screen → Dashboard

Every screen also has a direct route (`/dashboard`, `/weather`, `/market`, etc.). Desktop uses a side menu; narrow screens use a bottom navigation bar.

## Prototype behavior

- Sign-in and profile setup are simulated.
- The task checklist, assistant prompts, notification filters, market tabs, and map layers are interactive.
- The crop scan displays an example diagnosis when a photo action is selected.
- Forecasts, market prices, yield estimates, scheme details, map overlays, and assistant answers are sample content. Connect live services through `src/data.ts` and the screen components when integrations are ready.
