import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, LocateFixed, MapPin, Search, Star, X } from 'lucide-react';
import { placeKey, searchPlaces, SUGGESTED } from './weather';
import type { Place } from './weather';

export default function SearchDialog({
  saved,
  onSelect,
  onClose,
  onLocate,
  locating,
}: {
  saved: Place[];
  onSelect: (p: Place) => void;
  onClose: () => void;
  onLocate: () => void;
  locating: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const searching = query.trim().length >= 2;
  const suggestions = [
    ...saved,
    ...SUGGESTED.filter((p) => !saved.some((s) => placeKey(s) === placeKey(p))),
  ];
  const places = searching ? results : suggestions;
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    input.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      el?.close();
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    setResults([]);
    setError('');
    setActive(0);
    if (!searching) {
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    const timer = setTimeout(() => {
      searchPlaces(query.trim(), controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) {
            setResults(data);
            setBusy(false);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setError('Search is unavailable. Try again, or choose a saved place.');
            setBusy(false);
          }
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, searching]);
  return (
    <dialog
      ref={dialog}
      className="search-dialog"
      aria-labelledby="search-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-content">
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">A CHANGE OF SCENERY</p>
            <h2 id="search-title">Where to?</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close search">
            <X size={20} />
          </button>
        </div>
        <div className="search-input">
          <Search size={21} />
          <input
            ref={input}
            value={query}
            placeholder="Search city or postal code"
            aria-label="Search city or postal code"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="place-results"
            aria-expanded={places.length > 0}
            aria-activedescendant={places[active] ? `place-${active}` : undefined}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, places.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              }
              if (e.key === 'Enter' && places[active]) {
                e.preventDefault();
                onSelect(places[active]);
              }
            }}
          />
          {query && (
            <button
              className="icon-button small"
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                input.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button className="locate-row" onClick={onLocate} disabled={locating}>
          <LocateFixed size={19} />
          <span>{locating ? 'Finding your location…' : 'Use my current location'}</span>
          <ArrowUpRight size={18} />
        </button>
        <p className="search-group-label">
          {searching
            ? 'SEARCH RESULTS'
            : saved.length
              ? 'YOUR PLACES & A FEW MORE'
              : 'EXPLORE A PLACE'}
        </p>
        <div role="status" className="search-feedback">
          {busy
            ? 'Looking for places…'
            : error
              ? error
              : searching && !places.length
                ? 'No places found. Try a nearby city or another spelling.'
                : ''}
        </div>
        <div id="place-results" role="listbox" aria-label="Places" className="place-results">
          {places.map((p, i) => (
            <button
              type="button"
              role="option"
              aria-selected={active === i}
              id={`place-${i}`}
              className={`place-result ${active === i ? 'selected' : ''}`}
              key={p.id}
              onClick={() => onSelect(p)}
              onMouseEnter={() => setActive(i)}
            >
              <span className="place-result-icon">
                {saved.some((s) => placeKey(s) === placeKey(p)) ? (
                  <Star size={19} />
                ) : (
                  <MapPin size={19} />
                )}
              </span>
              <span>
                <strong>{p.name}</strong>
                <small>{[p.region, p.country].filter(Boolean).join(', ')}</small>
              </span>
              <ArrowUpRight size={17} />
            </button>
          ))}
        </div>
        <p className="dialog-footnote">Your places stay on this device. No account needed.</p>
      </div>
    </dialog>
  );
}
