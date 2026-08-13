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
import { useEffect, useRef } from 'react';
import { courtDefFor, type CourtMode, type CourtSize, type Rect } from '../model/court.ts';
import type { TeamSide } from '../model/drill.ts';
import { RING_R_PX } from '../model/rules.ts';
import type { TransformWriter } from './transformWriter.ts';
import { RULE_DASH, RULE_OK_STROKE, RULE_ALERT_STROKE, type RuleOverlayApi, type RuleRosterEntry } from './ruleOverlay.ts';

/** 케이싱 색. 근거는 colors.ts 의 `ARROW_CASING` 과 같다 — 불투명 검정만이 코트 위 3.93:1 로
 *  모양을 남긴다(알파를 섞으면 합성 결과가 주석의 숫자와 달라진다). */
const CASING = '#000000';
const CASING_OPACITY = 0.55;
const RING_MARK_W = 2.6;
const RING_CASING_W = 5.4;
const ZONE_MARK_W = 3;
const ZONE_CASING_W = 6.4;

interface RingProps {
  id: string;
  writer: TransformWriter;
  rules: RuleOverlayApi;
}

/** 공 하나를 따라다니는 3 m 원. 안쪽 표시선은 `stroke`·`stroke-dasharray` 를 그룹에서
 *  **상속**받는다 — writer 가 그룹 하나만 건드리면 색과 파선이 함께 바뀐다. */
function RuleRing({ id, writer, rules }: RingProps) {
  const followRef = useRef<SVGGElement | null>(null);
  const stateRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    // scaleWithHeld:false — 공을 잡아도 3 m 는 3 m 다(transformWriter.ts 의 계약 주석).
    writer.registerFollower(id, followRef.current, { scaleWithHeld: false });
    return () => writer.registerFollower(id, null);
  }, [writer, id]);

  useEffect(() => {
    rules.registerRing(id, stateRef.current);
    return () => rules.registerRing(id, null);
  }, [rules, id]);

  return (
    <g ref={followRef}>
      <g ref={stateRef} opacity={1} stroke={RULE_OK_STROKE} strokeDasharray={RULE_DASH}>
        <circle r={RING_R_PX} fill="none" stroke={CASING} strokeDasharray="none" strokeWidth={RING_CASING_W} opacity={CASING_OPACITY} />
        <circle r={RING_R_PX} fill="none" strokeWidth={RING_MARK_W} />
      </g>
    </g>
  );
}

interface ZoneMarkProps {
  index: number;
  zone: Rect;
  rules: RuleOverlayApi;
}

/** 골 지역 3인 표시. 깨끗하면 숨어 있고, 걸리면 RuleZones 의 흰 파선 위에 실선으로 덮인다. */
function RuleZoneMark({ index, zone, rules }: ZoneMarkProps) {
  const ref = useRef<SVGGElement | null>(null);

  useEffect(() => {
    rules.registerZone(index, ref.current);
    return () => rules.registerZone(index, null);
  }, [rules, index]);

  return (
    <g ref={ref} opacity={0} stroke={RULE_OK_STROKE} strokeDasharray={RULE_DASH}>
      <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} fill="none" stroke={CASING} strokeDasharray="none" strokeWidth={ZONE_CASING_W} opacity={CASING_OPACITY} />
      <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} fill={RULE_ALERT_STROKE} fillOpacity={0.2} strokeWidth={ZONE_MARK_W} />
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
  /** 선수 명단(팀·골키퍼). 좌표는 프레임에서 온다 — 여기로 내리지 않는다. */
  roster: readonly RuleRosterEntry[];
  teams: Record<TeamSide, { label: string }>;
}

export function RuleOverlay({ mode, size, visible, writer, rules, ballIds, roster, teams }: RuleOverlayProps) {
  const goalAreas = courtDefFor(mode, size).ruleZones;

  useEffect(() => {
    rules.setContext({ enabled: visible, roster, goalAreas, teamLabels: { home: teams.home.label, away: teams.away.label } });
  }, [rules, visible, roster, goalAreas, teams]);

  if (!visible) return null;

  return (
    // 판정 결과는 라이브 리전이 말한다(ruleOverlay.ts [D-6]) — 그림 자체는 접근성 트리에서 뺀다.
    // pointerEvents="none" 은 필수다: 링은 공 주위 반경 3 m 를 덮으므로 이게 없으면 링 안의
    // 개체를 잡을 수 없다.
    <g aria-hidden="true" pointerEvents="none">
      {goalAreas.map((z, i) => (
        <RuleZoneMark key={`${z.x},${z.y}`} index={i} zone={z} rules={rules} />
      ))}
      {ballIds.map((id) => (
        <RuleRing key={id} id={id} writer={writer} rules={rules} />
      ))}
    </g>
  );
}
