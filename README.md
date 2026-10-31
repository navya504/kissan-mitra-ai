# Kisaan Mitra AI

Kisaan Mitra AI is a mobile-first farming companion for web, Android, and iOS. It is built with Expo, Expo Router, React Native, TypeScript, and a small Node.js API. The browser tab title and app name are **Kisaan Mitra AI**.

## Features

| Area | Current behavior |
|---|---|
| Farmer profile | Editable farmer and farm details, location dropdowns, map pin selection, crop, and land area. Web profile data is saved in browser storage. |
| Weather | Seven-day Open-Meteo forecast and weather guidance for the configured Anakapalli location. No API key is needed. |
| Market prices | Paddy mandi listings from the data.gov.in AGMARKNET resource, through the Node API. Requires a data.gov.in API key. Sample prices are shown if live prices are unavailable. |
| Satellite map | Map and satellite layers, farm pin update, and a square field approximation derived from the pin and farm area. Google Maps keys are optional; the app has a fallback map picker. |
| Crop health | Sentinel-2 L2A imagery from public Element84 Earth Search. The backend computes NDVI observations for up to nine 10-day periods across the last 90 days, using the scene classification layer to filter invalid pixels when available. No Copernicus account or credentials are needed. |
| Crop disease scan | Photo capture/upload and image analysis through a Nebius vision model. Requires `NEBIUS_API_KEY`. |
| Ask Kisaan Mitra AI | Typed or spoken farming questions. Nebius generates replies; Sarvam handles speech-to-text and text-to-speech in supported Indian languages. Requires Nebius and Sarvam keys. |
| Government schemes | State and crop matching against the reviewed catalogue in `backend/schemes.json`, with links to official programme pages. |
| Farm plan and reminders | Task list and notification views with interactive local state. |
| Farmer community | Expandable discussion replies, likes, and expert cards with ratings and a local Connect request state. |
| Yield planning | Farmer-adjustable yield assumption and farm-area arithmetic for planning; it is not a trained yield prediction. |

## Run locally

Install dependencies once:

```powershell
npm install
```

Run the data API in the first terminal. Create `backend/.env` from the example once, then add a data.gov.in key if you want live mandi prices:

```powershell
Copy-Item backend/.env.example backend/.env
npm run api
```

Run the Expo app in a second terminal:

```powershell
npm run web
```

Open `http://localhost:8081`. The API health endpoint is `http://localhost:4000/api/health`.

To use an Android or iOS simulator, run `npm run android` or `npm run ios`. Physical phones need the backend address set to your computer's LAN IP in `EXPO_PUBLIC_API_BASE_URL`; `localhost` on a phone refers to the phone itself. iOS native builds require macOS and Xcode or an Expo development build.

## Configuration

Copy the root `.env.example` to `.env.local` (or `.env`) and set only the keys for services you use. Keep real key files out of Git.

| Variable | Used for | Required? |
|---|---|---|
| `NEBIUS_API_KEY` | Crop image analysis and AI replies | For live scan and assistant |
| `NEBIUS_VISION_MODEL` | Crop scan model; defaults to `moonshotai/Kimi-K3` | Optional |
| `NEBIUS_CHAT_MODEL` | Assistant model; defaults to `moonshotai/Kimi-K3` | Optional |
| `SARVAM_API_KEY` | Speech transcription and generated voice | For voice interaction |
| `SARVAM_SPEAKER` | Sarvam voice; defaults to `shubh` | Optional |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps JavaScript API in web | Optional; restrict to allowed web origins and Maps JavaScript API |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Native Android map | Optional; rebuild native app after setting |
| `GOOGLE_MAPS_IOS_API_KEY` | Native iOS map | Optional; rebuild native app after setting |
| `EXPO_PUBLIC_API_BASE_URL` | Node API address for web/phone clients | Optional; defaults to `http://localhost:4000` |

The backend reads `backend/.env`:

| Variable | Used for |
|---|---|
| `DATA_GOV_IN_API_KEY` | Live mandi prices |
| `PORT` | Backend port; defaults to `4000` |

No Copernicus client ID or secret is needed for satellite analysis. The Sentinel-2 public catalogue is best-effort and can have delays, cloud cover, or missing imagery for a particular field.

## Data API

The Node service started by `npm run api` provides:

| Method and path | Purpose |
|---|---|
| `GET /api/health` | Check whether the Node API is running |
| `GET /api/market/prices?state=Andhra%20Pradesh` | Paddy mandi prices from data.gov.in |
| `GET /api/schemes?state=Andhra%20Pradesh&crop=paddy` | Relevant scheme catalogue entries |
| `POST /api/satellite/analysis` | Search Sentinel-2 scenes and calculate field NDVI from farm pin and area |

Expo Router server routes provide `GET /api/weather`, `POST /api/diagnose`, `POST /api/chat`, `POST /api/transcribe`, and `POST /api/speak`. They use the root environment variables above. Deploy these server routes with the app for production; local development runs them through Expo's web server.

## Screen flow

Splash → mobile sign-in → farmer profile setup → dashboard. From the dashboard, navigate to:

- Farm plan
- Crop disease scan
- Weather advisory
- Farm health map and satellite analysis
- Yield planning
- Market prices
- AI assistant
- Government schemes
- Notifications
- Farmer community
- Profile and settings
- Closing screen

Each main page has a direct route such as `/dashboard`, `/weather`, `/market`, `/map`, `/community`, and `/profile`. Desktop uses a side menu; compact screens use bottom navigation.

## Current limits

- Sign-in and profile setup are not backed by an authentication service. No SMS OTP is sent.
- Profile data is stored locally in the browser; there is no user database or cross-device sync.
- The satellite field is an estimated square based on one pin and total acreage. It cannot represent irregular boundaries or multiple plots. NDVI reflects vegetation, not a disease diagnosis.
- Yield figures are planning calculations based on the farmer-entered yield assumption and area, not an AI or agronomically calibrated forecast.
- The schemes catalogue is reviewed static data; the app does not submit applications or verify eligibility.
- Tasks, reminders, notifications, community posts, likes, replies, and expert connection requests are local app state. Connect does not message a real expert.
- Weather and mandi screens may show labelled fallback prices or error states when providers are unavailable or not configured.
- AI diagnosis and assistant results depend on valid service credentials and should be checked with a local agricultural expert before acting.

## Checks

```powershell
npm run lint
npx tsc --noEmit
```
