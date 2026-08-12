// 3.-2 §5.2 — 내비게이션 크롬의 치수와 항목 아이콘. **레일(넓은 창)과 헤더 좌측 세그먼트(좁은
// 창)가 같은 3항목을 그린다**는 사실의 유일한 출처이자, 헤더가 세로 예산에서 쓰는 52px 을
// 계산으로 확인할 수 있게 하는 자리다.
//
// 왜 컴포넌트 파일 밖인가: trayMetrics.ts·bottomBarMetrics.ts 와 같은 이유다. (a) 컴포넌트
// 파일에서 함수·상수를 내보내면 react-refresh 경고가 는다(AppHeader.tsx 가 이미 한 건 쓰고
// 있다) (b) 예산 테스트가 화면 코드를 정방향으로 import 해 숫자를 대조할 수 없다.
//
// ⚠️ 여기서 `chromeBudget.ts` 를 import 하지 않는다. 그쪽은 코트 축척 계산(useStageMetrics·
// court)까지 끌고 오는 모듈이라, AppHeader 가 그것을 통째로 지고 다니게 된다. 예산 행과의
// 대조는 **테스트가** 양쪽을 각각 import 해서 한다(trayMetrics 가 간 길과 같다).
import type { ComponentType } from 'react';
import { IconHome, IconLibrary, IconSettings } from '../ui/icons.tsx';
import type { IconProps } from '../ui/icons.tsx';
import type { RailKey } from './screens.ts';

/** 레일 3항목의 아이콘. 레일과 헤더 세그먼트가 **같은 그림**을 써야 좁은 창으로 넘어간 사용자가
 *  같은 것을 보고 있다고 알아본다 — 각자 고르면 조용히 갈라진다. */
export const RAIL_ICONS: Record<RailKey, ComponentType<IconProps>> = {
  board: IconHome,
  drills: IconLibrary,
  settings: IconSettings,
};

/** 헤더 안쪽 여백. 좁으면 상하 4·좌우 12 로 줄인다.
 *
 *  상하 4 는 취향이 아니라 **세로 예산의 산술**이다: 헤더 행의 좁은 창 확정값은 52 이고
 *  (§5.2 — 되돌리기 44px 를 지키느라 없애지 않은 그 한 줄), 그 안에 44px 짜리 표적이 서려면
 *  남는 상하 여백이 (52 − 44) / 2 = 4 뿐이다. 여기를 8 로 두면 세그먼트가 헤더를 60 으로
 *  밀어 세로 예산 132 가 깨지고, 그만큼 코트 축척이 줄어든다. */
export const HEADER_PAD_PX = {
  wide: { x: 24, y: 8 },
  narrow: { x: 12, y: 4 },
} as const;

export const headerPadCss = (narrow: boolean): string => {
  const p = narrow ? HEADER_PAD_PX.narrow : HEADER_PAD_PX.wide;
  return `${p.y}px ${p.x}px`;
};

/** 헤더 좌측 세그먼트 한 칸의 높이 = `--hit` 그대로.
 *
 *  칸이 곧 표적이다 — 트레이 칩이 30×39 라서 §5.4 가 문제 삼은 것과 같은 종류의 손잡이라
 *  기기가 아니라 `--hit` 에 매단다(기본 44 · 큰 터치 타깃 56). 세그먼트 자체는 상하 여백도
 *  테두리도 갖지 않는다 — 한 픽셀이라도 더하면 아래 `headerContentMaxPx` 를 넘는다. */
export const navSegmentHeightPx = (hitPx: number): number => hitPx;

/** 그 모드의 헤더 한 줄이 담을 수 있는 **내용 높이**. `rowPx` 는 크롬 예산의 헤더 행
 *  (`CHROME_ROWS` 의 appHeader — wide 62 · narrow 52)이고, 테스트가 그 값을 먹여 준다. */
export const headerContentMaxPx = (rowPx: number, narrow: boolean): number =>
  rowPx - (narrow ? HEADER_PAD_PX.narrow.y : HEADER_PAD_PX.wide.y) * 2;
