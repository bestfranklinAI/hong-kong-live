import { Compass, LocateFixed, Minus, Plus, Rotate3d } from 'lucide-react';
import type { SceneCommand } from '../scene/types';
import { IconButton } from '../shared/ui';

export function MapControls({ command }: { command: (type: SceneCommand['type']) => void }) {
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
    </div>
  );
}
