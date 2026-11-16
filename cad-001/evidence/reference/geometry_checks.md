| # | check | result | detail |
|---|---|---|---|
| 1 | 2 wall polylines, both closed | PASS |  |
| 2 | wall net area = ring - door gap - window gap | PASS | 2730000 mm2 vs 2730000 mm2 |
| 3 | exterior extents (-150,-150)-(4150,6150) | PASS |  |
| 4 | door leaf 40 x 900 at hinge x=300, inside room (y>=0) | PASS |  |
| 5 | door swing arc r=900 centred on hinge (300,0), 0..90 deg | PASS |  |
| 6 | door opening 900 clear (jambs at x=300 and x=1200) | PASS |  |
| 7 | window: 4 lines, all y 2250..3750 (1500, centred on 6000) | PASS |  |
| 8 | window lines at x=4000 / 4065 / 4085 / 4150 | PASS | [4000.0, 4065.0, 4085.0, 4150.0] |
| 9 | 16 dimensions | PASS |  |
| 10 | dimension values | PASS | [300, 900, 2800, 4000, 2250, 1500, 2250, 6000, 150, 4000, 150, 4300, 150, 6000, 150, 6300] |
| 11 | dimension overrides: text 125, arch tick (4), precision 0 | PASS |  |
| 12 | chains sum to totals | PASS |  |
| 13 | every object on a CAD001 layer (none on layer 0) | PASS |  |
