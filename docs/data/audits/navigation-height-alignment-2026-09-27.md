# Navigation height alignment — 27 September 2026

## Result

Height alignment is **not verified**. The current app does not render route elevations: `WalkingRouteLayer` discards Z for display and uses a constant 3 m ellipsoid height. Indoor floor outlines likewise remain projections. Showing city buildings alongside those paths would not make them aligned 3D navigation.

## Evidence checked this run

- Live `https://mapapi.hkmapservice.gov.hk/PedRoute/NAServer/route?f=pjson`: `hasZ: true`, `outputSpatialReference: {wkid: 4326}`. No vertical CRS or route Z-unit declaration was found. `snapToleranceUnits: esriMeters` describes snapping, not the Z reference; directions distance units also do not establish Z units.
- Fetched the configured authorised city tileset, without logging its key. Root asset version is 1.1; it contains a Cartesian bounding box, no root transform and no additional top-level metadata beyond asset, geometricError and root. A bounding volume locates content; it does not validate pedestrian surface or floor heights. Child mesh surfaces were not sampled and no numerical model-versus-route residual has been established.
- [Official CSDI API documentation](https://tools.csdi.gov.hk/csdi-webpage/apidoc/3d-visualisation-map-api) describes Cesium 3D Tiles based on WGS84. This does not document how the routing endpoint's Z values relate to the tile surface.
- [LandsD 3D mapping overview](https://www.landsd.gov.hk/en/survey-mapping/mapping/3d-mapping.html) describes integration of indoor mapping, visualisation and the pedestrian network. That establishes intended compatibility, not a verified conversion for these particular API outputs.

## Decision

Keep navigation and endpoint picking in 2D with an explicit explanation. A 3D contextual overview is technically possible, but accurate floor-aligned navigation is not ready to claim. Do not substitute mesh roof samples for bridge decks, tunnels or indoor floors, and do not introduce a guessed constant vertical offset.

To enable physical-height routes, obtain the route Z units/vertical reference, apply the documented conversion to WGS84 ellipsoidal height, then compare independent known ground and bridge control points across several areas. Record residuals, source dates and uncertainty; validate indoor levels separately. Underground and indoor visibility will additionally need deliberate cutaway or occluded-path styling.

## Endpoint experience

Users can choose FROM or TO, use current location, drag the map beneath a centre crosshair and confirm, or swap endpoints. GPS accuracy is displayed without assigning a floor. HTTPS/localhost and browser permission are required. Requests that become obsolete through endpoint changes or unmount are ignored. Choosing a pin does not certify a walkable entrance; existing routing snap-offset validation remains in force.

Browser check at 390 × 844 confirmed choosing both endpoints by dragging and confirming, and swapping their values. Real GPS acquisition and physical Android touch remain unverified.
