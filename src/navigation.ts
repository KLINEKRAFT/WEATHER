import { useEffect, useRef, useState, type TouchEvent } from 'react';
export type View = 'today' | 'hourly' | 'daily' | 'radar' | 'settings';
const valid = (v: unknown): v is View =>
  ['today', 'hourly', 'daily', 'radar', 'settings'].includes(v as string);
export function useNavigation() {
  const [view, setView] = useState<View>('today');
  const [depth, setDepth] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    history.replaceState({ ...history.state, weatherView: 'today', weatherDepth: 0 }, '');
    const pop = (event: PopStateEvent) => {
      setView(valid(event.state?.weatherView) ? event.state.weatherView : 'today');
      setDepth(event.state?.weatherDepth ?? 0);
      window.scrollTo(0, 0);
    };
    addEventListener('popstate', pop);
    return () => removeEventListener('popstate', pop);
  }, []);
  function navigate(next: View) {
    if (next === view) return;
    history.pushState({ weatherView: next, weatherDepth: depth + 1 }, '');
    setDepth(depth + 1);
    setView(next);
    window.scrollTo(0, 0);
  }
  function back() {
    if (depth > 0) history.back();
  }
  return {
    view,
    navigate,
    back,
    canGoBack: depth > 0,
    swipeHandlers: {
      onTouchStart(e: TouchEvent) {
        const touch = e.touches[0];
        const target = e.target as HTMLElement;
        // Edge-only on interactive surfaces, so maps, sliders and forecast strips still pan.
        const interactive = target.closest(
          'input, button:not(.swipe-edge), dialog, .hourly-scroll, .hour-canvas-scroll, .leaflet-container',
        );
        start.current =
          e.touches.length === 1 && (!interactive || touch.clientX < 20)
            ? { x: touch.clientX, y: touch.clientY }
            : null;
      },
      onTouchEnd(e: TouchEvent) {
        const touch = e.changedTouches[0],
          first = start.current;
        start.current = null;
        if (first && touch.clientX - first.x > 85 && Math.abs(touch.clientY - first.y) < 55) back();
      },
      onTouchCancel() {
        start.current = null;
      },
    },
  };
}
