// §3.5 드릴 스키마 (cast·스텝·드릴 본체). 화살표 부분은 arrow.ts 로 분리.
import type { Vec2 } from '../core/units.ts';
import type { ChairId, BallId, ConeId, DrillId, StepId, NoteId } from '../core/ids.ts';
import type { CourtMode } from './court.ts';
import type { StoredChairPose } from './chair.ts';
import type { Arrow } from './arrow.ts';

export type PoseMap<K extends string, P> = Partial<Record<K, P>>;
export type TeamSide = 'home' | 'away';

export interface ChairDef {
  id: ChairId;
  team: TeamSide;
  number: string; // 화면에 그대로 찍는 값. 'G'|'2'|'3'|'4' (1~3자)
  isGk: boolean;
  role?: string; // 'GK'|'DF'|'WG'|'PM' — 명단 패널 우측 라벨 (인스펙터 역할 셀렉트가 채움)
  name?: string; // '플레이메이커' — 인스펙터 이름 입력이 채움
  color?: string; // 지정 시 팀 색 무시 — 인스펙터 개별 색 스와치가 채움
}
export interface BallDef {
  id: BallId;
}
export interface ConeDef {
  id: ConeId;
  colorIndex: 0 | 1;
}
export interface DrillCast {
  chairs: ChairDef[];
  balls: BallDef[];
  cones: ConeDef[];
}

export interface NoteLabel {
  id: NoteId;
  x: number;
  y: number;
  text: string;
  size?: number; // px, 기본 14 — 인스펙터 크기 셀렉트
  color?: string; // 기본 '#ffffff'
  align?: 'start' | 'middle' | 'end'; // 기본 'middle'
}

export interface DrillStep {
  id: StepId;
  name: string; // ≤40자
  note: string; // ≤600자
  durationMs?: number; // 이 스텝만 재생 간격 override
  chairs: PoseMap<ChairId, StoredChairPose>;
  balls: PoseMap<BallId, Vec2>;
  cones: PoseMap<ConeId, Vec2>;
  arrows: Arrow[];
  notes: NoteLabel[];
}

export type DrillLevel = '초급' | '중급' | '고급';
export const DRILL_LEVELS = ['초급', '중급', '고급'] as const;
export interface TeamStyle {
  label: string;
  color: string;
  gkColor: string;
}
export const CURRENT_DRILL_SCHEMA = 1;

export interface Drill {
  schemaVersion: number;
  id: DrillId;
  title: string; // ≤80자
  category: string; // 열린 string (UI 는 KNOWN_CATEGORIES 만 노출)
  level: DrillLevel;
  durationMin: number; // 훈련 계획용 소요시간(분). 재생 속도와 무관
  tags: string[]; // ≤12개, 각 ≤24자
  description?: string;
  courtMode: CourtMode; // 드릴 레벨 불변
  formation: string; // 생성 시 쓴 포메이션. 표시용
  teams: Record<TeamSide, TeamStyle>; // 생성 시 prefs 에서 structuredClone 으로 복사
  cast: DrillCast;
  steps: DrillStep[]; // 최소 1, 최대 60
  createdAt: number;
  updatedAt: number;
}
