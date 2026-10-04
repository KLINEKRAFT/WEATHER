import { lazy, Suspense, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Clock3,
  CloudSun,
  CalendarDays,
  Radio,
  RefreshCw,
  Search,
  Star,
  Sun,
  Moon,
  LocateFixed,
  SlidersHorizontal,
  ExternalLink,
  X,
} from 'lucide-react';
import type { Alert, Place, Units, Weather } from './weather';
import {
  clock,
  condition,
  placeKey,
  readStorage,
  temperature,
  today,
  TULSA,
  validPlace,
  writeStorage,
} from './weather';
import { useAlerts, useWeather } from './useWeather';
import WeatherIcon from './WeatherIcon';
import { DailyForecast, HourlyForecast } from './Forecast';
import SearchDialog from './SearchDialog';
import Conditions from './Conditions';
import { useNavigation } from './navigation';
import HourlyCanvas from './HourlyCanvas';
import Dashboard, { SettingsPanel, useLayout, useAppearance } from './Dashboard';

const Radar = lazy(() => import('./Radar'));
const views = [
  { id: 'today', label: 'Today', icon: CloudSun },
  { id: 'hourly', label: 'Hourly', icon: Clock3 },
  { id: 'daily', label: '10 days', icon: CalendarDays },
  { id: 'radar', label: 'Radar', icon: Radio },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal },
] as const;

function initialPlace() {
  const p = readStorage<Place>('place', TULSA);
  return validPlace(p) ? p : TULSA;
}
function initialSaved() {
  const p = readStorage<Place[]>('saved', [TULSA]);
  return Array.isArray(p) ? p.filter(validPlace).slice(0, 8) : [TULSA];
}

export default function App() {
  const [place, setPlace] = useState<Place>(initialPlace);
  const [saved, setSaved] = useState<Place[]>(initialSaved);
  const [units, setUnits] = useState<Units>(() =>
    readStorage<string>('units', 'f') === 'c' ? 'c' : 'f',
  );
  const [theme, setTheme] = useState(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );
  const { colors, setColors } = useAppearance(theme);
  const { view, navigate, back, canGoBack, swipeHandlers } = useNavigation();
  const { layout, setLayout } = useLayout();
  const [radarStyle, setRadarStyle] = useState(() => readStorage<string>('radar-style', 'blue'));
  const [radarOpacity, setRadarOpacity] = useState(() => {
    const n = readStorage<number>('radar-opacity', 0.72);
    return typeof n === 'number' && Number.isFinite(n) ? Math.max(0.2, Math.min(1, n)) : 0.72;
  });
  useEffect(() => {
    writeStorage('radar-style', radarStyle);
    writeStorage('radar-opacity', radarOpacity);
  }, [radarStyle, radarOpacity]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [alertOpen, setAlertOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const forecast = useWeather(place, refresh);
  const alerts = useAlerts(place, refresh);
  const weather = forecast.data;
  const isSaved = saved.some((p) => placeKey(p) === placeKey(place));

  useEffect(() => {
    writeStorage('place', place);
  }, [place]);
  useEffect(() => {
    writeStorage('saved', saved);
  }, [saved]);
  useEffect(() => {
    writeStorage('units', units);
  }, [units]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('weather:theme', theme);
    } catch {
      /* Theme remains usable without storage. */
    }
  }, [theme]);
  useEffect(() => {
    document.title = `${place.name} · Weather`;
  }, [place.name]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.key === 'k' && (e.metaKey || e.ctrlKey)) ||
        (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName))
      ) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  function selectPlace(next: Place) {
    setPlace(next);
    setSearchOpen(false);
    setMessage('');
    setAlertOpen(false);
  }
  function toggleSaved() {
    if (isSaved) setSaved((s) => s.filter((p) => placeKey(p) !== placeKey(place)));
    else if (saved.length >= 8) setMessage('You have 8 saved places. Unsave one to add another.');
    else setSaved((s) => [...s, place]);
  }
  function locate() {
    if (!navigator.geolocation) {
      setMessage('Location access is unavailable in this browser. Search for a city instead.');
      setSearchOpen(false);
      return;
    }
    setLocating(true);
    setMessage('');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        selectPlace({
          id: `gps:${p.coords.latitude.toFixed(3)},${p.coords.longitude.toFixed(3)}`,
          name: 'Current location',
          region: `${Math.abs(p.coords.latitude).toFixed(2)}° ${p.coords.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(p.coords.longitude).toFixed(2)}° ${p.coords.longitude >= 0 ? 'E' : 'W'}`,
          country: '',
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        });
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        setSearchOpen(false);
        setMessage(
          error.code === 1
            ? 'Location permission was denied. You can still search for any city.'
            : 'We couldn’t get your location. Try again or search for a city.',
        );
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    );
  }
  const zone = weather?.timezone ?? 'America/Chicago';
  const lastUpdate = forecast.updated ? clock(forecast.updated / 1000, zone, true) : '';
  const stale = forecast.cached || (!!weather && now / 1000 - weather.current.time > 3600);
  const radar = (expanded = false) => (
    <Suspense fallback={<div className="radar-placeholder">Loading radar…</div>}>
      <Radar
        place={place}
        zone={zone}
        theme={theme}
        expanded={expanded}
        onExpand={() => navigate('radar')}
        styleMode={radarStyle}
        opacity={radarOpacity}
      />
    </Suspense>
  );
  return (
    <div className={`weather-app view-${view}`} {...swipeHandlers}>
      <a href="#main" className="skip-link">
        Skip to forecast
      </a>
      <main id="main" className="art-main">
        <h1 className="sr-only">
          {place.name}{' '}
          {view === 'daily'
            ? '10-day forecast'
            : view === 'hourly'
              ? 'hourly forecast'
              : view === 'radar'
                ? 'radar'
                : view === 'settings'
                  ? 'settings'
                  : 'weather'}
        </h1>
        {view === 'today' && (
          <div className="place-line">
            <div>
              <span>{place.name}</span>
              <small>
                {new Intl.DateTimeFormat('en-US', {
                  timeZone: zone,
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                }).format(now)}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label="Refresh weather"
              disabled={forecast.loading}
              onClick={() => setRefresh((n) => n + 1)}
            >
              <RefreshCw size={16} className={forecast.loading ? 'spinning' : ''} />
            </button>
          </div>
        )}
        {view !== 'radar' && message && (
          <div className="notice" role="status">
            <span>{message}</span>
            <button
              className="icon-button"
              aria-label="Dismiss message"
              onClick={() => setMessage('')}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {view !== 'radar' && view !== 'settings' && (forecast.error || (stale && weather)) && (
          <div className="notice" role="status">
            <AlertCircle size={16} />
            <span>
              {weather ? `Showing a saved or older forecast · ${lastUpdate}` : forecast.error}
            </span>
            <button onClick={() => setRefresh((n) => n + 1)}>Retry</button>
          </div>
        )}
        {view !== 'radar' && view !== 'settings' && alerts.alerts.length > 0 && (
          <div className="alerts-container">
            <button
              className="alert-banner"
              onClick={() => setAlertOpen((v) => !v)}
              aria-expanded={alertOpen}
            >
              <AlertCircle size={18} />
              <strong>{alerts.alerts[0].event}</strong>
              <ChevronDown size={16} />
            </button>
            {alertOpen && (
              <div className="alert-details">
                {alerts.alerts.map((a) => (
                  <AlertDetail key={a.id} alert={a} />
                ))}
              </div>
            )}
          </div>
        )}
        {view === 'settings' ? (
          <SettingsPanel
            colors={colors}
            setColors={setColors}
            theme={theme}
            layout={layout}
            setLayout={setLayout}
          >
            <div className="settings-location">
              <button className="settings-search" onClick={() => setSearchOpen(true)}>
                <Search size={20} />
                <span>
                  {place.name}
                  <small>Search locations</small>
                </span>
              </button>
              <button
                className="icon-button"
                onClick={toggleSaved}
                aria-label={isSaved ? 'Unsave location' : 'Save location'}
                aria-pressed={isSaved}
              >
                <Star size={19} fill={isSaved ? 'currentColor' : 'none'} />
              </button>
            </div>
            <button className="text-button" onClick={locate} disabled={locating}>
              <LocateFixed size={16} />
              {locating ? 'Locating…' : 'Use current location'}
            </button>
            <div className="settings-row">
              <span>Temperature</span>
              <div className="unit-switch">
                <button aria-pressed={units === 'f'} onClick={() => setUnits('f')}>
                  °F
                </button>
                <button aria-pressed={units === 'c'} onClick={() => setUnits('c')}>
                  °C
                </button>
              </div>
            </div>
            <div className="settings-row">
              <span>Appearance</span>
              <button
                className="text-button"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                onClick={() => {
                  setColors(null);
                  setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
                }}
              >
                {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}{' '}
                {theme === 'dark' ? 'Night' : 'Day'}
              </button>
            </div>
            <h3>Radar</h3>
            <div className="radar-style-options">
              {[
                ['blue', 'Original blue'],
                ['amber', 'Amber'],
                ['mono', 'Monochrome'],
              ].map(([id, label]) => (
                <button key={id} aria-pressed={radarStyle === id} onClick={() => setRadarStyle(id)}>
                  {label}
                </button>
              ))}
            </div>
            <label className="settings-row">
              Overlay opacity
              <input
                aria-label="Radar opacity"
                type="range"
                min="0.2"
                max="1"
                step="0.05"
                value={radarOpacity}
                onChange={(e) => setRadarOpacity(Number(e.target.value))}
              />
            </label>
            <p className="settings-note">
              Tints change the display, not the radar data. Past 2 hours; coverage varies.
            </p>
          </SettingsPanel>
        ) : view === 'radar' ? (
          radar(true)
        ) : !weather ? (
          forecast.loading ? (
            <LoadingForecast />
          ) : (
            <div className="forecast-error">
              <p>Forecast unavailable.</p>
              <button className="primary-button" onClick={() => setRefresh((n) => n + 1)}>
                Try again
              </button>
              <button onClick={() => setSearchOpen(true)}>Search a different place</button>
            </div>
          )
        ) : view === 'today' ? (
          <Dashboard
            layout={layout}
            setLayout={setLayout}
            cards={{
              current: <CurrentWeather weather={weather} units={units} />,
              hourly: (
                <HourlyForecast
                  weather={weather}
                  units={units}
                  compact
                  onExpand={() => navigate('hourly')}
                />
              ),
              conditions: <Conditions weather={weather} units={units} />,
              daily: (
                <DailyForecast weather={weather} units={units} onExpand={() => navigate('daily')} />
              ),
              radar: radar(),
            }}
          />
        ) : view === 'hourly' ? (
          <HourlyCanvas weather={weather} units={units} />
        ) : (
          <DailyForecast weather={weather} units={units} full />
        )}
        {view === 'settings' && (
          <details className="source-details">
            <summary>Data & credits</summary>
            <p>
              Forecasts:{' '}
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                Open-Meteo
              </a>{' '}
              · Radar:{' '}
              <a href="https://rainviewer.com/" target="_blank" rel="noreferrer">
                RainViewer
              </a>{' '}
              · Alerts:{' '}
              <a href="https://weather.gov/" target="_blank" rel="noreferrer">
                NWS
              </a>
            </p>
            <p>
              Current conditions are model estimates. Times are local to the selected location.{' '}
              {alerts.status === 'unavailable'
                ? 'Weather alerts are unavailable right now.'
                : alerts.status === 'unsupported'
                  ? 'In-app weather alerts cover U.S. locations.'
                  : 'Weather alerts are checked for U.S. locations.'}
            </p>
          </details>
        )}
      </main>
      {canGoBack && (
        <button className="swipe-edge" aria-label="Back to previous view" onClick={back} />
      )}
      <nav className="app-nav" aria-label="Forecast views">
        {views.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-current={view === id ? 'page' : undefined}
            className={view === id ? 'active' : ''}
            onClick={() => navigate(id)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {searchOpen && (
        <SearchDialog
          saved={saved}
          onSelect={selectPlace}
          onClose={() => setSearchOpen(false)}
          onLocate={locate}
          locating={locating}
        />
      )}
    </div>
  );
}
function CurrentWeather({ weather, units }: { weather: Weather; units: Units }) {
  const c = weather.current,
    day = today(weather),
    sky = condition(c.code, c.day);
  return (
    <section className="current-panel" aria-label="Current weather">
      <div className="current-main">
        <div className="current-text">
          <div
            className={`current-temperature ${temperature(c.temperature, units).length > 3 ? 'long-temperature' : ''}`}
          >
            {temperature(c.temperature, units)}
          </div>
          <div className="current-description">
            <h2>{sky.label}</h2>
            <span>Feels {temperature(c.feels, units)}</span>
          </div>
          <div className="high-low">
            <span>
              <ArrowUp size={12} />
              {temperature(day?.high, units)}
            </span>
            <span>
              <ArrowDown size={12} />
              {temperature(day?.low, units)}
            </span>
          </div>
        </div>
        <div className="sky-art">
          <WeatherIcon code={c.code} day={c.day} size={90} />
        </div>
      </div>
    </section>
  );
}

function LoadingForecast() {
  return (
    <div className="loading-forecast" role="status" aria-label="Loading weather forecast">
      <span className="sr-only">Loading forecast…</span>
      <div className="skeleton skeleton-hero">
        <div />
        <div />
        <div />
      </div>
      <div className="skeleton skeleton-hourly" />
      <div className="skeleton-pair">
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    </div>
  );
}

function AlertDetail({ alert }: { alert: Alert }) {
  return (
    <article>
      <p className="eyebrow">
        {alert.severity} · {alert.sender}
      </p>
      <h3>{alert.headline}</h3>
      <p>{alert.description}</p>
      {alert.instruction && (
        <p>
          <strong>Recommended action</strong>
          <br />
          {alert.instruction}
        </p>
      )}
      <a href={alert.url} target="_blank" rel="noreferrer">
        View official weather information <ExternalLink size={13} />
      </a>
    </article>
  );
}
