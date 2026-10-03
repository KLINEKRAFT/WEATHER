import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
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
type Layout = { order: Card[]; collapsed: Card[] };
type Colors = { background: string; text: string } | null;
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
      ?.setAttribute('content', colors?.background ?? (theme === 'dark' ? '#242424' : '#eeeeec'));
  }, [colors, theme]);
  return { colors, setColors };
}
export default function Dashboard({
  cards,
  colors,
  setColors,
  theme,
}: {
  cards: Record<Card, ReactNode>;
  colors: Colors;
  setColors: (colors: Colors) => void;
  theme: string;
}) {
  const [layout, setLayout] = useState(initialLayout);
  const [customizing, setCustomizing] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => writeStorage('layout:v1', layout), [layout]);
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
  return (
    <div className="dashboard">
      <button className="customize-trigger text-button" onClick={() => setCustomizing(true)}>
        <SlidersHorizontal size={15} /> Customize
      </button>
      <span className="sr-only" role="status">
        {announcement}
      </span>
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
      {customizing && (
        <CustomizeDialog
          colors={colors}
          setColors={setColors}
          theme={theme}
          layout={layout}
          move={move}
          reset={() => {
            setLayout({ order: [...defaults], collapsed: [] });
            setAnnouncement('Default layout restored.');
          }}
          onClose={() => setCustomizing(false)}
        />
      )}
    </div>
  );
}
function CustomizeDialog({
  colors,
  setColors,
  theme,
  layout,
  move,
  reset,
  onClose,
}: {
  colors: Colors;
  setColors: (colors: Colors) => void;
  theme: string;
  layout: Layout;
  move: (id: Card, direction: number) => void;
  reset: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const background = colors?.background ?? (theme === 'dark' ? '#242424' : '#eeeeec');
  const text = colors?.text ?? (theme === 'dark' ? '#f0f0ec' : '#242424');
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="customize-dialog"
      aria-labelledby="customize-title"
      onCancel={onClose}
    >
      <div className="customize-heading">
        <h2 id="customize-title">Make it yours.</h2>
        <button className="icon-button" aria-label="Close customization" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <p>Colors and layout are saved on this device.</p>
      <h3>Colors</h3>
      <div className="color-presets">
        {[
          ['Paper', '#eeeeec', '#242424'],
          ['Ink', '#242424', '#f0f0ec'],
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
        <button className="primary-button" onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  );
}
