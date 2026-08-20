// §3.12 훈련 세션. 총 시간은 해석된 세션(ResolvedSession)에서만 계산한다 — 안 그러면 목록이
// "52분", 상세가 "총 42분(누락 1개 제외)" 로 갈린다.
//
// ── v2 (2026-08-18 구조 개편, 질문 20문 ②·⑮) — 정식 구획(phase) 계층 ─────────────────────────
// 코칭 표준은 Session → Phase(워밍업→기술→전술→스크리미지→쿨다운) → Drill 3계층이다.
// v1 의 평평한 items 는 단일 custom 구획으로 감싸 올라온다(migrate.ts — 무손실).
//
// ⚠️ **flatten 이 파생의 단일 출처다.** drillIds 재계산(putSession)·시연 순회·인쇄가 전부
// `flattenSessionItems` 하나를 거친다 — 각자 phases 를 직접 돌면 순회 순서가 갈라질 수 있다.
import type { DrillId, PhaseId, PlayerId, SessionId } from '../core/ids.ts';
import type { Locale } from '../i18n/locale.ts';
import { newId } from '../core/ids.ts';
import type { DrillRef } from './refs.ts';
import { resolveRefs } from './refs.ts';

export const CURRENT_SESSION_SCHEMA = 2;

export interface SessionItem extends DrillRef {
  durationOverrideMin?: number;
  note?: string;
  restAfterMin?: number;
}

/** 구획 종류 — 코칭 표준 어휘 + 'custom'(자유 이름). 드릴의 DRILL_TYPES 와 어휘가 겹치는 것은
 *  우연이 아니다: 기술 드릴이 기술 구획에 들어가는 것이 표준 세션의 짜임이다. */
export const SESSION_PHASE_KINDS = ['warm-up', 'technical', 'tactical', 'set-piece', 'scrimmage', 'cool-down', 'custom'] as const;
export type SessionPhaseKind = (typeof SESSION_PHASE_KINDS)[number];
/** i18n C5 — 로케일 차원이 붙었다(model/drill.ts 의 DRILL_TYPE_LABELS 와 같은 규약). */
export const PHASE_KIND_LABELS: Record<Locale, Record<SessionPhaseKind, string>> = {
  ko: { 'warm-up': '워밍업', technical: '기술', tactical: '전술', 'set-piece': '세트피스', scrimmage: '스크리미지', 'cool-down': '쿨다운', custom: '자유' },
  en: { 'warm-up': 'Warm-up', technical: 'Technical', tactical: 'Tactical', 'set-piece': 'Set Piece', scrimmage: 'Scrimmage', 'cool-down': 'Cool-down', custom: 'Custom' },
  ja: { 'warm-up': 'ウォームアップ', technical: '技術', tactical: '戦術', 'set-piece': 'セットプレー', scrimmage: 'スクリメージ', 'cool-down': 'クールダウン', custom: '自由' },
};

export interface SessionPhase {
  id: PhaseId;
  kind: SessionPhaseKind;
  /** kind 라벨을 덮어쓰는 자유 이름(≤40자). custom 구획의 실질 이름이 이것이다. */
  title?: string;
  /** 이 구획의 목표 배분(분). 강제는 없다 — 초과·미달은 색으로만 표시한다(질문 ⑮). */
  plannedMin?: number;
  items: SessionItem[];
}

/** 구획의 표시 이름 — title 이 있으면 그것, 없으면 kind 라벨. locale 기본값 'ko'. */
export function phaseLabel(p: SessionPhase, locale: Locale = 'ko'): string {
  return p.title !== undefined && p.title.trim().length > 0 ? p.title : PHASE_KIND_LABELS[locale][p.kind];
}

export interface TrainingSession {
  schemaVersion: number;
  id: SessionId;
  title: string;
  note?: string;
  scheduledAt?: number;
  location?: string;
  /** 세션 목표 총 시간(분). 없음 = 미지정. 강제 없음 — 배분 게이지의 기준선일 뿐이다. */
  goalTotalMin?: number;
  phases: SessionPhase[]; // v2 — v1 의 items 를 대체
  /** 로스터 참가자(구조 개편 3차에서 UI 합류). 없음 = 미지정. */
  participantIds?: PlayerId[];
  drillIds: DrillId[]; // phases 에서 파생. putSession 이 무조건 재계산
  createdAt: number;
  updatedAt: number;
}

/** 파생의 단일 출처 — 전 구획의 항목을 구획 순서대로 편다. */
export function flattenSessionItems(s: Pick<TrainingSession, 'phases'>): SessionItem[] {
  return s.phases.flatMap((p) => p.items);
}

export type ResolvedItem = SessionItem & { missing: boolean };
export interface ResolvedPhase {
  phase: SessionPhase;
  items: ResolvedItem[];
  totalMin: number;
}
export interface ResolvedSession {
  session: TrainingSession;
  /** 구획별 해석 — 세션 편집 화면·phase 인지 시연·인쇄가 읽는다. */
  phases: ResolvedPhase[];
  /** 평평한 하위 호환 뷰(= phases 를 편 것). 목록 요약·드로어 등 구획을 모르는 소비자용. */
  items: ResolvedItem[];
  totalMin: number;
  missingCount: number;
}

export function resolveSession(s: TrainingSession, existing: Set<DrillId>): ResolvedSession {
  const phases: ResolvedPhase[] = s.phases.map((p) => {
    const items = resolveRefs(p.items, existing);
    return { phase: p, items, totalMin: sessionTotalMin(items) };
  });
  const items = phases.flatMap((p) => p.items);
  const totalMin = phases.reduce((sum, p) => sum + p.totalMin, 0);
  const missingCount = items.filter((i) => i.missing).length;
  return { session: s, phases, items, totalMin, missingCount };
}

/** Σ(미누락 항목의 durationOverrideMin ?? durationMinCache) + Σ(restAfterMin ?? 0) */
export function sessionTotalMin(items: ResolvedItem[]): number {
  let total = 0;
  for (const item of items) {
    if (item.missing) continue;
    total += item.durationOverrideMin ?? item.durationMinCache;
    total += item.restAfterMin ?? 0;
  }
  return total;
}

// ── 구획을 아는 순수 편집 헬퍼 ────────────────────────────────────────────────────────────────
// 드로어(구획 무지)와 세션 편집 화면(구획 인지)이 **같은 함수**로 세션을 고치게 한다 —
// 각자 phases 를 손으로 주무르면 "빈 구획을 지워야 하나" 같은 규칙이 화면마다 갈라진다.

/** 새 구획 하나(비어 있음). v1 승격分과 같은 기본값을 쓴다 — custom '훈련'. */
export function defaultPhase(): SessionPhase {
  return { id: newId('ph'), kind: 'custom', title: '훈련', items: [] };
}

/** 항목 추가. phaseId 를 안 주면 **마지막 구획**에 붙는다(구획이 없으면 defaultPhase 생성).
 *  "마지막" 인 이유: 드로어의 [드릴 추가] 는 목록 끝에 붙는 동작이었다 — 그 감각을 지킨다. */
export function addSessionItem(s: TrainingSession, item: SessionItem, phaseId?: PhaseId): TrainingSession {
  if (s.phases.length === 0) {
    return { ...s, phases: [{ ...defaultPhase(), items: [item] }] };
  }
  const idx = phaseId !== undefined ? s.phases.findIndex((p) => p.id === phaseId) : s.phases.length - 1;
  const at = idx >= 0 ? idx : s.phases.length - 1;
  return { ...s, phases: s.phases.map((p, i) => (i === at ? { ...p, items: [...p.items, item] } : p)) };
}

/** 항목 제거(전 구획 수색). 빈 구획은 **남긴다** — 구획은 사용자가 만든 구조다. */
export function removeSessionItem(s: TrainingSession, itemId: string): TrainingSession {
  return { ...s, phases: s.phases.map((p) => ({ ...p, items: p.items.filter((it) => it.id !== itemId) })) };
}

/** 항목 패치(전 구획 수색). */
// §0.5 미배송 빚(2026-08-20) — 메모·휴식 시간 입력이 생기며 **명시적 undefined 는 키를
// 지운다** 규칙이 필요해졌다(store/editor/reducer.ts META_SET 과 같은 이유: 얕은 병합만
// 하면 undefined 값을 가진 키가 그대로 남고, structuredClone(IDB)은 그 키를 보존·JSON은
// 지우는 두 얼굴 문서가 된다 — edits.ts omitKey 머리말의 그 함정).
export function updateSessionItem(s: TrainingSession, itemId: string, patch: Partial<SessionItem>): TrainingSession {
  return {
    ...s,
    phases: s.phases.map((p) => ({
      ...p,
      items: p.items.map((it) => {
        if (it.id !== itemId) return it;
        const next = { ...it, ...patch };
        for (const k of Object.keys(patch)) {
          if ((patch as Record<string, unknown>)[k] === undefined) delete (next as unknown as Record<string, unknown>)[k];
        }
        return next;
      }),
    })),
  };
}

/** 평평한 첨자(flatten 기준)로 항목을 옮긴다 — 드로어의 ↑↓ 가 이 좌표계를 쓴다.
 *  구획 경계를 넘는 이동은 **넘어간 구획으로의 이사**다: 각 구획의 항목 수가 이동을 따라
 *  자연스럽게 변한다(수를 보존하려고 다른 항목을 밀어내면 안 시킨 이동이 생긴다). */
export function moveSessionItemFlat(s: TrainingSession, from: number, to: number): TrainingSession {
  const flat = flattenSessionItems(s);
  if (from === to || from < 0 || from >= flat.length || to < 0 || to >= flat.length) return s;
  // 슬롯 지도: flat 첨자 → (구획 첨자, 구획 내 첨자)
  const owner: Array<{ phase: number; index: number }> = [];
  s.phases.forEach((p, pi) => p.items.forEach((_, ii) => owner.push({ phase: pi, index: ii })));
  const moved = flat[from]!;
  const target = owner[to]!;
  const phases = s.phases.map((p) => ({ ...p, items: p.items.slice() }));
  const src = owner[from]!;
  phases[src.phase]!.items.splice(src.index, 1);
  // 같은 구획 안에서 뒤로 갈 때는 제거로 한 칸 당겨진 것을 보정한다.
  const insertIndex = target.phase === src.phase && to > from ? target.index : target.index + (to > from ? 1 : 0);
  const bounded = Math.min(Math.max(insertIndex, 0), phases[target.phase]!.items.length);
  phases[target.phase]!.items.splice(bounded, 0, moved);
  return { ...s, phases };
}

/** 구획 속성 패치(kind·title·plannedMin). title/plannedMin 을 undefined 로 주면 키를 지운다 —
 *  "빈 문자열 title" 같은 반쯤 지운 값이 저장본에 남는 것을 막는다(omitKey 교리). */
export function updatePhase(
  s: TrainingSession,
  phaseId: PhaseId,
  patch: Partial<Pick<SessionPhase, 'kind' | 'title' | 'plannedMin'>>,
): TrainingSession {
  return {
    ...s,
    phases: s.phases.map((p) => {
      if (p.id !== phaseId) return p;
      const next: SessionPhase = { ...p, ...patch };
      if (patch.title === undefined && 'title' in patch) delete next.title;
      if (patch.plannedMin === undefined && 'plannedMin' in patch) delete next.plannedMin;
      return next;
    }),
  };
}

/** 구획 순서 이동(±1). 범위 밖은 동일 참조. */
export function movePhase(s: TrainingSession, phaseId: PhaseId, dir: -1 | 1): TrainingSession {
  const i = s.phases.findIndex((p) => p.id === phaseId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= s.phases.length) return s;
  const phases = s.phases.slice();
  const [moved] = phases.splice(i, 1);
  phases.splice(j, 0, moved!);
  return { ...s, phases };
}

/** 구획 삭제 — **항목은 버리지 않는다.** 앞 구획(없으면 뒤 구획)에 병합한다. 유일한 구획인데
 *  항목이 있으면 동일 참조를 돌려 거부한다(구획을 지우려고 편성을 잃게 두지 않는다 —
 *  validate 의 "넘친 구획 병합" 과 같은 이중 손실 방지 결). */
export function removePhase(s: TrainingSession, phaseId: PhaseId): TrainingSession {
  const i = s.phases.findIndex((p) => p.id === phaseId);
  if (i < 0) return s;
  const victim = s.phases[i]!;
  if (s.phases.length === 1) {
    return victim.items.length === 0 ? { ...s, phases: [] } : s;
  }
  const phases = s.phases.filter((p) => p.id !== phaseId);
  if (victim.items.length > 0) {
    const heir = Math.max(0, i - 1); // 앞 구획 우선 — 시간 흐름상 "그 앞 활동에 붙는" 이 자연스럽다
    phases[heir] = { ...phases[heir]!, items: [...phases[heir]!.items, ...victim.items] };
  }
  return { ...s, phases };
}

export function pickNextSession(list: TrainingSession[], now: number = Date.now()): TrainingSession | null {
  let best: TrainingSession | null = null;
  for (const s of list) {
    if (s.scheduledAt === undefined || s.scheduledAt < now) continue;
    if (!best || s.scheduledAt < best.scheduledAt!) best = s;
  }
  return best;
}

/** i18n C4 — 로케일별 요일 약칭. `Intl.DateTimeFormat` 을 안 쓰는 이유는 아래 함수 주석과 같다
 *  (브라우저 간 조합 결과가 흔들리는 것을 원천 차단). 일요일(getDay()===0)이 배열 0번이다. */
const WEEKDAYS: Record<Locale, readonly string[]> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ja: ['日', '月', '火', '水', '木', '金', '土'],
};

/** 로케일 조합 결과가 브라우저마다 달라지지 않도록 직접 조립한다 → "화 19:00".
 *  locale 기본값 'ko' — 호출부 대다수(SessionTab)는 명시로 넘기고, 아직 안 넘기는 인쇄
 *  쪽(features/print/sessionPlan.ts)은 이 기본값으로 기존 동작을 유지한다. */
export function formatSessionWhen(ms: number, locale: Locale = 'ko'): string {
  const d = new Date(ms);
  const wd = WEEKDAYS[locale][d.getDay()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${wd} ${hh}:${mm}`;
}
