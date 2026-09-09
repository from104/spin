#!/usr/bin/env bash
#
# SPIN 공유 링크 백엔드 배포 — spin.atit.app 과 같은 호스트 (AWS Lightsail)
#
# 정본: docs/PLAN-SHARE-LINK.md 결정 12.
#
# ── 무엇을 하는가 ───────────────────────────────────────────────────────────────────
#  ① server/share/ 를 원격 /opt/spin-share/ 로 rsync (데이터 디렉터리는 건드리지 않는다)
#  ② deploy/share/spin-share.service 를 systemd 에 설치하고 daemon-reload → restart
#  ③ deploy/share/apache-share.conf 를 vhost 폴더에 놓고, vhost 에 Include 줄이 있는지 **본다**
#  ④ healthz 를 쳐서 실제로 살아 있는지 확인
#
# ⚠️ ③에서 **vhost 를 자동으로 고치지 않는다.** spin-vhost.conf 는 같은 인스턴스의 다른
#    사이트와 한 Apache 를 나눠 쓰는 파일이라, 스크립트가 sed 로 손대면 실수의 범위가 이
#    기능 밖으로 나간다. 줄이 없으면 무엇을 어디에 넣어야 하는지 화면에 적고 끝낸다.
#
# ⚠️ 이 스크립트는 **원격 시스템 설정을 바꾼다**(systemd 유닛 설치·서비스 재시작).
#    기현님 승인 뒤에만 실행한다. 먼저 `--dry-run` 으로 무엇이 바뀌는지 보라.
#
# 사용법:
#   npm run deploy:aws -- --dry-run   와 같은 결로:
#   bash scripts/deploy-share.sh --dry-run   # 전송 목록만 보여준다 (원격을 안 고친다)
#   bash scripts/deploy-share.sh             # 실제 배포
#   bash scripts/deploy-share.sh --no-test   # 서버 테스트를 건너뛴다
#
# ── 대상은 저장소에 적지 않는다 (deploy-aws.sh 와 같은 규칙·같은 변수 이름) ──────────
# 호스트·계정·SSH 키는 공개 저장소에 둘 것이 아니다. 전부 환경변수로 받고, 없으면 여기서
# 멈춘다. 저장소 루트의 `.env.deploy`(gitignore 대상)에 넣어 두면 아래에서 읽는다 —
# 키 이름은 `.env.deploy.example` 에 있다.
#   SPIN_AWS_HOST · SPIN_AWS_USER · SPIN_AWS_PEM (필수)
#   SPIN_SHARE_PATH(=/opt/spin-share) · SPIN_SHARE_URL(=https://spin.atit.app/api/share/healthz)
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
DEST="${SPIN_SHARE_PATH:-/opt/spin-share}"
HEALTH_URL="${SPIN_SHARE_URL:-https://spin.atit.app/api/share/healthz}"
VHOST_DIR="${SPIN_AWS_VHOST_DIR:-/opt/bitnami/apache2/conf/vhosts}"
VHOST_FILE="$VHOST_DIR/spin-vhost.conf"
SHARE_CONF="$VHOST_DIR/spin-share.conf"
# 원격 노드. systemd 유닛의 ExecStart 와 **같은 경로여야 한다** — 다르면 여기서 통과하고
# 서비스에서 죽는다.
REMOTE_NODE="${SPIN_AWS_NODE:-/opt/bitnami/node/bin/node}"

RUN_TEST=1
DRY=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --no-test) RUN_TEST=0 ;;
    -h|--help) sed -n '1,31p' "$0"; exit 0 ;;
    *) echo "모르는 인자: $arg" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }

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

SSH=(ssh -i "$PEM" -o StrictHostKeyChecking=no -o ConnectTimeout=10)

say "SPIN 공유 백엔드 배포 → $USER@$HOST:$DEST"
printf '  커밋 %s (%s)\n' "$(git rev-parse --short HEAD)" "$(git rev-parse --abbrev-ref HEAD)"
if [ -n "$(git status --porcelain -- server/share deploy/share scripts/deploy-share.sh)" ]; then
  warn '  ⚠️  커밋되지 않은 변경이 있습니다 — 배포본과 저장소가 어긋납니다.'
fi

# ── 사전 점검 ────────────────────────────────────────────────────────────────────────
[ -f "$PEM" ] || { echo "❌ PEM 키가 없습니다: $PEM" >&2; exit 1; }
PEM_PERMS=$(stat -c %a "$PEM")
if [ "$PEM_PERMS" != "600" ] && [ "$PEM_PERMS" != "400" ]; then chmod 600 "$PEM"; fi

if ! "${SSH[@]}" -o BatchMode=yes "$USER@$HOST" 'true' 2>/dev/null; then
  echo "❌ SSH 실패: $USER@$HOST — PEM·네트워크·방화벽 확인." >&2
  exit 1
fi

# ⚠️ 이 서버는 빌드 산출물이 없다 — 노드가 .ts 를 직접 돌린다. 22.18 미만이면 유닛이
#    SyntaxError 로 죽고, 그 사실이 healthz 실패로만 보여 원인을 찾는 데 시간이 든다.
say "원격 노드 버전"
NODE_V=$("${SSH[@]}" "$USER@$HOST" "$REMOTE_NODE --version" 2>/dev/null || echo "none")
printf '  %s → %s\n' "$REMOTE_NODE" "$NODE_V"
case "$NODE_V" in
  none) echo "❌ 원격에 노드가 없습니다($REMOTE_NODE). SPIN_AWS_NODE 로 경로를 주십시오." >&2; exit 1 ;;
  v2[2-9].*|v[3-9][0-9].*) : ;;
  *) echo "❌ Node 22.18 이상이 필요합니다(.ts 직접 실행). 지금: $NODE_V" >&2; exit 1 ;;
esac
# v22 는 마이너까지 본다 — 22.0~22.17 은 .ts 를 못 돈다.
if [[ "$NODE_V" =~ ^v22\.([0-9]+)\. ]] && [ "${BASH_REMATCH[1]}" -lt 18 ]; then
  echo "❌ Node 22.18 이상이 필요합니다(.ts 직접 실행). 지금: $NODE_V" >&2
  exit 1
fi

if [ "$RUN_TEST" = 1 ]; then
  say "서버 테스트"
  npm run share:test
fi

# ── ① 코드 전송 ──────────────────────────────────────────────────────────────────────
# --delete 를 쓰되 **data/ 는 제외**한다 — 그 안이 이용자가 올린 암호문이다. 테스트 파일은
# 운영에 올릴 이유가 없다.
RSYNC=(rsync -rlptv --delete --exclude='data/' --exclude='*.test.ts' --human-readable
       -e "ssh -i $PEM -o StrictHostKeyChecking=no -o ConnectTimeout=10")
[ "$DRY" = 1 ] && RSYNC+=(--dry-run)

say "① 코드 전송$([ "$DRY" = 1 ] && echo ' (드라이런)')"
"${SSH[@]}" "$USER@$HOST" "sudo mkdir -p '$DEST/data' && sudo chown -R $USER:$USER '$DEST'"
"${RSYNC[@]}" server/share/ "$USER@$HOST:$DEST/"

if [ "$DRY" = 1 ]; then
  say "드라이런 끝 — 유닛 설치·재시작·헬스체크는 건너뜁니다."
  exit 0
fi

# ── ② systemd 유닛 ───────────────────────────────────────────────────────────────────
say "② systemd 유닛 설치·재시작"
"${SSH[@]}" "$USER@$HOST" "sudo tee /etc/systemd/system/spin-share.service >/dev/null" \
  < deploy/share/spin-share.service
"${SSH[@]}" "$USER@$HOST" \
  'sudo systemctl daemon-reload && sudo systemctl enable spin-share.service && sudo systemctl restart spin-share.service'
sleep 1
"${SSH[@]}" "$USER@$HOST" 'systemctl is-active spin-share.service && systemctl --no-pager -l status spin-share.service | head -12'

# ── ③ Apache 조각 ────────────────────────────────────────────────────────────────────
say "③ Apache 프록시 조각"
"${SSH[@]}" "$USER@$HOST" "sudo tee '$SHARE_CONF' >/dev/null" < deploy/share/apache-share.conf
if "${SSH[@]}" "$USER@$HOST" "grep -q 'spin-share.conf' '$VHOST_FILE'"; then
  echo "  vhost 에 Include 줄이 이미 있습니다 — Apache 를 다시 읽습니다."
  "${SSH[@]}" "$USER@$HOST" 'sudo /opt/bitnami/ctlscript.sh restart apache'
else
  warn "  ⚠️  vhost 에 Include 줄이 없습니다. **자동으로 고치지 않습니다.**"
  cat <<EOF

     $VHOST_FILE 의 <VirtualHost *:443> 블록 안에 다음 한 줄을 넣으십시오:

         Include "$SHARE_CONF"

     그다음 원격에서:
         sudo /opt/bitnami/apache2/bin/apachectl -t     # 문법 확인
         sudo /opt/bitnami/ctlscript.sh restart apache

     넣기 전까지 https 쪽 /api/share 는 404 입니다(서비스 자체는 이미 떠 있습니다).
EOF
fi

# ── ④ healthz ────────────────────────────────────────────────────────────────────────
say "④ 헬스체크"
echo "  · 원격 루프백(서비스가 사는가):"
"${SSH[@]}" "$USER@$HOST" 'curl -fsS --max-time 5 http://127.0.0.1:8787/api/share/healthz' \
  && echo || warn '    ❌ 서비스가 응답하지 않습니다 — journalctl -u spin-share -n 50 을 보십시오.'
echo "  · 공개 주소(프록시까지 살았는가): $HEALTH_URL"
curl -fsS --max-time 10 "$HEALTH_URL" && echo || warn '    ❌ 아직 프록시가 안 붙었습니다(위 ③ 안내 참조).'

say "끝 — 되돌리려면: sudo systemctl stop spin-share && sudo systemctl disable spin-share"
