// 심플 모드 — 휠체어 히트가 차체 OBB 가 아니라 **피벗 중심의 원**이다(model/chairDisc.ts, 결정 A5).
// 두 모양이 갈리는 자리를 잰다: 뒤쪽(차체 밖, 원 안)은 원만 잡고, 앞쪽 끝(차체 안, 원 밖)은 차체만 잡는다.
// 이 갈림이 안 지켜지면 "보이는 원 = 잡히는 원" 이 깨져 보이지 않는 앞 범퍼가 잡힌다.
import { describe, expect, it } from 'vitest';
import type { ChairId } from '../core/ids.ts';
import { CHAIR } from '../core/constants.ts';
import { DISC_RADIUS_PX } from '../model/chairDisc.ts';
import { hitTest } from './hitTest.ts';
import type { HitContext, SceneSnapshot } from './hitTest.ts';

const id = 'ch_disc' as ChairId;
const pose = { x: 300, y: 260, theta: 0 };
const scene: SceneSnapshot = { chairs: [{ id, pose }], balls: [], cones: [], notes: [], arrows: [], strokes: [] };
const ctx = (chairDisc: boolean, grabPadPx = 0, tool: HitContext['tool'] = 'eraser'): HitContext => ({
  zones: { sTowRearMax: 0.12, sSpinMin: 0.32, sTowFrontMin: 0.85, grabPadPx },
  pxPerUnit: 1,
  pointerType: 'mouse',
  selectedChairId: null,
  selectedArrowId: null,
  handlesVisible: false,
  chairDisc,
  tool, // 기본 'eraser' — 관대한 2차 패스를 끈다, 몸통만 잰다
});
const at = (dx: number, dy = 0) => ({ x: pose.x + dx, y: pose.y + dy });

describe('심플 모드 히트 = 원', () => {
  it('앞 범퍼 끝(차체 안·원 밖)은 원 모드에서 안 잡히고 차체 모드에서는 잡힌다', () => {
    const p = at(CHAIR.pivotToFrontPx - 1);
    expect(p.x - pose.x).toBeGreaterThan(DISC_RADIUS_PX);
    expect(hitTest(p, scene, ctx(true))).toBeNull();
    expect(hitTest(p, scene, ctx(false))?.id).toBe(id);
  });
  it('뒤쪽 원 가장자리(차체 밖·원 안)는 원 모드에서만 잡힌다', () => {
    const p = at(-(DISC_RADIUS_PX - 1));
    expect(Math.abs(p.x - pose.x)).toBeGreaterThan(CHAIR.pivotToRearPx);
    expect(hitTest(p, scene, ctx(true))?.id).toBe(id);
    expect(hitTest(p, scene, ctx(false))).toBeNull();
  });
  it('★ 원은 원 안만 잡힌다 — 잡기 패드(큰 표적이 키우는 grabPadPx)·관대한 2차 패스도 원 밖으로 안 넓힌다(2026-11-19)', () => {
    const p = at(0, -(DISC_RADIUS_PX + 2)); // 원 바로 바깥(차체 옆으로도 바깥)
    expect(hitTest(p, scene, ctx(true, 8, 'select'))).toBeNull();
    expect(hitTest(at(0, -(DISC_RADIUS_PX - 0.5)), scene, ctx(true, 8, 'select'))?.id).toBe(id); // 원 안은 그대로
  });
  it('옆(원의 위쪽 가장자리)도 원이라 잡힌다 — 차체 반폭(10)보다 바깥', () => {
    expect(hitTest(at(0, -(DISC_RADIUS_PX - 0.5)), scene, ctx(true))?.id).toBe(id);
    expect(hitTest(at(0, -(DISC_RADIUS_PX - 0.5)), scene, ctx(false))).toBeNull();
  });
});
