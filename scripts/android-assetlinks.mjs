#!/usr/bin/env node
// App Links 검증 파일(`public/.well-known/assetlinks.json`)을 찍는다 — 정본은
// docs/PLAN-ANDROID.md §1 결정 21, 수동 절차는 같은 문서 §5 4번.
//
// ── 이 파일이 하는 일 ───────────────────────────────────────────────────────────────
// 안드로이드가 `https://spin.atit.app/s/…` 링크를 **앱으로** 열어 주려면, 그 도메인이
// "이 패키지를 내가 인정한다" 고 선언해야 한다. 그 선언이 이 JSON 이고, 안드로이드는 앱을
// 설치할 때 그것을 받아 **설치본을 서명한 키의 SHA-256** 과 대조한다.
//
// ⚠️ **지문은 「설치분을 서명한 모든 키」를 넣는다.** 하나만 넣으면 나머지 경로로 깔린 앱에서
//    링크가 조용히 브라우저로 떨어진다 — 오류도 경고도 없다(그래서 찾는 데 오래 걸린다).
//    지금 예상되는 키는 셋이다:
//      ① 업로드 키   — GitHub 릴리스의 APK 를 서명한 키(secrets/android-upload.jks)
//      ② Play 앱 서명 키 — Play 가 다시 서명한다. 첫 게시 뒤 Play Console 「앱 서명」에서 얻는다
//      ③ 디버그 키   — 실기 시험용 `assembleDebug` APK(~/.android/debug.keystore)
//    ②는 아직 없고 ③은 기계마다 다르다. 그래서 **파일을 손으로 고치지 말고 인자를 늘려 다시
//    찍는다** — 손으로 고치면 그 다음 사람이 무엇이 빠졌는지 알 길이 없다.
//
// 지문 얻는 법(값은 비밀이 아니다 — 공개 검증용이다):
//   keytool -list -v -keystore secrets/android-upload.jks -alias spin-upload   # ①
//   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android  # ③
//   → 출력의 `SHA256:` 줄(콜론으로 끊은 32바이트)을 그대로 쓴다. ② 는 Play Console 화면에서 복사.
//
// 사용법:
//   node scripts/android-assetlinks.mjs <SHA256> [<SHA256> …]
//   npm run android:assetlinks -- <SHA256> [<SHA256> …]
//   node scripts/android-assetlinks.mjs --out /tmp/a.json <SHA256>   # 다른 경로로 찍기(시험용)
//
// 찍은 뒤에는 커밋하고 `npm run deploy:aws` 로 내보낸다. `public/` 에 두는 이유: 배포가
// `dist/` 를 통째로 rsync 하는데 vite 가 `public/` 을 그대로 복사하기 때문이다. vhost 는 점으로
// 시작하는 경로를 403 으로 막지만 `.well-known` 만 예외다(scripts/deploy-aws.sh 의 배포 기록 주석).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 패키지명은 `capacitor.config.ts` 의 `appId` · `src-android/app/build.gradle` 의
// `applicationId` 와 **같아야 한다**. 다르면 검증이 조용히 실패한다.
const PACKAGE_NAME = 'app.atit.spin';

// 링크 열기 권한 하나만 위임한다. 다른 relation(예: common.get_login_creds)은 쓰지 않는다 —
// 필요 없는 권한을 선언하면 도메인이 앱에 허락한 범위가 실제보다 넓어 보인다.
const RELATION = 'delegate_permission/common.handle_all_urls';

// keytool 이 찍는 꼴: 32바이트를 콜론으로 끊은 대문자 16진수(`AB:CD:…`, 95자).
const FINGERPRINT = /^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = resolve(repoRoot, 'public/.well-known/assetlinks.json');

function fail(message) {
  console.error(`오류: ${message}`);
  console.error('사용법: node scripts/android-assetlinks.mjs [--out <파일>] <SHA256 지문> [<SHA256 지문> …]');
  process.exit(1);
}

const args = process.argv.slice(2);
let out = DEFAULT_OUT;
const fingerprints = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--out') {
    // 값이 빠진 `--out` 을 그냥 두면 undefined 를 경로로 쓰다 엉뚱한 곳에 쓴다.
    if (i + 1 >= args.length) fail('--out 뒤에 파일 경로가 없습니다.');
    out = resolve(args[++i]);
    continue;
  }
  if (arg.startsWith('-')) fail(`모르는 옵션입니다: ${arg}`);
  // 소문자로 복사해 오는 일이 잦다(웹 콘솔·문서에서). 꼴만 맞으면 받아 대문자로 정규화한다 —
  // 안드로이드는 대소문자를 가리지 않지만, 파일이 한 가지 꼴이어야 diff 가 읽힌다.
  const normalized = arg.trim().toUpperCase();
  if (!FINGERPRINT.test(normalized)) {
    fail(
      `SHA-256 지문의 꼴이 아닙니다: ${arg}\n` +
        '      32바이트를 콜론으로 끊은 16진수여야 합니다(keytool 출력의 `SHA256:` 줄).\n' +
        '      SHA-1(20바이트)을 잘못 붙여넣은 것은 아닌지 보세요 — 구글 OAuth 클라이언트 쪽이 SHA-1 이고 여기는 SHA-256 입니다.',
    );
  }
  fingerprints.push(normalized);
}

if (fingerprints.length === 0) fail('지문을 하나 이상 주세요.');

// 같은 지문을 두 번 주면 배열에 그대로 두 줄이 생긴다. 검증에는 해가 없지만 "키가 넷인가?"
// 로 읽혀서, 다음에 하나를 지울 때 어느 쪽인지 헷갈린다.
const unique = [...new Set(fingerprints)];
if (unique.length !== fingerprints.length) {
  console.warn(`경고: 같은 지문이 ${fingerprints.length - unique.length}개 중복이라 합쳤습니다.`);
}

// 문(statement) 하나에 지문 여러 개를 담는다 — 키마다 문을 나눠도 되지만, 같은 패키지에 대한
// 같은 권한이라 한 문에 모으는 쪽이 "이 앱을 서명한 키들" 이라는 뜻에 가깝다.
const statements = [
  {
    relation: [RELATION],
    target: {
      namespace: 'android_app',
      package_name: PACKAGE_NAME,
      sha256_cert_fingerprints: unique,
    },
  },
];

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(statements, null, 2)}\n`, 'utf8');

console.log(`${out} 에 지문 ${unique.length}개를 썼습니다 (패키지 ${PACKAGE_NAME}).`);
for (const fp of unique) console.log(`  ${fp}`);
console.log('키가 늘면 이 명령을 인자를 늘려 다시 돌리세요 — 파일을 손으로 고치지 않습니다.');
