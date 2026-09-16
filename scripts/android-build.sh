#!/usr/bin/env bash
#
# 안드로이드 APK/AAB 를 굽는다 — 정본은 docs/PLAN-ANDROID.md §1 결정 15·17·22.
#
# ── 이 스크립트가 있는 이유 ─────────────────────────────────────────────────────────
# `./gradlew` 를 손으로 부르면 매번 두 가지를 잊는다.
#
#  ① **JAVA_HOME.** gofu 의 기본 `java` 는 25 이고 Android Gradle Plugin 8.13 은 그 위에서
#     터진다("Unsupported class file major version" 계열). 필요한 것은 JDK 21 이다(결정 15).
#     환경변수가 비어 있으면 여기서 골라 준다 — 고르지 못하면 **조용히 25 로 도는 대신**
#     멈춘다. 조용히 도는 쪽이 훨씬 비싸다(에러 메시지가 원인을 가리키지 않는다).
#
#  ② **서명 유무에 따른 목표 선택.** 서명 환경변수 넷이 다 있으면 릴리스(APK+AAB 한 번에,
#     결정 17), 하나라도 없으면 디버그다. `app/build.gradle` 은 "있으면 건다" 만 하므로,
#     없을 때 `assembleRelease` 를 부르면 **서명 없는 릴리스 APK** 가 조용히 나온다 —
#     설치도 안 되고 Play 도 안 받는데 빌드는 초록이다. 그 갈림을 여기서 막는다.
#
# ⚠️ 웹 자산(dist/)을 굽지 않는다. `npm run android:build` 가 `npm run build` →
#    `npx cap sync android` 를 먼저 돌리고 이 스크립트를 부른다 — 그 순서가 package.json 에
#    보이는 편이, Capacitor 훅(`capacitor:sync:before`) 안에 숨는 것보다 낫다(결정 19).
#
# 사용법:
#   npm run android:build            # 서명 env 가 있으면 릴리스, 없으면 디버그
#   bash scripts/android-build.sh    # (같은 것 — 웹 빌드·sync 없이 gradle 만)
set -euo pipefail
cd "$(dirname "$0")/.."

ANDROID_DIR="src-android"

# ── ① JDK 21 고르기 ─────────────────────────────────────────────────────────────────
if [ -z "${JAVA_HOME:-}" ]; then
  for candidate in /usr/lib/jvm/java-21-openjdk-amd64 /opt/android-studio/jbr; do
    if [ -x "$candidate/bin/java" ]; then
      JAVA_HOME="$candidate"
      break
    fi
  done
fi
if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo "오류: JDK 21 을 찾지 못했습니다. JAVA_HOME 을 직접 지정하세요." >&2
  echo "      예: JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 npm run android:build" >&2
  exit 1
fi
export JAVA_HOME
# 넘겨받은 JAVA_HOME 도 판을 본다 — 셸 프로필이 25 를 내보낸 환경이면 위 자동 선택을 건너뛰고
# Gradle 이 원인을 가리키지 않는 에러로 죽는다(2026-09-17 검수). `sed -n 1p` 는 `head` 와 달리
# 스트림을 끝까지 읽어 pipefail 아래서 SIGPIPE(141) 로 안 죽는다.
java_major=$("$JAVA_HOME/bin/java" -version 2>&1 | sed -n '1p' | sed -E 's/.*version "([0-9]+).*/\1/')
if [ "$java_major" != "21" ]; then
  echo "오류: JAVA_HOME 이 JDK 21 이 아닙니다(현재 ${java_major:-?}): $JAVA_HOME" >&2
  exit 1
fi
echo "JAVA_HOME=$JAVA_HOME ($("$JAVA_HOME/bin/java" -version 2>&1 | sed -n '1p'))"

# ANDROID_HOME 이 없으면 Gradle 이 SDK 를 못 찾는다. local.properties(gitignore) 가 있으면
# 그쪽이 이기므로 여기서는 환경변수만 본다 — 없을 때 미리 말해 주는 것이 목적이다.
if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ] && [ ! -f "$ANDROID_DIR/local.properties" ]; then
  echo "오류: ANDROID_HOME(또는 ANDROID_SDK_ROOT)이 비어 있고 $ANDROID_DIR/local.properties 도 없습니다." >&2
  echo "      예: ANDROID_HOME=\$HOME/Android/Sdk npm run android:build" >&2
  exit 1
fi

# ── ② 서명 유무로 목표를 고른다 ─────────────────────────────────────────────────────
signed=1
for var in SPIN_ANDROID_KEYSTORE_FILE SPIN_ANDROID_KEYSTORE_PASSWORD SPIN_ANDROID_KEY_ALIAS SPIN_ANDROID_KEY_PASSWORD; do
  if [ -z "${!var:-}" ]; then
    signed=0
    break
  fi
done

start=$(date +%s)
if [ "$signed" -eq 1 ]; then
  echo "서명 환경변수 4개 확인 — 릴리스(APK + AAB)를 굽습니다."
  (cd "$ANDROID_DIR" && ./gradlew assembleRelease bundleRelease)
  outputs=(
    "$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
    "$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
  )
else
  echo "서명 환경변수가 없습니다 — 디버그 APK 로 떨어집니다(설치·실기 시험용)."
  (cd "$ANDROID_DIR" && ./gradlew assembleDebug)
  outputs=("$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk")
fi

echo "빌드 완료 ($(( $(date +%s) - start ))초)"
for f in "${outputs[@]}"; do
  if [ -f "$f" ]; then
    # --apparent-size 를 쓰는 이유: 방금 쓴 파일은 아직 디스크에 다 내려가지 않아서 맨 `du` 가
    # 7MB 짜리 APK 를 "1.0K" 로 보고한다(2026-09-17 실측). 크기를 보는 목적이 «제대로 구워졌나»
    # 확인인데 그 숫자가 거짓이면 이 줄이 오히려 사람을 속인다.
    echo "  $f ($(du -h --apparent-size "$f" | cut -f1))"
  else
    echo "  ⚠️ 없음: $f" >&2
  fi
done
