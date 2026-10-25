#!/bin/sh
# GRAVETIDE: ship the current commit to gravetidegame.com (the KZ server, `ssh kz` in ~/.ssh/config).
#   sh tools/deploy.sh          — the HEAD commit
#   sh tools/deploy.sh rollback — back to the release before the current one
# Layout on the server: /opt/gravetide/releases/<sha>/ (client, server, shared, assets), /opt/gravetide/current
# -> the live one, /opt/gravetide/data (the database, kept across releases), /etc/gravetide/game.env,
# systemd gravetide.service (node on 127.0.0.1:58521), nginx /etc/nginx/conf.d/gravetide.conf.
set -e
HOST=${DEPLOY_HOST:-kz}
cd "$(dirname "$0")/.."

if [ "$1" = "rollback" ]; then
  ssh "$HOST" 'set -e; cd /opt/gravetide/releases; cur=$(basename "$(readlink -f /opt/gravetide/current)");
    prev=$(ls -1dt */ | tr -d / | grep -vx "$cur" | head -1); [ -n "$prev" ] || { echo "no earlier release"; exit 1; };
    ln -sfn "/opt/gravetide/releases/$prev" /opt/gravetide/current; systemctl restart gravetide; echo "rolled back $cur -> $prev"'
  exit 0
fi

SHA=$(git rev-parse --short HEAD)
[ -z "$(git status --porcelain -- client server shared assets package.json)" ] || echo "note: uncommitted changes are NOT shipped (the archive is of $SHA)"
TMP=$(mktemp -d)
git archive --format=tar.gz -o "$TMP/gravetide-$SHA.tgz" HEAD client server shared assets site package.json tsconfig.json
# The client's production bundle (tools/build-client.ts; prod 2026-10-25: phones on mobile data lost one of ~560 modules
# and the game did not start): built here, from exactly the archived commit's client/ and shared/, into client/dist, and
# shipped beside the release. The server serves it while its sources are unchanged (server/src/net/static.ts).
[ -f node_modules/esbuild/package.json ] || npm install --no-audit --no-fund
mkdir -p "$TMP/src"
git archive HEAD client shared | tar -x -C "$TMP/src"
node --disable-warning=ExperimentalWarning tools/build-client.ts "$TMP/src"
tar -C "$TMP/src" -czf "$TMP/dist-$SHA.tgz" client/dist
scp -q "$TMP/gravetide-$SHA.tgz" "$TMP/dist-$SHA.tgz" "$HOST:/opt/gravetide/releases/"
rm -rf "$TMP"
# (a consistent snapshot of the live database before the restart — VACUUM INTO takes the WAL in too; the last ten kept)
ssh "$HOST" "set -e; cd /opt/gravetide/releases; mkdir -p $SHA; tar -xzf gravetide-$SHA.tgz -C $SHA; tar -xzf dist-$SHA.tgz -C $SHA; rm gravetide-$SHA.tgz dist-$SHA.tgz;
  mkdir -p /opt/gravetide/data/backups; B=/opt/gravetide/data/backups/gravetide-\$(date +%Y%m%d-%H%M%S)-$SHA.db;
  node --disable-warning=ExperimentalWarning -e \"new (require('node:sqlite').DatabaseSync)('/opt/gravetide/data/gravetide.db').exec(\\\"VACUUM INTO '\$B'\\\")\";
  chown gravetide:gravetide \$B; echo \"backup \$(basename \$B) \$(du -h \$B | cut -f1)\"; ls -1t /opt/gravetide/data/backups/gravetide-*.db | tail -n +11 | xargs -r rm -f;
  if [ -f /opt/gravetide/data/forum.db ]; then F=/opt/gravetide/data/backups/forum-\$(date +%Y%m%d-%H%M%S)-$SHA.db; node --disable-warning=ExperimentalWarning -e \"new (require('node:sqlite').DatabaseSync)('/opt/gravetide/data/forum.db').exec(\\\"VACUUM INTO '\$F'\\\")\"; chown gravetide:gravetide \$F; echo \"backup \$(basename \$F)\"; ls -1t /opt/gravetide/data/backups/forum-*.db | tail -n +11 | xargs -r rm -f; fi;
  ln -sfn /opt/gravetide/releases/$SHA /opt/gravetide/current; systemctl restart gravetide; sleep 8;
  systemctl is-active gravetide; curl -s -o /dev/null -w 'local HTTP %{http_code}\n' http://127.0.0.1:58521/;
  echo \"client: \$(curl -s http://127.0.0.1:58521/play | grep -o 'mode.:.[a-z]*' | head -1) (want: bundle)\";
  ls -1dt */ | tail -n +6 | xargs -r rm -rf"
echo "deployed $SHA"
