#!/bin/sh
# GRAVETIDE offsite store — retention, run on the OFFSITE box by the gtbackup user's crontab (docs/33_OPS.md).
# Keeps the newest 14 daily and 8 weekly copies (each copy = <name>.db.gz.enc + <name>.db.gz.enc.sha256).
# The game server cannot delete here (rrsync -no-del), so pruning lives on this side.
set -eu
ROOT=${1:-/opt/gravetide-backups/store}
prune() { # $1 = dir, $2 = how many to keep
  [ -d "$1" ] || return 0
  ls -1 "$1" | grep -E '^gravetide-[0-9]{8}-[0-9]{6}\.db\.gz\.enc$' | sort -r | tail -n +$(($2 + 1)) | while read -r f; do
    rm -f "$1/$f" "$1/$f.sha256"; echo "$(date '+%F %T') pruned $1/$f"
  done
}
prune "$ROOT/daily" 14
prune "$ROOT/weekly" 8
