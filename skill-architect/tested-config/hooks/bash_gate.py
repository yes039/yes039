#!/usr/bin/env python3
"""PreToolUse hook：Bash 只允許執行 `python3 tools/tabcalc.py ...`，且不得含任何串接、管線、重導向或變數展開。"""
import json, shlex, sys
cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "")
def deny(why):
    print(f"Blocked by bash_gate: {why}. Only `python3 tools/tabcalc.py <args>` is allowed.", file=sys.stderr); sys.exit(2)
if any(c in cmd for c in "\n`$\\"):
    deny("forbidden character")
lx = shlex.shlex(cmd, posix=True, punctuation_chars=True); lx.whitespace_split = True
try:
    toks = list(lx)
except ValueError:
    deny("unparsable command")
if any(t and all(ch in "();<>|&" for ch in t) for t in toks):
    deny("shell operator outside quotes")
if toks[:2] != ["python3", "tools/tabcalc.py"]:
    deny("command not allowed")
sys.exit(0)
