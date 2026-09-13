import { Compass, LocateFixed, Minus, Plus, Rotate3d } from 'lucide-react';
import type { Quality } from '@hk/contracts';
import type { SceneCommand } from '../scene/types';
import { IconButton } from '../shared/ui';

export function MapControls({
  command,
  quality,
  onQuality,
}: {
  command: (type: SceneCommand['type']) => void;
  quality: Quality;
  onQuality: (quality: Quality) => void;
}) {
  return (
    <div className="map-controls" aria-label="Map controls">
      <div className="control-group">
        <IconButton label="Point map north" onClick={() => command('north')}>
          <Compass size={20} />
        </IconButton>
        <IconButton label="Reset map view" onClick={() => command('reset')}>
          <LocateFixed size={20} />
        </IconButton>
        <IconButton label="Tilt map" onClick={() => command('toggle-pitch')}>
          <Rotate3d size={20} />
        </IconButton>
      </div>
      <div className="control-group">
        <IconButton label="Zoom in" onClick={() => command('zoom-in')}>
          <Plus size={21} />
        </IconButton>
        <span className="control-divider" />
        <IconButton label="Zoom out" onClick={() => command('zoom-out')}>
          <Minus size={21} />
        </IconButton>
      </div>
      <label className="quality-control">
        <span className="sr-only">Map graphics quality</span>
        <select value={quality} onChange={(event) => onQuality(event.target.value as Quality)}>
          <option value="efficient">Eco</option>
          <option value="balanced">Std</option>
          <option value="detailed">High</option>
        </select>
      </label>
    </div>
  );
}
