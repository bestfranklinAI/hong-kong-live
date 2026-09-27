"""Reproduce the dated Admiralty audit offline. Not a production floor matcher.

Uses captured public source data only. Sampled containment cannot establish that
an entire segment is on a floor or that a connection is accessible.
"""

import json, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
bundle = json.loads(
    (ROOT / "fixtures/providers/admiralty-routing-audit-2026-09-26.json").read_text()
)
floors = bundle["floors"]["floors"]


def in_ring(x, y, ring):
    inside = False
    for a, b in zip(ring, ring[1:]):
        ax, ay = a[:2]
        bx, by = b[:2]
        cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax)
        if (
            abs(cross) < 1e-14
            and min(ax, bx) - 1e-10 <= x <= max(ax, bx) + 1e-10
            and min(ay, by) - 1e-10 <= y <= max(ay, by) + 1e-10
        ):
            return True
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            inside = not inside
    return inside


def contains(f, x, y):
    return any(
        in_ring(x, y, p[0]) and not any(in_ring(x, y, h) for h in p[1:])
        for p in f["polygons"]
    )


# Basic boundary and hole checks for this one-off diagnostic, not a routing engine.
r = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]
assert in_ring(0.5, 0.5, r) and in_ring(0, 0.5, r) and not in_ring(2, 2, r)
assert not contains(
    {"polygons": [[r, [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6], [0.4, 0.4]]]]},
    0.5,
    0.5,
)
cases = []
for name in ["eal-sil", "eal-ground", "ground-eal", "eal-sil-recommended"]:
    route = bundle["routes"][name]
    vertices = [v for p in route["paths"] for v in p]
    counts = collections.Counter()
    xycounts = collections.Counter()
    unmatched = []
    for i, (x, y, z) in enumerate(vertices):
        xy = [f for f in floors if contains(f, x, y)]
        hits = [f for f in xy if z is not None and abs(f["z"] - z) <= 0.25]
        key = lambda n: "none" if n == 0 else "unique" if n == 1 else "ambiguous"
        xycounts[key(len(xy))] += 1
        counts[key(len(hits))] += 1
        if len(hits) != 1:
            unmatched.append(
                {
                    "vertexIndex": i,
                    "coordinate": [x, y, z],
                    "candidateLevelIds": [f["id"] for f in hits],
                }
            )
    out = dict(
        case=name,
        request=route["request"],
        distanceM=route["distanceM"],
        durationMinutes=route["durationMinutes"],
        endpointOffsetsM=route["endpointOffsetsM"],
        endpointZ=[vertices[0][2], vertices[-1][2]],
        transitionInstructions=[
            s["text"]
            for s in route["steps"]
            if any(w in s["text"].lower() for w in ["elevator", "escalator", "stairs"])
        ],
        fetchedAt=route["fetchedAt"],
        vertexCount=len(vertices),
        xyCandidates=dict(xycounts),
        xyAndSourceZCandidates=dict(counts),
        unresolvedVertices=unmatched,
    )
    segment_counts = collections.Counter()
    for path in route["paths"]:
        for a, b in zip(path, path[1:]):
            hits = []
            for t in [0.25, 0.5, 0.75]:
                x, y, z = [u + (v - u) * t for u, v in zip(a, b)]
                hits.append(
                    [
                        f["id"]
                        for f in floors
                        if abs(f["z"] - z) <= 0.25 and contains(f, x, y)
                    ]
                )
            if any(len(h) != 1 for h in hits):
                segment_counts["unresolvedInterior"] += 1
            elif len(set(h[0] for h in hits)) == 1:
                segment_counts["sameCandidateAtThreeSamples"] += 1
            else:
                segment_counts["differentCandidates"] += 1
    out["segmentInteriorSamples"] = dict(segment_counts)
    cases.append(out)
    print(name, dict(xycounts), dict(counts), dict(segment_counts))
(ROOT / "docs/data/audits/admiralty-routing-2026-09-26.json").write_text(
    json.dumps(
        {
            "scope": "Source consistency and offline vertex candidate analysis, not physical access or confirmed floor identity",
            "sourceZTolerance": 0.25,
            "floorFetchedAt": bundle["floors"]["fetchedAt"],
            "floors": [{"id": f["id"], "name": f["name"], "z": f["z"]} for f in floors],
            "cases": cases,
        },
        ensure_ascii=False,
        indent=2,
    )
    + "\n"
)
