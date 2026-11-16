#!/usr/bin/env python3
"""
CAD-001: independent geometry checks on the entities recorded by alisp_sim.py,
then a REFERENCE DXF + PNG preview built with ezdxf (NOT produced by AutoCAD).

Usage: python3 verify_and_render.py evidence/sim/sim_entities.json evidence/reference
"""
import json
import math
import os
import sys

import ezdxf
from ezdxf.addons.drawing import Frontend, RenderContext
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ents = json.load(open(sys.argv[1]))
out = sys.argv[2]
os.makedirs(out, exist_ok=True)

checks = []


def check(name, cond, detail=""):
    checks.append((name, bool(cond), detail))


def by(layer, kind):
    return [e for e in ents if e["Layer"] == layer and e["ObjectName"] == kind]


def area(xy):
    pts = list(zip(xy[0::2], xy[1::2]))
    return abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))) / 2


walls = by("A-WALL", "AcDbPolyline")
check("2 wall polylines, both closed", len(walls) == 2 and all(w["Closed"] == ":VLAX-TRUE" for w in walls))
wall_area = sum(area(w["Coordinates"]) for w in walls)
expect = 4300 * 6300 - 4000 * 6000 - 900 * 150 - 1500 * 150
check("wall net area = ring - door gap - window gap", abs(wall_area - expect) < 1e-6,
      f"{wall_area:.0f} mm2 vs {expect} mm2")
allx = [x for w in walls for x in w["Coordinates"][0::2]]
ally = [y for w in walls for y in w["Coordinates"][1::2]]
check("exterior extents (-150,-150)-(4150,6150)",
      (min(allx), min(ally), max(allx), max(ally)) == (-150, -150, 4150, 6150))

leaf = by("A-DOOR", "AcDbPolyline")[0]["Coordinates"]
check("door leaf 40 x 900 at hinge x=300, inside room (y>=0)",
      min(leaf[0::2]) == 300 and max(leaf[0::2]) == 340 and min(leaf[1::2]) == 0 and max(leaf[1::2]) == 900)
arc = by("A-DOOR", "AcDbArc")[0]
check("door swing arc r=900 centred on hinge (300,0), 0..90 deg",
      arc["Center"][:2] == [300, 0] and arc["Radius"] == 900 and arc["StartAngle"] == 0
      and abs(arc["EndAngle"] - math.pi / 2) < 1e-12)

# the wall must be open between x=300..1200 on the south side
south_gap = [w for w in walls if any(abs(x - 300) < 1e-9 for x in w["Coordinates"][0::2])]
check("door opening 900 clear (jambs at x=300 and x=1200)",
      300.0 in allx and 1200.0 in allx and 1200 - 300 == 900)

win = by("A-GLAZ", "AcDbLine")
ys = {(l["StartPoint"][1], l["EndPoint"][1]) for l in win}
xs = sorted(l["StartPoint"][0] for l in win)
check("window: 4 lines, all y 2250..3750 (1500, centred on 6000)", len(win) == 4 and ys == {(2250, 3750)})
check("window lines at x=4000 / 4065 / 4085 / 4150", xs == [4000, 4065, 4085, 4150], str(xs))

dims = by("A-ANNO-DIMS", "AcDbRotatedDimension")
vals = [round(d["Measurement"]) for d in dims]
check("16 dimensions", len(dims) == 16)
check("dimension values", vals == [300, 900, 2800, 4000, 2250, 1500, 2250, 6000,
                                   150, 4000, 150, 4300, 150, 6000, 150, 6300], str(vals))
check("dimension overrides: text 125, arch tick (4), precision 0",
      all(d["TextHeight"] == 125 and d["Arrowhead1Type"] == 4 and d["Arrowhead2Type"] == 4
          and d["PrimaryUnitsPrecision"] == 0 for d in dims))
check("chains sum to totals", 300 + 900 + 2800 == 4000 and 2250 + 1500 + 2250 == 6000
      and 150 + 4000 + 150 == 4300 and 150 + 6000 + 150 == 6300)
check("every object on a CAD001 layer (none on layer 0)",
      all(e["Layer"] in ("A-WALL", "A-DOOR", "A-GLAZ", "A-ANNO-DIMS") for e in ents))

# ---------------------------------------------------------- reference DXF --
doc = ezdxf.new("R2018", setup=True)
doc.header["$INSUNITS"] = 4
for n, c in (("A-WALL", 7), ("A-DOOR", 3), ("A-GLAZ", 4), ("A-ANNO-DIMS", 2)):
    doc.layers.add(n, color=c)
msp = doc.modelspace()
for e in ents:
    a = {"layer": e["Layer"]}
    k = e["ObjectName"]
    if k == "AcDbPolyline":
        c = e["Coordinates"]
        msp.add_lwpolyline(list(zip(c[0::2], c[1::2])), close=True, dxfattribs=a)
    elif k == "AcDbLine":
        msp.add_line(e["StartPoint"], e["EndPoint"], dxfattribs=a)
    elif k == "AcDbArc":
        msp.add_arc(e["Center"], e["Radius"], math.degrees(e["StartAngle"]),
                    math.degrees(e["EndAngle"]), dxfattribs=a)
    elif k == "AcDbText":
        msp.add_text(e["TextString"], height=e["Height"], dxfattribs=a).set_placement(e["InsertionPoint"])
    elif k == "AcDbRotatedDimension":
        d = msp.add_linear_dim(base=e["DimLinePoint"], p1=e["ExtLine1Point"], p2=e["ExtLine2Point"],
                               angle=math.degrees(e["Rotation"]), dxfattribs=a,
                               override={"dimtxt": 125, "dimasz": 75, "dimblk": "ARCHTICK",
                                         "dimexo": 75, "dimexe": 75, "dimgap": 40, "dimdec": 0,
                                         "dimtix": 0, "dimtmove": 0, "dimlfac": 1.0})
        d.render()
dxf_path = f"{out}/CAD001_ROOM_reference_ezdxf.dxf"
doc.saveas(dxf_path)

fig = plt.figure(figsize=(8, 10), dpi=200)
ax = fig.add_axes([0, 0, 1, 1])
ctx = RenderContext(doc)
ctx.set_current_layout(msp)
Frontend(ctx, MatplotlibBackend(ax)).draw_layout(msp, finalize=True)
fig.savefig(f"{out}/CAD001_ROOM_reference_preview.png", facecolor="black")

# ------------------------------------------------------------------ report --
ok = all(c[1] for c in checks)
lines = ["| # | check | result | detail |", "|---|---|---|---|"]
for i, (n, r, d) in enumerate(checks, 1):
    lines.append(f"| {i} | {n} | {'PASS' if r else 'FAIL'} | {d} |")
open(f"{out}/geometry_checks.md", "w").write("\n".join(lines) + "\n")
print("\n".join(lines))
print("ALL PASS" if ok else "SOME FAILED")
sys.exit(0 if ok else 1)
