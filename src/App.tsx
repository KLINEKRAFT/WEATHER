import { lazy, Suspense, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  CloudSun,
  Droplets,
  ExternalLink,
  LocateFixed,
  MapPin,
  Moon,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Sun,
  Wind,
  X,
} from 'lucide-react';
import type { Alert, Place, Units, Weather } from './weather';
import {
  clock,
  condition,
  outlook,
  percent,
  placeKey,
  readStorage,
  speed,
  speedUnit,
  temperature,
  today,
  TULSA,
  upcomingHours,
  validPlace,
  writeStorage,
} from './weather';
import { useAlerts, useWeather } from './useWeather';
import WeatherIcon from './WeatherIcon';
import { DailyForecast, HourlyForecast } from './Forecast';
import SearchDialog from './SearchDialog';
import Conditions from './Conditions';
import Dashboard, { useAppearance } from './Dashboard';

const Radar = lazy(() => import('./Radar'));
type View = 'today' | 'hourly' | 'daily' | 'radar';
const views = [
  { id: 'today', label: 'Today', icon: CloudSun },
  { id: 'hourly', label: 'Hourly', icon: Clock3 },
  { id: 'daily', label: '10 days', icon: CalendarDays },
  { id: 'radar', label: 'Radar', icon: Radio },
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
  const [view, setView] = useState<View>('today');
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
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#12161d' : '#f7f8fa');
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
  function navigate(next: View) {
    setView(next);
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
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
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to forecast
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" onClick={() => navigate('today')} aria-label="Weather home">
            <Sun size={25} strokeWidth={1.6} />
            <span>
              weather<span className="brand-dot">.</span>
            </span>
          </button>
          <button className="search-trigger" onClick={() => setSearchOpen(true)}>
            <Search size={17} />
            <span>Find your forecast</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="header-actions">
            <button
              className="icon-button mobile-search"
              onClick={() => setSearchOpen(true)}
              aria-label="Search locations"
            >
              <Search size={20} />
            </button>
            <button
              className={`icon-button locate-button ${locating ? 'locating' : ''}`}
              onClick={locate}
              aria-label="Use current location"
              disabled={locating}
            >
              <LocateFixed size={20} />
            </button>
            <div className="unit-switch" aria-label="Temperature units">
              <button aria-pressed={units === 'f'} onClick={() => setUnits('f')}>
                °F
              </button>
              <button aria-pressed={units === 'c'} onClick={() => setUnits('c')}>
                °C
              </button>
            </div>
            <button
              className="icon-button theme-toggle"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              onClick={() => {
                setColors(null);
                setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
              }}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={19} />}
            </button>
          </div>
        </div>
      </header>
      <div className="shell">
        <div className="top-bar">
          <nav className="view-nav" aria-label="Forecast views">
            {views.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={view === id ? 'active' : ''}
                aria-current={view === id ? 'page' : undefined}
                onClick={() => navigate(id)}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>
          <span className="today-date">
            {new Intl.DateTimeFormat('en-US', {
              timeZone: zone,
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            }).format(now)}
          </span>
        </div>
        <main id="main">
          <div className="location-heading">
            <div>
              <p className="eyebrow">
                <MapPin size={12} />{' '}
                {view === 'today'
                  ? 'YOUR DAILY OUTLOOK'
                  : view === 'hourly'
                    ? 'ONE HOUR AT A TIME'
                    : view === 'daily'
                      ? 'LOOKING AHEAD'
                      : 'WEATHER IN MOTION'}
              </p>
              <div className="location-title">
                <button onClick={() => setSearchOpen(true)}>
                  <h1>
                    {place.name}
                    <span>{place.region && `, ${place.region}`}</span>
                  </h1>
                  <ChevronDown size={21} />
                </button>
                <button
                  className={`save-place ${isSaved ? 'saved' : ''}`}
                  onClick={toggleSaved}
                  aria-label={isSaved ? 'Unsave location' : 'Save location'}
                  aria-pressed={isSaved}
                >
                  <Star size={19} fill={isSaved ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
            <button
              className="update-status"
              disabled={forecast.loading}
              onClick={() => setRefresh((n) => n + 1)}
              aria-label="Refresh weather"
            >
              <span className={`status-dot ${stale || forecast.error ? 'stale' : ''}`} />
              <span>
                {forecast.loading
                  ? 'Updating forecast'
                  : forecast.error && !weather
                    ? 'Forecast unavailable'
                    : stale
                      ? `Saved · ${lastUpdate}`
                      : `Updated ${lastUpdate}`}
              </span>
              <RefreshCw size={12} className={forecast.loading ? 'spinning' : ''} />
            </button>
          </div>
          {message && (
            <div className="notice" role="status">
              <AlertCircle size={18} />
              <span>{message}</span>
              <button
                className="icon-button small"
                aria-label="Dismiss message"
                onClick={() => setMessage('')}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {(forecast.error || (stale && weather)) && (
            <div className="notice forecast-notice" role="status">
              <AlertCircle size={18} />
              <span>
                {weather
                  ? `${forecast.error ? 'Couldn’t refresh. ' : ''}Showing a saved or older forecast${forecast.updated ? ` from ${new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(forecast.updated)}` : ''}.`
                  : forecast.error}
              </span>
              <button className="text-button" onClick={() => setRefresh((n) => n + 1)}>
                Retry <RefreshCw size={14} />
              </button>
            </div>
          )}
          {alerts.alerts.length > 0 && (
            <div className="alerts-container">
              <button
                className="alert-banner"
                onClick={() => setAlertOpen((v) => !v)}
                aria-expanded={alertOpen}
              >
                <AlertCircle size={20} />
                <span>
                  <strong>{alerts.alerts[0].event}</strong>
                  <small>
                    {alerts.alerts.length > 1 ? `${alerts.alerts.length} active alerts · ` : ''}
                    National Weather Service
                  </small>
                </span>
                <span className="alert-read">View alert</span>
                <ChevronDown size={18} className={alertOpen ? 'chevron open' : 'chevron'} />
              </button>
              {alertOpen && (
                <div className="alert-details">
                  {alerts.alerts.map((a) => (
                    <AlertDetail alert={a} key={a.id} />
                  ))}
                </div>
              )}
            </div>
          )}
          {!weather ? (
            forecast.loading ? (
              <LoadingForecast />
            ) : (
              <div className="forecast-error">
                <CloudSun size={50} strokeWidth={1.2} />
                <h2>A brief break in the forecast.</h2>
                <p>Check your connection and try again. You can also look up another city.</p>
                <button className="primary-button" onClick={() => setRefresh((n) => n + 1)}>
                  Try again <RefreshCw size={16} />
                </button>
                <button className="text-button" onClick={() => setSearchOpen(true)}>
                  Search a different place <ArrowRight size={16} />
                </button>
              </div>
            )
          ) : (
            <div className="forecast-content" key={`${placeKey(place)}:${view}`}>
              {view === 'today' && (
                <Dashboard
                  colors={colors}
                  setColors={setColors}
                  theme={theme}
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
                      <DailyForecast
                        weather={weather}
                        units={units}
                        onExpand={() => navigate('daily')}
                      />
                    ),
                    radar: (
                      <Suspense
                        fallback={<div className="panel radar-placeholder">Loading radar…</div>}
                      >
                        <Radar
                          place={place}
                          zone={zone}
                          theme={theme}
                          onExpand={() => navigate('radar')}
                        />
                      </Suspense>
                    ),
                  }}
                />
              )}
              {view === 'hourly' && (
                <>
                  <div className="view-intro">
                    <p>From right now to what’s next.</p>
                    <span>A detailed 48-hour forecast, in local time.</span>
                  </div>
                  <HourlyForecast weather={weather} units={units} expanded />
                </>
              )}
              {view === 'daily' && (
                <>
                  <div className="view-intro">
                    <p>Make room for what’s ahead.</p>
                    <span>Your 10-day forecast, without the guesswork.</span>
                  </div>
                  <DailyForecast weather={weather} units={units} full />
                </>
              )}
              {view === 'radar' && (
                <>
                  <div className="view-intro">
                    <p>Follow the weather as it moves.</p>
                    <span>Play back the past two hours of precipitation radar.</span>
                  </div>
                  <Suspense
                    fallback={<div className="panel radar-placeholder">Loading radar…</div>}
                  >
                    <Radar place={place} zone={zone} theme={theme} expanded />
                  </Suspense>
                  <div className="radar-notes">
                    <p>
                      <Radio size={18} />
                      <span>
                        <strong>Recent radar, clearly timed.</strong>Use the timeline to see where
                        precipitation has been. This is past radar, not a future forecast.
                      </span>
                    </p>
                    <p>
                      <MapPin size={18} />
                      <span>
                        <strong>A wider view.</strong>Drag to explore and use the controls to zoom.
                        Radar coverage varies by location.
                      </span>
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="alert-service-status">
            {alerts.status === 'ready' && !alerts.alerts.length ? (
              <>
                <ShieldCheck size={14} />
                <span>
                  No active NWS alerts for this location · Checked{' '}
                  {alerts.checked ? clock(alerts.checked / 1000, zone, true) : ''}
                </span>
              </>
            ) : alerts.status === 'unavailable' ? (
              <>
                <AlertCircle size={14} />
                <span>Weather alerts are unavailable right now.</span>
                <a href="https://www.weather.gov/" target="_blank" rel="noreferrer">
                  Check NWS <ExternalLink size={11} />
                </a>
              </>
            ) : alerts.status === 'unsupported' ? (
              <>
                <MapPin size={14} />
                <span>In-app weather alerts cover U.S. locations.</span>
              </>
            ) : alerts.status === 'loading' ? (
              <>
                <Radio size={14} />
                <span>Checking U.S. weather alerts…</span>
              </>
            ) : (
              <>
                <AlertCircle size={14} />
                <span>
                  {alerts.alerts.length} active NWS{' '}
                  {alerts.alerts.length === 1 ? 'alert' : 'alerts'} · Review the alert above.
                </span>
              </>
            )}
          </div>
        </main>
        <footer className="site-footer">
          <div>
            <span className="footer-brand">weather.</span>
            <span>A clearer view of your day.</span>
          </div>
          <p>
            Forecasts by{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>
            <span>·</span>Radar by{' '}
            <a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">
              RainViewer
            </a>
            <span>·</span>Alerts by{' '}
            <a href="https://www.weather.gov/" target="_blank" rel="noreferrer">
              NWS
            </a>
          </p>
          <small>
            Current conditions are model estimates. Times are local to your selected location.
          </small>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile forecast views">
        {views.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={view === id ? 'active' : ''}
            aria-current={view === id ? 'page' : undefined}
            onClick={() => navigate(id)}
          >
            <Icon size={21} />
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
    </>
  );
}

function CurrentWeather({ weather, units }: { weather: Weather; units: Units }) {
  const c = weather.current;
  const day = today(weather);
  const hour = upcomingHours(weather, 1)[0];
  const sky = condition(c.code, c.day);
  return (
    <section
      className={`current-panel ${c.day ? 'daytime' : 'nighttime'} sky-${sky.sky}`}
      aria-label="Current weather"
    >
      <div className="current-main">
        <div className="current-text">
          <p className="current-kicker">
            RIGHT NOW <span>·</span> {clock(c.time, weather.timezone, true)}
          </p>
          <div className="current-temperature">{temperature(c.temperature, units)}</div>
          <div className="current-description">
            <h2>{sky.label}</h2>
            <span>Feels like {temperature(c.feels, units)}</span>
          </div>
          <div className="high-low">
            <span>
              <ArrowUp size={14} />
              {temperature(day?.high, units)}
            </span>
            <span>
              <ArrowDown size={14} />
              {temperature(day?.low, units)}
            </span>
          </div>
        </div>
        <div className="sky-art" aria-hidden="true">
          <div className="sky-orbit orbit-one" />
          <div className="sky-orbit orbit-two" />
          <div className="sky-orbit orbit-three" />
          <div className="sky-glow" />
          <WeatherIcon code={c.code} day={c.day} size={220} />
          <div className="sky-horizon" />
          <span className="sky-art-label">
            {c.day ? 'A MOMENT UNDER THE SKY' : 'A QUIETER KIND OF SKY'}
          </span>
        </div>
      </div>
      <div className="current-bottom">
        <p>{outlook(weather, units)}</p>
        <div className="current-stats">
          <span>
            <Wind size={15} />
            {speed(c.wind, units)} {speedUnit(units)}
          </span>
          <span>
            <Droplets size={14} />
            {percent(hour?.rain)} precip.
          </span>
          <span>
            <Check size={14} />
            Local time
          </span>
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
