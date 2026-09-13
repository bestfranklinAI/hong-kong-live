"""Prepare the reviewed LCSD discovery selection from a downloaded CSDI response.

Usage: python3 scripts/prepare-explore-parks.py /path/to/parks.json
The query URL is stored in the generated catalogue. No network requests are made.
"""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

names = '''Tung Chung North Park
Tsing Yi Park
North District Park
Kowloon Park
Ma On Shan Promenade
Yuen Long Park
Po Hong Park
Shek Kip Mei Park
Chai Wan Park
Ngau Chi Wan Park
Lai Chi Kok Park
Tuen Mun Park
Tin Shui Wai Park
Kai Tak Cruise Terminal Park
Nam Cheong Park
Shing Mun Valley Park
Quarry Bay Park
Hong Kong Velodrome Park
Tai Po Waterfront Park
Tamar Park
Sha Tin Park
Tsuen Wan Park
Tseung Kwan O Waterfront Park
Waterfall Bay Park
Ap Lei Chau Waterfront Promenade
Bowen Road Park
Sai Kung Waterfront Park
East Coast Park (Phase 1)
Jordan Valley Park
Cornwall Street Park
Lion Rock Park
Ma On Shan Park
Hong Kong Zoological & Botanical Gardens
Kowloon Walled City Park
Nan Lian Garden
Yuen Po Street Bird Garden'''.splitlines()
source_url = 'https://portal.csdi.gov.hk/server/rest/services/common/lcsd_rcd_1629267205215_19292/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=json'
reference = 'https://data.gov.hk/en-data/dataset/hk-lcsd-csdi-parks-zoos-gardens'
source = json.loads(Path(sys.argv[1]).read_text())
if source.get('exceededTransferLimit'):
    raise ValueError('Incomplete source response; do not publish a partial catalogue.')
records = [feature['attributes'] for feature in source['features']]
places = []
for name in names:
    matches = [row for row in records if row['NameEN'] == name]
    if len(matches) != 1:
        raise ValueError(f'Expected one exact source match: {name}')
    row = matches[0]
    lng, lat = row['LONGITUDE'], row['LATITUDE']
    if not (113.8 < lng < 114.5 and 22.1 < lat < 22.6):
        raise ValueError(f'Invalid geographic coordinate: {name}')
    district = row['DistrictEN'].title().replace(' And ', ' & ')
    address = re.sub('<[^>]*>', '', row['AddressEN'] or '').strip()
    category = 'waterfront' if any(word in name for word in ['Waterfront', 'Promenade']) else 'park'
    places.append({
        'id': 'lcsd-' + re.sub('[^a-z0-9]+', '-', name.lower()).strip('-'),
        'name': name, 'nameZh': row['NameTC'], 'district': district,
        'category': category, 'lng': lng, 'lat': lat,
        'description': f'A public open space in {district}. ' + (f'Find it at {address}.' if address else ''),
        'tags': [row['DistrictTC'], address, row['AddressTC'] or '', 'LCSD', '康文署', '公園'],
        'source': {'name': 'Leisure and Cultural Services Department', 'url': reference},
        'sourceObjectId': row['OBJECTID'],
        'sourceUpdatedAt': datetime.fromtimestamp(row['LASTUPDATE'] / 1000, timezone.utc).isoformat(),
    })
output = {'sourceUrl': source_url, 'preparedAt': datetime.now(timezone.utc).isoformat(), 'places': places}
target = Path(__file__).resolve().parents[1] / 'apps/web/src/features/explore/parks.json'
target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(f'{len(places)} places across {len(set(p["district"] for p in places))} districts')
