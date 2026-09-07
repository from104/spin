// 영상(MP4) 내보내기의 **크기 계산**. 순수 함수만 있다(DOM·인코더·캔버스 없음).
// 정본 docs/PLAN-VIDEO-EXPORT.md 결정 5(크기)·11(순수 로직 분리).
//
// 여기 있는 계산이 틀리면 인코더가 통째로 던진다(H.264 yuv420p 는 홀수 치수를 못 받는다) —
// 실기에서 "내보내기 실패" 한 줄로만 보이므로 셀 수 있게 떼어 둔다.
import { EXPORT_LAYOUT, sceneBackdropFill, type SceneMetrics, type StaticSceneOpts } from '../staticSceneLayout.ts';
import type { VideoSize } from './encodeDrillVideo.ts';

/** 720p·1080p 의 **긴 변**(px). 세로가 아니라 긴 변인 이유: 코트가 가로형이라 긴 변을 고정하는
 *  쪽이 코트 크기 3단(28×15 / 25×14 / 30×18)에서 그림 크기가 덜 널뛴다. */
export const VIDEO_LONG_EDGE_PX: Record<VideoSize, number> = { 720: 1280, 1080: 1920 };

/** 시트가 고른 크기 → `StaticSceneOpts.resolution`(긴 변 = 1024 × resolution).
 *  정수가 아니다(720p = 1.25, 1080p = 1.875) — 그래서 결정 5 가 그 타입을 `number` 로 넓혔다. */
export function videoResolution(size: VideoSize): number {
  return VIDEO_LONG_EDGE_PX[size] / EXPORT_LAYOUT.baseLongEdgePx;
}

export interface VideoCanvasSize {
  /** 짝수로 올린 캔버스 픽셀. `metrics.widthPx/heightPx` 보다 최대 1px 씩 크다. */
  w: number;
  h: number;
  /** 캔버스를 먼저 칠하는 색 = 짝수 올림으로 남는 1px 줄의 색. */
  padColor: string;
}

/** 장면 크기 → 영상 캔버스 크기. **짝수로 올린다.**
 *
 *  왜 축척이 아니라 여백으로 맞추나: 긴 변은 1280/1920 으로 못 박혀 있고(결정 5) 짧은 변은
 *  코트 비율에서 나오므로 12조합 중 10조합이 홀수다. 축척을 흔들어 짝수를 만들면 720p 라면서
 *  1279px 인 파일이 나온다 — 1px 여백이 정직하다. `drawImage` 는 metrics 크기 그대로 그리고
 *  남는 오른쪽·아래 한 줄만 `padColor` 로 남는다(칠하는 것은 호출부가 먼저 한다). */
export function videoCanvasSize(
  metrics: Pick<SceneMetrics, 'widthPx' | 'heightPx'>,
  background?: StaticSceneOpts['background'],
): VideoCanvasSize {
  return {
    w: metrics.widthPx + (metrics.widthPx % 2),
    h: metrics.heightPx + (metrics.heightPx % 2),
    padColor: sceneBackdropFill(background),
  };
}
