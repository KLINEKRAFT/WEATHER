import { describe, expect, it } from 'vitest';
import raw from '../fixtures/tulsa.json';
import {
  clock,
  compass,
  condition,
  dateKey,
  dayLabel,
  forecastURL,
  outlook,
  parseWeather,
  percent,
  speed,
  temperature,
  today,
  TULSA,
  upcomingHours,
  validPlace,
} from '../../src/weather';

const weather = parseWeather(raw);
const NOW = Date.parse('2026-10-03T02:35:00Z') / 1000;

describe('forecast normalization', () => {
  it('accepts the real Open-Meteo response shape and preserves its local time zone', () => {
    expect(weather.timezone).toBe('America/Chicago');
    expect(weather.hours).toHaveLength(240);
    expect(weather.days).toHaveLength(10);
    expect(weather.current.temperature).toBe(19.6);
  });
  it('rejects malformed and incomplete forecasts rather than manufacturing data', () => {
    expect(() => parseWeather({})).toThrow();
    expect(() => parseWeather({ ...raw, timezone: 'Not/AZone' })).toThrow();
    expect(() =>
      parseWeather({ ...raw, current: { ...raw.current, temperature_2m: null } }),
    ).toThrow();
    expect(() => parseWeather({ ...raw, hourly: { time: [] } })).toThrow();
  });
  it('keeps missing optional values as null and displays them as unavailable', () => {
    const data = parseWeather({
      ...raw,
      current: { ...raw.current, wind_speed_10m: null },
      hourly: { ...raw.hourly, precipitation_probability: [null] },
    });
    expect(data.current.wind).toBeNull();
    expect(data.hours[0].rain).toBeNull();
    expect(percent(data.hours[0].rain)).toBe('—');
    expect(speed(data.current.wind, 'f')).toBe('—');
  });
});

describe('units and weather codes', () => {
  it('converts all temperatures and wind speeds from canonical SI data', () => {
    expect(temperature(0, 'f')).toBe('32°');
    expect(temperature(-20, 'f')).toBe('-4°');
    expect(temperature(19.6, 'c')).toBe('20°');
    expect(temperature(null, 'c')).toBe('—');
    expect(speed(16.09344, 'f')).toBe('10');
    expect(speed(16.09344, 'c')).toBe('16');
    expect(percent(0)).toBe('0%');
  });
  it('distinguishes night, frozen precipitation, storms, and unknown codes', () => {
    expect(condition(0, false).sky).toBe('moon');
    expect(condition(67).label).toBe('Freezing rain');
    expect(condition(86).sky).toBe('snow');
    expect(condition(99).label).toBe('Storms with hail');
    expect(condition(null).sky).toBe('unknown');
    expect(condition(123).sky).toBe('unknown');
  });
  it('normalizes compass wraparound', () => {
    expect(compass(359)).toBe('N');
    expect(compass(450)).toBe('E');
    expect(compass(-90)).toBe('W');
    expect(compass(null)).toBe('—');
  });
});

describe('location-local dates and forecast selection', () => {
  it('uses the selected city date, not the browser date, across midnight', () => {
    expect(dateKey(NOW, 'America/Chicago')).toBe('2026-10-02');
    expect(dateKey(NOW, 'Europe/London')).toBe('2026-10-03');
    expect(dayLabel(weather.days[0].time, weather.timezone, NOW)).toBe('Today');
    expect(today(weather, NOW)?.time).toBe(weather.days[0].time);
    expect(clock(NOW, 'America/Chicago')).toBe('9 PM');
  });
  it('keeps the current hour without including an expired interval', () => {
    const hours = upcomingHours(weather, 24, NOW);
    expect(hours).toHaveLength(24);
    expect(hours[0].time).toBe(Date.parse('2026-10-03T02:00:00Z') / 1000);
    expect(upcomingHours(weather, 1, hours[0].time + 3600)[0].time).toBe(hours[0].time + 3600);
  });
  it('labels tomorrow correctly across the 25-hour daylight-saving transition', () => {
    const beforeFallback = Date.parse('2026-11-01T05:30:00Z') / 1000;
    const tomorrowMidnight = Date.parse('2026-11-02T06:00:00Z') / 1000;
    expect(dayLabel(tomorrowMidnight, 'America/Chicago', beforeFallback)).toBe('Tomorrow');
  });
  it('handles non-whole-hour offsets without rounding to a UTC hour', () => {
    const shifted = {
      ...weather,
      hours: [{ ...weather.hours[0], time: Date.parse('2026-10-03T00:15:00Z') / 1000 }],
    };
    expect(upcomingHours(shifted, 1, Date.parse('2026-10-03T00:40:00Z') / 1000)).toHaveLength(1);
    expect(clock(shifted.hours[0].time, 'Asia/Kathmandu')).toBe('6 AM');
  });
  it('does not mistake missing precipitation probabilities for dry weather', () => {
    const missing = { ...weather, hours: weather.hours.map((h) => ({ ...h, rain: null })) };
    expect(outlook(missing, 'f', NOW)).not.toContain('Low chances');
  });
});

describe('provider requests and persisted places', () => {
  it('requests a ten-day SI forecast with UTC epochs and location-local grouping', () => {
    const url = new URL(forecastURL(TULSA));
    expect(url.hostname).toBe('api.open-meteo.com');
    expect(url.searchParams.get('timeformat')).toBe('unixtime');
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.get('forecast_days')).toBe('10');
    expect(url.searchParams.has('apikey')).toBe(false);
  });
  it('rejects invalid stored locations without losing valid equator coordinates', () => {
    expect(validPlace(TULSA)).toBe(true);
    expect(validPlace({ ...TULSA, latitude: 0, longitude: 0 })).toBe(true);
    expect(validPlace({ ...TULSA, latitude: 100 })).toBe(false);
    expect(validPlace({ ...TULSA, longitude: NaN })).toBe(false);
    expect(validPlace({ id: 'broken' })).toBe(false);
  });
});
