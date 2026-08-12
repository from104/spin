// §3.5 드릴 스키마 (cast·스텝·드릴 본체). 화살표 부분은 arrow.ts 로 분리.
import type { Vec2 } from '../core/units.ts';
import type { ChairId, BallId, ConeId, DrillId, StepId, NoteId } from '../core/ids.ts';
import type { CourtMode, CourtSize } from './court.ts';
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
/** v2 = §7 3.2/3.3 교육 필드 + 훈련량. **3.2 와 3.3 을 한 상승에 태웠다** — 나눠 올리면
 *  migrate 를 두 번 돌고 "교육 필드는 아는데 훈련량은 모르는" 중간 버전 파일이 세상에 남는다.
 *
 *  v3 = §7 5.1 코트 크기 3단(`courtSize`). **여기서 도장을 올리는 이유는 "필드가 하나 늘어서"
 *  가 아니다** — 좌표의 뜻이 바뀌기 때문이다. courtSize:'25x14' 드릴의 좌표는 700×425 판 위의
 *  값인데, 이 필드를 모르는 옛 앱은 그것을 825×525 판에 그린다. 파일은 멀쩡히 열리고 아무 경고도
 *  없이 **틀린 전술 그림**이 나온다. 도장을 올려 두면 옛 앱이 too-new 로 정직하게 거절한다.
 *  (봉투 버전 ENVELOPE_VERSION 은 1 그대로다 — 그릇이 아니라 내용의 버전이다.) */
export const CURRENT_DRILL_SCHEMA = 3;

export interface Drill {
  schemaVersion: number;
  id: DrillId;
  title: string; // ≤80자
  category: string; // 열린 string (UI 는 KNOWN_CATEGORIES 만 노출)
  level: DrillLevel;
  durationMin: number; // 훈련 계획용 소요시간(분). 재생 속도와 무관
  tags: string[]; // ≤12개, 각 ≤24자
  description?: string;
  // ── §3.2 교육 필드 (2026-08-12 결정 ⑦ = (B) 중간) ──────────────────────────────────────
  // 4차 PDF 세션 계획서가 읽어 갈 값들이다. **성공 기준·변형(progression/regression)·드릴간
  // 참조는 넣지 않는다** — (C) 최대의 몫이고 참조는 §8 이 이미 잘라냈다(삭제 시 참조 무결성).
  //
  // 전부 optional 이다. 필수로 만들면 저장소 곳곳의 `Drill` 리터럴(테스트 픽스처 포함)이 한꺼번에
  // 컴파일 오류가 나는데, 그 파일들은 지금 다른 작업이 만지는 중이다. 대신 **값을 채우는 자리는
  // 세 곳뿐**이다: `createDrill`(새 드릴) · `DRILL_MIGRATIONS` v1→v2(옛 파일) · 인스펙터(사람).
  // 그래서 실제로 돌아다니는 드릴에는 언제나 키가 있고, optional 은 타입 편의일 뿐이다.
  objective?: string; // 목적 — 이 드릴로 무엇을 얻는가 (≤200자)
  coachingPoints?: string[]; // 코칭 포인트 — PDF 가 불릿으로 찍는다 (≤6개, 각 ≤80자)
  playersNeeded?: number; // 필요 인원(명). **0 = 미지정** (1~30)
  equipment?: string; // 필요 장비 — '공 2 · 콘 6 · 조끼 8' (≤120자)
  // ── §3.3 훈련량 (반복·세트·인터벌) ────────────────────────────────────────────────────
  // `durationMin` 하나로는 *"3회 × 2세트"* 를 표현할 수 없다. 셋 다 **0 = 미지정**이다 —
  // 1 을 기본값으로 두면 정하지도 않은 "1회 × 1세트" 를 PDF 가 사실인 양 찍는다.
  reps?: number; // 반복 횟수 (0~99)
  sets?: number; // 세트 수 (0~99)
  intervalSec?: number; // 세트 간 인터벌(초) (0~600)
  courtMode: CourtMode; // 드릴 레벨 불변
  // ── §5.1 코트 크기 3단 (2026-08-13, §9 결정 ②) ────────────────────────────────────────────
  //
  // **왜 `courtMode` 에 접지 않고 별도 필드인가** (두 길 중 ②를 택한 근거):
  //  ① `'full30' | 'full28' | 'full25' | 'half' | 'flat'` 로 접으면 `CourtMode` 를 읽는 자리가
  //     전부 대상이 된다 — `COURT_MODES` 화이트리스트 · `Record<CourtMode, CourtDef>` ·
  //     `cloneToCourt` 의 isHalfFlat · 화면의 코트 선택 UI · `m === 'full'` 비교 9곳. 그중
  //     한 곳만 놓쳐도 "28×15 는 풀 코트가 아니다" 라고 판단하는 분기가 생긴다.
  //  ② 크기는 **모드와 직교하는 축**이다. 하프로 갔다 풀로 돌아왔을 때 고른 크기가 남아 있어야
  //     하는데, 접어 넣으면 그 정보가 전환 순간 사라진다.
  //  대가는 스키마 도장 상승(v2→v3)과 화이트리스트·마이그레이션·backup 봉투 세 관문인데,
  //  그 셋은 이 저장소에 이미 규약과 테스트가 있다(3차의 확립된 수법).
  //
  // ⚠️ optional 인 것은 타입 편의다 — **없으면 '30x18'** 이고, 값을 채우는 자리는 셋뿐이다:
  // `createDrill`(새 드릴) · `DRILL_MIGRATIONS` v2→v3(옛 파일) · 설정/편집 UI(사람).
  // 필수로 만들면 저장소 곳곳의 `Drill` 리터럴이 한꺼번에 컴파일 오류가 난다(§3.2 필드와 같은 판단).
  courtSize?: CourtSize;
  formation: string; // 생성 시 쓴 포메이션. 표시용
  teams: Record<TeamSide, TeamStyle>; // 생성 시 prefs 에서 structuredClone 으로 복사
  cast: DrillCast;
  steps: DrillStep[]; // 최소 1, 최대 60
  createdAt: number;
  updatedAt: number;
}
