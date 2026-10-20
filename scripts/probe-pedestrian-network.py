"""Bounded public-source experiment; never used by the live app.

Run with --live to capture missing responses (two requests at most in parallel).
Run without --live to replay the saved public samples offline. No user GPS,
credentials, whole-territory download, or production graph changes are involved.
"""

import argparse
import collections
import concurrent.futures
import copy
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
OUTDOOR = "https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637222018065_52265/MapServer"
INDOOR = "https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1742809197336_78665/MapServer"
ROUTER = "https://mapapi.hkmapservice.gov.hk/PedRoute/NAServer/route"
AREAS = {
    "central": [114.153, 22.279, 114.165, 22.286],
    "admiralty": [114.160, 22.275, 114.172, 22.282],
    "kowloon": [114.157, 22.300, 114.171, 22.308],
    "admiralty-core": [114.163, 22.278, 114.166, 22.281],
    "central-core": [114.158, 22.282, 114.161, 22.285],
}
FIELDS = [
    "OBJECTID",
    "PedestrianRouteID",
    "Location",
    "FeatureType",
    "AliasNameEN",
    "AliasNameTC",
    "WeatherProof",
    "WheelchairBarrier",
    "WheelchairAccess",
    "ObstaclesType",
    "Gradient",
    "Direction",
    "Enabled",
    "PositionCertainty",
    "FloorID",
    "AccessTimeID",
    "LastAmendmentDate",
    "Shape_Length",
]


def query(base, params):
    return base + "?" + urllib.parse.urlencode(params)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true")
    parser.add_argument(
        "--output", type=Path, default=ROOT / "output/playwright/network-probe"
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    evidence = {}

    def capture(name, url):
        path = args.output / (name + ".json")
        if path.exists():
            packet = json.loads(path.read_text())
            if packet["url"] != url:
                raise ValueError(
                    f"Cached query changed: {name}. Use a different output directory."
                )
            packet.setdefault(
                "capturedAt",
                dt.datetime.fromtimestamp(
                    path.stat().st_mtime, dt.timezone.utc
                ).isoformat(),
            )
        elif args.live:
            response = subprocess.run(
                ["curl", "--silent", "--show-error", "--fail", "--max-time", "25", url],
                capture_output=True,
            )
            if response.returncode:
                raise RuntimeError(f"{name}: {response.stderr.decode()[:200]}")
            if len(response.stdout) > 8 * 1024 * 1024:
                raise ValueError(f"{name}: response exceeds the 8 MiB experiment bound")
            packet = {
                "url": url,
                "capturedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
                "data": json.loads(response.stdout),
            }
            path.write_text(json.dumps(packet, ensure_ascii=False, indent=2) + "\n")
        else:
            raise RuntimeError(f"Missing {name}; use --live once to capture it.")
        evidence[name] = {k: packet[k] for k in ["url", "capturedAt"]}
        evidence[name]["dataSha256"] = hashlib.sha256(
            json.dumps(packet["data"], sort_keys=True).encode()
        ).hexdigest()
        return packet["data"]

    def batch(tasks):
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            return dict(pool.map(lambda item: (item[0], capture(*item)), tasks))

    metadata = batch(
        [
            ("outdoor-service", OUTDOOR + "?f=pjson"),
            ("outdoor-edges-schema", OUTDOOR + "/0?f=pjson"),
            ("indoor-service", INDOOR + "?f=pjson"),
            ("indoor-edges-schema", INDOOR + "/0?f=pjson"),
            ("router-metadata", ROUTER + "?f=pjson"),
            ("router-modes", ROUTER + "/retrieveTravelModes?f=json"),
            ("access-time-schema", OUTDOOR + "/1005?f=pjson"),
            ("access-time-details-schema", OUTDOOR + "/1006?f=pjson"),
            ("floor-relations-schema", OUTDOOR + "/1002?f=pjson"),
        ]
    )
    tasks = []
    for area, bbox in AREAS.items():
        for kind, base in [("outdoor", OUTDOOR), ("indoor", INDOOR)]:
            tasks.append(
                (
                    f"{area}-{kind}",
                    query(
                        base + "/0/query",
                        {
                            "f": "json",
                            "where": "1=1",
                            "geometry": ",".join(map(str, bbox)),
                            "geometryType": "esriGeometryEnvelope",
                            "inSR": "4326",
                            "outSR": "4326",
                            "spatialRel": "esriSpatialRelIntersects",
                            "outFields": ",".join(FIELDS),
                            "returnGeometry": "true",
                            "returnZ": "true",
                            "orderByFields": "OBJECTID",
                            "resultRecordCount": "1200",
                        },
                    ),
                )
            )
    samples = batch(tasks)
    tables = batch(
        [
            (
                f"{name}-sample",
                query(
                    OUTDOOR + f"/{layer}/query",
                    {
                        "f": "json",
                        "where": "1=1",
                        "outFields": ",".join(
                            field["name"]
                            for field in metadata[name + "-schema"]["fields"]
                            if field["name"] != "ModifiedBy"
                        ),
                        "returnGeometry": "false",
                        "resultRecordCount": "5",
                        "orderByFields": "OBJECTID",
                    },
                ),
            )
            for name, layer in [
                ("access-time", 1005),
                ("access-time-details", 1006),
                ("floor-relations", 1002),
            ]
        ]
    )

    modes = metadata["router-modes"]["supportedTravelModes"]
    stops = {
        "features": [
            {
                "attributes": {"Name": "Central Waterfront public reference"},
                "geometry": {
                    "x": 114.1644,
                    "y": 22.2836,
                    "spatialReference": {"wkid": 4326},
                },
            },
            {
                "attributes": {"Name": "Hong Kong Park public reference"},
                "geometry": {
                    "x": 114.1614,
                    "y": 22.2778,
                    "spatialReference": {"wkid": 4326},
                },
            },
        ]
    }
    base_params = {
        "f": "json",
        "stops": json.dumps(stops, separators=(",", ":")),
        "outSR": "4326",
        "returnZ": "true",
        "returnStops": "true",
        "directionsLanguage": "en",
        "directionsLengthUnits": "esriNAUMeters",
        "directionsStyleName": "NA Campus",
    }
    # Four public profiles, then a controlled JSON-mode request and a modified JSON mode.
    tasks = [
        (
            f"route-{name}",
            query(ROUTER + "/solve", {**base_params, "travelMode": value}),
        )
        for name, value in [
            ("shortest", "1"),
            ("recommended", "3"),
            ("barrier-free", "2"),
            ("unpaid", "5"),
        ]
    ]
    shortest = copy.deepcopy(next(mode for mode in modes if mode["id"] == "1"))
    custom = copy.deepcopy(shortest)
    custom.pop("id", None)
    custom["name"] = "Experiment covered preference"
    custom["restrictionAttributeNames"] = [
        "Direction",
        "Avoid Outdoor (high)",
        "Prefer Indoor (high)",
    ]
    invalid = copy.deepcopy(custom)
    invalid["restrictionAttributeNames"] = ["EXPERIMENT_NONEXISTENT_RESTRICTION"]
    for name, mode in [
        ("json-shortest-control", shortest),
        ("json-covered-preference", custom),
        ("json-invalid-control", invalid),
    ]:
        tasks.append(
            (
                "route-" + name,
                query(
                    ROUTER + "/solve",
                    {
                        **base_params,
                        "travelMode": json.dumps(mode, separators=(",", ":")),
                    },
                ),
            )
        )
    for style, key in [("NA Navigation", "navigation"), ("NA Desktop", "desktop")]:
        tasks.append(
            (
                "route-style-" + key,
                query(
                    ROUTER + "/solve",
                    {**base_params, "travelMode": "3", "directionsStyleName": style},
                ),
            )
        )
    routes = batch(tasks)
    baseline_path = routes["route-shortest"]["routes"]["features"][0]["geometry"][
        "paths"
    ][0]
    point = baseline_path[len(baseline_path) // 2]
    barriers = {
        "features": [
            {
                "attributes": {
                    "Name": "Experiment: avoid one source route location",
                    "BarrierType": 0,
                    "FullEdge": 1,
                },
                "geometry": {
                    "x": point[0],
                    "y": point[1],
                    "z": point[2],
                    "spatialReference": {"wkid": 4326},
                },
            }
        ]
    }
    routes["route-avoid-location"] = capture(
        "route-avoid-location",
        query(
            ROUTER + "/solve",
            {
                **base_params,
                "travelMode": "1",
                "barriers": json.dumps(barriers, separators=(",", ":")),
                "returnBarriers": "true",
            },
        ),
    )
    # Joins use actual IDs observed in bounded samples, never inferred proximity.
    floor_ids = (
        sorted(
            {
                f["attributes"]["FloorID"]
                for name, d in samples.items()
                if name.endswith("outdoor")
                for f in d.get("features", [])
                if f["attributes"].get("FloorID") is not None
            }
        )[:6]
        + sorted(
            {
                f["attributes"]["FloorID"]
                for name, d in samples.items()
                if name.endswith("indoor")
                for f in d.get("features", [])
                if f["attributes"].get("FloorID") is not None
            }
        )[:6]
    )
    access_ids = sorted(
        {
            f["attributes"]["AccessTimeID"]
            for d in samples.values()
            for f in d.get("features", [])
            if f["attributes"].get("AccessTimeID") is not None
        }
    )[:8]
    joins = batch(
        [
            (
                "floor-relations-selected-joined",
                query(
                    OUTDOOR + "/1002/query",
                    {
                        "f": "json",
                        "where": "FloorID IN (" + ",".join(map(str, floor_ids)) + ")",
                        "outFields": "FloorID,FloorPolyID,BuildingID,EnglishName,ChineseName",
                        "returnGeometry": "false",
                        "resultRecordCount": "100",
                    },
                ),
            ),
            (
                "access-time-joined",
                query(
                    OUTDOOR + "/1005/query",
                    {
                        "f": "json",
                        "where": "AccessTimeID IN ("
                        + ",".join(map(str, access_ids))
                        + ")",
                        "outFields": "AccessTimeID,AccessTimeType,DescriptionEN,DescriptionTC,LastAmendmentDate",
                        "returnGeometry": "false",
                        "resultRecordCount": "100",
                    },
                ),
            ),
            (
                "access-time-details-joined",
                query(
                    OUTDOOR + "/1006/query",
                    {
                        "f": "json",
                        "where": "AccessTimeID IN ("
                        + ",".join(map(str, access_ids))
                        + ")",
                        "outFields": "AccessTimeID,DayCode,FromTime,ToTime",
                        "returnGeometry": "false",
                        "resultRecordCount": "100",
                    },
                ),
            ),
        ]
    )

    def summarise_sample(name, data):
        if "error" in data:
            return {"error": data["error"]}
        kind = name.split("-")[-1]
        schema = metadata[kind + "-edges-schema"]
        domains = {
            field["name"]: {
                str(v["code"]): v["name"]
                for v in (field.get("domain") or {}).get("codedValues", [])
            }
            for field in schema["fields"]
        }
        features = data.get("features", [])
        stats = {}
        for field in [
            "FeatureType",
            "Location",
            "WeatherProof",
            "WheelchairBarrier",
            "WheelchairAccess",
            "Enabled",
            "Direction",
        ]:
            stats[field] = dict(
                collections.Counter(
                    "Missing"
                    if (value := f["attributes"].get(field)) is None
                    else domains[field].get(str(value), str(value))
                    for f in features
                )
            )
        vertices = [
            v
            for feature in features
            for path in feature.get("geometry", {}).get("paths", [])
            for v in path
        ]
        z = [v[2] for v in vertices if len(v) >= 3 and isinstance(v[2], (int, float))]
        return {
            "featureCount": len(features),
            "exceededTransferLimit": data.get("exceededTransferLimit", False),
            "spatialReference": data.get("spatialReference"),
            "hasZ": data.get("hasZ"),
            "zRange": [min(z), max(z)] if z else None,
            "vertices": len(vertices),
            "nonNull": {
                field: sum(f["attributes"].get(field) is not None for f in features)
                for field in [
                    "Gradient",
                    "FloorID",
                    "AccessTimeID",
                    "LastAmendmentDate",
                ]
            },
            "counts": stats,
        }

    def summarise_route(data):
        if "error" in data:
            return {"error": data["error"]}
        features = data.get("routes", {}).get("features", [])
        if not features:
            return {
                "keys": list(data),
                "messages": data.get("messages"),
                "noRoute": True,
            }
        route = features[0]
        dirs = data.get("directions", [{}])[0]
        instructions = [
            f.get("attributes", {}).get("text", "") for f in dirs.get("features", [])
        ]
        return {
            "distanceM": route["attributes"].get("Total_Length"),
            "minutes": route["attributes"].get("Total_Time"),
            "pathSha256": hashlib.sha256(
                json.dumps(route["geometry"]["paths"]).encode()
            ).hexdigest(),
            "hasZ": data["routes"].get("hasZ"),
            "steps": len(instructions),
            "mentions": {
                term: sum(term in text.lower() for text in instructions)
                for term in ["stair", "elevator", "escalator", "footbridge", "subway"]
            },
            "messages": data.get("messages"),
            "maneuvers": dict(
                collections.Counter(
                    f.get("attributes", {}).get("maneuverType", "Missing")
                    for f in dirs.get("features", [])
                )
            ),
            "barrierAttributes": [
                f["attributes"] for f in data.get("barriers", {}).get("features", [])
            ],
            "responseKeys": list(data),
            "directionKeys": list(dirs),
            "directionFeatureKeys": list(dirs.get("features", [{}])[0]),
            "stopAttributes": [
                f["attributes"] for f in data.get("stops", {}).get("features", [])
            ],
        }

    report = {
        "scope": "Public bounded samples and solver experiments; no physical access, sensor accuracy or performance validation.",
        "areasWgs84": AREAS,
        "sampleLimit": 1200,
        "sampleDefinition": "Features intersecting each box, not clipped; outdoor and indoor services can overlap. Do not sum them as a unique graph.",
        "schemas": {
            kind: {
                "hasZ": metadata[kind + "-edges-schema"].get("hasZ"),
                "sourceHeightModelInfo": metadata[kind + "-edges-schema"].get(
                    "sourceHeightModelInfo"
                ),
                "sourceSpatialReference": metadata[kind + "-edges-schema"].get(
                    "sourceSpatialReference"
                ),
                "fields": [
                    f["name"]
                    for f in metadata[kind + "-edges-schema"].get("fields", [])
                ],
            }
            for kind in ["outdoor", "indoor"]
        },
        "samples": {
            name: summarise_sample(name, data) for name, data in samples.items()
        },
        "tables": {
            name: {
                "fields": [f["name"] for f in metadata[name + "-schema"]["fields"]],
                "sample": tables[name + "-sample"],
            }
            for name in ["access-time", "access-time-details", "floor-relations"]
        },
        "modes": modes,
        "networkDataset": metadata["router-metadata"].get("networkDataset"),
        "joins": {"floorIds": floor_ids, "accessTimeIds": access_ids, "results": joins},
        "routes": {name: summarise_route(data) for name, data in routes.items()},
        "evidence": evidence,
    }
    route_summary = report["routes"]
    checks = {
        "bothSchemasContainZ": all(
            report["schemas"][kind]["hasZ"] for kind in ["outdoor", "indoor"]
        ),
        "coreQueriesNotTruncated": all(
            not data["exceededTransferLimit"]
            for name, data in report["samples"].items()
            if "core" in name
        ),
        "jsonControlMatchesNumericShortest": route_summary[
            "route-json-shortest-control"
        ]["pathSha256"]
        == route_summary["route-shortest"]["pathSha256"],
        "coveredPreferenceChangesGeometry": route_summary[
            "route-json-covered-preference"
        ]["pathSha256"]
        != route_summary["route-shortest"]["pathSha256"],
        "invalidRestrictionReportedIgnored": any(
            "ignored" in msg["description"]
            for msg in route_summary["route-json-invalid-control"]["messages"]
        ),
        "barrierLocatedAndPathChanged": route_summary["route-avoid-location"][
            "barrierAttributes"
        ][0]["Status"]
        == 0
        and route_summary["route-avoid-location"]["pathSha256"]
        != route_summary["route-shortest"]["pathSha256"],
        "directionStylesPreserveRoute": all(
            route_summary["route-style-" + name]["pathSha256"]
            == route_summary["route-recommended"]["pathSha256"]
            for name in ["navigation", "desktop"]
        ),
    }
    report["checks"] = checks
    if not all(checks.values()):
        raise ValueError("An experimental control changed: " + json.dumps(checks))
    (args.output / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    )
    print(
        json.dumps(
            {"samples": report["samples"], "routes": report["routes"]},
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
