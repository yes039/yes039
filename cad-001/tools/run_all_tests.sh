#!/usr/bin/env bash
# CAD-001 offline test suite (Linux, no AutoCAD). Re-run any time:  bash tools/run_all_tests.sh
set -u
cd "$(dirname "$0")/.."
LSP=lsp/CAD001_ROOM.lsp
TMP=$(mktemp -d)
fail=0
echo "== 1. execute LSP in simulator (6 scenarios)"
python3 tools/alisp_sim.py "$LSP" evidence/sim > evidence/sim/sim_console.log 2>&1 || { echo FAIL; fail=1; }
python3 - <<'PY' || fail=1
import json; r=json.load(open("evidence/sim/sim_report.json"))
ok = {
 "S1 blank dwg -> 26 objects, 1 undo group": r["S1_blank_dwg"]["entity_count"]==26 and r["S1_blank_dwg"]["undo_marks"]==["start","end"],
 "S2 pre-existing objects unchanged, existing layer colour kept": r["S2_existing_objects"]["preexisting_unchanged"] and r["S2_existing_objects"]["awall_color_after"]==1,
 "S3 locked layer -> stop, 0 objects, no layer created": r["S3_locked_layer"]["new_entities"]==0 and r["S3_locked_layer"]["layers"]==["0","A-DOOR"],
 "S4 non-world UCS -> stop, 0 objects": r["S4_ucs_not_world"]["new_entities"]==0,
 "S5 injected error -> rollback, pre-existing kept": r["S5_error_rollback"]["new_entities_left"]==0 and r["S5_error_rollback"]["preexisting_left"]==3,
 "S6 CAD001_ENV read-only": r["S6_env_readonly"]["new_entities"]==0 and r["S6_env_readonly"]["layers"]==["0"],
}
for k,v in ok.items(): print(("PASS " if v else "FAIL ")+k)
raise SystemExit(0 if all(ok.values()) else 1)
PY
echo "== 2. geometry checks + reference DXF/PNG"
python3 tools/verify_and_render.py evidence/sim/sim_entities.json evidence/reference | tail -1 | grep -q "ALL PASS" && echo "PASS 13 geometry checks" || { echo FAIL; fail=1; }
echo "== 3. mutation tests (the simulator must REJECT broken code)"
mut() { # name, sed expression
  sed "$2" "$LSP" > "$TMP/m.lsp"
  if python3 tools/alisp_sim.py "$TMP/m.lsp" "$TMP/out" > "$TMP/log" 2>&1 && \
     python3 tools/verify_and_render.py "$TMP/out/sim_entities.json" "$TMP/ref" > /dev/null 2>&1; then
    echo "FAIL (not detected): $1"; fail=1
  else
    why=$(grep -m1 "| FAIL |" "$TMP/ref/geometry_checks.md" 2>/dev/null | cut -d'|' -f3)
    [ -z "$why" ] && why=$(grep -m1 -oE "(LispError|ERROR).*" "$TMP/log" | cut -c1-80)
    echo "PASS detected: $1 ->$why"; fi
  rm -rf "$TMP/out" "$TMP/ref"
}
mut "missing closing paren"         '0,/(setq \*cad001-version\* "1.0")/s//(setq *cad001-version* "1.0"/'
mut "misspelled ActiveX method"     's/vla-AddLine ms/vla-AddLin ms/'
mut "wrong wall thickness 120"      's/(setq \*cad001-wall\*     150.0)/(setq *cad001-wall*     120.0)/'
mut "door width 800"                's/(setq \*cad001-door-w\*   900.0)/(setq *cad001-door-w*   800.0)/'
mut "misspelled property"           's/vla-put-TextGap/vla-put-TextGapp/'
rm -rf "$TMP"
echo; [ $fail = 0 ] && echo "ALL OFFLINE TESTS PASSED" || echo "SOME TESTS FAILED"
exit $fail
