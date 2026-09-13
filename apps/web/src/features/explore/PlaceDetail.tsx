import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bookmark, Check, ExternalLink, MapPin, Share2, X } from 'lucide-react';
import type { Place } from '@hk/contracts';
import { categoryLabels } from './places';
import { IconButton, PlaceIcon } from '../../shared/ui';
import { usePreferences } from '../../app/preferences';

export function PlaceDetail({
  place,
  onClose,
  onTransit,
}: {
  place: Place;
  onClose: () => void;
  onTransit: () => void;
}) {
  const saved = usePreferences((state) => state.savedIds.includes(place.id));
  const toggleSaved = usePreferences((state) => state.toggleSaved);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'error'>('idle');
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!window.matchMedia('(max-width: 700px)').matches) return;
    const previous = document.activeElement;
    title.current?.focus({ preventScroll: true });
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, []);

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareState('copied');
    } catch {
      setShareState('error');
    }
  }

  return (
    <section className="detail-card" aria-label={`Selected place: ${place.name}`}>
      <div className="detail-top">
        <span className="detail-category">
          <PlaceIcon category={place.category} size={16} />
          {categoryLabels[place.category]}
        </span>
        <IconButton label="Close place details" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <h2 ref={title} tabIndex={-1}>
        {place.name}
      </h2>
      <p className="chinese-name">{place.nameZh}</p>
      <p className="detail-description">{place.description}</p>
      <div className="detail-location">
        <MapPin size={15} />
        <span>{place.district}</span>
      </div>
      <div className="detail-actions">
        <button
          className={`primary-button ${saved ? 'saved' : ''}`}
          onClick={() => toggleSaved(place.id)}
          aria-pressed={saved}
        >
          <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
          {saved ? 'Place saved' : 'Save this place'}
        </button>
        <IconButton
          label={shareState === 'copied' ? 'Link copied' : 'Copy link to this view'}
          onClick={() => void share()}
        >
          {shareState === 'copied' ? <Check size={19} /> : <Share2 size={18} />}
        </IconButton>
        {place.station && (
          <IconButton label="Show MTR departures" onClick={onTransit}>
            <ArrowUpRight size={20} />
          </IconButton>
        )}
      </div>
      {shareState !== 'idle' && (
        <p className="share-feedback" role="status">
          {shareState === 'copied'
            ? 'Link copied. Share a little discovery.'
            : 'Copy the address from your browser to share this view.'}
        </p>
      )}
      <a className="detail-source" href={place.source.url} target="_blank" rel="noreferrer">
        More from {place.source.name}
        <ExternalLink size={12} />
      </a>
    </section>
  );
}
