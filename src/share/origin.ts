// 「우리 도메인」의 **정본 한 벌**.
//
// ── 왜 상수가 생겼나(2026-09-19, 기현님 제보 *"링크 공유도 [안 된다]"*) ────────────────────
// 공유 링크의 기준 주소는 원래 **같은 출처 상대 경로**였다(share/api.ts 결정 3 — 앱이 어느
// 도메인에 올라가도 자기 서버를 부른다). 그 설계는 웹에서 옳다. 그런데 **네이티브 셸에는 '같은
// 출처' 라는 것이 없다**: Capacitor 의 출처는 `https://localhost` 이고, 거기에는 우리 서버가
// 없다. 그래서 안드로이드에서는 상대 경로가 언제나 자기 자신에게 물어 조용히 실패했다.
//
// 지금까지의 방어는 빌드 env(`SPIN_ANDROID_WEB_ORIGIN`)였는데, 그것이 빠지면 **앱에서만, 실행
// 중에만** 깨진다 — 실패 모양 중 가장 나쁜 것이다(테스트도 CI 도 못 잡는다). 그리고 애초에
// 안드로이드 빌드는 이 도메인에 **이미 묶여 있다**: AndroidManifest 의 App Links intent-filter 와
// `.well-known/assetlinks.json` 이 이 호스트를 하드코딩한다. 즉 «도메인 독립» 은 웹 빌드의
// 성질이지 안드로이드 빌드의 성질이 아니었다. 그 사실을 상수로 인정한다.
//
// ⚠️ 이 값을 바꾸면 **함께 바꿔야 하는 곳이 셋** 있다. 하나만 고치면 링크가 앱으로 안 오거나,
//    오는데 앱이 무시하거나, 공유가 남의 서버로 간다:
//      · `src-android/app/src/main/AndroidManifest.xml` 의 `android:host`
//      · 배포 도메인의 `.well-known/assetlinks.json`
//      · `src/platform/android/nativeBridge.ts`(이 파일에서 가져다 쓴다)
//    `origin.test.ts` 가 매니페스트를 읽어 그 결합을 못박는다.

/** 배포처 호스트. 배포처는 하나다(ROADMAP — dev 는 리다이렉트일 뿐). */
export const CANONICAL_WEB_HOST = 'spin.atit.app';

/** 배포처 출처. 네이티브 셸이 env 없이도 옳게 동작하기 위한 바닥값이다 — env 는 여전히
 *  **덮어쓸 수 있고**(스테이징·자체 호스팅), 웹 빌드는 이 값을 아예 안 쓴다(상대 경로 그대로). */
export const CANONICAL_WEB_ORIGIN = `https://${CANONICAL_WEB_HOST}`;
