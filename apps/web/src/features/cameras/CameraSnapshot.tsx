import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { TrafficCamera } from '@hk/contracts';
import { hkSourceTime } from '../../shared/format';

/** Only the selected, visible card refreshes. Images stay on the provider; no archive or proxy. */
export function CameraSnapshot({ camera }: { camera: TrafficCamera }) {
  const host = useRef<HTMLElement>(null);
  const [request, setRequest] = useState(Date.now);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [visible, setVisible] = useState(false);
  const refresh = () => {
    setStatus('loading');
    setLoadedAt(null);
    setRequest(Date.now());
  };
  useEffect(() => {
    if (!host.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, 120_000);
    return () => clearInterval(timer);
  }, [visible]);
  useEffect(() => {
    if (status !== 'loading' || !visible) return;
    const timer = window.setTimeout(() => setStatus('error'), 20_000);
    return () => clearTimeout(timer);
  }, [request, status, visible]);
  return (
    <article ref={host} className="camera-preview" aria-label="Selected traffic camera">
      <span className="eyebrow">TRAFFIC SNAPSHOT · {camera.id}</span>
      <h2>{camera.name.replace(/ \[[^\]]+\]$/, '')}</h2>
      <p>
        {camera.district} · {camera.region}
      </p>
      <div className="camera-image">
        {visible && (
          <img
            key={request}
            src={`${camera.imageUrl}?t=${request}`}
            width="320"
            height="240"
            alt={`Traffic snapshot: ${camera.name}`}
            referrerPolicy="no-referrer"
            onLoad={() => {
              setStatus('loaded');
              setLoadedAt(new Date().toISOString());
            }}
            onError={() => setStatus('error')}
            style={{ visibility: status === 'loaded' ? 'visible' : 'hidden' }}
          />
        )}
        {status !== 'loaded' && (
          <span role="status">
            {status === 'error'
              ? 'Snapshot unavailable. Try refreshing or opening the source.'
              : 'Loading selected camera…'}
          </span>
        )}
      </div>
      <p className="camera-caption">
        Still image · normally updated every two minutes. The provider may display a “No Service”
        image.
      </p>
      <p className="camera-caption">
        Image loaded: {hkSourceTime(loadedAt)}.<br />
        Capture time is not supplied separately; check the image’s printed timestamp.
      </p>
      <div className="camera-preview-actions">
        <button className="text-button" onClick={refresh} disabled={status === 'loading'}>
          <RefreshCw size={14} />
          Refresh snapshot
        </button>
        <a className="text-button" href={camera.imageUrl} target="_blank" rel="noreferrer">
          Open original ↗
        </a>
      </div>
      <small>Image: Transport Department</small>
    </article>
  );
}
