#!/usr/bin/env bash
#
# 고친 파일만 린트한다 (기현 지시 2026-09-02: *"파일별 린트 하면 안 되겠니?"*)
#
# ── 왜 필요한가 ──────────────────────────────────────────────────────────────────────
# `npm run lint` 는 저장소 전체를 돌고 **오래된 경고 46줄**을 함께 뱉는다(2026-09-02 실측).
# 전부 fast-refresh·exhaustive-deps 류의 오랜 잔소리라 고칠 계획이 없는데, 그 46줄 속에서
# 방금 만든 한 줄을 찾아내야 한다. 결국 "경고가 늘었나" 를 눈으로 세게 되고, 그러면 안 센다.
#
# 파일을 지정하면 0.3초에 끝나고 출력이 **비어 있으면 깨끗한 것**이다 — 세지 않아도 된다.
# `test:rel`(vitest related)이 테스트에서 하는 일과 같은 짝이다.
#
# ── 무엇을 고른가 ────────────────────────────────────────────────────────────────────
# 인자를 주면 그 파일들. 안 주면 **HEAD 이후 손댄 .ts/.tsx 전부** — 스테이지 여부와 무관하게
# 고친 것(diff)과 아직 git 이 모르는 새 파일(untracked)을 함께 본다. 새 파일이 빠지면
# "새로 만든 파일만 검사를 안 받는" 가장 나쁜 구멍이 생긴다.
#
# 사용법:
#   npm run lint:rel                      # HEAD 이후 바뀐 파일 전부
#   npm run lint:rel src/app/AppRail.tsx  # 지정한 파일만
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$#" -gt 0 ]; then
  files=("$@")
else
  # -z 로 NUL 구분해 읽는다 — 경로에 공백이 있어도 안 갈라진다.
  mapfile -d '' -t changed < <(git diff -z --name-only --diff-filter=ACMR HEAD -- '*.ts' '*.tsx')
  mapfile -d '' -t added < <(git ls-files -z --others --exclude-standard -- '*.ts' '*.tsx')
  files=("${changed[@]}" "${added[@]}")
fi

# 지운 파일·이미 사라진 경로를 거른다. 없는 경로를 넘기면 oxlint 가 통째로 실패한다.
present=()
for f in "${files[@]:-}"; do
  [ -n "$f" ] && [ -f "$f" ] && present+=("$f")
done

# ⚠️ 빈 목록으로 oxlint 를 부르면 **저장소 전체**를 돈다 — "바뀐 게 없다" 가 조용히
#    전체 린트로 둔갑하면 이 스크립트를 쓰는 뜻이 사라진다. 그래서 여기서 멈춘다.
if [ "${#present[@]}" -eq 0 ]; then
  echo "린트할 파일이 없습니다 — HEAD 이후 바뀐 .ts/.tsx 가 없습니다."
  exit 0
fi

printf '린트 %d개 파일\n' "${#present[@]}"
exec npx oxlint "${present[@]}"
