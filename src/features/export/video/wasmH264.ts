// WebCodecs 가 없을 때 쓰는 **소프트웨어** H.264 인코더. 정본 docs/PLAN-VIDEO-EXPORT.md
// (2026-09-13, 결정 2 확장). 알맹이는 `h264-mp4-encoder` — minih264(인코더) + minimp4(먹서)를
// wasm 으로 담은 것이라 브라우저 코덱을 한 조각도 쓰지 않는다.
//
// ⚠️ 이 파일은 `encodeDrillVideo.ts` 에서 **동적 import 로만** 불린다(결정 3 과 같은 이유).
// 붙어 오는 wasm 이 1.7MB 라 내장 코덱이 있는 기계는 한 바이트도 받지 않아야 한다.
//
// 왜 `import` 가 아니라 <script> 인가: 이 패키지의 **웹 빌드는 모듈이 아니다.** `main` 은 node
// 빌드(`require("fs")`)를 가리켜 번들러가 집으면 브라우저에서 터지고, 웹 빌드는 전역 `var HME`
// 하나를 심는 옛 스크립트라 `import` 해도 내보내는 것이 없다. 그래서 Vite 에는 **자산으로만**
// 달라 하고(`?url`) 실행은 <script> 로 한다. wasm 은 그 파일 안에 base64 로 박혀 있어 따로
// 받아 오는 것이 없다(오프라인에서도 된다 — 앱 자산이므로).
import hmeScriptUrl from 'h264-mp4-encoder/embuild/dist/h264-mp4-encoder.web.js?url';
import type { VideoFrameSink } from './videoEngine.ts';

/** 웹 빌드가 심는 전역 `HME` 의 알맹이. 패키지의 `.d.ts` 는 node 빌드를 가리켜 쓸 수 없으므로
 *  **쓰는 것만** 여기서 다시 적는다(2026-09-13 실측으로 모양을 확인했다 — 전역은 함수가 아니라
 *  `{ createH264MP4Encoder }` 객체다). */
interface HmeEncoder {
  outputFilename: string;
  width: number;
  height: number;
  frameRate: number;
  /** 0 이 아니면 quantizationParameter 를 덮는다. */
  kbps: number;
  /** 0 = 화질 우선, 10 = 속도 우선. */
  speed: number;
  /** 키프레임 간격(프레임 수). */
  groupOfPictures: number;
  initialize(): void;
  addFrameRgba(buffer: Uint8ClampedArray | Uint8Array): void;
  finalize(): void;
  delete(): void;
  FS: { readFile(path: string): Uint8Array; unlink(path: string): void };
}
interface HmeGlobal {
  /** wasm 런타임이 깨어난 뒤 인코더 한 개를 준다. */
  createH264MP4Encoder(): Promise<HmeEncoder>;
}

/** 스크립트는 한 번만 심는다 — 두 번째 내보내기가 1.7MB 를 다시 받으면 안 된다. */
let scriptPromise: Promise<HmeGlobal> | null = null;

function loadHmeScript(): Promise<HmeGlobal> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<HmeGlobal>((resolve, reject) => {
    const ready = (globalThis as { HME?: HmeGlobal }).HME;
    if (ready) {
      resolve(ready);
      return;
    }
    const el = document.createElement('script');
    el.src = hmeScriptUrl;
    el.async = true;
    el.onload = () => {
      const hme = (globalThis as { HME?: HmeGlobal }).HME;
      // 전역이 없다 = 스크립트는 받았지만 **평가 중에 터졌다.** 거의 언제나 CSP 의 `unsafe-eval`
      // 이 없는 것이다(embind 가 바인딩마다 `new Function` 을 쓴다 — 2026-09-13 실측).
      if (hme) resolve(hme);
      else reject(new Error('h264-mp4-encoder: 전역 HME 가 없다(CSP unsafe-eval?)'));
    };
    // 실패는 기억하지 않는다 — 다음 시도가 다시 받을 수 있어야 한다(오프라인에서 켰다 붙은 경우).
    el.onerror = () => {
      scriptPromise = null;
      reject(new Error('h264-mp4-encoder: 스크립트를 받지 못했다'));
    };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

export interface WasmSinkOpts {
  /** 프레임이 이미 그려져 있는 캔버스의 2D 문맥. 픽셀은 여기서 읽는다. */
  ctx: CanvasRenderingContext2D;
  /** 캔버스 크기. 둘 다 **짝수**여야 한다(H.264 yuv420p) — `videoCanvasSize` 가 보장한다. */
  w: number;
  h: number;
  fps: number;
  /** 목표 비트레이트(bps). `videoBitrate` 가 준다 — 엔진이 갈려도 같은 값을 쓴다. */
  bitrateBps: number;
}

/** 소프트웨어 인코더 싱크. 만드는 순간 스크립트를 받고 wasm 런타임을 깨운다. */
export async function createWasmH264Sink(opts: WasmSinkOpts): Promise<VideoFrameSink> {
  const { ctx, w, h, fps, bitrateBps } = opts;
  const hme = await loadHmeScript();
  // wasm 런타임이 깨어날 때까지 기다린다(1.7MB 를 푸는 시간이다).
  const enc = await hme.createH264MP4Encoder();
  enc.outputFilename = 'spin.mp4';
  enc.width = w;
  enc.height = h;
  enc.frameRate = fps;
  enc.kbps = Math.max(1, Math.round(bitrateBps / 1000));
  // 5 = 중간. 0(최고 화질)은 1080p 에서 프레임당 수백 ms 를 먹어 300장이면 못 기다린다.
  enc.speed = 5;
  // 2초마다 키프레임. 메신저·슬라이드에서 아무 데나 집어 재생해도 바로 그림이 나온다.
  enc.groupOfPictures = Math.max(1, fps * 2);
  enc.initialize();

  let closed = false;
  const drop = () => {
    if (closed) return;
    closed = true;
    try {
      enc.delete();
    } catch {
      // 이미 놓았으면 그만이다.
    }
  };

  return {
    async add() {
      // RGBA 를 그대로 넘긴다 — YUV 변환은 wasm 쪽이 한다(같은 코드가 두 벌 있지 않게).
      const rgba = ctx.getImageData(0, 0, w, h).data;
      enc.addFrameRgba(rgba);
      // wasm 인코딩은 **동기**라 이 한 줄이 없으면 굽는 내내 창이 굳는다(취소 버튼도 안 눌린다).
      // WebCodecs 쪽은 `source.add` 를 기다리는 것이 같은 일을 한다.
      await new Promise((r) => setTimeout(r, 0));
    },
    async finish() {
      enc.finalize();
      // `readFile` 이 주는 것은 wasm 힙을 보는 **창**이다 — `delete()` 뒤에는 그 자리가 남의
      // 것이 된다. 그래서 복사(`slice`)를 먼저 뜨고, 그 다음에야 인코더를 놓는다. 순서가 바뀌면
      // 어쩌다 한 번 깨진 파일이 나오고, 그건 실기에서 "가끔 안 열려요" 로만 보인다.
      const copy = enc.FS.readFile(enc.outputFilename).slice();
      // 가상 파일계는 인코더끼리 공유한다 — 지우지 않으면 내보낼 때마다 메모리에 파일이 쌓인다.
      try {
        enc.FS.unlink(enc.outputFilename);
      } catch {
        // 없으면 그만이다.
      }
      drop();
      return new Blob([copy], { type: 'video/mp4' });
    },
    async dispose() {
      drop();
    },
  };
}
