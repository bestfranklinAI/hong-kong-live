"""Plot the bounded recorded Admiralty network sample; no live requests.

uv run --with matplotlib==3.10.7 python scripts/plot-pedestrian-network.py
"""

import json
from pathlib import Path
import math
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from mpl_toolkits.mplot3d.art3d import Line3DCollection
from matplotlib.lines import Line2D

root = Path(__file__).resolve().parents[1]
folder = root / "output/playwright/network-probe"
features = []
for kind in ["outdoor", "indoor"]:
    packet = json.loads((folder / f"admiralty-core-{kind}.json").read_text())
    data = packet["data"]
    if data.get("exceededTransferLimit"):
        raise ValueError("Use the complete bounded core query, not a truncated sample.")
    features.extend((kind, f) for f in data["features"])
x0, y0 = 114.163, 22.278
cos = math.cos(math.radians(y0))
project = lambda p: ((p[0] - x0) * 111195 * cos, (p[1] - y0) * 111195, p[2])
colors = {1: "#147d73", 2: "#bc6b26", 3: "#7d8790"}
plt.rcParams.update(
    {
        "font.family": "DejaVu Sans",
        "font.size": 11,
        "axes.titleweight": "bold",
        "axes.labelcolor": "#45534f",
        "text.color": "#1d332e",
        "axes.edgecolor": "#dce4de",
        "xtick.color": "#596b64",
        "ytick.color": "#596b64",
    }
)
fig = plt.figure(figsize=(12.5, 6.4), facecolor="#fafbf9")
left = fig.add_subplot(121)
right = fig.add_subplot(122, projection="3d")
segments2, segments3, c = [], [], []
for kind, feature in features:
    for path in feature["geometry"]["paths"]:
        if not all(len(p) >= 3 and p[2] is not None for p in path):
            continue
        points = [project(p) for p in path]
        segments2.append([p[:2] for p in points])
        segments3.append(points)
        c.append(colors.get(feature["attributes"].get("WeatherProof"), "#7d8790"))
left.add_collection(LineCollection(segments2, colors=c, linewidths=1.3, alpha=0.8))
left.set(
    xlim=(0, 310),
    ylim=(0, 335),
    aspect="equal",
    title="Shelter information across nearby paths",
    xlabel="East from sample origin (m)",
    ylabel="North from sample origin (m)",
)
left.grid(alpha=0.15)
right.add_collection3d(
    Line3DCollection(segments3, colors=c, linewidths=1.1, alpha=0.7), autolim=False
)
right.set(
    xlim=(0, 310),
    ylim=(0, 335),
    zlim=(-40, 40),
    title="The same sample, separated by height",
    xlabel="East (m)",
    ylabel="North (m)",
    zlabel="Source height (HKPD m)",
)
right.set_box_aspect((1, 1, 0.7))
right.view_init(elev=27, azim=-48)
fig.suptitle(
    "Admiralty: information a single route line leaves out",
    fontsize=18,
    x=0.055,
    ha="left",
    y=0.98,
)
fig.legend(
    [Line2D([0], [0], color=colors[k], lw=3) for k in [1, 2, 3]],
    ["Recorded as covered", "Recorded as uncovered", "Unclassified"],
    loc="upper left",
    bbox_to_anchor=(0.045, 0.925),
    ncol=3,
    frameon=False,
)
fig.text(
    0.055,
    0.08,
    "816 outdoor-service + 835 indoor-service edge records intersect this box. These are not equipment counts or a deduplicated graph.",
    fontsize=10,
    color="#596b64",
)
fig.text(
    0.055,
    0.045,
    "Recorded government data, 19 Oct 2026. Published shelter attributes do not establish present access or rain protection. Heights exaggerated for clarity.",
    fontsize=9,
    color="#596b64",
)
fig.text(
    0.055,
    0.014,
    "Source: Lands Department / CSDI · Map from Lands Department · Sample origin: 114.163° E, 22.278° N. No live location data.",
    fontsize=9,
    color="#596b64",
)
fig.subplots_adjust(left=0.07, right=0.96, top=0.81, bottom=0.19, wspace=0.22)
fig.savefig(
    folder / "network-opportunities.png", dpi=160, facecolor=fig.get_facecolor()
)
fig.savefig(folder / "network-opportunities.svg", facecolor=fig.get_facecolor())
print(folder / "network-opportunities.png")
