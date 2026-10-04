import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowUpRight, LocateFixed, Pause, Play, Radio, RefreshCw } from 'lucide-react';
import { clock, fetchJSON, finite } from './weather';
import type { Place } from './weather';

type Frame = { time: number; path: string };
type Manifest = { host: string; frames: Frame[] };
let cachedManifest: { data: Manifest; saved: number } | null = null;

export function parseManifest(value: unknown): Manifest {
  const r = value as { host?: unknown; radar?: { past?: unknown } };
  if (
    !r ||
    typeof r.host !== 'string' ||
    !/^https:\/\/([\w-]+\.)?rainviewer\.com$/.test(r.host) ||
    !Array.isArray(r.radar?.past)
  )
    throw new Error('Radar is temporarily unavailable.');
  const frames = r.radar.past
    .filter(
      (f): f is Frame =>
        !!f && finite(f.time) && typeof f.path === 'string' && /^\/v2\/radar\/[\w-]+$/.test(f.path),
    )
    .sort((a, b) => a.time - b.time);
  if (!frames.length) throw new Error('No recent radar frames are available.');
  return { host: r.host, frames };
}

export default function Radar({
  place,
  zone,
  theme,
  expanded = false,
  onExpand,
  styleMode = 'blue',
  opacity = 0.72,
}: {
  place: Place;
  zone: string;
  theme: string;
  expanded?: boolean;
  onExpand?: () => void;
  styleMode?: string;
  opacity?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const baseLayer = useRef<L.TileLayer | null>(null);
  const overlay = useRef<L.TileLayer | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [index, setIndex] = useState(0);
  const [displayTime, setDisplayTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [tileError, setTileError] = useState('');
  const [baseError, setBaseError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const initialPlace = useRef(place);
  const opacityRef = useRef(opacity);
  useEffect(() => {
    opacityRef.current = opacity;
    overlay.current?.setOpacity(opacity);
  }, [opacity]);
  const pause = () => setPlaying(false);

  useEffect(() => {
    if (!container.current) return;
    const { latitude, longitude } = initialPlace.current;
    const instance = L.map(container.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      minZoom: 3,
      maxZoom: 10,
      attributionControl: true,
    }).setView([latitude, longitude], 6);
    map.current = instance;
    L.control.zoom({ position: expanded ? 'topright' : 'bottomright' }).addTo(instance);
    instance.attributionControl.setPrefix(false);
    marker.current = L.circleMarker([latitude, longitude], {
      radius: 5,
      color: '#fff',
      weight: 3,
      fillColor: '#242a37',
      fillOpacity: 1,
    }).addTo(instance);
    instance.on('dragstart zoomstart', pause);
    const resize = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      instance.remove();
      map.current = null;
      overlay.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
      className: `base-map-tiles ${theme === 'dark' ? 'dark-map-tiles' : ''}`,
      maxZoom: 19,
      updateWhenIdle: true,
      keepBuffer: 0,
    }).addTo(instance);
    layer.on('tileerror', () => setBaseError(true));
    baseLayer.current = layer;
    setBaseError(false);
    layer.bringToBack();
    return () => {
      layer.remove();
    };
  }, [theme]);

  useEffect(() => {
    map.current?.setView([place.latitude, place.longitude], 6);
    marker.current?.setLatLng([place.latitude, place.longitude]);
    setPlaying(false);
  }, [place]);

  useEffect(() => {
    const controller = new AbortController();
    async function update() {
      try {
        const next =
          cachedManifest && Date.now() - cachedManifest.saved < 5 * 60 * 1000 && refresh === 0
            ? cachedManifest.data
            : parseManifest(
                await fetchJSON(
                  'https://api.rainviewer.com/public/weather-maps.json',
                  controller.signal,
                ),
              );
        if (controller.signal.aborted) return;
        cachedManifest = { data: next, saved: Date.now() };
        setManifest(next);
        setIndex(next.frames.length - 1);
        setError('');
        setPlaying(false);
      } catch {
        if (!controller.signal.aborted) {
          setError('Radar is temporarily unavailable.');
          setPlaying(false);
        }
      }
    }
    void update();
    const timer = setInterval(
      () => {
        if (!document.hidden) void update();
      },
      5 * 60 * 1000,
    );
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    const frame = manifest?.frames[index];
    const instance = map.current;
    if (!frame || !manifest || !instance) return;
    let disposed = false,
      failed = false,
      loaded = false;
    setReady(false);
    setTileError('');
    // 512 px tiles + a one-level zoom offset reduce tile requests. Native source zoom stays <= 7.
    const layer = L.tileLayer(`${manifest.host}${frame.path}/512/{z}/{x}/{y}/2/1_1.png`, {
      className: 'radar-data-tiles',
      tileSize: 512,
      zoomOffset: -1,
      maxNativeZoom: 8,
      maxZoom: 10,
      opacity: 0,
      attribution:
        '<a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer">RainViewer</a>',
      updateWhenIdle: true,
      keepBuffer: 0,
      updateInterval: 500,
    });
    const watchdog = window.setTimeout(() => {
      if (!disposed && !loaded) {
        failed = true;
        setTileError('Radar tiles are taking too long to load.');
        setPlaying(false);
        setReady(true);
      }
    }, 18000);
    layer.on('tileerror', () => {
      failed = true;
    });
    layer.on('load', () => {
      if (disposed) return;
      loaded = true;
      clearTimeout(watchdog);
      setReady(true);
      if (failed) {
        layer.remove();
        setTileError('Some radar tiles could not load. Please retry.');
        setPlaying(false);
        return;
      }
      if (overlay.current !== layer) overlay.current?.remove();
      overlay.current = layer;
      layer.setOpacity(opacityRef.current);
      marker.current?.bringToFront();
      setDisplayTime(frame.time);
    });
    layer.addTo(instance);
    return () => {
      disposed = true;
      clearTimeout(watchdog);
      if (overlay.current !== layer) layer.remove();
    };
  }, [manifest, index, refresh]);

  useEffect(() => {
    if (!playing || !ready || !manifest || tileError || error) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % manifest.frames.length), 1500);
    return () => clearTimeout(timer);
  }, [playing, ready, manifest, index, tileError, error]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, []);
  const frames = manifest?.frames ?? [];
  const age = frames.length ? Math.round((Date.now() / 1000 - frames.at(-1)!.time) / 60) : null;
  return (
    <section
      className={`panel radar-panel radar-style-${['blue', 'amber', 'mono'].includes(styleMode) ? styleMode : 'blue'} ${expanded ? 'radar-expanded' : ''}`}
      aria-label="Weather radar"
    >
      <div className="radar-heading">
        <div>
          <span className="eyebrow">
            <Radio size={13} /> PRECIPITATION
          </span>
          <h2>{expanded ? 'The bigger picture.' : 'On your radar'}</h2>
        </div>
        {!expanded && (
          <button className="icon-button" aria-label="Expand radar" onClick={onExpand}>
            <ArrowUpRight size={21} />
          </button>
        )}
        {expanded && (
          <button className="text-button" onClick={() => setRefresh((n) => n + 1)}>
            <RefreshCw size={15} />
            Refresh
          </button>
        )}
      </div>
      <div className="map-wrapper">
        <div
          ref={container}
          className="radar-map"
          role="region"
          aria-label={`Precipitation radar centered on ${place.name}`}
        />
        <span className="map-time">
          {displayTime
            ? `Past radar · ${clock(displayTime, zone, true)} · ${zone.split('/').at(-1)?.replaceAll('_', ' ')}`
            : 'Loading radar…'}
        </span>
        <button
          className="map-recenter"
          aria-label="Recenter radar on selected location"
          onClick={() => map.current?.setView([place.latitude, place.longitude], 6)}
        >
          <LocateFixed size={18} />
        </button>
        <div className="radar-legend">
          <span>Light</span>
          <i />
          <span>Heavy</span>
        </div>
        {(error || tileError || baseError) && (
          <div className="map-error" role="status">
            <span>
              {error || tileError || 'The base map could not load.'}
              {displayTime ? ' Last loaded frame shown.' : ''}
            </span>
            <button
              onClick={() => {
                setRefresh((n) => n + 1);
                setBaseError(false);
                baseLayer.current?.redraw();
              }}
            >
              Retry
            </button>
          </div>
        )}
        {!ready && manifest && !error && <span className="radar-loading">Loading frame…</span>}
      </div>
      <div className="radar-controls">
        <button
          className={`play-button ${playing ? 'playing' : ''}`}
          disabled={!frames.length || !!error || !!tileError}
          aria-label={playing ? 'Pause radar animation' : 'Play radar animation'}
          onClick={() => setPlaying((v) => !v)}
        >
          {playing ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </button>
        <div className="radar-timeline">
          <input
            aria-label="Radar history"
            aria-valuetext={frames[index] ? clock(frames[index].time, zone, true) : 'Unavailable'}
            type="range"
            min={0}
            max={Math.max(0, frames.length - 1)}
            step={1}
            value={index}
            disabled={!frames.length}
            onChange={(e) => {
              setPlaying(false);
              setIndex(Number(e.target.value));
            }}
          />
          <div>
            <span>{frames[0] ? clock(frames[0].time, zone, true) : 'Past 2 hours'}</span>
            <span>{frames.at(-1) ? clock(frames.at(-1)!.time, zone, true) : 'Latest'}</span>
          </div>
        </div>
        <button
          className="latest-button"
          disabled={!frames.length}
          onClick={() => {
            setPlaying(false);
            setIndex(frames.length - 1);
          }}
        >
          Latest
        </button>
      </div>
      <p className="radar-caption">
        Past radar ·{' '}
        {age === null
          ? 'Coverage varies by region'
          : age > 20
            ? `Latest frame is ${age} minutes old`
            : `Updated ${Math.max(0, age)} min ago`}
        <span>
          {expanded ? 'Coverage varies. Blank areas may have no radar coverage.' : 'RainViewer'}
        </span>
      </p>
    </section>
  );
}
