// §4.4 P2-4 — 파워싸커 두 규칙의 **그림**. 3 m 링(2-on-1)과 골 지역 3인 표시를 한 층에 둔다.
//
// 시각 언어(계획서 §9-⑧): **규칙은 파선, 코트는 실선.** 옛 판에는 규정에 없는 센터 서클
// (실선 r=75)이 있어 공이 센터에 올 때 두 원이 겹쳐 보이는 구간이 있었다 — 5.3 이 그 원을
// 지웠으므로(§9 결정 ⑧) **반지름 75 원은 이제 이 링 하나뿐**이고, 3 m 감각도 이 링이 맡는다.
// 파선/케이싱은 그대로 둔다: 규칙과 코트를 가르는 언어이지 그 원 하나를 피하려던 장치가 아니다.
//
// 색은 세 번째 채널이다: 붉은색은 코트(#1f7a46) 위 1.75:1 로 혼자서는 못 읽힌다. 그래서
//   ① 어두운 케이싱이 **모양**을 언제나 남기고, ② 위반은 **파선 → 실선**으로 바뀌며,
//   ③ 색이 마지막에 얹힌다. 여기에 라이브 리전 발화(ruleOverlay.ts [D-6])가 더해진다.
//
// 위치는 React 가 아니라 TransformWriter 팔로워가 쓴다(§6.1 규칙 1) — ZoneHandles 가 같은
// 실수로 '핸들만 제자리에 남는' 버그를 낸 전례가 있다(ZoneHandles.tsx:6-10).
//
// ⚠️ 2026-08-13(§7 5.2, 기현님 실기 ③) — **링은 더 이상 모든 공에 상시로 뜨지 않는다.** 공마다
// 없음/3 m/5 m 를 따로 갖고(`BallDef.ring`), 기본값은 **없음**이다. 위 문단들의 "공을 따라다니는
// 이 링" 은 *켜져 있을 때* 의 이야기로 읽으면 된다 — 시각 언어(파선·케이싱·세 채널)와 팔로워
// 규율은 하나도 바뀌지 않았다. 바뀐 것은 **몇 개를 그리는가** 뿐이다. 그리고 **판정은 표시와
// 무관하다**: 원이 '없음' 인 공도 링 그룹은 등록되어 2-on-1 판정과 발화를 그대로 탄다.
import { useEffect, useMemo, useRef } from 'react';
import { attackDir, courtDefFor, goalMouths, type CourtMode, type CourtSize, type Rect } from '../model/court.ts';
import type { BallRing, TeamSide } from '../model/drill.ts';
import { defaultDefense, defendedMouths, defendedZones, otherSide, ringRadiusPx } from '../model/rules.ts';
import type { TransformWriter } from './transformWriter.ts';
import {
  ownerArrowPath,
  OWNER_ARROW_HEAD_PX,
  OWNER_ARROW_LEN_PX,
  OWNER_ARROW_OPACITY,
  OWNER_ARROW_W,
  RULE_DASH,
  RULE_OK_STROKE,
  RING_CASING_W,
  RING_MARK_W,
  RULE_CASING,
  RULE_CASING_OPACITY,
  RULE_ZONE_ALERT_FILL,
  RULE_ZONE_ALERT_FILL_OPACITY,
  ZONE_CASING_W,
  ZONE_MARK_W,
  type RuleOverlayApi,
  type RuleRosterEntry,
} from './ruleOverlay.ts';
import { useLocale } from '../i18n/useLocale.ts';

// ⚠️ 2026-09-06 — 케이싱 색·불투명도와 굵기 넷은 이 파일의 리터럴이 아니라 `ruleOverlay.ts`
// 하나에서 온다. PNG·인쇄를 굽는 `buildStaticSvg.ts` 가 **같은 이름·같은 값**을 두 번째로
// 적어 두고 있었고(대조 테스트 없이 주석으로만 약속), 그 두 벌이 곧 다음 드리프트다.
const CASING = RULE_CASING;
const CASING_OPACITY = RULE_CASING_OPACITY;

interface RingProps {
  id: string;
  /** 5.2 — 이 공의 원(없음/3 m/5 m). 반지름은 `ringRadiusPx` 에서만 온다(리터럴 금지). */
  ring: BallRing;
  /** 이 공을 차는 팀. 5 m 링일 때만 화살표를 그린다 — 3 m(2-on-1)에는 소유 개념이 없다. */
  owner?: TeamSide;
  /** 소유 팀이 공격하는 방향(도). `attackDir` 에서 파생해 호출부가 계산한다 — 코트 정의를
   *  공마다 다시 읽지 않기 위해서다. */
  ownerDeg?: number;
  writer: TransformWriter;
  rules: RuleOverlayApi;
}

/** 공 하나를 따라다니는 거리 원. 안쪽 표시선은 `stroke`·`stroke-dasharray` 를 그룹에서
 *  **상속**받는다 — writer 가 그룹 하나만 건드리면 색과 파선이 함께 바뀐다.
 *
 *  ⚠️ **원이 'none' 이어도 이 컴포넌트는 그려지고 `rules.registerRing` 도 그대로 한다** —
 *  원(圓)이 없을 뿐 그리는 것이 없는 것이고, 등록을 건너뛰면 그 공은 `judge()` 의 rings 순회에서
 *  빠져 **2-on-1 판정과 라이브 리전 발화가 통째로 사라진다**(표시와 판정은 독립이다). 실측으로
 *  확인한 자리다: 조건부 등록으로 만들면 "원을 끈 공 옆에서 반칙이 나도 아무도 말하지 않는다". */
function RuleRing({ id, ring, owner, ownerDeg, writer, rules }: RingProps) {
  const followRef = useRef<SVGGElement | null>(null);
  const stateRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    // scaleWithHeld:false — 공을 잡아도 3 m 는 3 m 다(transformWriter.ts 의 계약 주석).
    writer.registerFollower(id, followRef.current, { scaleWithHeld: false });
    return () => writer.registerFollower(id, null);
  }, [writer, id]);

  // ⚠️ deps 에 `ring` 이 있어야 한다 — **판정 규칙이 원에서 갈리기 때문**이다(model/rules.ts 의
  //    `ruleForRing`). 빼면 3 m 로 등록된 공을 5 m 로 바꿔도 판정이 2-on-1 에 머문다.
  // ⚠️ `owner` 도 deps 다 — 소유가 뒤집히면 5 m 를 물러날 팀이 반대가 되므로(fiveMeterRetreat)
  //    등록을 다시 타야 한다. `ring` 을 deps 에 둔 것과 같은 이유다.
  useEffect(() => {
    rules.registerRing(id, stateRef.current, ring, owner);
    return () => rules.registerRing(id, null);
  }, [rules, id, ring, owner]);

  const r = ringRadiusPx(ring);
  return (
    <g ref={followRef}>
      <g ref={stateRef} opacity={1} stroke={RULE_OK_STROKE} strokeDasharray={RULE_DASH}>
        {r !== null && (
          <>
            <circle r={r} fill="none" stroke={CASING} strokeDasharray="none" strokeWidth={RING_CASING_W} opacity={CASING_OPACITY} />
            <circle r={r} fill="none" strokeWidth={RING_MARK_W} />
          </>
        )}
      </g>
      {ring === '5m' && owner !== undefined && ownerDeg !== undefined && (
        <g transform={`rotate(${ownerDeg})`} opacity={OWNER_ARROW_OPACITY} aria-hidden>
          <path
            d={ownerArrowPath(OWNER_ARROW_LEN_PX, OWNER_ARROW_HEAD_PX)}
            fill="none"
            stroke={RULE_OK_STROKE}
            strokeWidth={OWNER_ARROW_W}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
    </g>
  );
}

interface ZoneMarkProps {
  index: number;
  zone: Rect;
  rules: RuleOverlayApi;
}

/** 골 지역 3인 표시. 깨끗하면 숨어 있고, 걸리면 RuleZones 의 **연한 붉은 면 + 흰 파선** 위에
 *  진한 붉은 면 + 실선으로 덮인다(2026-08-13 기현 지시 ②: "반칙은 진하게, 그냥은 연하게").
 *  두 상태의 실측: 면 #50875e → #92543f (휘도 1.39:1, 붉기 −34.5 → +73). 근거·검산은
 *  ruleOverlay.ts 의 RULE_ZONE_* 주석과 render/ruleZoneFill.test.tsx. */
function RuleZoneMark({ index, zone, rules }: ZoneMarkProps) {
  const ref = useRef<SVGGElement | null>(null);

  useEffect(() => {
    rules.registerZone(index, ref.current);
    return () => rules.registerZone(index, null);
  }, [rules, index]);

  return (
    <g ref={ref} opacity={0} stroke={RULE_OK_STROKE} strokeDasharray={RULE_DASH}>
      <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} fill="none" stroke={CASING} strokeDasharray="none" strokeWidth={ZONE_CASING_W} opacity={CASING_OPACITY} />
      <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} fill={RULE_ZONE_ALERT_FILL} fillOpacity={RULE_ZONE_ALERT_FILL_OPACITY} strokeWidth={ZONE_MARK_W} />
    </g>
  );
}

export interface RuleOverlayProps {
  mode: CourtMode;
  /** §6.4 코트 크기 3단 — 골 지역 사각형의 자리가 크기마다 다르다. 빼먹으면 판정(2인 규칙)이
   *  **남의 코트 사각형**으로 돌아간다. */
  size?: CourtSize;
  /** prefs.showRuleZones — 규칙 존과 **같은 스위치**다. 새 설정을 만들지 않는다(§3.0 E-6:
   *  prefs 스키마 확장은 한 커밋에 모은다). 끄면 판정도 발화도 함께 멎는다. */
  visible: boolean;
  writer: TransformWriter;
  rules: RuleOverlayApi;
  /** 이 스텝에 판 위에 있는 공. 링은 공마다 하나씩 그린다. */
  ballIds: readonly string[];
  /** 5.2 — 공 id → 그 공의 거리 원. **없는 id 는 'none'** 이다(초기 배치가 원 없음이므로
   *  대부분의 공이 여기 없다). 전역 스위치 하나가 아니라 표를 받는 것이 핵심이다: 공 두 개가
   *  서로 다른 원을 가질 수 있어야 한다. */
  ballRings?: Readonly<Record<string, BallRing>>;
  /** 공 id → 그 공을 **차는 팀**(`DrillStep.ballOwner`). 5 m 링일 때만 뜻이 있다. 없는 id 는
   *  진영에서 파생한다(model/rules.ts `fiveMeterRetreat`) — 그것이 이 필드가 생기기 전의
   *  동작이라 옛 드릴의 그림이 보존된다. */
  ballOwners?: Readonly<Record<string, TeamSide>>;
  /** 선수 명단(팀·골키퍼). 좌표는 프레임에서 온다 — 여기로 내리지 않는다. */
  roster: readonly RuleRosterEntry[];
  teams: Record<TeamSide, { label: string }>;
  /** 진영 — `ruleZones[0]` 을 지키는 팀(`Drill.defense`). 생략하면 `defaultDefense(mode)` 다.
   *  이 값이 골 지역 3인을 **수비 팀에만** 걸고, 2-on-1 의 골키퍼 면제를 **자기 골 지역**으로
   *  좁힌다(model/rules.ts 머리말 ✅ 2026-08-15). */
  defense?: TeamSide;
}

export function RuleOverlay({ mode, size, visible, writer, rules, ballIds, ballRings, ballOwners, roster, teams, defense }: RuleOverlayProps) {
  const locale = useLocale();
  const def = courtDefFor(mode, size);
  const zones = def.ruleZones;
  // ⚠️ `useMemo` 다. `defendedZones` 는 매번 새 배열을 만드는데, 그것이 아래 이펙트의 deps 에
  //    들어가므로 그대로 두면 **렌더마다 setContext 가 다시 돈다**(판정 상태가 매번 초기화된다).
  const side = defense ?? defaultDefense(mode);
  const goalAreas = useMemo(() => defendedZones(zones, side), [zones, side]);
  // 세트피스 5 m 제한(2026-08-17). 골라인 **바깥 반평면**이라 골 지역과 다른 자리다 —
  // 골 지역을 넘기면 골 지역에 나와 선 골키퍼까지 면제된다(model/court.ts 의 goalMouths).
  const mouths = useMemo(() => defendedMouths(goalMouths(def), side), [def, side]);
  // 플랫 코트는 골대도 진영도 없어 "누가 수비인가" 라는 약속이 성립하지 않는다 → 규칙 끔.
  const fiveMeterDefense = def.goalPosts.length === 0 ? null : side;

  useEffect(() => {
    rules.setContext({
      enabled: visible,
      roster,
      goalAreas,
      goalMouths: mouths,
      fiveMeterDefense,
      teamLabels: { home: teams.home.label, away: teams.away.label },
      locale,
      court: { mode, surface: def.surface },
    });
  }, [rules, visible, roster, goalAreas, mouths, fiveMeterDefense, teams, locale, mode, def]);

  const ringOf = (id: string): BallRing => ballRings?.[id] ?? 'none';
  // 소유 화살표의 방향 — **코트당 한 번만** 계산한다(공마다 코트 정의를 다시 읽지 않는다).
  // `attackDir(def, 0)` 은 진영(`side`) 팀이 공격하는 방향이므로, 상대가 소유면 뒤집는다.
  const ownerDegs = useMemo(() => {
    const d = attackDir(def, 0);
    if (!d) return null; // 플랫 코트 — 골대가 없어 "어느 쪽으로 공격" 이 성립하지 않는다
    const deg = (Math.atan2(d.y, d.x) * 180) / Math.PI;
    return { [side]: deg, [otherSide(side)]: deg + 180 } as Record<TeamSide, number>;
  }, [def, side]);
  // §7 5.2 — **스위치가 꺼져 있어도 사용자가 켠 원은 남는다**(2026-08-13 판단, 기현님 실기 ③).
  // 골 지역 존과 다른 축이기 때문이다: 존은 "규칙을 보여 줘" 라는 화면 설정이고, 개별 공의 원은
  // 그 공을 세 번 눌러 **명시적으로 켠 것**이다. 스위치로 지워 버리면 켠 사람이 이유를 알 수
  // 없이 사라진다. 다만 이때 판정은 서지 않으므로(setContext enabled:false) 원은 흰 파선
  // 그대로다 — 경고 없이 거리만 보여 준다. "존을 감춘 사람에게 규칙 경고만 남기지 않는다" 는
  // 옛 계약(ruleOverlay.ts RuleOverlayContext.enabled)은 그래서 깨지지 않는다.
  const shown = visible ? ballIds : ballIds.filter((id) => ringOf(id) !== 'none');
  if (!visible && shown.length === 0) return null;

  return (
    // 판정 결과는 라이브 리전이 말한다(ruleOverlay.ts [D-6]) — 그림 자체는 접근성 트리에서 뺀다.
    // pointerEvents="none" 은 필수다: 링은 공 주위 반경 3 m(5 m 면 더)를 덮으므로 이게 없으면
    // 링 안의 개체를 잡을 수 없다.
    <g aria-hidden="true" pointerEvents="none">
      {visible &&
        goalAreas.map((z, i) => (
          <RuleZoneMark key={`${z.rect.x},${z.rect.y}`} index={i} zone={z.rect} rules={rules} />
        ))}
      {shown.map((id) => {
        const owner = ballOwners?.[id];
        return (
          <RuleRing
            key={id}
            id={id}
            ring={ringOf(id)}
            owner={owner}
            ownerDeg={owner !== undefined ? ownerDegs?.[owner] : undefined}
            writer={writer}
            rules={rules}
          />
        );
      })}
    </g>
  );
}
