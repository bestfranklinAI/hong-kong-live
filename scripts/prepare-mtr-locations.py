"""Prepare a reviewed station catalogue; requires pyproj==3.7.2 and curl.

Run with a cache directory argument. Existing responses are reused; requests are
sequential and spaced to respect LandsD's location-search service notice.
"""
import json
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlencode
from datetime import datetime, timezone
from pyproj import Transformer

root = Path(__file__).resolve().parents[1]
cache = Path(sys.argv[1])
cache.mkdir(parents=True, exist_ok=True)
network = json.loads((root / 'packages/contracts/src/mtr-network.json').read_text())
transform = Transformer.from_crs('EPSG:2326', 'EPSG:4326', always_xy=True)
base = 'https://www.map.gov.hk/gs/api/v1.0.0/locationSearch'

def fetch(query, key):
    path = cache / (key + '.json')
    if not path.exists():
        result = subprocess.run(
            [
                'curl', '--fail', '--silent', '--show-error',
                '--max-time', '30', '--retry', '2', '--retry-delay', '2',
                base + '?' + urlencode({'q': query}),
            ],
            capture_output=True,
            check=True,
        )
        data = json.loads(result.stdout)
        path.write_text(json.dumps(data, ensure_ascii=False))
        time.sleep(1)
    return json.loads(path.read_text())

shared = fetch('MTR Station', 'all')
locations = {}
missing = []
for code, station in network['stations'].items():
    expected = 'MTR ' + station['name'] + ' Station'
    def matches(rows):
        return [r for r in rows if r['nameEN'].casefold() == expected.casefold()]
    rows = matches(shared)
    if not rows:
        rows = matches(fetch(expected, code))
    if len(rows) != 1:
        missing.append(code)
        print('REVIEW', code, flush=True)
        continue
    row = rows[0]
    lng, lat = transform.transform(row['x'], row['y'])
    assert 113.8 < lng < 114.5 and 22.1 < lat < 22.6, code
    locations[code] = {
        'lng': round(lng, 6),
        'lat': round(lat, 6),
        'sourceName': row['nameEN'],
        'sourceNameZh': row['nameZH'],
        'easting': row['x'],
        'northing': row['y'],
    }
    print(code, flush=True)
if missing:
    raise SystemExit('Unresolved stations: ' + ', '.join(missing))
output = {
    'sourceUrl': base,
    'retrievedAt': datetime.now(timezone.utc).isoformat(),
    'sourceCrs': 'EPSG:2326',
    'outputCrs': 'EPSG:4326',
    'stations': locations,
}
(root / 'packages/contracts/src/mtr-locations.json').write_text(
    json.dumps(output, ensure_ascii=False, indent=2) + '\n'
)
