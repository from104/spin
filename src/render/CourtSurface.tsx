// §6.6 레이어 구조 — 코트 라인 디스패처. mode·variant 에만 반응하는 React.memo.
import { memo } from 'react';
import type { ComponentType } from 'react';
import type { CourtMode, CourtSize } from '../model/court.ts';
import { FullCourtLines } from './courtLines/FullCourtLines.tsx';
import { HalfCourtLines } from './courtLines/HalfCourtLines.tsx';
import { FlatCourtLines } from './courtLines/FlatCourtLines.tsx';

/** editor(도구 레일) / present(시연) / thumb(카드·미리보기) — §6.6 굵기표. */
export type CourtLineVariant = 'editor' | 'present' | 'thumb';

export interface CourtLineWeights {
  outline: number;
  goalArea: number;
  /** thumb 은 골 십자를 그리지 않는다. */
  goalCross?: number;
  /** thumb 은 킥인 원을 그리지 않는다. */
  spotR?: number;
  spotSw?: number;
  /** 센터 마크(15 cm "X") 선 굵기.
   *
   *  ⚠️ 5.3 이전에는 이 자리가 `centerR`(흰 **점**의 반지름 4.5/5/2)이었다. 점을 지운 이유는
   *  규격이다 — Laws 2025 의 중앙 표시는 점이 아니라 **15 cm X** 하나이고, 반지름 4.5 px 짜리
   *  점은 지름 36 cm 로 그 마크보다 2.4 배 크다. X 를 그 점 아래 그리면 통째로 가려진다.
   *  같은 커밋에서 규정에 없는 센터 서클(r=75)도 지웠다(§9 결정 ⑧). */
  centerMark: number;
}

// §6.6 표: editor 3/2.8/2.2/r4·sw1.5/X2.2 · present 3.2/3/2.4/r4.4·sw1.6/X2.4 · thumb 4/3.25/—/—/X2
export const COURT_LINE_WEIGHTS: Record<CourtLineVariant, CourtLineWeights> = {
  editor: { outline: 3, goalArea: 2.8, goalCross: 2.2, spotR: 4, spotSw: 1.5, centerMark: 2.2 },
  present: { outline: 3.2, goalArea: 3, goalCross: 2.4, spotR: 4.4, spotSw: 1.6, centerMark: 2.4 },
  thumb: { outline: 4, goalArea: 3.25, centerMark: 2 },
};

export interface CourtSurfaceProps {
  mode: CourtMode;
  variant: CourtLineVariant;
  /** §5.1/§6.4 코트 크기 3단. **full 에서만 의미가 있다** — 하프·플랫은 3단을 따라가지 않는다
   *  (근거는 court.ts 의 COURT_DEFS 주석 셋: 규격 부재 · 격자 붕괴 · flat 파급).
   *  디스패처는 세 컴포넌트에 **똑같이** 넘기고, Half/Flat 은 그 prop 을 **읽지 않는다**.
   *  여기서 모드로 분기해 "넘길지 말지" 를 고르면 그 분기가 court.ts 의 판단과 갈라진다 —
   *  판단은 한 곳(court.ts)에만 있어야 하고, 이 파일은 그것을 되풀이하지 않는다. */
  size?: CourtSize;
}

const LINES: Record<CourtMode, ComponentType<{ variant: CourtLineVariant; size?: CourtSize }>> = {
  full: FullCourtLines,
  half: HalfCourtLines,
  flat: FlatCourtLines,
};

/** 코트 라인만 그린다. 배경 사각형(COURT_BG)은 이 컴포넌트를 담는 쪽(CourtStage/CourtThumbnail
 *  /CourtPreview)이 그린다 — §6.6 레이어 구조에서 배경 rect 는 CourtSurface 의 형제 노드다. */
export const CourtSurface = memo(function CourtSurface({ mode, variant, size }: CourtSurfaceProps) {
  const Lines = LINES[mode];
  return <Lines variant={variant} size={size} />;
});
