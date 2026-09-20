// 드릴 → MP4(H.264) 영상. 정본 docs/PLAN-VIDEO-EXPORT.md (결정 1·2·4·9·10·12).
// ⚠️ 이 파일은 UI(ExportSheet) 에서 동적 import 로만 불린다 — mediabunny 를 정적으로 import 하지 마라(결정 3).
// jsdom 은 캔버스도 VideoEncoder 도 없다 — 단위 테스트를 붙이지 않는다. 순수 로직은 videoTiming.ts·videoMetrics.ts 에.
//
// 파이프라인 한 줄(결정 1): `sampleDrill(t)` → `buildStaticScene(frame, opts, order)` → SVG →
// `<img>` → **캔버스 한 장** → `CanvasSource.add(t초, 1/fps초)`. 워커를 쓰지 않는 이유는 SVG
// 디코드가 DOM `Image` 를 요구하기 때문이고, 순차(await)로 가는 이유는 PNG 경로와 같다 —
// 프레임 300장을 동시에 물면 모바일에서 메모리로 죽는다(ExportSheet 의 "순차로 굽는다").
import type { Drill } from '../../../model/drill.ts';
import type { Locale } from '../../../i18n/locale.ts';
import { staticSceneMetrics, type StaticSceneOpts } from '../staticSceneLayout.ts';
import { buildStaticScene } from '../buildStaticSvg.ts';
import { paintSceneToCanvas, waitForFonts } from '../rasterize.ts';
import { drillTotalMs, sampleDrill } from '../../../model/playback.ts';
import { sceneOrder } from '../../../model/zOrder.ts';
import { LIMITS, noteFirstLine } from '../../../model/validate.ts';
import { PLAYBACK } from '../../../core/constants.ts';
import { translate } from '../../../i18n/useT.ts';
import { VIDEO_FPS, videoBitrate, videoFrameTimes } from './videoTiming.ts';
import { videoCanvasSize, videoResolution } from './videoMetrics.ts';
import { chooseVideoEngine, type VideoCaps, type VideoEngine, type VideoFrameSink } from './videoEngine.ts';

export type VideoSize = 720 | 1080;

export interface VideoExportOpts {
  size: VideoSize;
  locale: Locale;
  /** 캡션 형태(제목·roster 여부). 글(n/N·스텝 이름)은 엔진이 프레임마다 채운다 — 결정 7. */
  caption: StaticSceneOpts['caption'] | undefined;
  /** 장면 옵션의 **나머지 전부** — 코트·팀·진영·격자·규칙 존·배경.
   *
   *  왜 통째로 받나(2026-09-08 추가): PNG 경로가 넘기는 것과 **한 칸도 다르면 안 되기** 때문이다.
   *  `size`(코트 크기) 하나만 빠져도 25×14 로 그린 드릴이 28×15 코트로 인코딩되고, `defense` 가
   *  빠지면 영상에서만 다른 팀이 붉게 칠해진다(ExportSheet 의 PNG 옵션 주석에 그 사고 기록이 있다).
   *  세 필드만 뺀 이유: `shapes` 는 프레임마다 도착 스텝에서 꺼내고, `caption` 은 위 필드가 틀이며,
   *  `resolution` 은 `size`(720/1080)에서 나온다 — 셋 다 엔진이 정해야 프레임끼리 어긋나지 않는다. */
  scene: Omit<StaticSceneOpts, 'shapes' | 'caption' | 'resolution'>;
}

export interface VideoExportResult {
  /** 실제로 구운 엔진. 실기 보고에서 "느린데요" 가 어느 길이었는지 가르는 유일한 표다. */
  engine: VideoEngine;
  blob: Blob;
  bytes: number;
  frames: number;
  durationMs: number;
  width: number;
  height: number;
}

export interface VideoExportHooks {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/** 이 기기의 능력. `webcodecsAvc` 는 존재 여부가 아니라 **실제로 구워 본** 결과다 —
 *  mediabunny `canEncode('avc')` 가 작은 프레임을 한 장 인코딩해 보고 답한다(디코딩만 되는
 *  조합과, WebKitGTK 처럼 시스템 플러그인이 빠져 실패하는 조합을 여기서 가른다). */
async function detectVideoCaps(): Promise<VideoCaps> {
  const wasm = typeof WebAssembly !== 'undefined';
  if (typeof VideoEncoder === 'undefined') return { webcodecsAvc: false, wasm };
  try {
    const { canEncode } = await import('mediabunny');
    return { webcodecsAvc: await canEncode('avc'), wasm };
  } catch {
    // 청크 로드 실패(오프라인·차단)는 "내장 코덱을 못 쓴다" 일 뿐이다 — 소프트웨어 길은 남는다.
    return { webcodecsAvc: false, wasm };
  }
}

/** 무엇으로 구울지. null 이면 못 굽는다 — 그때만 시트가 항목을 비활성으로 보인다(결정 2). */
export async function videoExportEngine(): Promise<VideoEngine | null> {
  return chooseVideoEngine(await detectVideoCaps());
}

/** 영상 내보내기가 되는가. 내장 코덱이 없어도 wasm 이 있으면 **된다**(2026-09-13). */
export async function isVideoExportSupported(): Promise<boolean> {
  return (await videoExportEngine()) !== null;
}

/** 내장 코덱(WebCodecs) 싱크 — mediabunny 가 인코딩과 MP4 먹싱을 다 한다.
 *  ⚠️ 정적 import 금지(결정 3) — 이 함수 안의 한 줄이 mediabunny 를 내보내기 청크에 가둔다. */
async function createWebCodecsSink(
  canvas: HTMLCanvasElement,
  bitrateBps: number,
): Promise<VideoFrameSink> {
  const { Output, BufferTarget, Mp4OutputFormat, CanvasSource, Quality } = await import('mediabunny');
  const output = new Output({
    // fastStart: moov 를 앞에 둔다 — 모바일 메신저가 다 받기 전에도 재생을 시작한다.
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, {
    codec: 'avc',
    quality: new Quality({ bitrate: bitrateBps, bitrateMode: 'variable' }),
  });
  output.addVideoTrack(source);
  await output.start();

  return {
    async add(tSec: number) {
      // add 가 돌려주는 약속을 기다리는 것이 인코더 배압(backpressure) 처리이자, 브라우저에
      // 숨 쉴 틈을 주는 양보이기도 하다 — 안 기다리면 긴 드릴에서 탭이 굳는다.
      await source.add(tSec, 1 / VIDEO_FPS);
    },
    async finish() {
      await output.finalize();
      const buffer = output.target.buffer;
      // 여기 오면 finalize 가 성공했다는 뜻이라 buffer 는 있어야 한다. i18n 키를 쓰지 않는 이유는
      // 이용자에게 보일 문구가 아니기 때문이다 — 시트가 export.video.failed 로 갈아 보여준다(결정 9).
      if (!buffer) throw new Error('mediabunny: BufferTarget produced no buffer');
      return new Blob([buffer], { type: 'video/mp4' });
    },
    async dispose() {
      await output.cancel().catch(() => {});
    },
  };
}

/** 취소되면 DOMException('AbortError') 로 reject 한다(결정 9). */
export async function encodeDrillVideo(
  drill: Drill,
  opts: VideoExportOpts,
  hooks: VideoExportHooks = {},
): Promise<VideoExportResult> {
  const { onProgress, signal } = hooks;
  throwIfAborted(signal);

  // 타이밍은 손으로 재계산하지 않는다 — 트윈 구간이 세 갈래(보통·seamless·cut)라 `sampleDrill`
  // 하나만 알고 있다(playback.ts). 여기서 정하는 것은 **어느 시각을 찍느냐** 뿐이다(결정 4).
  const baseMs = PLAYBACK.stepIntervalMs[1];
  const transitionMs = PLAYBACK.transitionMsFor(baseMs);
  const totalMs = drillTotalMs(drill, baseMs);
  const times = videoFrameTimes(totalMs, VIDEO_FPS);

  // 캡션 **형태**를 루프 전에 한 번 확정한다(결정 7). 띠 높이(captionH)가 전체 높이를 바꾸므로,
  // 프레임마다 roster 유무가 흔들리면 해상도가 흔들리고 인코더가 던진다.
  const resolution = videoResolution(opts.size);
  const sceneOptsFor = (stepIndex: number): StaticSceneOpts => {
    const step = drill.steps[stepIndex];
    return {
      ...opts.scene,
      resolution,
      // 작도 도형은 프레임에 없다(보간하지 않는 **표시**라 스텝이 갖는다) — 시연·PNG 와 같은 통로다.
      shapes: step?.shapes,
      caption: captionFor(drill, opts.caption, stepIndex),
    };
  };
  const metrics = staticSceneMetrics(sceneOptsFor(0));
  const { w, h, padColor } = videoCanvasSize(metrics, opts.scene.background);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(translate(opts.locale, 'export.canvasUnsupported'));

  // 폰트 대기는 **루프 앞에서 한 번**(결정 12). 프레임마다 기다리면 순수 낭비다.
  await waitForFonts();
  throwIfAborted(signal);

  let blob: Blob;

  // 엔진은 **굽기 직전**에 고른다(결정 2 확장, 2026-09-13). 시트가 열릴 때 잰 값을 들고
  // 있지 않는 이유: 시트를 열어 둔 채 기기가 바뀌는 일은 없어도, 두 번 재는 값이 다르면 그때
  // 어느 쪽이 참인지 가릴 길이 없다 — 굽는 쪽이 참이다.
  const engine = await videoExportEngine();
  if (!engine) throw new Error(translate(opts.locale, 'export.video.unsupported'));
  const bitrateBps = videoBitrate(w, h, VIDEO_FPS);
  const sink: VideoFrameSink =
    engine === 'webcodecs'
      ? await createWebCodecsSink(canvas, bitrateBps)
      // 소프트웨어 인코더는 쓰는 기기에서만 받는다(1.7MB) — 동적 import 가 그 약속이다.
      : await (await import('./wasmH264.ts')).createWasmH264Sink({ ctx, w, h, fps: VIDEO_FPS, bitrateBps });
  throwIfAborted(signal);

  try {
    for (let i = 0; i < times.length; i++) {
      throwIfAborted(signal);
      const t = times[i]!;
      const frame = sampleDrill(drill, t, { baseMs, transitionMs, loop: false });
      const step = drill.steps[frame.stepIndex];
      const scene = buildStaticScene(
        frame,
        sceneOptsFor(frame.stepIndex),
        // 표시 순서도 프레임에 없다 — 도착 스텝의 것이다(판·시연·인쇄와 **같은 함수**).
        step ? sceneOrder(step, drill.cast) : undefined,
      );
      // 매 프레임 바탕부터 칠한다: 지난 프레임을 지우는 일과, 짝수 올림으로 남는 1px 줄을
      // 배경색으로 채우는 일을 한 번에 한다(결정 5). 영상에는 알파가 없다.
      ctx.fillStyle = padColor;
      ctx.fillRect(0, 0, w, h);
      await paintSceneToCanvas(scene, canvas, opts.locale);
      await sink.add(t / 1000);
      onProgress?.(i + 1, times.length);
    }
    throwIfAborted(signal);
    blob = await sink.finish();
  } catch (e) {
    // 취소든 실패든 인코더·워커를 놓아준다. dispose 자체의 실패는 삼킨다 — 원래 오류가 더 중요하다.
    await sink.dispose();
    throw e;
  }

  return {
    engine,
    blob,
    bytes: blob.size,
    frames: times.length,
    // 파일에 **실제로 담긴** 길이다(프레임 수 × 1/fps). 드릴 총 길이(totalMs)보다 최대 한 프레임
    // 길다 — 마지막 정지 포즈 한 장 때문이다(videoTiming 의 `+1`).
    durationMs: (times.length * 1000) / VIDEO_FPS,
    width: w,
    height: h,
  };
}

/** 프레임의 캡션 글(결정 7). 형태(title·roster)는 시트가 준 틀 그대로 쓰고 **도착 스텝**의
 *  번호·이름만 채운다. 틀이 없으면(undefined/null) 캡션 띠 자체가 없는 것이니 그대로 흘린다. */
function captionFor(
  drill: Drill,
  frame: StaticSceneOpts['caption'] | undefined,
  stepIndex: number,
): StaticSceneOpts['caption'] {
  if (!frame) return frame;
  const step = drill.steps[stepIndex];
  return {
    ...frame,
    stepIndex,
    stepCount: drill.steps.length,
    // PNG 와 같은 통로다: step.name 은 로드된 드릴에서 항상 '' 라(validate 정화기가 note 로
    // 이관한다) note 첫 줄이 스텝 텍스트가 파일에 실리는 유일한 길이다.
    stepName: step ? noteFirstLine(step.note).slice(0, LIMITS.stepNameLen) : '',
  };
}

/** 취소는 **예외**로만 알린다 — 반쯤 만든 Blob 을 돌려주면 부르는 쪽이 그것을 저장한다. */
function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('영상 내보내기가 취소되었습니다.', 'AbortError');
}
