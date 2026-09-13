import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Wind, ArrowUpRight, RefreshCw } from 'lucide-react';
import { windyLayers, windyUrl, type WindyLayer } from './windy';

export function WindyWeather({
  onObservations,
  controlsHost,
}: {
  onObservations: () => void;
  controlsHost?: HTMLElement | null;
}) {
  const [layer, setLayer] = useState<WindyLayer>('wind');
  const [detail, setDetail] = useState(false);
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const src = windyUrl(layer, detail);
  const label = windyLayers.find((l) => l.id === layer)!.label;
  const groups = [...new Set(windyLayers.map((l) => l.group))];
  const controls = (
    <>
      <div className="windy-toolbar">
        <div className="windy-heading">
          <Wind size={24} />
          <div>
            <span className="eyebrow">HONG KONG · WEATHER</span>
            <h1>A little change in the air.</h1>
          </div>
        </div>
        <div className="windy-actions">
          <label className="windy-layer" htmlFor="windy-layer">
            Weather layer
            <select
              id="windy-layer"
              value={layer}
              onChange={(e) => {
                setLayer(e.target.value as WindyLayer);
                setLoaded(false);
              }}
            >
              {groups.map((group) => (
                <optgroup label={group} key={group}>
                  {windyLayers
                    .filter((l) => l.group === group)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button className="windy-hko" onClick={onObservations}>
            HKO observations <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
      <div className="windy-options">
        <span>Windy · {label}</span>
        <label>
          <input
            type="checkbox"
            checked={detail}
            onChange={(e) => {
              setDetail(e.target.checked);
              setLoaded(false);
            }}
          />{' '}
          Spot forecast
        </label>
        <button
          className="text-button"
          onClick={() => {
            setReload((v) => v + 1);
            setLoaded(false);
          }}
        >
          <RefreshCw size={13} /> Reset to Hong Kong
        </button>
      </div>
    </>
  );
  return (
    <section className="windy-weather" aria-label="Windy weather map">
      {controlsHost === undefined
        ? controls
        : controlsHost
          ? createPortal(controls, controlsHost)
          : null}
      <div className="windy-frame">
        {!loaded && (
          <p className="windy-loading" role="status">
            Opening Windy…
          </p>
        )}
        <iframe
          key={`${src}-${reload}`}
          src={src}
          title={`Windy Hong Kong — ${label}`}
          onLoad={() => setLoaded(true)}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <div className="windy-footer">
        <span>
          Forecasts and imagery via Windy. Use HKO observations for local station readings. Changing
          layers resets the map to Hong Kong.
        </span>
        <a href={src} target="_blank" rel="noreferrer">
          Open Windy ↗
        </a>
      </div>
    </section>
  );
}
