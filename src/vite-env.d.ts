/// <reference types="vite/client" />

/** vite.config.ts 의 define 이 빌드 시점에 package.json 의 version 으로 치환한다.
 *  화면에 버전을 박아 두면 릴리스 때 반드시 어긋나므로 출처를 하나로 묶어 둔 것이다. */
declare const __APP_VERSION__: string;
