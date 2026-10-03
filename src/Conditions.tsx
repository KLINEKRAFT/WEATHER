import { ArrowUp, Droplets, Eye, Gauge, Sun, Sunrise, Sunset, Wind } from 'lucide-react';
import {
  clock,
  compass,
  finite,
  percent,
  speed,
  speedUnit,
  temperature,
  today,
  upcomingHours,
  uvLabel,
} from './weather';
import type { Units, Weather } from './weather';
import { SectionTitle } from './Forecast';

export default function Conditions({ weather, units }: { weather: Weather; units: Units }) {
  const current = weather.current;
  const hour = upcomingHours(weather, 1)[0];
  const day = today(weather);
  const uv = hour?.uv ?? null;
  const sunrise = day?.sunrise;
  const sunset = day?.sunset;
  const daylight = day?.daylight;
  const progress =
    sunrise && sunset && sunset > sunrise
      ? Math.max(0, Math.min(1, (Date.now() / 1000 - sunrise) / (sunset - sunrise)))
      : null;
  const sunX = progress === null ? null : 20 + progress * 260;
  const sunY = progress === null ? null : 83 - Math.sin(progress * Math.PI) * 65;
  const daylightLabel = finite(daylight)
    ? `${Math.floor(daylight / 3600)}h ${Math.floor((daylight % 3600) / 60)}m`
    : '—';
  return (
    <section className="conditions-section" aria-label="Weather details">
      <SectionTitle eyebrow="A CLOSER LOOK" title="The details that make the day." />
      <div className="conditions-grid">
        <article className="condition-card">
          <p className="metric-label">
            <Wind size={16} />
            Wind
          </p>
          <div className="metric-value">
            {speed(current.wind, units)}
            <small>{speedUnit(units)}</small>
            <span className="wind-compass" aria-hidden="true">
              <span>N</span>
              <ArrowUp
                size={26}
                style={{ transform: `rotate(${(current.direction ?? 0) + 180}deg)` }}
              />
            </span>
          </div>
          <p>
            From {compass(current.direction)} · Gusts {speed(current.gusts, units)}{' '}
            {speedUnit(units)}
          </p>
        </article>
        <article className="condition-card">
          <p className="metric-label">
            <Droplets size={16} />
            Humidity
          </p>
          <div className="metric-value">{percent(current.humidity)}</div>
          <div className="mini-track">
            <i style={{ width: `${current.humidity ?? 0}%` }} />
          </div>
          <p>Dew point {temperature(hour?.dew, units)}</p>
        </article>
        <article className="condition-card">
          <p className="metric-label">
            <Sun size={16} />
            UV index
          </p>
          <div className="metric-value">
            {uv === null ? '—' : uv.toFixed(1)}
            <small>{uvLabel(uv)}</small>
          </div>
          <div className="uv-track">
            <i style={{ left: `${Math.min(98, ((uv ?? 0) / 12) * 100)}%` }} />
          </div>
          <p>Today’s peak {day?.uv === null || day?.uv === undefined ? '—' : day.uv.toFixed(1)}</p>
        </article>
        <article className="condition-card">
          <p className="metric-label">
            <Eye size={16} />
            Visibility
          </p>
          <div className="metric-value">
            {hour?.visibility === null || hour?.visibility === undefined
              ? '—'
              : Math.round(hour.visibility / (units === 'f' ? 1609.344 : 1000))}
            <small>{units === 'f' ? 'mi' : 'km'}</small>
          </div>
          <div className="visibility-lines" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <p>
            {hour?.visibility !== null && hour?.visibility !== undefined
              ? hour.visibility >= 10000
                ? 'Clear view ahead'
                : hour.visibility >= 4000
                  ? 'Some reduced visibility'
                  : 'Low visibility'
              : 'Visibility unavailable'}
          </p>
        </article>
        <article className="condition-card daylight-card">
          <div>
            <p className="metric-label">
              <Sunrise size={16} />
              Sun & daylight
            </p>
            <div className="metric-value">{daylightLabel}</div>
            <p>
              {progress === 0
                ? 'The day is still ahead'
                : progress === 1
                  ? 'The sun has set for today'
                  : progress === null
                    ? 'Sun times unavailable'
                    : 'Between sunrise and sunset'}
            </p>
          </div>
          <div className="sun-path">
            <svg
              viewBox="0 0 300 102"
              role="img"
              aria-label="Sun’s progress between sunrise and sunset"
            >
              <path
                d="M20 83C80 -4 220 -4 280 83"
                fill="none"
                stroke="var(--border)"
                strokeWidth="2"
                strokeDasharray="4 5"
              />
              <path d="M10 83H290" stroke="var(--border)" fill="none" />
              {sunX !== null && sunY !== null && (
                <>
                  <circle cx={sunX} cy={sunY} r="15" fill="var(--accent)" opacity=".09" />
                  <circle cx={sunX} cy={sunY} r="7" fill="var(--accent)" />
                </>
              )}
            </svg>
            <div>
              <span>
                <Sunrise size={13} />
                {sunrise ? clock(sunrise, weather.timezone, true) : '—'}
              </span>
              <span>
                <Sunset size={13} />
                {sunset ? clock(sunset, weather.timezone, true) : '—'}
              </span>
            </div>
          </div>
        </article>
        <article className="condition-card">
          <p className="metric-label">
            <Gauge size={16} />
            Pressure
          </p>
          <div className="metric-value pressure-value">
            {current.pressure === null
              ? '—'
              : units === 'f'
                ? (current.pressure / 33.8639).toFixed(2)
                : Math.round(current.pressure)}
            <small>{units === 'f' ? 'inHg' : 'hPa'}</small>
          </div>
          <p>At sea level</p>
        </article>
        <article className="condition-card">
          <p className="metric-label">
            <Droplets size={16} />
            Today’s precipitation
          </p>
          <div className="metric-value">
            {day?.precipitation === null || day?.precipitation === undefined
              ? '—'
              : units === 'f'
                ? (day.precipitation / 25.4).toFixed(2)
                : day.precipitation.toFixed(1)}
            <small>{units === 'f' ? 'in' : 'mm'}</small>
          </div>
          <p>{percent(day?.rain)} peak chance today</p>
        </article>
      </div>
    </section>
  );
}
