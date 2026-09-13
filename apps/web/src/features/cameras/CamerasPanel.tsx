import { useMemo, useState } from 'react';
import { Camera, Search } from 'lucide-react';
import type { TrafficCamera } from '@hk/contracts';
import type { useCameras } from './use-cameras';
import { CameraSnapshot } from './CameraSnapshot';

export function CamerasPanel({
  query,
  selected,
  onSelect,
}: {
  query: ReturnType<typeof useCameras>;
  selected: TrafficCamera | null;
  onSelect: (camera: TrafficCamera) => void;
}) {
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('');
  const cameras = query.data?.data;
  const districts = useMemo(() => [...new Set(cameras?.map((c) => c.district))].sort(), [cameras]);
  const matches = useMemo(
    () =>
      cameras?.filter(
        (c) =>
          (!district || c.district === district) &&
          `${c.name} ${c.district} ${c.id}`.toLowerCase().includes(search.toLowerCase().trim()),
      ) ?? [],
    [cameras, search, district],
  );
  return (
    <section className="cameras-panel" aria-label="Traffic cameras">
      <div className="panel-heading">
        <span className="eyebrow">A LOOK AT THE ROAD</span>
        <h1>Street level.</h1>
        <p>Select a map marker or find a camera below.</p>
      </div>
      {selected && <CameraSnapshot key={selected.id} camera={selected} />}
      <label className="camera-search">
        <Search size={17} />
        <input
          aria-label="Search traffic cameras"
          placeholder="Road, district or camera ID"
          maxLength={80}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <select
        className="station-select"
        aria-label="Camera district"
        value={district}
        onChange={(e) => setDistrict(e.target.value)}
      >
        <option value="">All districts</option>
        {districts.map((name) => (
          <option key={name}>{name}</option>
        ))}
      </select>
      <div className="results-heading">
        <h2>Traffic cameras</h2>
        <span>{matches.length} locations</span>
      </div>
      {query.isPending ? (
        <p role="status">Loading camera locations…</p>
      ) : !cameras ? (
        <div className="empty-state">
          <Camera size={25} />
          <h3>Locations unavailable</h3>
          <p>{query.data?.error || 'Please try again shortly.'}</p>
          <button className="text-button" onClick={() => void query.refetch()}>
            Retry catalogue
          </button>
        </div>
      ) : (
        <>
          {query.isError && (
            <p role="status">Location update failed; showing the cached catalogue.</p>
          )}
          <div className="camera-results">
            {matches.slice(0, 40).map((camera) => (
              <button
                key={camera.id}
                className={selected?.id === camera.id ? 'active' : ''}
                onClick={() => onSelect(camera)}
              >
                <Camera size={17} />
                <span>
                  <strong>{camera.name.replace(/ \[[^\]]+\]$/, '')}</strong>
                  <small>
                    {camera.district} · {camera.id}
                  </small>
                </span>
              </button>
            ))}
          </div>
          {!matches.length && <p>No matching cameras. Try another road or district.</p>}
          {matches.length > 40 && (
            <p className="catalog-note">
              Showing the first 40 matches. Search or choose a district to narrow the list. All
              catalogue locations remain on the map.
            </p>
          )}
        </>
      )}
      <a
        className="text-button"
        href="https://data.gov.hk/en-data/dataset/hk-td-tis_2-traffic-snapshot-images"
        target="_blank"
        rel="noreferrer"
      >
        Transport Department open data ↗
      </a>
    </section>
  );
}
