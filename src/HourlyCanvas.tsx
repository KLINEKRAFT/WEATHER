import { useState, type CSSProperties } from 'react';
import WeatherIcon from './WeatherIcon';
import {
  clock,
  condition,
  dayLabel,
  finite,
  percent,
  speed,
  speedUnit,
  temperature,
  upcomingHours,
  type Weather,
  type Units,
} from './weather';
export default function HourlyCanvas({ weather, units }: { weather: Weather; units: Units }) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const all = upcomingHours(weather, 48),
    hours = all.slice(page * 24, page * 24 + 24);
  const active = hours.find((h) => h.time === selected) ?? hours[0];
  const numbers = all.map((h) => h.temperature).filter(finite);
  const low = Math.min(...numbers),
    span = Math.max(1, Math.max(...numbers) - low);
  if (!active) return <p className="notice">Refresh for an updated hourly forecast.</p>;
  return (
    <section className="hour-canvas" aria-label="Hourly forecast">
      <div className="canvas-top">
        <span>
          {dayLabel(active.time, weather.timezone)} / {clock(active.time, weather.timezone)}
        </span>
        <div>
          <button
            aria-label="First 24 hours"
            aria-pressed={page === 0}
            onClick={() => {
              setPage(0);
              setSelected(null);
            }}
          >
            01—24
          </button>
          <button
            aria-label="Next 24 hours"
            aria-pressed={page === 1}
            disabled={all.length <= 24}
            onClick={() => {
              setPage(1);
              setSelected(null);
            }}
          >
            25—48
          </button>
        </div>
      </div>
      <div className="hour-focus">
        <strong>{temperature(active.temperature, units)}</strong>
        <WeatherIcon code={active.code} day={active.day} size={80} />
      </div>
      <div className="hour-focus-caption">
        <span>{condition(active.code, active.day).label}</span>
        <span>Feels {temperature(active.feels, units)}</span>
      </div>
      <div className="hour-canvas-scroll" tabIndex={0} aria-label="Scroll and select an hour">
        <div className="thermal-score">
          {hours.map((h, i) => {
            const level = h.temperature === null ? null : (h.temperature - low) / span;
            return (
              <button
                key={h.time}
                className={`score-hour ${active.time === h.time ? 'selected' : ''}`}
                aria-pressed={active.time === h.time}
                aria-label={`${clock(h.time, weather.timezone)}, ${temperature(h.temperature, units)}, ${condition(h.code, h.day).label}`}
                onClick={() => setSelected(h.time)}
                style={
                  {
                    '--height': `${level === null ? 0 : 22 + level * 70}%`,
                    '--tone': `${level === null ? 0 : 28 + level * 60}%`,
                  } as CSSProperties
                }
              >
                <span>{i === 0 && page === 0 ? 'Now' : clock(h.time, weather.timezone)}</span>
                <div className="score-track">
                  <i />
                  <strong>{temperature(h.temperature, units)}</strong>
                </div>
                <WeatherIcon code={h.code} day={h.day} size={28} />
                <small>{percent(h.rain)}</small>
              </button>
            );
          })}
        </div>
      </div>
      <div className="score-key">
        <span>Temperature rhythm</span>
        <span>← swipe hours →</span>
      </div>
      <dl className="hour-facts">
        <div>
          <dt>Rain</dt>
          <dd>{percent(active.rain)}</dd>
        </div>
        <div>
          <dt>Wind</dt>
          <dd>
            {speed(active.wind, units)}
            <small> {speedUnit(units)}</small>
          </dd>
        </div>
        <div>
          <dt>Humidity</dt>
          <dd>{percent(active.humidity)}</dd>
        </div>
      </dl>
    </section>
  );
}
