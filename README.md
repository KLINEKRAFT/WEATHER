# weather.

A clearer view of your day. A minimal, responsive weather app with quiet typography, useful detail, and real forecasts.

## What’s inside

- Current temperature, conditions, feels-like, daily high/low, and a forecast-based summary.
- A scrollable 24-hour chart with temperature, precipitation probability, and wind views; a detailed 48-hour table.
- Ten daily forecasts with comparable temperature ranges and expandable details.
- Animated precipitation radar, a history slider, zoom, recenter, and clearly labeled timestamps.
- City/postal-code search, opt-in device location, and up to eight saved places.
- Light/dark mode, Fahrenheit/Celsius, self-hosted DM Sans, reduced-motion support, keyboard search (`/` or `⌘/Ctrl K`), and a mobile navigation bar.
- Wind, gusts, humidity, dew point, visibility, UV, pressure, precipitation totals, and sunrise/sunset.
- Active U.S. National Weather Service alerts, including full instructions and official-source links.

The default location is Tulsa. There are no accounts, ads, analytics, or API keys in the default configuration. Location and preferences stay in this browser’s local storage. Coordinates are sent to the weather providers when loading a forecast; device location is requested only after a click.

## Run locally

Use Node.js 22.12+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

```sh
npm run build       # Type check and optimized production build
npm run preview     # Serve the production build locally
npm test            # Data normalization, units, missing data, local dates, and DST
npx playwright install chromium
npm run test:e2e    # Desktop/mobile interactions, failures, and accessibility
```

Browser tests use explicit fixtures and never depend on the current weather or third-party tile availability. `tests/fixtures/tulsa.json` is a real Open-Meteo response captured October 3, 2026, for testing only; it is never imported by application code. If using an existing Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable.

## Vercel

The repository includes `vercel.json` with all build settings. Import **KLINEKRAFT/WEATHER** into the existing [weather project](https://vercel.com/colinikline-2717s-projects/weather), or connect that repository under **Settings → Git**.

| Setting               | Value           |
| --------------------- | --------------- |
| Framework             | Vite            |
| Root directory        | Repository root |
| Install command       | `npm ci`        |
| Build command         | `npm run build` |
| Output directory      | `dist`          |
| Node.js               | 24.x or 22.x    |
| Environment variables | None required   |

The `codex/minimal-weather` branch contains the initial implementation. Connect it for a preview, then merge into `main` for the production deployment. Vercel supplies HTTPS, which device location requires outside localhost. The app is a client-side static build; it needs no database or server functions.

## Data sources and limits

| Source                                                                | Purpose                                            | Behavior                                                                                           |
| --------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Open-Meteo](https://open-meteo.com/en/docs)                          | Current model estimates, hourly and daily forecast | Fetches on location change; refreshes every 10 minutes while visible. Units are converted locally. |
| [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api)  | City/postal-code search                            | Debounced, cancelable search.                                                                      |
| [RainViewer](https://www.rainviewer.com/api/weather-maps-api.html)    | Recent radar                                       | Past two hours, typically 10-minute frames; manifest refreshed every 5 minutes.                    |
| [OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/) | Basemap                                            | Normal browser tile caching, visible attribution, no bulk prefetch or offline map downloads.       |
| [NWS](https://www.weather.gov/documentation/services-web-api)         | Active U.S. weather alerts                         | Refreshes every 5 minutes while visible; an unavailable service is never presented as “no alerts.” |

The free Open-Meteo endpoint is for non-commercial use. RainViewer’s public service is for personal/educational use; its 2026 API provides past radar only, Universal Blue color scheme, native zoom through level 7, and a 100 requests/IP/minute limit. The app requests 512px radar tiles at a reduced source zoom, loads only the selected frame, waits for loading before animation advances, and stops playback when the page is hidden or the map moves. Higher zooms enlarge the available source tiles. Coverage varies; a blank region does not establish that it is dry. See [RainViewer’s transition notes](https://www.rainviewer.com/api/transition-faq.html) and [Open-Meteo’s usage plans](https://open-meteo.com/en/pricing) before a commercial or high-traffic rollout.

Unavailable measurements display an em dash. A previously fetched forecast may be shown for up to 24 hours with a visible saved/older-forecast notice when refresh fails. Requests have timeouts and cancellation so one city’s forecast cannot appear under another city’s name. Times use the selected location’s time zone, including calendar-day handling across daylight-saving changes. This is not a push-alert service.

## Structure

```text
src/App.tsx          App shell, preferences, navigation, current weather, alerts
src/weather.ts      Provider requests, data normalization, units and time handling
src/useWeather.ts   Forecast/alert loading, cancellation, refresh and cache
src/Forecast.tsx    Hourly charts, detailed hourly table, daily forecast
src/Radar.tsx       Lazy-loaded Leaflet map and radar playback
src/SearchDialog.tsx Accessible location search
src/Conditions.tsx Weather detail cards and daylight graphic
src/styles.css     Responsive layout, design tokens and light/dark themes
```

## Dashboard customization

The Today view uses a bold, compact temperature and hourly strip. Choose **Customize** to pick a color preset, set background and font colors, or move forecast cards up and down. Tap a card heading to collapse or expand it. Color, order, and collapse preferences are saved locally on each device. **Reset layout** restores all cards; **Use light / dark theme colors** clears custom colors. The header theme toggle also returns to theme colors. Detailed hourly charts remain available on the Hourly tab.
