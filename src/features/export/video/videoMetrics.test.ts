// videoMetrics — 영상 캔버스 크기. 지우면 새는 버그: H.264(yuv420p)는 홀수 치수를 못 받아
// 짝수 올림이 빠지면 12조합 중 10조합에서 인코딩이 통째로 던진다(코트 3종 × 캡션 유무 ×
// 실명 유무가 전부 다른 높이를 낸다). 실기에서는 "내보내기 실패" 한 줄로만 보인다.
import { describe, it, expect } from 'vitest';
import { videoCanvasSize, videoResolution } from './videoMetrics.ts';
import { staticSceneMetrics, type StaticSceneOpts } from '../staticSceneLayout.ts';
import { TEAMS } from '../sceneFixture.ts';

const OPTS: StaticSceneOpts = { mode: 'full', teams: TEAMS };

/** 결정 5 의 숫자를 **고정값**으로 적는다. 구현의 `VIDEO_LONG_EDGE_PX` 를 import 해 대조하면
 *  상수를 1300 으로 잘못 고쳐도 초록이다(검사표가 구현을 베끼는 자기증명 — 2026-09-08 검수). */
const LONG_EDGE = { 720: 1280, 1080: 1920 } as const;

describe('videoResolution — 긴 변을 1280/1920 으로 못 박는다', () => {
  it('긴 변이 실제로 그 값이 된다(정수 배율이 아니다)', () => {
    for (const size of [720, 1080] as const) {
      const m = staticSceneMetrics({ ...OPTS, resolution: videoResolution(size) });
      expect(Math.max(m.widthPx, m.heightPx)).toBe(LONG_EDGE[size]);
      expect(videoResolution(size) % 1).not.toBe(0); // 1.25 / 1.875 — 옛 `1 | 2` 로는 못 담는다
    }
  });

  it('긴 변 정의는 1024 × resolution 이라는 계약을 지킨다', () => {
    expect(1024 * videoResolution(1080)).toBe(1920);
    expect(1024 * videoResolution(720)).toBe(1280);
  });
});

describe('videoCanvasSize — 짝수 올림', () => {
  it('홀수는 한 칸 올리고 짝수는 그대로 둔다', () => {
    expect(videoCanvasSize({ widthPx: 1279, heightPx: 721 })).toMatchObject({ w: 1280, h: 722 });
    expect(videoCanvasSize({ widthPx: 1280, heightPx: 720 })).toMatchObject({ w: 1280, h: 720 });
  });

  it('실제 코트 3종 × 캡션 유무의 모든 조합이 짝수로 나온다', () => {
    const caption = { title: '측면 돌파', stepIndex: 0, stepCount: 3, stepName: '' };
    for (const mode of ['full', 'half', 'flat'] as const) {
      for (const size of ['30x18', '28x15', '25x14'] as const) {
        for (const cap of [null, caption, { ...caption, roster: '2번 김민수' }]) {
          for (const px of [720, 1080] as const) {
            const m = staticSceneMetrics({ ...OPTS, mode, size, caption: cap, resolution: videoResolution(px) });
            const c = videoCanvasSize(m);
            expect(c.w % 2).toBe(0);
            expect(c.h % 2).toBe(0);
            // 그림은 그대로 그리고 남는 줄만 여백이다 — 축척을 흔들지 않는다.
            expect(c.w - m.widthPx).toBeLessThanOrEqual(1);
            expect(c.h - m.heightPx).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('배경에 따라 여백 색이 갈린다 — 검정 배경에 먹색 줄이 남으면 눈에 띈다', () => {
    expect(videoCanvasSize({ widthPx: 3, heightPx: 3 }, 'black').padColor).toBe('#000000');
    expect(videoCanvasSize({ widthPx: 3, heightPx: 3 }).padColor).toBe('#000000'); // 기본값도 검정
    expect(videoCanvasSize({ widthPx: 3, heightPx: 3 }, 'transparent').padColor).not.toBe('#000000');
  });
});
