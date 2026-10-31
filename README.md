# Kisaan Mitra AI

A cross-platform farming companion built with Expo, React Native, TypeScript, and Expo Router. The same screens run on web, iOS, and Android. Weather uses Open-Meteo; mandi prices use a Node.js proxy for AGMARKNET data published through data.gov.in; satellite analysis uses public Sentinel-2 imagery through Element84 Earth Search.

## Run locally

```sh
npm install
npm run web
npm run android
npm run ios
```

## Weather and mandi price data

Weather loads a seven-day forecast for the farm location from Open-Meteo. It does not need an API key. If the provider is unavailable, the app labels the sample fallback.

Mandi prices need a data.gov.in API key. Copy `backend/.env.example` to `backend/.env`, set `DATA_GOV_IN_API_KEY`, then run `npm run api` in one terminal. Start the Expo app in another terminal. The proxy reads the key only on the server and caches daily prices for 15 minutes.

The web app uses `http://localhost:4000` by default. For a physical phone, set `EXPO_PUBLIC_API_BASE_URL` to the reachable URL of the running/deployed API, such as your computer's LAN address during local development. This URL is public configuration and must never contain the API key.

## Google Maps and satellite analysis

Copy the root `.env.example` to `.env`. For Google Maps in the browser, enable Maps JavaScript API and set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`; restrict this key to the Maps JavaScript API and the app's web origins. For native Android and iOS builds, create separate restricted keys, set `GOOGLE_MAPS_ANDROID_API_KEY` and `GOOGLE_MAPS_IOS_API_KEY`, then rebuild the native app. Without those keys, the existing in-app map picker remains available.

Satellite analysis needs no Copernicus account or OAuth credentials. The backend searches public Sentinel-2 L2A scenes in Element84 Earth Search and computes NDVI from red and near-infrared raster pixels for up to nine 10-day periods in the last 90 days. It uses the scene classification layer to omit cloud, shadow, water, and other invalid pixels when that asset is available. The server accepts `POST /api/satellite/analysis` with `{ "latitude": 17.69, "longitude": 83.00, "area": "10 acres" }` and derives a square estimated boundary centered on the pin.

The estimated square boundary is only an approximation from the map pin and farm area. Check it against the real plot: one pin and total acreage cannot represent irregular boundaries or multiple fields. The returned NDVI vigor index is satellite vegetation reflectance, not a disease diagnosis or calibrated yield forecast. Calibrated yield prediction still requires local harvest history, crop calendar, and agronomic validation.

The Government Schemes screen reads the reviewed catalogue at `GET /api/schemes?state=Andhra%20Pradesh&crop=paddy`. The initial catalogue is curated from official PM-KISAN, PMFBY, and Andhra Pradesh Agriculture sources in `backend/schemes.json`; it matches by state and crop, links to official pages, and does not claim that a farmer is eligible. Update the source date and records when official rules change. Do not scrape myScheme; request authorized access before using any automated integration.

Providers: [Open-Meteo forecast API](https://open-meteo.com/en/docs) and [data.gov.in mandi price catalog](https://data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi).

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
- The task checklist, assistant prompts, notification filters, market tabs, and map layers are interactive.
- The crop scan and multilingual Ask AI assistant use the configured Nebius and Sarvam services (see above).
- Weather uses Open-Meteo; mandi prices use data.gov.in when configured; satellite vigor is computed from public Sentinel-2 imagery via Earth Search; schemes come from the backend catalogue.
- Yield planning uses a farmer-editable starting yield and farm area, not a calibrated yield forecast. Earth Search is best-effort, and imagery can be cloudy or unavailable for a field. Community experts and conversations use local sample data; expert connection requests are not sent to a live service.
