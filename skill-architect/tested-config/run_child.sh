#!/bin/bash
# 用法: run_child.sh <log名稱> <預算USD> <prompt> [額外 claude 參數...]
# 以乾淨環境啟動子 Claude Code：假 HOME、只載入 sandbox 專案設定、不掛任何 MCP、dontAsk 權限模式
S=<SCRATCH>
NAME=$1; BUDGET=$2; PROMPT=$3; shift 3
cd $S/sandbox || exit 1
START=$(date +%s.%N)
env -i PATH=/opt/node22/bin:/usr/local/bin:/usr/bin:/bin HOME=$S/home LANG=C.UTF-8 \
  HTTPS_PROXY=$HTTPS_PROXY HTTP_PROXY=${HTTP_PROXY:-$HTTPS_PROXY} NO_PROXY=$NO_PROXY \
  NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt SSL_CERT_FILE=/root/.ccr/ca-bundle.crt \
  ANTHROPIC_BASE_URL=https://api.anthropic.com \
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1 \
  claude -p "$PROMPT" --output-format stream-json --verbose \
    --setting-sources project --strict-mcp-config --permission-mode dontAsk \
    --no-session-persistence --settings <SCRATCH>/hooks/session-settings.json --max-budget-usd "$BUDGET" --model sonnet --allowedTools "Edit(/<SCRATCH>/sandbox/runs/**)" "Read(/<SCRATCH>/sandbox/cases/**)" "Read(/<SCRATCH>/sandbox/runs/**)" "Read(/<SCRATCH>/sandbox/tools/**)" "Bash(python3 tools/tabcalc.py *)" Glob Grep "Skill(sk-01-decompose)" "Skill(sk-02-dispatch)" "Skill(sk-03-verify)" "Agent(sk-planner)" "Agent(sk-worker)" "Agent(sk-verifier)" "$@" < /dev/null \
  2> $S/logs/$NAME.err | python3 -u -c "import sys,time,json
for l in sys.stdin:
  l=l.strip()
  try: d=json.loads(l); d['_ts']=time.time(); print(json.dumps(d,ensure_ascii=False),flush=True)
  except Exception: print(l,flush=True)" > $S/logs/$NAME.jsonl
RC=${PIPESTATUS[0]}
END=$(date +%s.%N)
echo "{\"name\":\"$NAME\",\"rc\":$RC,\"wall_s\":$(python3 -c "print(round($END-$START,1))")}" >> $S/logs/_runs.jsonl
tail -1 $S/logs/_runs.jsonl
