#!/usr/bin/env bash
#
# SPIN 배포 — spin.atit.app (AWS Lightsail)
#
# ── 배포가 무엇인가 ──────────────────────────────────────────────────────────────────
# spin.atit.dev(scripts/deploy.sh, cube)와 별개의 두 번째 배포처다. AWS Lightsail
# (<AWS_HOST>, mocil 과 같은 서버)에 Apache 이름기반 가상호스트를 하나 추가해 뒀다
# (conf/vhosts/spin-vhost.conf, ServerName spin.atit.app) — 그 vhost 의 DocumentRoot 가
#   /opt/bitnami/apache2/spin-htdocs
# 다. mocil 은 _default_ catch-all vhost(/opt/bitnami/apache2/htdocs)라 이 경로는 건드리지
# 않는다. 이 스크립트는 그 디렉터리에 dist/ 를 올리는 것이 전부다 — vhost·DNS(Cloudflare
# spin.atit.app A → <AWS_HOST>)는 이미 구성되어 있고 다시 만들 일은 없다.
#
# 사용법:
#   npm run deploy:aws              # 테스트 → 빌드 → 배포
#   npm run deploy:aws -- --dry-run # 무엇이 바뀔지만 보여준다 (아무것도 안 쓴다)
#   npm run deploy:aws -- --no-test # 테스트를 건너뛴다 (빌드는 건너뛰지 않는다)
#   npm run deploy:aws -- --first   # 대상이 비어 있는 첫 배포 (아래 안전장치 참조)
#
# 환경변수로 대상을 바꿀 수 있다:
#   SPIN_AWS_HOST(=<AWS_HOST>) · SPIN_AWS_USER(=bitnami) ·
#   SPIN_AWS_PEM(=~/.ssh/<AWS_PEM>) · SPIN_AWS_PATH(=/opt/bitnami/apache2/spin-htdocs)
set -euo pipefail

HOST="${SPIN_AWS_HOST:-<AWS_HOST>}"
USER="${SPIN_AWS_USER:-bitnami}"
PEM="${SPIN_AWS_PEM:-$HOME/.ssh/<AWS_PEM>}"
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
    -h|--help) sed -n '1,25p' "$0"; exit 0 ;;
    *) echo "모르는 인자: $arg" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "SPIN 배포 → $USER@$HOST:$DEST (AWS Lightsail)"
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
INFO=$(printf '{"commit":"%s","version":"%s","at":"%s","by":"%s@%s","target":"aws"}\n' \
  "$(git rev-parse HEAD)" \
  "$(node -p "require('./package.json').version")" \
  "$(date -Iseconds)" \
  "$(id -un)" "$(hostname)")
printf '%s' "$INFO" | ssh -i "$PEM" -o ConnectTimeout=10 "$USER@$HOST" "cat > '$DEST/.deployed.json'"

say "배포 완료 → $URL"
echo "  $INFO"
