export type Units = 'f' | 'c';
export type Place = {
  id: string;
  name: string;
  region: string;
  country: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
};
export type Hour = {
  time: number;
  temperature: number | null;
  feels: number | null;
  rain: number | null;
  code: number | null;
  day: boolean;
  wind: number | null;
  direction: number | null;
  humidity: number | null;
  visibility: number | null;
  uv: number | null;
  dew: number | null;
};
export type Day = {
  time: number;
  code: number | null;
  high: number | null;
  low: number | null;
  sunrise: number | null;
  sunset: number | null;
  daylight: number | null;
  uv: number | null;
  rain: number | null;
  precipitation: number | null;
  wind: number | null;
};
export type Weather = {
  timezone: string;
  current: {
    time: number;
    temperature: number;
    feels: number | null;
    code: number | null;
    day: boolean;
    humidity: number | null;
    wind: number | null;
    direction: number | null;
    gusts: number | null;
    pressure: number | null;
    clouds: number | null;
  };
  hours: Hour[];
  days: Day[];
};
export type Alert = {
  id: string;
  event: string;
  headline: string;
  severity: string;
  description: string;
  instruction: string;
  expires: string;
  sender: string;
  url: string;
};
export type Sky =
  'sun' | 'moon' | 'partly' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm' | 'unknown';

export const TULSA: Place = {
  id: 'tulsa',
  name: 'Tulsa',
  region: 'Oklahoma',
  country: 'United States',
  countryCode: 'US',
  latitude: 36.154,
  longitude: -95.9928,
};
export const SUGGESTED: Place[] = [
  TULSA,
  {
    id: 'okc',
    name: 'Oklahoma City',
    region: 'Oklahoma',
    country: 'United States',
    countryCode: 'US',
    latitude: 35.4676,
    longitude: -97.5164,
  },
  {
    id: 'nyc',
    name: 'New York',
    region: 'New York',
    country: 'United States',
    countryCode: 'US',
    latitude: 40.7143,
    longitude: -74.006,
  },
  {
    id: 'london',
    name: 'London',
    region: 'England',
    country: 'United Kingdom',
    countryCode: 'GB',
    latitude: 51.5085,
    longitude: -0.1257,
  },
];

export const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const number = (v: unknown): number | null => (finite(v) ? v : null);
type RecordData = Record<string, unknown>;
const record = (v: unknown): RecordData =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as RecordData) : {};
const item = (r: RecordData, key: string, i: number) =>
  number(Array.isArray(r[key]) ? r[key][i] : null);

export function parseWeather(raw: unknown): Weather {
  const r = record(raw),
    c = record(r.current),
    h = record(r.hourly),
    d = record(r.daily);
  if (
    !finite(c.time) ||
    !finite(c.temperature_2m) ||
    typeof r.timezone !== 'string' ||
    !Array.isArray(h.time) ||
    !h.time.length ||
    !Array.isArray(d.time) ||
    !d.time.length
  )
    throw new Error('The weather service returned an incomplete forecast.');
  try {
    new Intl.DateTimeFormat('en', { timeZone: r.timezone });
  } catch {
    throw new Error('The weather time zone is unavailable.');
  }
  return {
    timezone: r.timezone,
    current: {
      time: c.time,
      temperature: c.temperature_2m,
      feels: number(c.apparent_temperature),
      code: number(c.weather_code),
      day: c.is_day === 1,
      humidity: number(c.relative_humidity_2m),
      wind: number(c.wind_speed_10m),
      direction: number(c.wind_direction_10m),
      gusts: number(c.wind_gusts_10m),
      pressure: number(c.pressure_msl),
      clouds: number(c.cloud_cover),
    },
    hours: h.time
      .map((time, i): Hour => ({
        time: number(time) ?? 0,
        temperature: item(h, 'temperature_2m', i),
        feels: item(h, 'apparent_temperature', i),
        rain: item(h, 'precipitation_probability', i),
        code: item(h, 'weather_code', i),
        day: item(h, 'is_day', i) === 1,
        wind: item(h, 'wind_speed_10m', i),
        direction: item(h, 'wind_direction_10m', i),
        humidity: item(h, 'relative_humidity_2m', i),
        visibility: item(h, 'visibility', i),
        uv: item(h, 'uv_index', i),
        dew: item(h, 'dew_point_2m', i),
      }))
      .filter((h) => h.time > 0),
    days: d.time
      .map((time, i): Day => ({
        time: number(time) ?? 0,
        code: item(d, 'weather_code', i),
        high: item(d, 'temperature_2m_max', i),
        low: item(d, 'temperature_2m_min', i),
        sunrise: item(d, 'sunrise', i),
        sunset: item(d, 'sunset', i),
        daylight: item(d, 'daylight_duration', i),
        uv: item(d, 'uv_index_max', i),
        rain: item(d, 'precipitation_probability_max', i),
        precipitation: item(d, 'precipitation_sum', i),
        wind: item(d, 'wind_speed_10m_max', i),
      }))
      .filter((d) => d.time > 0),
  };
}

export function condition(code: number | null, day = true): { label: string; sky: Sky } {
  if (code === 0) return { label: day ? 'Clear skies' : 'Clear night', sky: day ? 'sun' : 'moon' };
  if (code === 1)
    return { label: day ? 'Mostly sunny' : 'Mostly clear', sky: day ? 'sun' : 'moon' };
  if (code === 2) return { label: 'Partly cloudy', sky: 'partly' };
  if (code === 3) return { label: 'Overcast', sky: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Foggy', sky: 'fog' };
  if (code !== null && [51, 53, 55].includes(code)) return { label: 'Drizzle', sky: 'rain' };
  if (code !== null && [56, 57, 66, 67].includes(code))
    return { label: 'Freezing rain', sky: 'rain' };
  if (code !== null && [61, 63, 65, 80, 81, 82].includes(code))
    return { label: code === 65 || code === 82 ? 'Heavy rain' : 'Rain showers', sky: 'rain' };
  if (code !== null && [71, 73, 75, 77, 85, 86].includes(code))
    return { label: 'Snow', sky: 'snow' };
  if (code !== null && [95, 96, 99].includes(code))
    return { label: code === 95 ? 'Thunderstorms' : 'Storms with hail', sky: 'storm' };
  return { label: 'Conditions unavailable', sky: 'unknown' };
}

export const tempValue = (c: number, units: Units) => (units === 'f' ? (c * 9) / 5 + 32 : c);
export const temperature = (c: number | null | undefined, units: Units) =>
  finite(c) ? `${Math.round(tempValue(c, units))}°` : '—';
export const speed = (kmh: number | null | undefined, units: Units) =>
  finite(kmh) ? `${Math.round(units === 'f' ? kmh / 1.609344 : kmh)}` : '—';
export const speedUnit = (units: Units) => (units === 'f' ? 'mph' : 'km/h');
export const percent = (n: number | null | undefined) => (finite(n) ? `${Math.round(n)}%` : '—');
export const compass = (n: number | null) =>
  n === null
    ? '—'
    : [
        'N',
        'NNE',
        'NE',
        'ENE',
        'E',
        'ESE',
        'SE',
        'SSE',
        'S',
        'SSW',
        'SW',
        'WSW',
        'W',
        'WNW',
        'NW',
        'NNW',
      ][Math.round((((n % 360) + 360) % 360) / 22.5) % 16];
export const clock = (time: number, zone: string, minutes = false) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour: 'numeric',
    ...(minutes ? { minute: '2-digit' as const } : {}),
  }).format(new Date(time * 1000));
export const dateKey = (time: number, zone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(time * 1000));
export function dayLabel(time: number, zone: string, now = Date.now() / 1000, long = false) {
  const localToday = dateKey(now, zone);
  if (dateKey(time, zone) === localToday) return 'Today';
  // Advance the local calendar date, not 24 elapsed hours (DST days can be 23 or 25 hours).
  const tomorrow = new Date(`${localToday}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (dateKey(time, zone) === tomorrow.toISOString().slice(0, 10)) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: long ? 'long' : 'short',
  }).format(new Date(time * 1000));
}
export function upcomingHours(weather: Weather, count = 24, now = Date.now() / 1000) {
  // Pick the interval containing "now", including zones offset by 30 or 45 minutes.
  return weather.hours.filter((h) => h.time + 3600 > now).slice(0, count);
}
export function today(weather: Weather, now = Date.now() / 1000) {
  return weather.days.find(
    (d) => dateKey(d.time, weather.timezone) === dateKey(now, weather.timezone),
  );
}
export function outlook(weather: Weather, units: Units, now = Date.now() / 1000) {
  const hours = upcomingHours(weather, 12, now);
  const wet = hours.find((h) => h.rain !== null && h.rain >= 40);
  const day = today(weather, now);
  const high = day && day.high !== null ? `A high of ${temperature(day.high, units)} today. ` : '';
  if (wet)
    return `${high}${percent(wet.rain)} chance of precipitation around ${clock(wet.time, weather.timezone)}.`;
  if (hours.length && hours.every((h) => h.rain !== null && h.rain < 20))
    return `${high}Low chances of precipitation over the next 12 hours.`;
  return `${high}Your next 24 hours, at a glance.`;
}
export function uvLabel(value: number | null) {
  if (value === null) return 'Unavailable';
  if (value < 3) return 'Low';
  if (value < 6) return 'Moderate';
  if (value < 8) return 'High';
  if (value < 11) return 'Very high';
  return 'Extreme';
}

export const validPlace = (p: unknown): p is Place => {
  const v = record(p);
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.region === 'string' &&
    typeof v.country === 'string' &&
    finite(v.latitude) &&
    Math.abs(v.latitude) <= 90 &&
    finite(v.longitude) &&
    Math.abs(v.longitude) <= 180
  );
};
export function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(`weather:${key}`);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(`weather:${key}`, JSON.stringify(value));
  } catch {
    /* Private browsing or full storage must not break forecasts. */
  }
}
export const placeKey = (place: Place) =>
  `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`;

export async function fetchJSON(url: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Unable to reach the weather service. Check your connection and try again.');
  }
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? 'The weather service is busy. Please try again shortly.'
        : 'The weather service could not be reached.',
    );
  return response.json();
}

export function forecastURL(place: Place) {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: '10',
    current:
      'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    hourly:
      'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,is_day,wind_speed_10m,wind_direction_10m,visibility,uv_index,dew_point_2m',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,daylight_duration,uv_index_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max',
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export async function searchPlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  const result = record(
    await fetchJSON(
      `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: query, count: '7', language: 'en', format: 'json' })}`,
      signal,
    ),
  );
  if (!Array.isArray(result.results)) return [];
  return result.results
    .map((value): unknown => {
      const p = record(value);
      return {
        id: String(p.id),
        name: p.name,
        region: p.admin1 ?? '',
        country: p.country ?? '',
        countryCode: p.country_code,
        latitude: p.latitude,
        longitude: p.longitude,
      };
    })
    .filter(validPlace);
}

export async function fetchAlerts(place: Place, signal: AbortSignal): Promise<Alert[]> {
  const r = record(
    await fetchJSON(
      `https://api.weather.gov/alerts/active?point=${place.latitude.toFixed(4)},${place.longitude.toFixed(4)}`,
      signal,
    ),
  );
  if (!Array.isArray(r.features)) throw new Error('Alert service unavailable.');
  return r.features.map((f: unknown) => {
    const p = record(record(f).properties);
    return {
      id: String(p.id),
      event: String(p.event ?? 'Weather alert'),
      headline: String(p.headline ?? p.event ?? 'Weather alert'),
      severity: String(p.severity ?? 'Unknown'),
      description: String(p.description ?? ''),
      instruction: String(p.instruction ?? ''),
      expires: String(p.expires ?? ''),
      sender: String(p.senderName ?? 'National Weather Service'),
      url: `https://forecast.weather.gov/MapClick.php?lat=${place.latitude.toFixed(4)}&lon=${place.longitude.toFixed(4)}`,
    };
  });
}
