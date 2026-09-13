"""Build reviewed OSM railway routes from cached /relation/{id}/full.json files.
Never bridge disconnected ways or substitute station-centre straight lines.
"""
import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
CATALOGUE = json.loads((ROOT / "packages/contracts/src/mtr-network.json").read_text())
# One alignment per branch, shared in both directions; not platform/lane geometry.
RELATIONS = {
    "ISL": [4432666], "TWL": [269669], "KTL": [6452935],
    "TKL": [269672, 9736610], "EAL": [4248592, 4248591, 4250435],
    "TML": [6102299], "SIL": [6827211], "TCL": [5317706],
    "AEL": [5317239], "DRL": [4709540],
}
ALIASES = {"SWT": "SUW"}
names = {v["name"].casefold(): k for k, v in CATALOGUE["stations"].items()}
names["asiaworld-expo"] = "AWE"
result = {}
for line, ids in RELATIONS.items():
    routes = []
    allowed = next(x["stations"] for x in CATALOGUE["lines"] if x["code"] == line)
    for rid in ids:
        filename = "island-line" if rid == 4432666 else str(rid)
        raw = json.loads((ROOT / f"output/mtr-motion/{filename}.json").read_text())
        objects = {(e["type"], e["id"]): e for e in raw["elements"]}
        rel = objects["relation", rid]
        ways = [objects["way", m["ref"]]["nodes"] for m in rel["members"]
                if m["type"] == "way" and m["role"] == ""]
        path = list(ways[0])
        if len(ways) > 1 and path[-1] not in (ways[1][0], ways[1][-1]):
            path.reverse()
        for way in ways[1:]:
            if path[-1] == way[-1]:
                way = list(reversed(way))
            assert path[-1] == way[0], (line, rid, "Disconnected ways", path[-1], way[0])
            path.extend(way[1:])
        stops = {}
        for member in rel["members"]:
            if not member["role"].startswith("stop"):
                continue
            node = objects[member["type"], member["ref"]]
            tags = node.get("tags", {})
            code = ALIASES.get(tags.get("ref"), tags.get("ref"))
            if code not in allowed:
                code = names.get(tags.get("name:en", "").casefold())
            assert code in allowed, (line, rid, tags)
            assert node["id"] in path, (line, rid, code, "Stop is not on track")
            stops[code] = path.index(node["id"])
        assert list(stops.values()) == sorted(stops.values()), (line, rid, "Unordered stops")
        # Normalize to catalogue order; branch ordering is represented by separate routes.
        if allowed.index(next(iter(stops))) > allowed.index(list(stops)[-1]):
            path.reverse()
            stops = {k: len(path) - 1 - v for k, v in reversed(list(stops.items()))}
        routes.append({"id": str(rid), "source": f"https://www.openstreetmap.org/relation/{rid}",
                       "stations": stops, "coordinates": [[objects["node", n]["lon"], objects["node", n]["lat"]] for n in path]})
        print(line, rid, len(path), list(stops))
    result[line] = routes
target = ROOT / "apps/web/src/features/trains/railway-tracks.json"
target.write_text(json.dumps({"license": "ODbL-1.0", "retrievedAt": datetime.now(timezone.utc).isoformat(), "lines": result}, separators=(",", ":")))
