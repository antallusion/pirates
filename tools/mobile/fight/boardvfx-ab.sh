#!/usr/bin/env bash
# docs/25 §3: the frame rate before and after the boarding's looks, interleaved on one server (its sea grows busier as
# it runs, so a «before» measured an hour earlier is not a fair one): the panel and main.ts of the base commit put in
# place for «before», this branch's for «after», a battle measured each way in turn (tools/mobile/fight/boardvfx.mjs:
# her turn standing still, then the auto-battle). The branch's files are restored at the end.
#   GPORT=58980 BASE=f4471ecf SIZES="812x375 1500x600" PAIRS=3 bash tools/mobile/fight/boardvfx-ab.sh
set -u
BASE=${BASE:-f4471ecf}
PAIRS=${PAIRS:-3}
SIZES=${SIZES:-812x375 1500x600}
KEEP=$(mktemp -d)
cp client/src/ui/tactical.ts client/src/main.ts "$KEEP/"
restore() { cp "$KEEP/tactical.ts" client/src/ui/tactical.ts; cp "$KEEP/main.ts" client/src/main.ts; }
trap restore EXIT
for s in $SIZES; do
  for i in $(seq 1 "$PAIRS"); do
    for side in before after; do
      if [ "$side" = before ]; then git show "$BASE:client/src/ui/tactical.ts" > client/src/ui/tactical.ts; git show "$BASE:client/src/main.ts" > client/src/main.ts; else restore; fi
      GPORT=${GPORT:-58980} SIZE=$s WEATHER=breeze HOUR=12 SHOTS=0 ULT=0 OUT=docs/img/boardvfx/fps TAG=ab_${side}_$i timeout 600 node tools/mobile/fight/boardvfx.mjs 2>&1 | tail -1 | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const r=JSON.parse(d);console.log('$s','$side','$i','idle',r.idle?.fps,'fight',r.fight?.fps)}catch{console.log('$s','$side','$i','?',d.slice(0,200))}})"
    done
  done
done
