// 설정의 **물리 존 슬라이더 3종**이 실제 드래그 판정까지 도달하는가. (2026-08-13, 5차 검증관)
//
// ── 왜 이 파일이 생겼나 ────────────────────────────────────────────────────────────────
// `physics/index.ts` 의 `internalHitContext()` 가 `zones: DEFAULT_ZONES` 를 **하드코딩**하고
// 있었다. `beginDrag` 는 UI 의 HitContext 를 받지 않고 이 함수를 스스로 불러 쓰므로, 설정에서
// '후방 견인 경계 / 제자리 회전 시작 / 전방 견인 시작' 을 아무리 옮겨도 판정은 언제나 기본값이었다.
//
// 그런데 **음영과 커서는 따라 움직였다** — 그쪽은 EditorWorkspace → EditorStage →
// useEditorPointer 로 `prefs.physics.zones` 가 직접 흐른다. 즉 판이 "여기는 제자리 회전" 이라고
// 칠해 놓은 자리를 잡으면 평행 이동이 되는 상태였다. 5.5 가 2존 모드에서 고친 거짓말과
// **정확히 같은 종류**이고, 5.5·5.4 두 구현자가 경계 밖 발견으로 각각 보고했지만
// "내 소유가 아니다" 로 남아 있었다.
//
// 재현(고치기 전): 설정 → 물리 → '제자리 회전 시작' 을 0.22 로 내림 → 판에서 차체 s=0.3 지점
// (앞 음영 구역)을 잡으면 여전히 translate 로 움직인다.
//
// ── 이 파일이 못박는 것 ────────────────────────────────────────────────────────────────
// ① 월드에 넘긴 존 경계가 `beginDrag` 의 판정에 실제로 쓰인다(생성 인자 · setZones 양쪽).
// ② `zoneAt()` 도 같은 값을 본다(둘이 갈라지면 다시 거짓말이 된다).
// ③ **대조군**: 기본 존에서는 예전과 한 글자도 다르지 않다 — 슬라이더를 안 건드린 사용자의
//    물성은 변하지 않는다. 그리고 커스텀 존이 기본 존과 실제로 **다른 답**을 내는 s 가 존재한다
//    (안 그러면 ①은 "무엇을 넣어도 통과" 다).
import { beforeEach, describe, expect, it } from 'vitest';
import { createPhysicsWorld } from './index.ts';
import type { PhysicsWorldApi } from './index.ts';
import { DEFAULT_ZONES } from '../core/constants.ts';
import { classifyZone, poseFromStored } from '../model/chair.ts';
import type { ZoneConfig } from '../model/chair.ts';
import { COURT_DEFS } from '../model/court.ts';
import { defaultCast, defaultStep } from '../model/defaults.ts';
import type { HitResult } from './hitTest.ts';

/** 설정 화면이 실제로 만들 수 있는 값 — '제자리 회전 시작' 을 앞으로 크게 당긴 표.
 *  (SettingsScreen 의 세 슬라이더가 쓰는 필드와 같다.) */
const SPIN_EARLY: ZoneConfig = { ...DEFAULT_ZONES, sTowRearMax: 0.05, sSpinMin: 0.22, sTowFrontMin: 0.85 };

const DEF = COURT_DEFS.full;
const cast = defaultCast();
const step = defaultStep('full', '1-2-1', cast);
const chairId = cast.chairs[0]!.id;

/** 차체 축 위 정규 위치 s 를 그대로 담은 차체 히트. hitTest 가 만드는 것과 같은 모양이다
 *  (drag.beginDrag 는 `hit.zone ?? classifyZone(hit.s!, ctx.zones)` 로 s 를 읽는다). */
const chairHit = (s: number): HitResult => ({ kind: 'chair', id: chairId, s }) as unknown as HitResult;

/** 잡는 월드 좌표는 판정에 쓰이지 않지만(zone 은 s 로 갈린다) 실제 경로를 타게 하려고 준다. */
const grabAt = (): { x: number; y: number } => {
  const p = step.chairs[chairId]!;
  return { x: p.x, y: p.y };
};

/** 두 존 표가 서로 다른 답을 내는 s 들. 이 목록이 비면 아래 단언 전부가 무의미하다. */
const DIVERGENT_S = [0.1, 0.3, 0.4, 0.45, 0.9].filter(
  (s) => classifyZone(s, DEFAULT_ZONES) !== classifyZone(s, SPIN_EARLY),
);

describe('설정의 물리 존 슬라이더가 드래그 판정까지 간다 (5차 검증관)', () => {
  let world: PhysicsWorldApi;
  beforeEach(() => {
    world = createPhysicsWorld(DEF.vbW, DEF.vbH);
    world.load(cast, step, 'full');
    return () => world.dispose();
  });

  it('대조군 — 두 존 표가 실제로 다른 답을 내는 s 가 여럿 있다 (0개라서 통과 방지)', () => {
    expect(DIVERGENT_S.length).toBeGreaterThanOrEqual(3);
    // 그리고 그 답이 한 종류로 뭉쳐 있지 않다 — '전부 spin' 이면 자물쇠가 헐겁다.
    expect(new Set(DIVERGENT_S.map((s) => classifyZone(s, SPIN_EARLY))).size).toBeGreaterThanOrEqual(2);
  });

  it('setZones 뒤의 beginDrag 는 **새 경계**로 존을 가른다', () => {
    world.setZones(SPIN_EARLY);
    for (const s of DIVERGENT_S) {
      const h = world.beginDrag(chairHit(s), grabAt());
      expect(h, `s=${s}`).not.toBeNull();
      expect(h!.zone, `s=${s}`).toBe(classifyZone(s, SPIN_EARLY));
      h!.end();
    }
  });

  it('생성 인자로 넘긴 존도 즉시 유효하다 — 코트 전환 직후 첫 드래그가 기본값으로 새지 않는다', () => {
    const w2 = createPhysicsWorld(DEF.vbW, DEF.vbH, undefined, SPIN_EARLY);
    w2.load(cast, step, 'full');
    for (const s of DIVERGENT_S) {
      const h = w2.beginDrag(chairHit(s), grabAt());
      expect(h!.zone, `s=${s}`).toBe(classifyZone(s, SPIN_EARLY));
      h!.end();
    }
    w2.dispose();
  });

  it('⚠️ 대조군 — 슬라이더를 안 건드리면 예전과 한 글자도 같다 (기본 물성 불변)', () => {
    // 차체 밖(s≤0, s≥1)까지 포함해야 네 존이 전부 나온다 — DEFAULT_ZONES 는 차체 **안**에서는
    // translate/spin 둘로만 갈린다(sTowRearMax=0 · sTowFrontMin=1).
    const seen = new Set<string>();
    for (const s of [-0.1, 0, 0.05, 0.3, 0.5, 0.6, 0.9, 1, 1.2]) {
      const h = world.beginDrag(chairHit(s), grabAt());
      expect(h!.zone, `s=${s}`).toBe(classifyZone(s, DEFAULT_ZONES));
      seen.add(h!.zone!);
      h!.end();
    }
    // '전부 translate 라서 통과' 를 막는다 — 기본 표도 실제로 네 존으로 갈려야 한다.
    expect(seen.size).toBe(4);
  });

  it('zoneAt() 도 같은 표를 본다 — 판정과 조회가 갈라지면 다시 거짓말이 된다', () => {
    // 차체 축을 따라 훑는다. s 를 손으로 계산하지 않는다(projectGrab 의 정규화 규약을 여기서
    // 다시 적으면 그것이 곧 두 번째 진실이 된다) — 대신 **응답성과 가역성**을 잰다.
    const pose = poseFromStored(step.chairs[chairId]!);
    const u = { x: Math.cos(pose.theta), y: Math.sin(pose.theta) };
    const pts = [-12, -4, 4, 10, 16, 22, 28, 34].map((d) => ({ x: pose.x + u.x * d, y: pose.y + u.y * d }));

    const readAll = (): Array<string | null> => pts.map((p) => world.zoneAt(chairId, p));
    const base = readAll();
    expect(base.length).toBe(8);
    expect(base.every((z) => z !== null)).toBe(true); // 0개·전부 null 이라서 통과 방지

    world.setZones(SPIN_EARLY);
    const changed = readAll();
    // ① 응답성 — 표를 바꿨으면 답이 실제로 달라진 자리가 있어야 한다.
    expect(changed.some((z, i) => z !== base[i])).toBe(true);
    // ② 가역성 — 되돌리면 원래대로. 값을 한 번 굳혀 버리는 구현을 막는다.
    world.setZones(DEFAULT_ZONES);
    expect(readAll()).toEqual(base);
  });
});
