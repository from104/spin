// 안드로이드 셸(Capacitor 8) 설정 — 정본은 `docs/PLAN-ANDROID.md` §1 결정 1·2·22.
//
// 이 파일이 여기(루트) 있는 이유: Capacitor CLI 는 `cap add`·`cap sync`·`cap run` 을 부른
// 디렉터리에서 설정을 찾고, 그 디렉터리를 기준으로 `webDir`·`android.path` 를 푼다. 네이티브
// 프로젝트만 `src-android/` 로 내려보내고(데스크톱 `src-tauri/` 와 짝) 설정은 루트에 둔다.
//
// ⚠️ **`server` 블록을 기본으로 두지 않는다.** 두면 앱이 그 주소를 출처로 삼는데, 커밋된 주소는
//    언젠가 죽거나 남의 기기에서 안 열린다. 기본 출처는 Capacitor 가 웹뷰에 물리는
//    `https://localhost` 이고, 이것이 **secure context** 라서 WebCodecs(영상 내보내기)·
//    IndexedDB·`crypto.subtle`(공유 링크 암호화)·Wake Lock 이 켜진다. 옛 qcalc 의
//    `androidScheme: "file"` 을 베끼면 안 된다 — Capacitor 8 은 `file` 을 금지 목록으로 거부한다
//    (결정 2, PLAN-ANDROID §6 교훈: "참고 프로젝트도 정본이 아니다").
//
// 개발 중 라이브 리로드만 예외다(결정 22): `SPIN_CAP_SERVER_URL` 이 있을 때만 그 주소를 출처로
// 쓴다. 값은 커밋되지 않고 `npm run android:dev` 를 부르는 사람이 셸에서 준다.
import type { CapacitorConfig } from '@capacitor/cli';

// 라이브 리로드 주소. 없으면 `undefined` 라 아래 스프레드가 통째로 사라진다.
// `cleartext` 를 같이 켜는 이유: 개발 서버는 http 라 Android 9+ 의 기본 평문 차단에 걸린다.
// 이 두 줄이 **함께** 켜지고 함께 꺼져야 한다 — 하나만 남으면 빈 출처로 뜬다.
const devServerUrl = process.env.SPIN_CAP_SERVER_URL;

const config: CapacitorConfig = {
  // 결정 1 — 패키지명이자 OAuth 커스텀 스킴(`app.atit.spin:/oauth2redirect`, 결정 5).
  // 구글 콘솔의 안드로이드 클라이언트에 이 문자열 그대로 등록된다. 바꾸면 설치본이 갈라지고
  // 로그인이 죽으므로 사실상 불변이다.
  appId: 'app.atit.spin',
  appName: 'SPIN',
  // `npm run build` 산출물. Capacitor 는 이 폴더를 통째로 APK 의 assets 로 복사한다.
  webDir: 'dist',
  android: {
    // 결정 1 — 네이티브 프로젝트 자리. 기본값은 `android/` 지만 `src-tauri/` 와 짝이 되도록 옮겼다.
    path: 'src-android',
  },
  ...(devServerUrl ? { server: { url: devServerUrl, cleartext: true } } : {}),
};

export default config;
