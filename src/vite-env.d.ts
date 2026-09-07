/// <reference types="vite/client" />

/** Vite 가 주입하는 환경 변수 가운데 **이 앱이 뜻을 정한 것**만 적는다(vite/client 의
 *  `ImportMetaEnv` 에 병합된다). 인덱스 시그니처가 이미 any 로 다 받으므로, 여기 적는 값어치는
 *  타입이 아니라 **문서**다 — 어떤 변수가 존재하고 없으면 무엇이 되는지가 한 곳에 남는다. */
interface ImportMetaEnv {
  /** 공유 링크 API 의 기준 주소(PLAN-SHARE-LINK 결정 3). **없으면 `/api/share`** — 같은 출처
   *  상대 경로라 앱이 어느 도메인에 올라가도 자기 서버를 부른다(도메인 독립). 절대 주소가
   *  필요한 곳은 출처가 앱과 다른 데스크톱(tauri://) 빌드뿐이다. 읽는 자리는
   *  `src/share/api.ts` 의 `shareApiBase()` 하나. */
  readonly VITE_SHARE_API_BASE?: string;
}

/** vite.config.ts 의 define 이 빌드 시점에 package.json 의 version 으로 치환한다.
 *  화면에 버전을 박아 두면 릴리스 때 반드시 어긋나므로 출처를 하나로 묶어 둔 것이다. */
declare const __APP_VERSION__: string;
