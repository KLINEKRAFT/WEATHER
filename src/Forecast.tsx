import { useId, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Droplets,
  Sunrise,
  Sunset,
  Wind,
} from 'lucide-react';
import type { Day, Hour, Units, Weather } from './weather';
import {
  clock,
  condition,
  dateKey,
  dayLabel,
  finite,
  percent,
  speed,
  speedUnit,
  temperature,
  tempValue,
  upcomingHours,
  uvLabel,
} from './weather';
import WeatherIcon from './WeatherIcon';

export function SectionTitle({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}

export function HourlyForecast({
  weather,
  units,
  expanded = false,
  compact = false,
  onExpand,
}: {
  weather: Weather;
  units: Units;
  expanded?: boolean;
  compact?: boolean;
  onExpand?: () => void;
}) {
  const [metric, setMetric] = useState<'temperature' | 'rain' | 'wind'>('temperature');
  const [selected, setSelected] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const gradient = useId().replace(/:/g, '');
  const available = upcomingHours(weather, expanded ? 48 : 24);
  const hours = expanded ? available.slice(page * 24, (page + 1) * 24) : available;
  const active = hours.find((h) => h.time === selected);
  const values = hours.map((h) =>
    metric === 'temperature'
      ? h.temperature === null
        ? null
        : tempValue(h.temperature, units)
      : metric === 'rain'
        ? h.rain
        : h.wind === null
          ? null
          : Number(speed(h.wind, units)),
  );
  const numbers = values.filter(finite);
  const min = metric === 'temperature' ? Math.min(...numbers) - 4 : 0;
  const max =
    metric === 'rain' ? 100 : Math.max(...numbers, min + 1) + (metric === 'temperature' ? 4 : 5);
  const width = Math.max(1, hours.length) * 74;
  const points = values.map((v, i) =>
    v === null ? null : { x: i * 74 + 37, y: 64 - ((v - min) / (max - min)) * 54 },
  );
  const segments: { x: number; y: number }[][] = [];
  points.forEach((p, i) => {
    if (p) {
      if (i === 0 || !points[i - 1]) segments.push([]);
      segments[segments.length - 1].push(p);
    }
  });
  const display = (h: Hour) =>
    metric === 'temperature'
      ? temperature(h.temperature, units)
      : metric === 'rain'
        ? percent(h.rain)
        : `${speed(h.wind, units)}`;
  return (
    <section
      className={`panel hourly-panel ${expanded ? 'expanded-hourly' : ''} ${compact ? 'compact-hourly' : ''}`}
      aria-label="Hourly forecast"
    >
      <div className="panel-heading">
        <SectionTitle
          title={expanded ? 'The hours ahead.' : 'Hour by hour'}
          action={!expanded ? '48-hour forecast' : undefined}
          onAction={onExpand}
        />
        <div className="metric-tabs" aria-label="Hourly chart measurement">
          {(['temperature', 'rain', 'wind'] as const).map((m) => (
            <button aria-pressed={metric === m} key={m} onClick={() => setMetric(m)}>
              {m === 'temperature' ? 'Temperature' : m === 'rain' ? 'Precipitation' : 'Wind'}
            </button>
          ))}
        </div>
      </div>
      {expanded && (
        <div className="hourly-day-controls">
          <p>
            {page === 0 ? 'Next 24 hours' : '24–48 hours ahead'}{' '}
            <span>· {weather.timezone.replaceAll('_', ' ')}</span>
          </p>
          <div>
            <button
              className="icon-button"
              disabled={page === 0}
              onClick={() => setPage(0)}
              aria-label="First 24 hours"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="icon-button"
              disabled={page === 1 || available.length <= 24}
              onClick={() => setPage(1)}
              aria-label="Next 24 hours"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
      {!hours.length ? (
        <p className="empty-inline">
          This saved forecast has no upcoming hours. Refresh to get the latest.
        </p>
      ) : (
        <>
          <div
            className="hourly-scroll"
            tabIndex={0}
            aria-label="Scroll through the hourly forecast"
          >
            <div className="hourly-plot" style={{ width, minWidth: '100%' }}>
              <svg
                className={`temperature-chart ${metric}`}
                viewBox={`0 0 ${width} 82`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity=".16" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`M0 77H${width}`} className="chart-baseline" />
                {segments.map((segment, i) => {
                  const line = segment
                    .map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x},${p.y}`)
                    .join(' ');
                  return (
                    <g key={i}>
                      <path
                        d={`${line} L${segment.at(-1)!.x},82 L${segment[0].x},82 Z`}
                        fill={`url(#${gradient})`}
                      />
                      <path
                        d={line}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.3"
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  );
                })}
                {points.map(
                  (p, i) =>
                    p && (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r="3"
                        fill="var(--surface)"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                    ),
                )}
              </svg>
              {hours.map((h, i) => (
                <button
                  className={`hour-column ${selected === h.time ? 'is-selected' : ''}`}
                  key={h.time}
                  aria-pressed={selected === h.time}
                  aria-label={`${clock(h.time, weather.timezone)}, ${temperature(h.temperature, units)}, ${condition(h.code, h.day).label}, precipitation ${percent(h.rain)}`}
                  onClick={() => setSelected(selected === h.time ? null : h.time)}
                >
                  <span className="hour-time">
                    {page === 0 && i === 0 ? 'Now' : clock(h.time, weather.timezone)}
                  </span>
                  <WeatherIcon code={h.code} day={h.day} size={35} />
                  <strong>
                    {display(h)}
                    {metric === 'wind' && <small>{speedUnit(units)}</small>}
                  </strong>
                  <span className={`hour-rain ${h.rain !== null && h.rain > 0 ? 'has-rain' : ''}`}>
                    <Droplets size={12} />
                    {percent(h.rain)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="chart-footnote" aria-live="polite">
            {active ? (
              <>
                <strong>
                  {clock(active.time, weather.timezone)} ·{' '}
                  {condition(active.code, active.day).label}
                </strong>
                <span>
                  Feels {temperature(active.feels, units)} · Wind {speed(active.wind, units)}{' '}
                  {speedUnit(units)} · Humidity {percent(active.humidity)}
                </span>
              </>
            ) : (
              <>
                <span>Precipitation chance shown below</span>
                <span>
                  Scroll to explore <ArrowRight size={13} />
                </span>
              </>
            )}
          </div>
        </>
      )}
      {expanded && (
        <div className="hourly-table">
          <div className="hourly-table-head">
            <span>Time</span>
            <span>Conditions</span>
            <span>Temp.</span>
            <span>Feels</span>
            <span>Precip.</span>
            <span>Wind</span>
          </div>
          {hours.map((h, i) => (
            <div key={h.time} className="hourly-table-row">
              <span>
                <strong>{clock(h.time, weather.timezone)}</strong>
                {(i === 0 ||
                  dateKey(h.time, weather.timezone) !==
                    dateKey(hours[i - 1].time, weather.timezone)) && (
                  <small>{dayLabel(h.time, weather.timezone)}</small>
                )}
              </span>
              <span>
                <WeatherIcon code={h.code} day={h.day} size={30} />
                <span className="table-condition">{condition(h.code, h.day).label}</span>
              </span>
              <strong>{temperature(h.temperature, units)}</strong>
              <span>{temperature(h.feels, units)}</span>
              <span className="rain-number">{percent(h.rain)}</span>
              <span>
                {speed(h.wind, units)} <small>{speedUnit(units)}</small>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function DailyForecast({
  weather,
  units,
  full = false,
  onExpand,
}: {
  weather: Weather;
  units: Units;
  full?: boolean;
  onExpand?: () => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const days = weather.days
    .filter(
      (d) => dateKey(d.time, weather.timezone) >= dateKey(Date.now() / 1000, weather.timezone),
    )
    .slice(0, full ? 10 : 5);
  const low = Math.min(...days.map((d) => d.low).filter(finite));
  const high = Math.max(...days.map((d) => d.high).filter(finite));
  const span = Math.max(high - low, 1);
  return (
    <section
      className={`panel daily-panel ${full ? 'full-daily' : ''}`}
      aria-label="Daily forecast"
    >
      <SectionTitle
        title={full ? '' : 'The next few days'}
        action={!full ? '10-day forecast' : undefined}
        onAction={onExpand}
      />
      <div className="daily-rows">
        {days.map((d) => (
          <div className="day-item" key={d.time}>
            <button
              className="day-row"
              onClick={() => setOpen(open === d.time ? null : d.time)}
              aria-expanded={open === d.time}
              aria-controls={`detail-${d.time}`}
            >
              <span className="day-name">
                <strong>{dayLabel(d.time, weather.timezone)}</strong>
                {full && (
                  <small>
                    {new Intl.DateTimeFormat('en-US', {
                      timeZone: weather.timezone,
                      month: 'short',
                      day: 'numeric',
                    }).format(d.time * 1000)}
                  </small>
                )}
              </span>
              <WeatherIcon code={d.code} size={35} />
              {full && <span className="daily-condition">{condition(d.code).label}</span>}
              <span className={`day-rain ${d.rain !== null && d.rain >= 20 ? 'rain-number' : ''}`}>
                <Droplets size={12} />
                {percent(d.rain)}
              </span>
              <span className="temperature-range">
                <span className="low-temp">{temperature(d.low, units)}</span>
                <span className="range-track">
                  {d.low !== null && d.high !== null && (
                    <span
                      style={{
                        left: `${((d.low - low) / span) * 100}%`,
                        width: `${Math.max(3, ((d.high - d.low) / span) * 100)}%`,
                      }}
                    />
                  )}
                </span>
                <strong>{temperature(d.high, units)}</strong>
              </span>
              <ChevronDown size={15} className={open === d.time ? 'chevron open' : 'chevron'} />
            </button>
            {open === d.time && <DayDetail day={d} zone={weather.timezone} units={units} />}
          </div>
        ))}
      </div>
      {!days.length && <p className="empty-inline">Refresh for a new daily forecast.</p>}
      <div className={full ? 'sr-only' : 'daily-footnote'}>
        <span className="range-key" /> Daily low and high · Forecasts can change
      </div>
    </section>
  );
}

function DayDetail({ day, zone, units }: { day: Day; zone: string; units: Units }) {
  return (
    <div className="day-detail" id={`detail-${day.time}`}>
      <p>
        {condition(day.code).label}. High {temperature(day.high, units)}, low{' '}
        {temperature(day.low, units)}.
      </p>
      <div>
        <span>
          <Wind size={15} />
          <small>Max wind</small>
          <strong>
            {speed(day.wind, units)} {speedUnit(units)}
          </strong>
        </span>
        <span>
          <CloudRain size={15} />
          <small>Precipitation</small>
          <strong>
            {day.precipitation === null
              ? '—'
              : units === 'f'
                ? `${(day.precipitation / 25.4).toFixed(2)} in`
                : `${day.precipitation.toFixed(1)} mm`}
          </strong>
        </span>
        <span>
          <Sunrise size={15} />
          <small>Sunrise</small>
          <strong>{day.sunrise ? clock(day.sunrise, zone, true) : '—'}</strong>
        </span>
        <span>
          <Sunset size={15} />
          <small>Sunset</small>
          <strong>{day.sunset ? clock(day.sunset, zone, true) : '—'}</strong>
        </span>
      </div>
      <p className="day-uv">
        Peak UV {day.uv === null ? 'unavailable' : `${day.uv.toFixed(1)} · ${uvLabel(day.uv)}`}
      </p>
    </div>
  );
}
