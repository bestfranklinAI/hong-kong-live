"""Join OSM relation 4432666, rejecting gaps; source is downloaded separately."""
import json
from pathlib import Path
from datetime import datetime, timezone
root = Path(__file__).resolve().parents[1]
source = json.loads((root / 'output/mtr-motion/island-line.json').read_text())
objects = {(e['type'], e['id']): e for e in source['elements']}
relation = objects['relation', 4432666]
ways = [objects['way', m['ref']]['nodes'] for m in relation['members'] if m['type'] == 'way' and m['role'] == '']
path = list(ways[0])
for way in ways[1:]:
    if path[-1] == way[-1]: way = list(reversed(way))
    assert path[-1] == way[0], 'Broken railway alignment'
    path.extend(way[1:])
stops = {}
for member in relation['members']:
    if member['role'] == 'stop':
        node = objects['node', member['ref']]
        stops[node['tags']['ref']] = path.index(node['id'])
assert len(stops) == 17 and list(stops.values()) == sorted(stops.values())
result = {'source': 'https://www.openstreetmap.org/relation/4432666', 'license': 'ODbL-1.0', 'retrievedAt': datetime.now(timezone.utc).isoformat(), 'stations': stops, 'coordinates': [[objects['node', n]['lon'], objects['node', n]['lat']] for n in path]}
target = root / 'apps/web/src/features/trains/island-line.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(result))
print(len(path), 'track vertices;', len(stops), 'stations')
