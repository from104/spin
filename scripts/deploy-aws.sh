#!/usr/bin/env bash
#
# SPIN 배포 — spin.atit.app (AWS Lightsail)
#
# ★ **이것이 기본 배포다.** spin.atit.dev 는 여기로 리다이렉트하므로(2026-09-01 기현님 확인)
#   "배포" 라고만 하면 이 스크립트다. scripts/deploy.sh(cube)는 사본을 놓는 용도로만 남아 있다.
#
# ── 배포가 무엇인가 ──────────────────────────────────────────────────────────────────
# spin.atit.dev(scripts/deploy.sh, cube)와 별개의 두 번째 배포처다. Lightsail 인스턴스에
# Apache 이름기반 가상호스트를 하나 추가해 뒀다(conf/vhosts/spin-vhost.conf,
# ServerName spin.atit.app) — 그 vhost 의 DocumentRoot 가
#   /opt/bitnami/apache2/spin-htdocs
# 다. 같은 인스턴스의 _default_ catch-all vhost(/opt/bitnami/apache2/htdocs)는 건드리지
# 않는다. 이 스크립트는 그 디렉터리에 dist/ 를 올리는 것이 전부다 — vhost·DNS 는 이미
# 구성되어 있고 다시 만들 일은 없다.
#
# 사용법:
#   npm run deploy:aws              # 테스트 → 빌드 → 배포
#   npm run deploy:aws -- --dry-run # 무엇이 바뀔지만 보여준다 (아무것도 안 쓴다)
#   npm run deploy:aws -- --no-test # 테스트를 건너뛴다 (빌드는 건너뛰지 않는다)
#   npm run deploy:aws -- --first   # 대상이 비어 있는 첫 배포 (아래 안전장치 참조)
#
# ── 대상은 저장소에 적지 않는다 ──────────────────────────────────────────────────────
# 호스트·계정·SSH 키는 공개 저장소에 둘 것이 아니다. 전부 환경변수로 받고, 없으면 여기서
# 멈춘다. 저장소 루트의 `.env.deploy`(gitignore 대상)에 넣어 두면 아래에서 읽는다 —
# 키 이름은 `.env.deploy.example` 에 있다.
#   SPIN_AWS_HOST · SPIN_AWS_USER · SPIN_AWS_PEM (필수)
#   SPIN_AWS_PATH(=/opt/bitnami/apache2/spin-htdocs) · SPIN_AWS_URL(=https://spin.atit.app)
set -euo pipefail

# .env.deploy 가 있으면 읽는다. 이미 환경에 있는 값이 이긴다(export 된 쪽을 존중).
if [ -f "$(dirname "$0")/../.env.deploy" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$(dirname "$0")/../.env.deploy"
  set +a
fi

HOST="${SPIN_AWS_HOST:-}"
USER="${SPIN_AWS_USER:-}"
PEM="${SPIN_AWS_PEM:-}"
DEST="${SPIN_AWS_PATH:-/opt/bitnami/apache2/spin-htdocs}"
URL="${SPIN_AWS_URL:-https://spin.atit.app}"

RUN_TEST=1
DRY=0
FIRST=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --no-test) RUN_TEST=0 ;;
    --first)   FIRST=1 ;;
    -h|--help) sed -n '1,28p' "$0"; exit 0 ;;
    *) echo "모르는 인자: $arg" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ── 대상이 주어졌나 ──────────────────────────────────────────────────────────────────
missing=""
[ -n "$HOST" ] || missing="$missing SPIN_AWS_HOST"
[ -n "$USER" ] || missing="$missing SPIN_AWS_USER"
[ -n "$PEM" ]  || missing="$missing SPIN_AWS_PEM"
if [ -n "$missing" ]; then
  echo "❌ 배포 대상이 없습니다 —$missing 을 .env.deploy 또는 환경에 넣으세요." >&2
  echo '   .env.deploy.example 을 .env.deploy 로 복사해 값을 채우면 됩니다.' >&2
  exit 1
fi

say "SPIN 배포 → $USER@$HOST:$DEST (Lightsail)"
printf '  커밋 %s (%s)\n' "$(git rev-parse --short HEAD)" "$(git rev-parse --abbrev-ref HEAD)"
printf '  버전 %s\n' "$(node -p "require('./package.json').version")"
if [ -n "$(git status --porcelain)" ]; then
  printf '  \033[33m⚠️  커밋되지 않은 변경이 있습니다 — 배포본과 저장소가 어긋납니다.\033[0m\n'
fi

# ── 사전 점검 ────────────────────────────────────────────────────────────────────────
if [ ! -f "$PEM" ]; then
  echo "❌ PEM key not found at $PEM" >&2
  exit 1
fi
PEM_PERMS=$(stat -c %a "$PEM")
if [ "$PEM_PERMS" != "600" ] && [ "$PEM_PERMS" != "400" ]; then
  chmod 600 "$PEM"
fi

if ! ssh -i "$PEM" -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=10 \
     "$USER@$HOST" 'true' 2>/dev/null; then
  echo "❌ SSH to $USER@$HOST 실패. PEM·네트워크·Lightsail 방화벽 확인." >&2
  exit 1
fi

# ── 검증 ─────────────────────────────────────────────────────────────────────────────
if [ "$RUN_TEST" = 1 ]; then
  say "테스트"
  npm test
fi

say "빌드"
npm run build

# 빌드가 조용히 실패해 빈 dist 를 배포하는 것이 가장 나쁜 경우다 — 그때 사이트가 통째로
# 죽는데 스크립트는 성공으로 끝난다.
[ -f dist/index.html ] || { echo "dist/index.html 이 없습니다 — 빌드가 실패했습니다." >&2; exit 1; }

# 데스크톱 client_secret 이 이 웹 빌드에 새지 않았는지 확인한다(2026-09-05 감사, [치명 2]).
# `.env.local` 이 있고 그 값이 비어 있지 않은데 dist/ 어딘가에 그대로 박혀 있으면, 그건
# `vite.config.ts` 의 envPrefix 게이팅이 깨졌거나 다른 경로로 새어 들어갔다는 뜻이다 — 화면에
# 값을 절대 내지 않고(grep 결과만 참/거짓으로 판정) 배포를 여기서 멈춘다.
if [ -f .env.local ]; then
  # 따옴표·공백은 벗긴다 — dotenv 는 벗겨서 넣으므로 번들에는 맨 값만 실린다. 안 벗기면
  # 따옴표로 감싼 값이 영영 안 맞아 경보가 무음이 된다(2026-09-05 검수).
  DESKTOP_SECRET=$(sed -n 's/^SPIN_DESKTOP_GOOGLE_CLIENT_SECRET=//p' .env.local | tr -d '"'"'"' ')
  if [ -n "$DESKTOP_SECRET" ]; then
    if grep -rqF -- "$DESKTOP_SECRET" dist/; then
      echo "데스크톱 client_secret 이 웹 번들에 들어 있습니다 — 배포 중단" >&2
      exit 1
    fi
    echo "누출 검사: 데스크톱 client_secret 이 dist/ 에 없음 — 통과"
  else
    # '검사했고 깨끗함' 과 '검사 안 함' 이 화면에서 구별돼야 한다.
    echo "누출 검사 건너뜀: .env.local 에 SPIN_DESKTOP_GOOGLE_CLIENT_SECRET 이 없음" >&2
  fi
else
  echo "누출 검사 건너뜀: .env.local 없음" >&2
fi

# ── 대상 안전장치 ────────────────────────────────────────────────────────────────────
# `--delete` 를 쓰므로 **경로가 틀리면 남의 디렉터리를 비운다.** 대상에 이전 배포본의
# index.html 이 있는지 먼저 확인해 첫 배포와 경로 오타를 구분한다.
HAS_INDEX=$(ssh -i "$PEM" -o ConnectTimeout=10 "$USER@$HOST" \
  "test -f '$DEST/index.html' && echo 1 || echo 0")
if [ "$HAS_INDEX" != 1 ] && [ "$FIRST" != 1 ]; then
  cat >&2 <<EOF

⛔ 대상에 index.html 이 없습니다: $USER@$HOST:$DEST
   경로가 틀렸거나 첫 배포입니다. --delete 로 다른 디렉터리를 비우지 않기 위해 멈춥니다.
   정말 첫 배포라면:  npm run deploy:aws -- --first
EOF
  exit 1
fi

# ── 전송 ─────────────────────────────────────────────────────────────────────────────
# --delete: 이름에 해시가 붙은 낡은 asset 이 쌓이는 것을 막는다.
# --exclude .deployed.json: 아래에서 우리가 쓰는 배포 기록이다. dist 에 없으므로 --delete 가
#   매번 지워 버린다.
RSYNC=(rsync -rlptv --delete --exclude='.deployed.json' --human-readable
       -e "ssh -i $PEM -o StrictHostKeyChecking=no -o ConnectTimeout=10")
[ "$DRY" = 1 ] && RSYNC+=(--dry-run)

say "전송$([ "$DRY" = 1 ] && echo ' (드라이런 — 아무것도 안 씁니다)')"
"${RSYNC[@]}" dist/ "$USER@$HOST:$DEST/"

if [ "$DRY" = 1 ]; then
  say "드라이런 끝 — 실제로 배포하려면 --dry-run 을 빼십시오."
  exit 0
fi

# ── 배포 기록 ────────────────────────────────────────────────────────────────────────
# 이 파일은 **웹에서 안 읽힌다** — `by` 에 배포자의 사용자명@호스트명이 들어가는데 그게 공개로
# 흘러서, 2026-09-01 에 vhost(spin-vhost.conf)에서 점 파일을 403 으로 막았다. `.well-known` 만
# 예외다(인증서 갱신). 그래서 "지금 떠 있는 게 어느 커밋인가" 는 curl 이 아니라 ssh 로 본다:
#   ssh -i "$PEM" "$USER@$HOST" "cat $DEST/.deployed.json"
INFO=$(printf '{"commit":"%s","version":"%s","at":"%s","by":"%s@%s","target":"aws"}\n' \
  "$(git rev-parse HEAD)" \
  "$(node -p "require('./package.json').version")" \
  "$(date -Iseconds)" \
  "$(id -un)" "$(hostname)")
printf '%s' "$INFO" | ssh -i "$PEM" -o ConnectTimeout=10 "$USER@$HOST" "cat > '$DEST/.deployed.json'"

say "배포 완료 → $URL"
echo "  $INFO"
