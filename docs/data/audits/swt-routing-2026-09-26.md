# Sung Wong Toi route consistency audit — 26 September 2026

This checks live API integration and source consistency. It does not establish that the journeys are physically passable, wheelchair suitable today, or accessible without a ticket. No personal location was used.

## Results

Three sequential requests used the current official station point catalogue and the application's barrier-free profile. The API re-resolved each venue/point identifier before routing.

| Journey | Source distance | Source time | Lift instructions | Endpoint XY offsets |
| --- | ---: | ---: | ---: | --- |
| Concourse Exit A → Platform 1 | 123.4 m | 2.06 min | 1 | 0 m / 0 m |
| Platform 1 → Exit A Ground Level | 160.6 m | 2.68 min | 2 | 0 m / 0 m |
| Exit A Ground Level → Platform 1 | 160.6 m | 2.68 min | 2 | 0 m / 0 m |

Returned source heights agree with the chosen levels: concourse −3.53, platform −9.9 and ground 7.1. These values remain raw source Z, not independently verified ellipsoid heights. Zero endpoint offsets do not validate every intermediate link. The ground/platform pair has the same estimated length in each direction, but its instructions differ; never reverse an instruction list to manufacture a return journey.

Machine-readable requests, times and results: [audit evidence](swt-routing-2026-09-26.json). The raw platform-to-ground response and request are preserved in `fixtures/providers/landsd-route-swt-platform-ground-2026-09-26.json`. This is audit evidence, not a live-data substitute.

## Route-to-floor findings

The current raw response contains `messages`, `checksum`, `routes` and `directions`. Direction features expose `attributes`, `compressedGeometry` and optional `strings`. Their attributes are `ETA`, `arriveTimeUTC`, `length`, `maneuverType`, `text` and `time`; observed string entries are `esriDSTStreetName`. No explicit venue ID, level ID or unit ID was observed per step.

The route service metadata reports network sources `merged_PedRoute_line1` (edge source 1) and `NetworkDataset_Indoor_Outdoor_Junctions` (junction source 2). These source identifiers do not establish a join from an individual returned instruction to the indoor floor catalogue. No automatic floor switching is enabled.

The metadata exposes `networkDataset.buildTime = 1783475226000`, corresponding to **8 July 2026, 01:47:06 UTC**. This is a network build timestamp, not the survey date or live status of a lift. The app's per-route `sourceUpdatedAt` remains unknown; substituting this build time there would change its meaning.

Sources: [official route API documentation](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-pedestrian-route-search), [route service metadata](https://mapapi.hkmapservice.gov.hk/PedRoute/NAServer/route?f=pjson).

## Next validation gates

1. Repeat the data audit for a complex interchange such as Admiralty, covering a route with multiple named platforms and ground entrances. This audit covers one station only.
2. Investigate documented segment geometry and source edge identifiers. A possible join needs venue, XY containment, source Z and ambiguity checks; labels or altitude alone cannot establish a floor.
3. Field-check both directions of the Sung Wong Toi journey: actual Exit A street entrance, signs, ticket barriers, each lift landing, opening/access restrictions and any detour. Record date and evidence for each check. All are currently **not checked**.
4. Verify vertical datum and height units before rendering routes at physical 3D heights. Continue using ground projection until then.
