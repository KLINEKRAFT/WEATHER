import { useEffect, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react';
import { readStorage, writeStorage } from './weather';

const defaults = ['current', 'hourly', 'conditions', 'daily', 'radar'] as const;
type Card = (typeof defaults)[number];
const labels: Record<Card, string> = {
  current: 'Right now',
  hourly: 'Hourly',
  conditions: 'Details',
  daily: 'Daily forecast',
  radar: 'Radar',
};
export type Layout = { order: Card[]; collapsed: Card[] };
export type Colors = { background: string; text: string } | null;
function initialLayout(): Layout {
  const value = readStorage<Partial<Layout> | null>('layout:v1', null);
  const order = Array.isArray(value?.order)
    ? [...new Set(value.order.filter((id) => defaults.includes(id)))]
    : [];
  return {
    order: [...order, ...defaults.filter((id) => !order.includes(id))],
    collapsed: Array.isArray(value?.collapsed)
      ? value.collapsed.filter((id) => defaults.includes(id))
      : [],
  };
}
function initialColors(): Colors {
  const value = readStorage<Colors>('colors:v1', null);
  return value && /^#[\da-f]{6}$/i.test(value.background) && /^#[\da-f]{6}$/i.test(value.text)
    ? value
    : null;
}
export function useAppearance(theme: string) {
  const [colors, setColors] = useState<Colors>(initialColors);
  useEffect(() => {
    writeStorage('colors:v1', colors);
    const root = document.documentElement;
    const variables = [
      '--page',
      '--surface',
      '--surface-soft',
      '--text',
      '--muted',
      '--faint',
      '--border',
      '--accent-text',
      '--blue',
    ];
    variables.forEach((key) => root.style.removeProperty(key));
    root.style.removeProperty('color');
    root.style.removeProperty('background');
    if (colors) {
      const { background, text } = colors;
      root.style.setProperty('--page', background);
      root.style.setProperty('--surface', background);
      root.style.setProperty('--surface-soft', `color-mix(in srgb, ${background} 94%, ${text})`);
      root.style.setProperty('--text', text);
      root.style.setProperty('--muted', `color-mix(in srgb, ${text} 78%, ${background})`);
      root.style.setProperty('--faint', `color-mix(in srgb, ${text} 72%, ${background})`);
      root.style.setProperty('--border', `color-mix(in srgb, ${text} 16%, ${background})`);
      root.style.setProperty('--accent-text', text);
      root.style.setProperty('--blue', text);
      root.style.color = text;
      root.style.background = background;
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', colors?.background ?? (theme === 'dark' ? '#2d2d2d' : '#eae0d2'));
  }, [colors, theme]);
  return { colors, setColors };
}
export function useLayout() {
  const [layout, setLayout] = useState(initialLayout);
  useEffect(() => writeStorage('layout:v1', layout), [layout]);
  return { layout, setLayout };
}
export default function Dashboard({
  cards,
  layout,
  setLayout,
}: {
  cards: Record<Card, ReactNode>;
  layout: Layout;
  setLayout: Dispatch<SetStateAction<Layout>>;
}) {
  return (
    <div className="dashboard">
      <div className="dashboard-cards">
        {layout.order.map((id) => {
          const collapsed = layout.collapsed.includes(id);
          return (
            <div
              key={id}
              className={`dashboard-card card-${id} ${collapsed ? 'is-collapsed' : ''}`}
              data-card={id}
            >
              <div className="card-toolbar">
                <button
                  className="collapse-card"
                  aria-expanded={!collapsed}
                  aria-controls={`card-${id}`}
                  aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${labels[id]}`}
                  onClick={() =>
                    setLayout((previous) => ({
                      ...previous,
                      collapsed: collapsed
                        ? previous.collapsed.filter((card) => card !== id)
                        : [...previous.collapsed, id],
                    }))
                  }
                >
                  <span>{labels[id]}</span>
                  <ChevronDown size={15} className={collapsed ? '' : 'open'} />
                </button>
              </div>
              {!collapsed && (
                <div id={`card-${id}`} className="card-content">
                  {cards[id]}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export function SettingsPanel({
  colors,
  setColors,
  theme,
  layout,
  setLayout,
  children,
}: {
  colors: Colors;
  setColors: (colors: Colors) => void;
  theme: string;
  layout: Layout;
  setLayout: Dispatch<SetStateAction<Layout>>;
  children: ReactNode;
}) {
  const [announcement, setAnnouncement] = useState('');
  function move(id: Card, direction: number) {
    setLayout((previous) => {
      const order = [...previous.order];
      const index = order.indexOf(id);
      const next = index + direction;
      if (next < 0 || next >= order.length) return previous;
      [order[index], order[next]] = [order[next], order[index]];
      return { ...previous, order };
    });
    setAnnouncement(`${labels[id]} moved ${direction < 0 ? 'up' : 'down'}.`);
  }
  const reset = () => {
    setLayout({ order: [...defaults], collapsed: [] });
    setAnnouncement('Default layout restored.');
  };
  const background = colors?.background ?? (theme === 'dark' ? '#2d2d2d' : '#eae0d2');
  const text = colors?.text ?? (theme === 'dark' ? '#eae0d2' : '#2d2d2d');
  return (
    <section className="settings-panel" aria-label="Settings">
      <span className="sr-only" role="status">
        {announcement}
      </span>
      {children}
      <h3>Colors</h3>
      <div className="color-presets">
        {[
          ['White Rock', '#eae0d2', '#2d2d2d'],
          ['Mine Shaft', '#2d2d2d', '#eae0d2'],
          ['Akaroa', '#d7c9ae', '#2d2d2d'],
          ['Barley Corn', '#a68763', '#171717'],
          ['Sand', '#eee5d4', '#40382d'],
          ['Sage', '#dce4d8', '#263b2d'],
          ['Blue', '#dce7ef', '#203749'],
        ].map(([name, bg, fg]) => (
          <button
            key={name}
            onClick={() => setColors({ background: bg, text: fg })}
            style={{ background: bg, color: fg }}
            aria-label={`${name} colors`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="color-inputs">
        <label>
          Background
          <input
            type="color"
            aria-label="Background color"
            value={background}
            onChange={(e) => setColors({ background: e.target.value, text })}
          />
        </label>
        <label>
          Font color
          <input
            type="color"
            aria-label="Font color"
            value={text}
            onChange={(e) => setColors({ background, text: e.target.value })}
          />
        </label>
      </div>
      <button className="text-button" onClick={() => setColors(null)}>
        Use light / dark theme colors
      </button>
      <h3>Card order</h3>
      <p>Move cards here. Tap a card’s heading to collapse it.</p>
      <ol className="layout-list">
        {layout.order.map((id, index) => (
          <li key={id}>
            <span>{labels[id]}</span>
            <div>
              <button
                className="icon-button"
                aria-label={`Move ${labels[id]} up`}
                disabled={index === 0}
                onClick={() => move(id, -1)}
              >
                <ArrowUp size={18} />
              </button>
              <button
                className="icon-button"
                aria-label={`Move ${labels[id]} down`}
                disabled={index === layout.order.length - 1}
                onClick={() => move(id, 1)}
              >
                <ArrowDown size={18} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="customize-footer">
        <button className="text-button" onClick={reset}>
          Reset layout
        </button>
      </div>
    </section>
  );
}
