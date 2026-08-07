// 플랫 코트 — "라인 없음"(§3.2 dims). template.html 304행/460행의 isFlat 블록은 비어 있다.
// 배경·격자만으로 코트를 표현하므로 이 컴포넌트는 아무것도 그리지 않는다.
import type { CourtLineVariant } from '../CourtSurface.tsx';

export interface FlatCourtLinesProps {
  variant: CourtLineVariant;
}

export function FlatCourtLines(_props: FlatCourtLinesProps) {
  return null;
}
