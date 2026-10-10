@echo off
chcp 65001 >nul
title GRAVETIDE cluster
cd /d "%~dp0"
rem The production layout on one machine (docs/04 §4.4): a Gateway on 58600 and two zones of one world
rem (west = the Black Coast, east = every other region), sharing one SQLite database.
set LINK_SECRET=local-cluster-secret
set DB_PATH=data/local-cluster.db
set TRUST_PROXY=1
set ZONE_LAYOUT=west=black_coast;east=gravewater,whispering,ashen_isles,leviathan_reach,dead_mans_expanse,drowned_crown,the_abyss
start "GRAVETIDE zone west" cmd /k "set ZONE=west&& set ZONE_NAME=west&& set ZONE_PORT=9301&& set ZONE_PEERS=east=127.0.0.1:9302&& set LINK_PORT=9101&& set PORT=58601&& set HOST=127.0.0.1&& node --disable-warning=ExperimentalWarning server/src/main.ts"
timeout /t 5 >nul
start "GRAVETIDE zone east" cmd /k "set ZONE=east&& set ZONE_NAME=east&& set ZONE_PORT=9302&& set ZONE_PEERS=west=127.0.0.1:9301&& set LINK_PORT=9102&& set PORT=58602&& set HOST=127.0.0.1&& node --disable-warning=ExperimentalWarning server/src/main.ts"
timeout /t 8 >nul
echo GRAVETIDE (кластер) — http://localhost:58600 — не закрывайте окна.
start "" "http://localhost:58600"
set PORT=58600
set LINK_ZONES=west=127.0.0.1:9101@http://127.0.0.1:58601,east=127.0.0.1:9102@http://127.0.0.1:58602
node --disable-warning=ExperimentalWarning server/src/gateway.ts
pause
