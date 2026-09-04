#!/usr/bin/env bash
#
# SPIN 배포 — spin.atit.dev
#
# ⚠️ ── 이 스크립트는 더 이상 기본 배포가 아니다 (2026-09-01 기현님 확인) ────────────────
# **spin.atit.dev 는 spin.atit.app 으로 리다이렉트한다.** 실제로 사람이 보는 것은 AWS 쪽이고,
# "배포" 라고만 하면 그것은 `npm run deploy:aws` 다. 이 스크립트는 cube 에 사본을 놓는 용도로
# 남겨 둔다 — 아래 설명은 그 사본에 대한 것이지, 서비스 중인 사이트에 대한 것이 아니다.
#
# 왜 굳이 적어 두는가: 이 파일과 deploy-aws.sh 를 나란히 읽으면 **살아 있는 배포처가 둘** 로
# 보인다. 실제로 2026-09-01 릴리스 때 그렇게 읽고 어디로 올릴지 되물었다. 리다이렉트라는
# 사실은 코드 어디에도 안 적혀 있어서 물어보지 않으면 알 길이 없었다.
#
# ── 배포가 무엇인가 ──────────────────────────────────────────────────────────────────
# 이 앱은 정적 빌드다(REQUIREMENTS §1 "서버 없음"). 배포는 `dist/` 를 cube 의
#   /pool/vhost/sites/spin
# 에 놓는 것이 전부다. 그 디렉터리는 `spin-web`(nginx:alpine)에 읽기 전용으로 물려 있고,
# 그 앞의 `vhost-proxy`(nginx-proxy)가 VIRTUAL_HOST=spin.atit.dev 로 라우팅한다.
# 서버 설정을 만질 일이 없다 — 파일만 갈아 끼운다.
#
# ── 왜 이 스크립트가 생겼나 (2026-08-17 기현님 지시) ──────────────────────────────────
# *"지금은 cube에서만 배포가 가능한데 gofu에서도 배포 가능하게 해줘."*
#
# cube 에서만 되던 이유는 권한이 아니라 **경로가 안 보여서**다: gofu 에 NFS 로 오는 것은
# /pool/sync · /pool/data · /pool/backup 셋뿐이고 /pool/vhost 는 오지 않는다. Syncthing 이
# 나르는 것도 `work` 폴더(= cube 의 /pool/work)까지다. 그래서 gofu 에서 아무리 빌드해도
# 놓을 자리가 없었다.
#
# 고르지 않은 길 둘, 근거와 함께:
#   ① **NFS export 에 /pool/vhost 추가** — cube 의 시스템 설정을 바꾸고, 재부팅 마운트를
#      유지해야 하고, 노출면이 는다. 얻는 것은 "cp 로 배포" 하나뿐이다.
#   ② **배포 디렉터리를 Syncthing 폴더로** — 양방향 동기화라 **삭제도 양방향으로 번진다.**
#      배포는 단방향이어야 하고, 한쪽 사고가 상대를 지우면 안 된다.
# 그래서 SSH + rsync 다. gofu 는 이미 cube 에 키로 붙는다 — **바꿀 시스템 설정이 0 이다.**
#
# ── 한 스크립트가 양쪽에서 돈다 ──────────────────────────────────────────────────────
# cube 에서 실행하면 로컬 복사, 그 밖에서 실행하면 ssh 를 태운다. 배포 절차를 기기마다
# 다르게 적어 두면 한쪽만 고쳐지고, 그러면 "내 기기에서는 되는데" 가 다시 생긴다.
#
# 사용법:
#   npm run deploy              # 테스트 → 빌드 → 배포
#   npm run deploy -- --dry-run # 무엇이 바뀔지만 보여준다 (아무것도 안 쓴다)
#   npm run deploy -- --no-test # 테스트를 건너뛴다 (빌드는 건너뛰지 않는다)
#   npm run deploy -- --first   # 대상이 비어 있는 첫 배포 (아래 안전장치 참조)
#
# 환경변수로 대상을 바꿀 수 있다: SPIN_DEPLOY_HOST · SPIN_DEPLOY_PATH
set -euo pipefail

HOST="${SPIN_DEPLOY_HOST:-cube}"
DEST="${SPIN_DEPLOY_PATH:-/pool/vhost/sites/spin}"
URL="${SPIN_DEPLOY_URL:-https://spin.atit.dev}"

RUN_TEST=1
DRY=0
FIRST=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --no-test) RUN_TEST=0 ;;
    --first)   FIRST=1 ;;
    -h|--help) sed -n '1,45p' "$0"; exit 0 ;;
    *) echo "모르는 인자: $arg" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."

# cube 에서 돌면 로컬 복사다. `hostname` 이 아니라 **대상 경로가 실제로 있는가**로 판정한다 —
# 호스트명은 바뀔 수 있지만 "그 디렉터리가 여기 있는가" 는 언제나 참이다.
if [ -d "$DEST" ]; then
  LOCAL=1
  TARGET="$DEST/"
  WHERE="로컬 ($DEST)"
else
  LOCAL=0
  TARGET="$HOST:$DEST/"
  WHERE="$HOST:$DEST (ssh)"
fi

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "SPIN 배포 → $WHERE"
printf '  커밋 %s (%s)\n' "$(git rev-parse --short HEAD)" "$(git rev-parse --abbrev-ref HEAD)"
printf '  버전 %s\n' "$(node -p "require('./package.json').version")"
if [ -n "$(git status --porcelain)" ]; then
  printf '  \033[33m⚠️  커밋되지 않은 변경이 있습니다 — 배포본과 저장소가 어긋납니다.\033[0m\n'
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
# `--delete` 를 쓰므로 **경로가 틀리면 남의 디렉터리를 비운다.** 그래서 대상에 이전 배포본의
# index.html 이 있는지 먼저 확인한다. 없으면 (첫 배포이거나) 경로가 틀린 것이고, 둘을 구분할
# 방법이 없으므로 사람에게 묻는다 — `--first` 가 그 답이다.
if [ "$LOCAL" = 1 ]; then
  HAS_INDEX=$([ -f "$DEST/index.html" ] && echo 1 || echo 0)
else
  HAS_INDEX=$(ssh -o ConnectTimeout=10 "$HOST" "test -f '$DEST/index.html' && echo 1 || echo 0")
fi
if [ "$HAS_INDEX" != 1 ] && [ "$FIRST" != 1 ]; then
  cat >&2 <<EOF

⛔ 대상에 index.html 이 없습니다: $WHERE
   경로가 틀렸거나 첫 배포입니다. --delete 로 남의 디렉터리를 비우지 않기 위해 멈춥니다.
   정말 첫 배포라면:  npm run deploy -- --first
EOF
  exit 1
fi

# ── 전송 ─────────────────────────────────────────────────────────────────────────────
# --no-o --no-g: 대상 디렉터리는 setgid(2775, 그룹 syncthing)다. 소유권까지 맞추려 들면
#   ① gofu 의 from104 는 syncthing 그룹이 아니라 그룹이 어긋나고 ② setgid 의 뜻이 깨진다.
#   빼 두면 새 파일이 디렉터리에서 그룹을 상속한다.
# --delete: 이름에 해시가 붙은 낡은 asset 이 쌓이는 것을 막는다.
# --exclude .deployed.json: 아래에서 우리가 쓰는 배포 기록이다. dist 에 없으므로 --delete 가
#   매번 지워 버린다.
RSYNC=(rsync -rlptv --no-o --no-g --delete --exclude='.deployed.json' --human-readable)
[ "$DRY" = 1 ] && RSYNC+=(--dry-run)
[ "$LOCAL" = 0 ] && RSYNC+=(-e "ssh -o ConnectTimeout=10")

say "전송$([ "$DRY" = 1 ] && echo ' (드라이런 — 아무것도 안 씁니다)')"
"${RSYNC[@]}" dist/ "$TARGET"

if [ "$DRY" = 1 ]; then
  say "드라이런 끝 — 실제로 배포하려면 --dry-run 을 빼십시오."
  exit 0
fi

# ── 배포 기록 ────────────────────────────────────────────────────────────────────────
# "지금 떠 있는 것이 어느 커밋인가" 를 나중에 알 수 있어야 한다. 앱 화면의 버전 표시는
# minor 단위라 커밋을 못 가린다.
INFO=$(printf '{"commit":"%s","version":"%s","at":"%s","by":"%s@%s"}\n' \
  "$(git rev-parse HEAD)" \
  "$(node -p "require('./package.json').version")" \
  "$(date -Iseconds)" \
  "$(id -un)" "$(hostname)")
if [ "$LOCAL" = 1 ]; then
  printf '%s' "$INFO" > "$DEST/.deployed.json"
else
  printf '%s' "$INFO" | ssh -o ConnectTimeout=10 "$HOST" "cat > '$DEST/.deployed.json'"
fi

say "배포 완료 → $URL"
echo "  $INFO"
