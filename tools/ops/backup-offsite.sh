#!/bin/bash
# GRAVETIDE — daily encrypted OFFSITE copy of the live SQLite database (docs/33_OPS.md).
#
# Runs on the game server (`ssh kz`) as root from /etc/cron.d/gravetide-offsite-backup, installed at
# /opt/gravetide/ops/backup-offsite.sh. No secrets in this file: the key, the ssh key and the Telegram token are
# read from files on the server.
#
#   backup-offsite.sh            snapshot (VACUUM INTO) -> gzip -> openssl AES-256 -> rsync to the offsite box -> verify
#   backup-offsite.sh list       what is stored offsite
#   backup-offsite.sh verify F   download F (e.g. daily/gravetide-20261016-045000.db.gz.enc), decrypt, integrity_check
#   backup-offsite.sh restore F OUT.db   download + decrypt F into OUT.db (never touches the live database)
#
# Offsite layout (the remote side is jailed by rrsync -no-del, so this server can add files but never delete them;
# the remote prunes itself — tools/ops/backup-offsite-prune.sh, 14 daily + 8 weekly):
#   daily/gravetide-YYYYMMDD-HHMMSS.db.gz.enc   (+ .sha256: hashes of the encrypted file and of the plain .db)
#   weekly/…                                    (Sunday's copy)
# On any failure the owner gets a Telegram message from the game's bot (TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_IDS in
# game.env; neither is ever printed).
set -euo pipefail
umask 077

DB=${GT_DB:-/opt/gravetide/data/gravetide.db}
ENV_FILE=${GT_ENV:-/etc/gravetide/game.env}
ENC_KEY=${GT_BACKUP_KEY:-/etc/gravetide/backup.key}
SSH_KEY=${GT_BACKUP_SSH_KEY:-/etc/gravetide/backup_ssh_ed25519}
KNOWN=${GT_BACKUP_KNOWN_HOSTS:-/etc/gravetide/backup_known_hosts}
REMOTE=${GT_BACKUP_REMOTE:-gtbackup@31.59.220.44}
WORK=${GT_BACKUP_WORK:-/var/tmp/gravetide-offsite}
NODE=${GT_NODE:-/usr/bin/node}

SSH="ssh -i $SSH_KEY -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$KNOWN -o ConnectTimeout=30"
RSYNC=(rsync -t --timeout=120 -e "$SSH")
log() { echo "$(date '+%F %T') $*"; }

alert() { # $1 = text; Telegram to every TELEGRAM_ADMIN_IDS via the game's bot. The token goes to curl on stdin (-K -),
  # so it is in neither argv nor the log.
  local tok ids id c
  tok=$(grep -E '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"' \r') || true
  ids=$(grep -E '^TELEGRAM_ADMIN_IDS=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"' \r') || true
  [ -n "$tok" ] && [ -n "$ids" ] || { log "alert: no bot token/admin ids in env"; return 0; }
  for id in ${ids//,/ }; do
    c=$(printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$tok" |
      curl -s -o /dev/null -w '%{http_code}' -m 20 -K - --data-urlencode "chat_id=$id" --data-urlencode "text=$1") || true
    log "alert: telegram HTTP ${c:-none}"
  done
}

integrity() { # $1 = a .db file -> prints "ok <tables> <accounts>" or the error
  "$NODE" --disable-warning=ExperimentalWarning -e '
    const d = new (require("node:sqlite").DatabaseSync)(process.argv[1], { readOnly: true });
    const ok = d.prepare("PRAGMA integrity_check").all().map(r => r.integrity_check).join(";");
    const t = d.prepare("SELECT count(*) n FROM sqlite_master WHERE type=\x27table\x27").get().n;
    let a = "?"; try { a = d.prepare("SELECT count(*) n FROM accounts").get().n; } catch {}
    console.log(ok + " " + t + " " + a);' "$1"
}

decrypt() { # $1 = .db.gz.enc, $2 = out .db
  openssl enc -d -aes-256-cbc -md sha256 -pbkdf2 -iter 200000 -pass "file:$ENC_KEY" -in "$1" | gunzip -c > "$2"
}

fetch() { # $1 = remote relative path, $2 = local dir
  "${RSYNC[@]}" "$REMOTE:$1" "$REMOTE:$1.sha256" "$2/"
}

verify_file() { # $1 = remote relative path; prints the integrity line; non-zero on any mismatch
  local tmp name enc_sum plain_sum
  tmp=$(mktemp -d "$WORK/verify.XXXXXX"); name=$(basename "$1")
  fetch "$1" "$tmp"
  enc_sum=$(sed -n 's/^enc //p' "$tmp/$name.sha256"); plain_sum=$(sed -n 's/^db //p' "$tmp/$name.sha256")
  [ "$(sha256sum < "$tmp/$name" | cut -d' ' -f1)" = "$enc_sum" ] || { rm -rf "$tmp"; echo "encrypted hash mismatch"; return 1; }
  decrypt "$tmp/$name" "$tmp/check.db"
  [ "$(sha256sum < "$tmp/check.db" | cut -d' ' -f1)" = "$plain_sum" ] || { rm -rf "$tmp"; echo "plain hash mismatch"; return 1; }
  local r; r=$(integrity "$tmp/check.db"); rm -rf "$tmp"
  echo "$r"; [ "${r%% *}" = "ok" ]
}

mkdir -p "$WORK"
case "${1:-run}" in
  list)
    "${RSYNC[@]}" -r --list-only "$REMOTE:" ; exit 0 ;;
  verify)
    [ -n "${2:-}" ] || { echo "usage: $0 verify daily/<file>.db.gz.enc"; exit 2; }
    verify_file "$2"; exit $? ;;
  restore)
    [ -n "${2:-}" ] && [ -n "${3:-}" ] || { echo "usage: $0 restore daily/<file>.db.gz.enc OUT.db"; exit 2; }
    [ "$(readlink -f "$3")" != "$(readlink -f "$DB")" ] || { echo "refusing to write over the live database"; exit 2; }
    tmp=$(mktemp -d "$WORK/restore.XXXXXX"); fetch "$2" "$tmp"
    decrypt "$tmp/$(basename "$2")" "$3"; rm -rf "$tmp"
    echo "restored $2 -> $3: $(integrity "$3")"; exit 0 ;;
  run) ;;
  *) echo "usage: $0 [run|list|verify F|restore F OUT]"; exit 2 ;;
esac

exec 9>"$WORK/.lock"; flock -n 9 || { log "another run holds the lock"; exit 0; }
STEP=start
trap 'rc=$?; set +e; trap - ERR; rm -f "$WORK"/snap-*.db "$WORK"/gravetide-*.enc*; log "FAILED at $STEP (rc=$rc)"
  alert "GRAVETIDE: ночной offsite-бэкап базы НЕ прошёл (шаг «$STEP», код $rc, $(hostname)). Лог: /var/log/gravetide-offsite.log"; exit $rc' ERR

STAMP=$(date +%Y%m%d-%H%M%S)
NAME=gravetide-$STAMP.db.gz.enc
SNAP=$WORK/snap-$STAMP.db

STEP=snapshot   # VACUUM INTO = one consistent copy (WAL included), the same as tools/deploy.sh
"$NODE" --disable-warning=ExperimentalWarning -e '
  new (require("node:sqlite").DatabaseSync)(process.argv[1]).exec("VACUUM INTO \x27" + process.argv[2] + "\x27")' "$DB" "$SNAP"
STEP=integrity
SRC=$(integrity "$SNAP"); [ "${SRC%% *}" = "ok" ] || { log "snapshot integrity: $SRC"; false; }

STEP=encrypt
gzip -9 -c "$SNAP" | openssl enc -aes-256-cbc -md sha256 -pbkdf2 -iter 200000 -salt -pass "file:$ENC_KEY" -out "$WORK/$NAME"
{ echo "enc $(sha256sum < "$WORK/$NAME" | cut -d' ' -f1)"; echo "db $(sha256sum < "$SNAP" | cut -d' ' -f1)"; } > "$WORK/$NAME.sha256"

STEP=upload
"${RSYNC[@]}" "$WORK/$NAME" "$WORK/$NAME.sha256" "$REMOTE:daily/"
[ "$(date +%u)" = 7 ] && "${RSYNC[@]}" "$WORK/$NAME" "$WORK/$NAME.sha256" "$REMOTE:weekly/"

STEP=verify     # download it back, decrypt, compare hashes, PRAGMA integrity_check
GOT=$(verify_file "daily/$NAME") || { log "verify: $GOT"; false; }
[ "$GOT" = "$SRC" ] || { log "verify: restored copy differs ($GOT vs $SRC)"; false; }

rm -f "$SNAP" "$WORK/$NAME" "$WORK/$NAME.sha256"
log "ok $NAME $(du -k "$DB" | cut -f1)K live, offsite verified: $GOT (integrity tables accounts)"
