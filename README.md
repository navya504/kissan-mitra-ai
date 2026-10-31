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

### Crop disease scan

The crop scan screen sends the farmer's photo to a vision model on [Nebius Token Factory](https://tokenfactory.nebius.com) through the server route `src/app/api/diagnose+api.ts`, so the API key stays on the server.

1. Copy `.env.example` to `.env.local` (git-ignored) and set `NEBIUS_API_KEY`.
2. Optionally set `NEBIUS_VISION_MODEL` (default `moonshotai/Kimi-K3`; `Qwen/Qwen3.8-27B` is a faster alternative).
3. Restart `npm run web`.

Photos are resized to 1024 px before upload. Native builds need the route deployed and its URL set as the `expo-router` plugin `origin` in `app.json`.

### Multilingual voice assistant

On the Ask AI screen the farmer can type or tap the mic and speak in Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia or English. The reply comes back in the same language and is read aloud.

| Step | Service | Server route |
|---|---|---|
| Speech to text, with automatic language detection | Sarvam `saaras:v4` | `src/app/api/transcribe+api.ts` |
| Reply in the same language | Nebius `moonshotai/Kimi-K3` (`NEBIUS_CHAT_MODEL`) | `src/app/api/chat+api.ts` |
| Read the reply aloud | Sarvam `bulbul:v3` (`SARVAM_SPEAKER`) | `src/app/api/speak+api.ts` |

Set `SARVAM_API_KEY` alongside `NEBIUS_API_KEY` (see `.env.example`). Typed questions are matched to a language by their script; romanised text such as "dhaan mein khaad" is treated as English. Recordings stop automatically after 30 seconds.

## Screen flow

1. Splash → Welcome / sign in → Farmer profile setup → Home dashboard
2. Dashboard → Farm plan, crop disease scan, weather advisory, farm health map, yield forecast, market prices, AI assistant, government schemes, notifications, community, and profile
3. Closing / thank-you screen → Dashboard

Every screen also has a direct route (`/dashboard`, `/weather`, `/market`, etc.). Desktop uses a side menu; narrow screens use a bottom navigation bar.

## Prototype behavior

- Sign-in and profile setup are simulated.
- The task checklist, notification filters, market tabs, and map layers are interactive.
- The crop scan and the Ask AI assistant use live AI services (see above).
- Weather is a live forecast from Open-Meteo for the demo farm location.
- Market prices, yield estimates, scheme details, and map overlays are sample content. Connect live services through `src/data.ts` and the screen components when integrations are ready.
