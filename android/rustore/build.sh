#!/bin/sh
# GRAVETIDE for RuStore: the WebView APK built with the SDK's own tools (no Gradle). sh android/rustore/build.sh [versionCode] [versionName]
# Needs JDK 17 and the Android SDK (build-tools 35, platform 35); the signing key lives outside the repo (C:/Users/enosi/gravetide-keys).
set -e
cd "$(dirname "$0")"
VC=${1:-1}; VN=${2:-1.0.0}
JDK=${JDK:-"/c/Program Files/Microsoft/jdk-17.0.20.101-hotspot"}
SDK=${SDK:-/c/Users/enosi/Android/Sdk}
BT=$SDK/build-tools/35.0.0
export JAVA_HOME="$JDK"; export PATH="$JDK/bin:$PATH"
JAR=$SDK/platforms/android-35/android.jar
KEYS=$(cygpath -m "${KEYS:-/c/Users/enosi/gravetide-keys}")
OUT=build; rm -rf "$OUT"; mkdir -p $OUT/gen $OUT/classes $OUT/dex
"$BT/aapt2.exe" compile --dir res -o $OUT/res.zip
"$BT/aapt2.exe" link -I "$JAR" --manifest AndroidManifest.xml -o $OUT/base.apk $OUT/res.zip --java $OUT/gen \
  --min-sdk-version 24 --target-sdk-version 35 --version-code $VC --version-name $VN --auto-add-overlay
"$JDK/bin/javac.exe" -source 11 -target 11 -encoding UTF-8 -classpath "$JAR" -d $OUT/classes $(find src $OUT/gen -name '*.java') 2>&1 | grep -v "bootstrap classpath\|system modules\|deprecat\|warning" || true
"$BT/d8.bat" --release --min-api 24 --lib "$JAR" --output $OUT/dex $(find $OUT/classes -name '*.class')
cp $OUT/base.apk $OUT/unsigned.apk
(cd $OUT/dex && "$JDK/bin/jar.exe" uf ../unsigned.apk classes.dex)
"$BT/zipalign.exe" -f -p 4 $OUT/unsigned.apk $OUT/aligned.apk
"$BT/apksigner.bat" sign --ks "$KEYS/gravetide-rustore.jks" --ks-key-alias gravetide --ks-pass file:"$KEYS/keystore-password.txt" --out $OUT/gravetide-rustore-$VN.apk $OUT/aligned.apk
"$BT/apksigner.bat" verify --print-certs $OUT/gravetide-rustore-$VN.apk | head -3
ls -la $OUT/gravetide-rustore-$VN.apk
