// §6.6 레이어 구조 — 코트 라인 디스패처. mode·variant 에만 반응하는 React.memo.
import { memo } from 'react';
import type { ComponentType } from 'react';
import type { CourtMode } from '../model/court.ts';
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
  centerR: number;
}

// §6.6 표: editor 3/2.8/2.2/r4·sw1.5/r4.5 · present 3.2/3/2.4/r4.4·sw1.6/r5 · thumb 4/3.25/—/—/r2
export const COURT_LINE_WEIGHTS: Record<CourtLineVariant, CourtLineWeights> = {
  editor: { outline: 3, goalArea: 2.8, goalCross: 2.2, spotR: 4, spotSw: 1.5, centerR: 4.5 },
  present: { outline: 3.2, goalArea: 3, goalCross: 2.4, spotR: 4.4, spotSw: 1.6, centerR: 5 },
  thumb: { outline: 4, goalArea: 3.25, centerR: 2 },
};

export interface CourtSurfaceProps {
  mode: CourtMode;
  variant: CourtLineVariant;
}

const LINES: Record<CourtMode, ComponentType<{ variant: CourtLineVariant }>> = {
  full: FullCourtLines,
  half: HalfCourtLines,
  flat: FlatCourtLines,
};

/** 코트 라인만 그린다. 배경 사각형(COURT_BG)은 이 컴포넌트를 담는 쪽(CourtStage/CourtThumbnail
 *  /CourtPreview)이 그린다 — §6.6 레이어 구조에서 배경 rect 는 CourtSurface 의 형제 노드다. */
export const CourtSurface = memo(function CourtSurface({ mode, variant }: CourtSurfaceProps) {
  const Lines = LINES[mode];
  return <Lines variant={variant} />;
});
