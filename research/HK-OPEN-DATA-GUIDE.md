# Hong Kong open data: a project discovery guide

Research date: **13 September 2026** · Intended use: brainstorming a visually engaging web app for desktop and mobile.

**My recommendation: start with a “Hong Kong Live Atlas”.** Let people explore one district in 3D, tap a place, and see nearby transport, weather and interesting public places. Give the first version one clear activity—exploring a neighbourhood—then choose whether to deepen it into walking, outdoor planning or city analysis.

This is a curated guide to promising dataset families, not an exhaustive inventory. Official catalogue entries and documentation underpin the availability claims. Eight endpoints received a one-request HTTP check; the rest are documentation-verified, not integration-tested. Product ideas and difficulty assessments below are my recommendations.

## Contents

- [Where the data lives](#where-the-data-lives)
- [The 3D opportunity](#the-3d-opportunity)
- [Transport and mobility](#transport-and-mobility)
- [Weather and environment](#weather-and-environment)
- [Places, nature and culture](#places-nature-and-culture)
- [People, housing, health and the economy](#people-housing-health-and-the-economy)
- [How to access the data](#how-to-access-the-data)
- [What the endpoint checks found](#what-the-endpoint-checks-found)
- [Project ideas and scope](#project-ideas-and-scope)
- [A practical first build](#a-practical-first-build)

## Where the data lives

| Source | What to use it for | How to get data |
|---|---|---|
| [DATA.GOV.HK](https://data.gov.hk/en/) | Discover datasets across government departments and participating organisations | Open a dataset, read its dictionary and update notes, then use the individual resource's download/API URL. The catalogue page itself is usually not the data endpoint. |
| [CSDI Portal](https://portal.csdi.gov.hk/) | Buildings, boundaries, networks, facilities and other geographic layers | Dataset downloads plus WFS, WMS and ArcGIS REST services, where available. Use the Dataset API Explorer to build requests. |
| [Lands Department open geospatial data](https://www.landsd.gov.hk/en/spatial-data/open-data.html) | Understand the official mapping products and find their CSDI records | Product downloads and dedicated map APIs; authentication differs by service. |
| [HKO open data directory](https://www.weather.gov.hk/en/abouthko/opendata_intro.htm) | Observations, forecasts, warnings, rain, tides and climate history | JSON APIs and downloadable CSV/XML resources; different products have different update schedules. |
| [HKMA API documentation](https://apidocs.hkma.gov.hk/abouthkmasapi/) | Financial and monetary statistics | Free API access without registration; endpoint-specific documentation and examples. |
| [C&SD web tables](https://www.censtatd.gov.hk/en/web_table.html?id=710-86101) | Statistical time series and custom tables | Select a table and dimensions, then use its generated API example or CSV/XLSX/XML/SDMX export. |

DATA.GOV.HK also supports historical file retrieval and API builders. An archived file is a previous version of a resource: check its actual archive coverage before promising a historical replay. See the official [user guide](https://data.gov.hk/en/user-guide) and [FAQ](https://data.gov.hk/en/faq).

## The 3D opportunity

The “3D scan” you have seen may be **Open3Dhk**, the Lands Department viewer. The official tile-based visualisation models are meshes reconstructed from oblique aerial photographs. That is a different product from raw LiDAR point clouds or a street-level scan. Hong Kong's territory-wide 3D Digital Map was fully launched in March 2025. [Official 3D mapping overview](https://www.landsd.gov.hk/en/survey-mapping/mapping/3d-mapping.html)

| Dataset/service | What you get | Access | What it enables |
|---|---|---|---|
| **3D Visualisation Map, tile-based models** | Textured mesh for visually realistic city exploration | Stream Cesium 3D Tiles in WGS84 through the [3D Visualisation Map API](https://tools.csdi.gov.hk/csdi-webpage/apidoc/3d-visualisation-map-api); CSDI downloads also exist | Fly over Victoria Harbour, explore hills and buildings, overlay live information |
| **3D Spatial Data API** | Building and infrastructure model tilesets | [3D Spatial Data API](https://tools.csdi.gov.hk/csdi-webpage/apidoc/3d-spatial-data-api), also 3D Tiles/WGS84 | A structured city model foundation; inspect available attributes before assuming buildings can be joined to external records |
| **Individualised / non-textured visualisation models** | Alternative 3D representations listed alongside the mesh product | Search the exact product names in CSDI; inspect each download specification | Candidate for stylised buildings and thematic colouring; conversion and attribute availability need a sample check |
| **3D Pedestrian Network** | 3D line features with street-related attributes, wheelchair accessibility and obstacles | [Dataset](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-3d-pedestrian-network): JSON, GML and FGDB; quarterly updates | Show the vertical structure of walking routes and analyse access to facilities |
| **3D pedestrian route search** | Point-to-point walking routes across supported indoor/outdoor networks | [Route API documentation](https://hosting.csdi.gov.hk/csdi-webpage/apidoc/3d-pedestrian-route-search) | Prototype routing without building your own solver first |
| **3D indoor maps** | Indoor geographic information for covered venues | Products described in the [3D mapping overview](https://www.landsd.gov.hk/en/survey-mapping/mapping/3d-mapping.html); check venue coverage in CSDI | Floor-aware exploration around selected stations/buildings |

### How to obtain the 3D streaming service

Both 3D streaming API pages say to request a **free API key from `3dmap@landsd.gov.hk`**. No request was sent during this research. Example URL shapes are:

```text
https://data.map.gov.hk/api/3d-data/3dtiles/f2/tileset.json?key=YOUR_KEY

https://data.map.gov.hk/api/3d-data/3dsd/WGS84/building/tileset.json?key=YOUR_KEY
https://data.map.gov.hk/api/3d-data/3dsd/WGS84/infrastructure/tileset.json?key=YOUR_KEY
```

The documentation states shared-service limits of **5 GB/sec bandwidth and 100 concurrent users**, together with a fair-usage policy. Treat those as published service constraints, not a private allocation or a scalability guarantee. Clarify the intended application usage when requesting the key. [Spatial API access and limits](https://tools.csdi.gov.hk/csdi-webpage/apidoc/3d-spatial-data-api)

### What changes the project scope

- **A textured mesh is excellent scenery, but does not automatically provide a selectable database record for every visible building.** Plan a separate footprint/point layer for interactions unless the chosen model proves to have the attributes you need.
- **3D network data is not live lift-status data.** A mapped accessible connection may still be unavailable on a particular day. Validate routing and vertical alignment locally before making accessibility promises.
- **Open visualisation products and paid mapping products coexist.** The Lands Department page also describes paid legacy formats and mobile mapping services. Verify the exact product, rather than treating everything shown by a public viewer as freely downloadable raw survey data.
- **Streaming is the right first experiment.** Test one small area at different levels of detail on a phone before considering large offline model downloads.

The first two points are implementation implications of the published product descriptions; they are not claims that every available model lacks attributes or that every route is unreliable.

## Transport and mobility

| Dataset | Contents / published cadence | Source and access | Best visual use / limitation |
|---|---|---|---|
| **KMB + Long Win ETA** | Routes, stops, stop sequences and arrivals; ETA every minute, other data daily | [Official dataset and specifications](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb); REST JSON | Nearby departures and route cards. Treat service type and direction as part of route identity. |
| **Citybus ETA** | Routes, stops and arrivals; ETA every minute | [Official dataset](https://data.gov.hk/en-data/dataset/ctb-eta-transport-realtime-eta); JSON APIs | Same experience for Hong Kong Island and other served areas; use current API documentation rather than an old NWFB integration. |
| **New Lantao Bus** | Route, stop and live arrival information | [Second-generation dataset](https://data.gov.hk/en-data/dataset/nlb-bus-nlb-bus-service-v2); API resources and dictionary on the page | Especially useful for Lantau outing ideas. |
| **Citybus/NLB stop aggregation** | Routes and ETA at a specific stop; ETA within one minute | [DPO aggregation API](https://data.gov.hk/en-data/dataset/hk-dpo-datagovhk1-transport-bus-route-list-and-eta-spcific-bus-stop); JSON | Simplifies a “tap a stop, see all departures” experience. |
| **Green minibuses** | Route/stop information and upcoming arrivals; ETA every minute | [GMB dataset](https://data.gov.hk/en-data/dataset/hk-td-sm_7-real-time-arrival-data-of-gmb); JSON | Strong local value beyond rail and franchised buses. A GMB feed is not evidence of equivalent red-minibus coverage. |
| **MTR Next Train** | Up to four upcoming trains; catalogue says every 10 seconds, covering ten named heavy-rail lines | [Current dataset](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data); JSON | Station departures, destinations and platforms. Arrival data alone does not establish precise train positions. |
| **Light Rail** | Upcoming trains at Light Rail stops | [Light Rail dataset](https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data); separate JSON API | A Tuen Mun / Yuen Long transit view; use its own stop and platform model. |
| **Traffic speed, volume and occupancy** | Detector data every minute; processed road-segment speeds every two minutes | [Strategic / major roads dataset](https://data.gov.hk/en-data/dataset/hk-td-sm_4-traffic-data-strategic-major-roads); XML feeds and CSV geometry/locations | Colour road segments by measured conditions; coverage is strategic/major roads. |
| **Road network and traffic incidents** | Road geometry and special traffic news | [Road Network v2](https://data.gov.hk/en-data/dataset/hk-td-tis_15-road-network-v2), [Special Traffic News v2](https://data.gov.hk/en-data/dataset/hk-td-tis_19-special-traffic-news-v2) | Geometry joins and disruption overlays; use dictionaries to match IDs. These catalogue destinations are linked by the legacy traffic page, not separately endpoint-tested here. |
| **Traffic CCTV snapshots** | JPEG stills, typically 320 × 240, every two minutes; location metadata available | [Snapshot dataset](https://data.gov.hk/en-data/dataset/hk-td-tis_2-traffic-snapshot-images); JPEG or base64 XML | Tap a camera on the map. These are refreshed stills, not live video streams. |
| **Parking information and vacancy** | Participating car parks, locations, fees/hours/restrictions and vacancy timestamps | [One-stop API specification](https://resource.data.one.gov.hk/opendata/carpark/Parking_Vacancy_Data_Specification.pdf); unauthenticated JSON GET | Availability markers and car-park detail cards. Coverage and freshness vary by operator. |
| **Cross-boundary ferries** | Arrival schedules for China Ferry Terminal and Hong Kong–Macao Ferry Terminal; every five minutes | [Marine Department dataset](https://data.gov.hk/en-data/dataset/hk-md-mardep-crossboundaryferryservices-arrive/resource/22679fe9-d9c4-4a62-8f01-af23bc2b0434); CSV | Harbour departures/arrivals context; this does not provide the position of every vessel. |

**Route geometry deserves separate work.** Stop lists give a sequence of points, which may not trace the road correctly. Obtain the corresponding route geometry where published—GMB, for example, has a linked [CSDI route layer](https://data.gov.hk/en-data/dataset/hk-td-sm_7-real-time-arrival-data-of-gmb/resource/3b1e2d12-548e-4942-a940-13012a9aab45)—and verify route/direction identifiers before joining it to ETA.

**Avoid the legacy speed-map endpoint.** Its catalogue warns that it has migrated to a second generation and will be removed. The older City Dashboard speed dataset is also described there as no longer updated. Start with the current road/traffic datasets above. [Migration notice](https://data.gov.hk/en-data/dataset/hk-td-sm_1-traffic-speed-map)

If you animate trains or buses from ETA, mark the movement as an **estimated visualisation**, unless an actual vehicle-location feed independently supports it.

## Weather and environment

| Dataset | Contents / cadence | Source and access | Visual opportunity |
|---|---|---|---|
| **Current weather, forecasts and warnings** | Weather report, local and nine-day forecast, warning summary/details and special tips | [HKO API documentation](https://www.hko.gov.hk/en/weatherAPI/doc/files/HKO_Open_Data_API_Documentation.pdf); JSON GET with `dataType` and language | A city condition panel with source-issued warning cards |
| **Regional observations** | Temperature, humidity, wind, visibility and other station measurements; many regional feeds update every ten minutes | [HKO directory](https://www.weather.gov.hk/en/abouthko/opendata_intro.htm); dataset-specific resources | Station markers, wind arrows and comparisons between districts |
| **Gridded rainfall nowcast** | Half-hour rainfall forecasts through the next two hours; refresh every 12 minutes | [Dataset and dictionary](https://data.gov.hk/en-data/dataset/hk-hko-rss-gridded-rainfall-nowcast-in-hong-kong); CSV plus spatial-data access | A time slider showing the next forecast periods across Hong Kong |
| **Past-hour station rainfall** | Observed rain accumulated over the past hour; refresh every 15 minutes | HKO directory and API documentation above | Compare what has fallen with what is forecast; preserve different observation windows |
| **Tides, heat, UV and tropical cyclones** | Latest tides, heat indices, UV and cyclone products; each has its own timing and coverage | HKO directory above | Waterfront / outdoor context and cyclone-track exploration; inspect each product before integrating |
| **AQHI by monitoring station and forecast** | Hourly index; forecasts at specified times and as required | [EPD station dataset](https://data.gov.hk/en-data/dataset/hk-epd-airteam-current-aqhi-of-individual-air-quality-monitoring-stations), [DPO JSON/CSV/XML version](https://data.gov.hk/en-data/dataset/hk-dpo-datagovhk2-city-dashboard-aqhi) | Station risk markers and a forecast card |
| **Beach water quality grades** | Published beach grades; monitoring updates rather than continuous sensor readings | [Current grading](https://data.gov.hk/en-data/dataset/hk-epd-beachteam-beach-water-quality-grading); resource feeds/spatial access | Beach comparison with date of grading |
| **Historical beach water quality** | Annual files covering 1986–2025 in the current catalogue | [Historical dataset](https://data.gov.hk/en-data/dataset/hk-epd-beachteam-beach-historical-data-en); CSV and spatial access | Long-term beach trend charts and a historical map |

**A useful distinction:** station temperature and AQHI values are measurements at stations; they are not a measured value for every street. Any continuous heatmap you derive should identify its interpolation method. The rainfall nowcast is already a gridded forecast, but still needs its issue time, forecast period and units preserved.

**An endpoint migration to know:** the AQHI City Dashboard dataset says its base path moved to `static.data.gov.hk/opendata/dataset` on 15 July 2026. Copy current resource links instead of using older tutorials. [AQHI migration notice](https://data.gov.hk/en-data/dataset/hk-dpo-datagovhk2-city-dashboard-aqhi)

## Places, nature and culture

These often make a first project easier: download a modest set of points or paths, add good discovery interactions, then introduce a live layer.

| Dataset | Access and update character | What users could do |
|---|---|---|
| **Hiking trails in country parks** | [AFCD dataset](https://data.gov.hk/en-data/dataset/hk-afcd-afcdlist-hikingtrailscp), linked CSDI API; inspect geometry and revision metadata | Explore trails on terrain and preview the route |
| **Trail distance posts** | [AFCD CSV](https://data.gov.hk/en-data/dataset/hk-afcd-afcdlist-distance-trails/resource/d2af79ce-0235-4991-9f02-3ba02ffbf963) | Show trail checkpoints and named locations; keep the original grid reference |
| **Country park water stations** | [AFCD dataset](https://data.gov.hk/en-data/dataset/hk-afcd-afcdlist-water-dispenser), downloadable facility records | Find a refill stop while planning an outing; listing does not prove current operability |
| **Public toilets, markets and refuse points** | [FEHD facilities](https://data.gov.hk/en-data/dataset/hk-fehd-fehdlocatn-fehd-facility-and-service-locations/resource/161df8ea-b91a-46bf-b703-817a1aadbdcb); XML with coordinates, hours and contact details, updated as necessary | Practical nearby facilities and market discovery |
| **Old and Valuable Trees / Stonewall Trees** | [Development Bureau dataset](https://data.gov.hk/en-data/dataset/hk-devb-ovt-ovt-and-stonewall); CSDI API, half-yearly updates | A tree discovery trail with individual point cards; this is not a complete canopy map |
| **Declared monuments with images** | [Antiquities and Monuments data](https://data.gov.hk/en-data/dataset/hk-devb-amo-declared-monuments-with-image); CSDI API, names, addresses, declaration years and photos | A heritage walk with photo/story cards; declaration year is not construction year |
| **Recreation and sports facilities** | [LCSD spatial facilities](https://data.gov.hk/en-data/dataset/hk-lcsd-csdi-other-recreation-facilities) and [venue usage data](https://data.gov.hk/en-data/dataset/hk-lcsd-facility-usage-facilities) | Find facilities or compare published usage; do not infer real-time booking slots from usage statistics |
| **EV charging stations** | [CLP dataset](https://data.gov.hk/en-data/dataset/clp-team1-electric-vehicle-charging-stations); JSON, updates as necessary | Charger discovery. This specific listing does not establish all-operator live availability |
| **Cultural events** | [Mega ACE events](https://data.gov.hk/en-data/dataset/hk-cstb-cstbdiv013-mega-ace-fund-events), CSV and CSDI; [URBTIX events](https://data.gov.hk/en-data/dataset/hk-lcsd-event-urbtix-event/resource/dd8cb3ab-4635-4fd1-8d8a-e5cea3bca2ef), date-based XML batch resource | A map/calendar for selected event sources; check date windows and venue joins |

For public Wi-Fi, the [OFCA directory](https://www.ofca.gov.hk/en/news_info/data_statistics/internet/wifi/index.html) links to access-point locations. Treat it as a discovery lead here: its machine-readable location resource was not traced or tested in this pass, and hotspot presence alone does not establish free access or current connectivity.

## People, housing, health and the economy

| Dataset family | Source and access | What it can support / boundary |
|---|---|---|
| **Population, income, households, education and housing characteristics** | [2021 Census district statistics and boundaries](https://data.gov.hk/en-data/dataset/hk-censtatd-census_geo-2021-population-census-by-dcd); CSV, XLSX and CSDI | District choropleths and comparison cards. These are 2021 observations, not 2026 population estimates. |
| **Subdivided-unit statistics** | [Census subdivided-unit dataset](https://data.gov.hk/en-data/dataset/hk-censtatd-census_geo-2021-population-census-su-by-dcd); CSV/XLSX/spatial links | Housing patterns at the published geographic level; avoid assigning district averages to individual buildings. |
| **Economic, employment and trade tables** | C&SD table selection and its [API interface](https://www.censtatd.gov.hk/en/web_table.html?id=710-86101) | Retrieve the chosen table by dimensions, period and language; exact trade/employment table IDs still need selection for your chosen question. |
| **Property prices, rents, stock and vacancy** | [RVD property market statistics](https://data.gov.hk/en-data/dataset/hk-rvd-tsinfo_rvd-property-market-statistics); CSV/XLS resources, many monthly series and some annual measures | Property-cycle charts. Aggregate indices are not a transaction-level valuation for every apartment. |
| **Land utilisation** | [Planning Department statistics](https://data.gov.hk/en-data/dataset/hk-pland-pland1-land-utilization-in-hong-kong-statistics/resource/65911e9d-b5d3-4404-b5aa-7378bc4229b0); annual CSV | Broad land-use comparisons. The provider says this product is not intended for detailed calculations and methods may change between years; it is not parcel zoning. |
| **HKMA monetary and banking statistics** | [HKMA market-data API index](https://apidocs.hkma.gov.hk/documentation/market-data-and-statistics/); JSON | Exchange rates, monetary conditions and linked financial time-series views; choose the frequency and series definition carefully. |
| **A&E waiting times** | [Hospital Authority dataset](https://data.gov.hk/en-data/dataset/hospital-hadata-ae-waiting-time); JSON, every 15 minutes | Display provider-defined hospital/triage statistics. Schema and URLs changed on 13 October 2025; use the revised resource. |
| **Company register information** | [Companies Registry search FAQ](https://www.cr.gov.hk/en/electronic/e-servicesportal/faq/e-search.htm) | Public company search exists, but paid search products also exist. This research does not establish a free bulk API for the complete register. |

Your initial healthcare category needs narrowing: **HA A&E waiting-time data is confirmed; an all-provider private/public clinic queue feed and a universal live bed-availability feed were not established here.** Build around a named, documented resource rather than those broader assumptions.

For census maps, keep the observation year and boundary version together. For comparisons across datasets, match both geographic definitions and time periods before calculating a ratio.

## How to access the data

### 1. Simple JSON endpoints

These are concrete GET requests used in the checks. Clicking them should expose raw data, subject to current service availability.

| Purpose | Example request |
|---|---|
| Current weather | [HKO current report](https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en) |
| KMB/LWB routes | [KMB route list](https://data.etabus.gov.hk/v1/transport/kmb/route/) |
| MTR arrival sample | [Tseung Kwan O / TKL](https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=TKL&sta=TKO) |
| Parking vacancy | [Participating car parks](https://api.data.gov.hk/v1/carpark-info-vacancy?data=vacancy&vehicleTypes=privateCar) |
| A&E waiting times | [Revised HA feed](https://www.ha.org.hk/opendata/aed/aedwtdata2-en.json) |
| Daily exchange-rate dataset | [HKMA daily figures](https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily) |

For HKO, documented `dataType` values include `rhrread` (current report), `fnd` (nine-day forecast), `flw` (local forecast), `warnsum`, `warningInfo` and `swt`. Languages include `en`, `tc` and `sc`. [HKO specification](https://www.hko.gov.hk/en/weatherAPI/doc/files/HKO_Open_Data_API_Documentation.pdf)

For parking, request basic information with `data=info` and vacancy with `data=vacancy`, then join on car-park identifiers. The specification includes vehicle type, car-park IDs and extent filters. Preserve vacancy type and each record's timestamp. [Parking specification](https://resource.data.one.gov.hk/opendata/carpark/Parking_Vacancy_Data_Specification.pdf)

HKMA's daily exchange-rate dictionary expresses currency values as **HKD per unit of foreign currency**. Interpret units from the dictionary, rather than guessing from the field name. Pagination and query controls need checking before using the default response as a complete or latest history. [Exchange-rate documentation](https://apidocs.hkma.gov.hk/documentation/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily/)

### 2. Geographic layers through CSDI

Open the dataset and choose its API under “Other Resources and Services”.

- **WFS / ArcGIS REST:** retrieve features and attributes for clickable points, paths and polygons.
- **WMS:** request a rendered map image; useful for display, but not a substitute for feature geometry in analysis.
- **Bulk downloads:** useful for static layers that you can prepare once.

Prefer GeoJSON in WGS84 where offered. A typical ArcGIS feature query uses `where=...`, `outFields=...`, `outSR=4326` and `f=geojson`. Query the visible extent, select the fields needed, and handle pagination/transfer limits. [CSDI service documentation and examples](https://portal.csdi.gov.hk/csdi-webpage/doc/GeoSpatialServices)

HK datasets may use **HK1980 Grid, EPSG:2326**, rather than longitude/latitude. Confirm coordinate system, axis order and height reference when combining layers. Requesting 4326 output avoids some conversion work; it does not resolve every vertical-datum issue.

### 3. Address and place lookup

The [Lands Department Location Search API](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-location-search-api) searches addresses, buildings, places and facilities. The [Address Lookup Service](https://data.gov.hk/en-data/dataset/hk-dpo-als_01-als?id=810) provides structured Chinese/English addresses through JSON/XML, with GeoAddress variants.

Use place search for map navigation and structured address lookup for address normalisation. Inspect candidates and matching fields: a result can represent a complex, not the precise entrance or apartment. Direct address endpoints were not tested here.

### 4. Reuse and service conditions

DATA.GOV.HK says the Government does not charge fees or royalties for commercial/non-commercial reuse. Keep the provider and resource-specific conditions with your dataset record. [Portal FAQ](https://data.gov.hk/en/faq)

The 3D streaming documentation permits reuse with source/IP acknowledgement and its other conditions. LandsD Map APIs also specify a logo on the map face and copyright notices. Include attribution in the map design from the start. [3D API terms](https://tools.csdi.gov.hk/csdi-webpage/apidoc/3d-visualisation-map-api), [Map API attribution notice](https://hosting.csdi.gov.hk/csdi-webpage/apidoc/3d-pedestrian-route-search)

Free data still leaves your own hosting, processing and delivery costs. No paid service, key registration or deployment was initiated for this guide.

## What the endpoint checks found

One GET per endpoint, following redirects, with response parsing. Checked on 13 September 2026 around 13:10 HKT. Full request URLs and selected response headers are recorded in [endpoint-checks.json](endpoint-checks.json).

| Endpoint | Result | Practical implication |
|---|---|---|
| HKO current report | HTTP 200, JSON, `Access-Control-Allow-Origin: *`; observation update on the research date | Straightforward candidate for a first live card |
| KMB route list | HTTP 200, JSON, wildcard CORS; current generated timestamp | Good bootstrap metadata; this test does not validate ETA accuracy |
| MTR TKL/TKO | HTTP 200, JSON, wildcard CORS; schedule timestamps on the research date | A usable sample station response |
| Parking vacancy | HTTP 200, JSON, wildcard CORS; 570 result records | Some records were current while the first had a 7 September timestamp; stale-data handling is essential |
| HA waiting times | HTTP 200, JSON, wildcard CORS; revised triage fields and update at 13:00 | Avoid parsers built for the old schema |
| HKMA exchange rates | HTTP 200, JSON; success flag; origin allowed | Default response contained 100 records and began at 31 August 2026; latest-day coverage/order was not verified |
| CSDI sample place layer | HTTP 200, GeoJSON; origin allowed; two features and transfer-limit flag | Geographic data retrieval works in this sample; full retrieval requires pagination |
| HKO rainfall CSV | HTTP 200, parsed CSV, approximately 2.7 MB / 58,564 rows; no CORS allowance observed | Fetch/cache/transform server-side before phone delivery unless later browser testing establishes another supported route |

All but the HKO current-report request included `Origin: http://localhost:5173`; CORS observations apply only to those responses. No actual browser, iPhone/Android, preflight, uptime, load or 3D rendering tests were performed. HTTP 200 is not evidence that every data record is fresh or every field correct.

## Project ideas and scope

The ratings are relative estimates for a personal holiday project, not measured development times.

| Concept | What the user does | Main ingredients | Visual appeal | Effort | Main uncertainty |
|---|---|---|---|---|---|
| **Hong Kong Live Atlas** | Explore a neighbourhood, tap a place, switch a small number of live layers | 3D tiles + places + weather + transport | Very high | Medium | 3D key access and phone performance |
| **Hong Kong in Layers** | Follow how a walking route changes level through stations, bridges and streets | 3D pedestrian/indoor network + routing + amenities | Very high | High | Vertical alignment, supported coverage and actual accessibility |
| **Rain Window** | Compare leaving now with later using forecast periods and nearby transit | Rainfall grid + weather warnings + stops/ETA | High | Medium | Grid processing and explaining forecast uncertainty |
| **Weekend Explorer** | Choose a trail, beach or heritage walk and inspect conditions and facilities | AFCD + monuments + beach grades + HKO + transport | High | Low–medium | Joining destinations and transport; current opening/closure information |
| **City Pulse** | Explore measured traffic conditions and camera snapshots over the city | Road geometry + speeds + CCTV + parking | Very high | Medium–high | Different coverage and refresh schedules; storing history for replay |
| **Neighbourhood Portraits** | Compare districts through population, housing and access to facilities | Census polygons + amenities + selected economic series | High | Medium | Matching time periods and geographic units |
| **Hidden Hong Kong** | Discover stonewall trees, monuments and public markets nearby | Trees + heritage + FEHD facilities | High | Low | Enough contextual content to make discovery rewarding |

### Three scope choices I would seriously consider

**1. Best match for your excitement about 3D: Hong Kong Live Atlas.**

Start in Central–Admiralty–Wan Chai. A user can tilt the city, select a monument or station, see its information, and open a nearby-arrivals card. Keep weather as context. The 3D city provides the visual hook; the selected place provides a reason to interact.

**2. Most distinctively Hong Kong: Hong Kong in Layers.**

Make the vertical city understandable: a carefully validated route through streets, bridges and a station, with a floor/height view. First confirm that the selected area exists in the source network. Start with a few curated routes; a dependable citywide accessibility router is a much larger project.

**3. Easiest to finish and use during your holiday: Weekend Explorer.**

Pick a small collection of places, provide a strong map and detail card, show relevant weather and published beach grades, and help people reach the nearby transport stop. Broader route optimisation can come later.

A “shadiest walk” app is an interesting later experiment, but it needs derived sun/shadow modelling and route validation; a 3D model alone does not provide measured pavement heat or guaranteed shelter from rain.

## A practical first build

### Recommended MVP: one neighbourhood, three useful interactions

1. **Explore:** search or choose a place, pan/tilt the map, switch between a lightweight view and 3D.
2. **Inspect:** tap a station, monument or facility and get a concise bilingual card with source information.
3. **Check now:** show upcoming transport and a weather summary, with observation timestamps and unavailable/stale states.

Start with one transport operator or MTR, one place dataset and HKO. Add rainfall playback after those work on a phone. Avoid making the first release depend on supporting every transport operator, every 3D venue and every data category.

### Suggested delivery shape

- A responsive web app, optionally installable to the home screen.
- Direct public API requests where browser access is confirmed; a small backend for caching, transformations and protected credentials.
- Static place layers prepared ahead of time and delivered in compact form.
- 3D tiles streamed on demand with a phone-appropriate detail budget and a lightweight fallback.
- Live feeds refreshed at a cadence suited to the source and only when their view is active.

Treat the bulk rainfall file differently from a tiny arrival response. Fetch the grid once per source update, prepare the required area/forecast periods, and share the cached result across users. This is a design recommendation based on the sample payload size, not a benchmark of a finished app.

### Keep a small dataset register

For every integrated layer, record:

```text
provider / catalogue URL / resource URL / dictionary URL
licence and attribution / authentication / observed CORS behaviour
format / coordinate system / geographic coverage
observation time / publication time / retrieval time / refresh rule
identifiers used for joins / missing-value rules / stale threshold
last successful check / known limitations
```

The most valuable next feasibility check is **one 3D neighbourhood on your own phone**, followed by one place overlay and one live feed. That will establish whether the first project should prioritise photorealistic exploration or a lighter map with richer data interactions.
