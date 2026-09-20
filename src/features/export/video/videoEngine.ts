// 영상(MP4) 을 **무엇으로 굽느냐**. 순수 함수와 타입만 있다(DOM·wasm·인코더 없음).
// 정본 docs/PLAN-VIDEO-EXPORT.md — 2026-09-13 에 결정 2(지원 판정)를 넓힌 자리다.
//
// 왜 둘로 갈랐나: WebCodecs(`VideoEncoder`)는 브라우저가 코덱을 **내장**했을 때만 있다. 크롬·
// 엣지·최신 사파리에는 있지만, 리눅스 데스크톱 앱이 쓰는 WebKitGTK 는 H.264 인코딩을 시스템
// GStreamer 플러그인에 기대므로 그 플러그인이 없는 기계에서는 통째로 없는 것과 같다(우분투
// 최소 설치가 그렇다). 그때 "이 브라우저는 안 됩니다" 로 끝내는 대신 **소프트웨어 인코더를
// 내려받아** 굽는다 — 느리지만 되는 쪽이 낫다.

/** `webcodecs` = 브라우저 내장 코덱(빠르다·하드웨어를 탄다). `wasm` = 내려받는 소프트웨어
 *  인코더(minih264, 느리다). 고르는 규칙은 `chooseVideoEngine` 하나다. */
export type VideoEngine = 'webcodecs' | 'wasm';

export interface VideoCaps {
  /** 브라우저가 H.264 를 **인코딩** 할 수 있는가. 존재 여부가 아니라 실제 인코드 검사다
   *  (디코딩만 되는 조합이 있다 — mediabunny `canEncode('avc')` 가 한 장 구워 보고 답한다). */
  webcodecsAvc: boolean;
  /** WebAssembly 가 도는가. 소프트웨어 인코더의 유일한 전제다. */
  wasm: boolean;
}

/** 엔진 선택. 내장 코덱이 있으면 **무조건** 그쪽이다 — 소프트웨어 인코더는 같은 드릴을 수십 배
 *  느리게 굽고 화질도 못하다(기저 프로파일·고정 QP). 둘 다 없으면 null 이고, 그때만 시트가
 *  항목을 비활성으로 보인다. */
export function chooseVideoEngine(caps: VideoCaps): VideoEngine | null {
  if (caps.webcodecsAvc) return 'webcodecs';
  if (caps.wasm) return 'wasm';
  return null;
}

/** 프레임을 받아 파일 한 개를 만드는 곳. 두 엔진이 이 모양만 맞추면 굽는 회로(캔버스에 장면을
 *  그리는 쪽)는 하나로 남는다 — 엔진이 갈려도 **그림이 갈리지 않는다** 는 뜻이라 중요하다. */
export interface VideoFrameSink {
  /** 캔버스에 이미 그려진 한 장을 넣는다. `tSec` 은 그 프레임의 시각(초)이다 — 고정 fps 로
   *  굽는 엔진(wasm)은 쓰지 않지만, 타임스탬프를 갖는 엔진(WebCodecs)에는 필요하다. */
  add(tSec: number): Promise<void>;
  /** 파일을 닫고 돌려준다. */
  finish(): Promise<Blob>;
  /** 실패·취소 때 자원을 놓는다. **던지지 않는다** — 원래 오류가 더 중요하다. */
  dispose(): Promise<void>;
}
