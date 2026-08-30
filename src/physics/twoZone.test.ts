// 5.5 — 2존 모드(§4.4 P2-2 · §9 결정 ④). 순수층에서 재는 것 셋:
//   ① `handlesVisible` 은 **설정 토글 하나만** 본다 (자동 배율 문턱이 죽었는가)
//   ② `applyTwoZone` 은 차체 히트만 접고 존 핸들·나머지는 건드리지 않는다
//   ③ 그림(twoZoneViewConfig)과 판정(applyTwoZone)이 **같은 말**을 한다
//
// 이 파일이 순수 함수를 직접 찌르는 이유: 같은 성질을 컴포넌트 prop 뒤에 두면 단언이 닿지
// 않는다(이 저장소 실적: 순수 함수를 `steps.some(...)` → `steps[0]` 로 좁혀도 1623개가 전건
// 초록이었다). 실제 포인터 경로 배선은 features/editor/twoZoneMode.test.tsx 가 잰다.
import { describe, expect, it } from 'vitest';
import { DEFAULT_ZONES, INTERACT } from '../core/constants.ts';
import { classifyZone, projectGrab, type ChairPose, type DragZone, type ZoneConfig } from '../model/chair.ts';
import type { ArrowId, BallId, ChairId, ConeId, NoteId } from '../core/ids.ts';
import { handlesVisible } from './hitTest.ts';
import type { HitResult } from './hitTest.ts';
import { applyTwoZone, twoZoneViewConfig, TWO_ZONE_BODY } from './twoZone.ts';
import { beginDrag } from './drag.ts';
import type { HitContext } from './hitTest.ts';

const chA = 'ch_a' as ChairId;

/** 존 경계 3벌 — 기본 + 설정 슬라이더가 실제로 낼 수 있는 양 끝(prefs.resolvePhysics 클램프 범위).
 *  한 벌만 찌르면 "DEFAULT_ZONES 에서만 참인 성질" 이 통과한다. */
const ZONE_SETS: ReadonlyArray<{ name: string; z: ZoneConfig }> = [
  { name: '기본(반반)', z: { ...DEFAULT_ZONES } },
  { name: '옛 4토막(0.12/0.32/0.85)', z: { sTowRearMax: 0.12, sSpinMin: 0.32, sTowFrontMin: 0.85, grabPadPx: 10 } },
  { name: '회전 최대(0.18/0.22/0.6)', z: { sTowRearMax: 0.18, sSpinMin: 0.22, sTowFrontMin: 0.6, grabPadPx: 4 } },
];

/** §9-④ 가 근거로 든 **실측 배율 분포**. 문턱 1.28 을 여러 번 넘나든다. */
const MEASURED_PX_PER_UNIT = [0.663, 0.891, 0.899, 1.151, 1.675] as const;
const POINTER_TYPES = ['mouse', 'touch', 'pen', ''] as const;

describe('handlesVisible — 자동 배율 문턱은 죽었다 (§9 결정 ④)', () => {
  it('OFF 면 어떤 배율·포인터 종류에서도 켜지지 않는다 — 7인치 터치(0.663)가 핵심이다', () => {
    let checked = 0;
    for (const s of MEASURED_PX_PER_UNIT) {
      for (const pt of POINTER_TYPES) {
        expect(handlesVisible(s, pt, false), `s=${s} pointerType=${pt}`).toBe(false);
        checked++;
      }
    }
    // 0개라서 통과하는 길을 막는다 — 매트릭스가 비면 위 for 는 아무것도 단언하지 않는다.
    expect(checked).toBe(MEASURED_PX_PER_UNIT.length * POINTER_TYPES.length);
    expect(checked).toBeGreaterThanOrEqual(20);
  });

  it('대조군 — ON 이면 같은 매트릭스 전부에서 켜진다 ("무엇을 넣어도 false" 구현을 막는다)', () => {
    for (const s of MEASURED_PX_PER_UNIT) {
      for (const pt of POINTER_TYPES) {
        expect(handlesVisible(s, pt, true), `s=${s} pointerType=${pt}`).toBe(true);
      }
    }
  });

  it('문턱 상수(2.2154)의 양쪽을 정확히 짚어도 답이 안 바뀐다 — 되살리면 여기가 빨개진다', () => {
    const t = INTERACT.zoneDirectMinPxPerUnit;
    expect(t).toBeCloseTo(2.2154, 6); // 문턱 자체는 상수로 남아 있다(constants.test.ts 가 유도식을 지킨다)
    // 옛 식이라면 아래 첫 줄만 true 가 됐다. 그 비대칭이 바로 "줌이 조작 규칙을 바꾸는 사고" 다.
    expect(handlesVisible(t - 0.0001, 'touch', false)).toBe(false);
    expect(handlesVisible(t + 0.0001, 'touch', false)).toBe(false);
    expect(handlesVisible(t - 0.0001, 'mouse', false)).toBe(false);
  });
});

describe('applyTwoZone — 무엇을 접고 무엇을 남기는가', () => {
  const chairHit = (s: number): HitResult => ({ kind: 'chair', id: chA, s });

  it('ON 이면 차체 히트는 s 와 무관하게 전부 translate 다 (경계 s=0 · s=1 포함)', () => {
    let seen = 0;
    for (let s = -0.2; s <= 1.2001; s += 0.02) {
      const out = applyTwoZone(chairHit(s), true);
      expect(out.zone, `s=${s.toFixed(2)}`).toBe(TWO_ZONE_BODY);
      expect(out.zone).toBe('translate');
      seen++;
    }
    expect(seen).toBeGreaterThan(60);
    // 경계 두 점은 격자 부동소수에 기대지 않고 따로 못박는다 — classifyZone 이 `<=`/`<` 라
    // 하필 이 두 점에서만 towRear/towFront 로 새는 자리다.
    expect(applyTwoZone(chairHit(0), true).zone).toBe('translate');
    expect(applyTwoZone(chairHit(1), true).zone).toBe('translate');
  });

  it('ON 이어도 s 와 id 는 보존된다 — 히트를 새로 만드는 것이 아니라 존만 입힌다', () => {
    const out = applyTwoZone(chairHit(0.77), true);
    expect(out.s).toBe(0.77);
    expect(out.id).toBe(chA);
    expect(out.kind).toBe('chair');
  });

  it('OFF 면 히트 객체가 **그대로** 돌아온다 (참조 동일 — 기본 경로에 한 바이트도 안 닿는다)', () => {
    const h = chairHit(0.9);
    expect(applyTwoZone(h, false)).toBe(h);
    expect(applyTwoZone(h, false).zone).toBeUndefined();
  });

  it('존 핸들은 ON 에서도 손대지 않는다 — 2존에서 회전·견인이 남은 유일한 수단이다', () => {
    for (const zone of ['towRear', 'towFront', 'spin', 'translate'] as DragZone[]) {
      const h: HitResult = { kind: 'zoneHandle', id: chA, zone };
      const out = applyTwoZone(h, true);
      expect(out).toBe(h);
      expect(out.zone).toBe(zone);
    }
  });

  it('존이 없는 개체 4종은 ON 에서도 그대로다', () => {
    const others: HitResult[] = [
      { kind: 'ball', id: 'bl_a' as BallId },
      { kind: 'cone', id: 'cn_a' as ConeId },
      { kind: 'note', id: 'nt_a' as NoteId },
      { kind: 'arrow', id: 'ar_a' as ArrowId },
      { kind: 'arrowHandle', id: 'ar_a' as ArrowId, which: 'ctrl' },
    ];
    for (const h of others) {
      expect(applyTwoZone(h, true), h.kind).toBe(h);
      expect(applyTwoZone(h, true).zone).toBeUndefined();
    }
  });
});

describe('그림(음영·커서)과 판정이 같은 말을 한다', () => {
  for (const { name, z } of ZONE_SETS) {
    it(`[${name}] ON — 차체 안(0<s<1) 전 구간이 그림에서도 translate 다`, () => {
      const view = twoZoneViewConfig(z, true);
      let seen = 0;
      for (let s = 0.005; s < 1; s += 0.005) {
        expect(classifyZone(s, view), `s=${s.toFixed(3)}`).toBe('translate');
        expect(applyTwoZone({ kind: 'chair', id: chA, s }, true).zone).toBe('translate');
        seen++;
      }
      expect(seen).toBeGreaterThan(190);
      // grabPadPx 는 히트 여유라 존과 무관 — 접히면 안 된다.
      expect(view.grabPadPx).toBe(z.grabPadPx);
      // ChairChip 의 `x1-x0 > 0.01` 필터가 나머지 셋을 걷어낼 수 있어야 한다(폭 0).
      expect(view.sTowRearMax).toBe(0);
      expect(view.sSpinMin).toBe(1);
      expect(view.sTowFrontMin).toBe(1);
    });

    it(`[${name}] 대조군 — OFF 면 같은 s 격자에서 존이 실제로 여러 개 나온다`, () => {
      const view = twoZoneViewConfig(z, false);
      expect(view).toBe(z); // OFF 는 원본 그대로
      const kinds = new Set<DragZone>();
      for (let s = 0; s <= 1.0001; s += 0.005) kinds.add(classifyZone(s, view));
      // 이 단언이 없으면 twoZoneViewConfig 가 늘 2존 표를 돌려줘도 위 it 이 통과한다.
      expect(kinds.size).toBeGreaterThanOrEqual(3);
      expect(kinds.has('translate')).toBe(true);
      expect(kinds.has('spin')).toBe(true);
    });
  }
});

describe('beginDrag — 접힌 존이 실제 드래그 세션에 실린다', () => {
  const pose: ChairPose = { x: 300, y: 300, theta: 0 };
  const ctx = (z: ZoneConfig): HitContext => ({
    zones: z,
    pxPerUnit: 1,
    pointerType: 'touch',
    selectedChairId: null,
    selectedArrowId: null,
    handlesVisible: false,
    tool: 'select',
  });
  /** s 를 실제 월드 좌표로 되돌린다(θ=0 이므로 x 축). projectGrab 의 역이다. */
  const worldAt = (s: number) => ({ x: pose.x + (s - 0.2) * 37.5, y: pose.y });

  for (const { name, z } of ZONE_SETS) {
    it(`[${name}] ON — 차체 앞뒤 어디를 잡아도 세션 존은 translate 다`, () => {
      for (const s of [0, 0.05, 0.3, 0.5, 0.7, 0.95, 1]) {
        const w = worldAt(s);
        const session = beginDrag(applyTwoZone({ kind: 'chair', id: chA, s }, true), w, ctx(z), pose);
        expect(session.zone, `s=${s}`).toBe('translate');
        // 래치는 손대지 않는다 — 존만 접는 것이지 잡은 점을 옮기는 것이 아니다.
        const g = projectGrab(pose, w);
        expect(session.grab.ax).toBeCloseTo(g.ax, 9);
        expect(session.grab.lat).toBeCloseTo(g.lat, 9);
      }
    });

    it(`[${name}] OFF — 세션 존이 classifyZone 과 한 글자도 다르지 않다`, () => {
      const seen = new Set<DragZone>();
      for (const s of [0, 0.05, 0.3, 0.5, 0.7, 0.95, 1]) {
        const session = beginDrag({ kind: 'chair', id: chA, s }, worldAt(s), ctx(z), pose);
        expect(session.zone, `s=${s}`).toBe(classifyZone(s, z));
        seen.add(session.zone!);
      }
      // "전부 translate 였다" 로 통과하는 길을 막는다 — OFF 경로는 실제로 갈라져야 한다.
      expect(seen.size).toBeGreaterThanOrEqual(3);
    });
  }

  it('ON 에서도 존 핸들 드래그는 그 핸들의 존을 그대로 쓴다 (회전·견인이 살아 있다)', () => {
    for (const zone of ['towRear', 'towFront'] as DragZone[]) {
      const hit = applyTwoZone({ kind: 'zoneHandle', id: chA, zone }, true);
      const session = beginDrag(hit, { x: 400, y: 300 }, ctx(DEFAULT_ZONES), pose);
      expect(session.zone).toBe(zone);
    }
  });
});
