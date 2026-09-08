// 3.-2 §5.2 — 내비게이션 크롬의 치수와 항목 아이콘. **레일(넓은 창)과 헤더 좌측 세그먼트(좁은
// 창)가 같은 항목을 그린다**는 사실의 유일한 출처이자, 헤더가 세로 예산에서 쓰는 52px 을
// 계산으로 확인할 수 있게 하는 자리다.
//
// ── ⚠️ 2026-09-09: 위 문단과 아래 주석들이 말하던 «3항목» 은 오래전에 거짓이 됐다 ──────────
// 3 → 5(2026-08-18 세션, 2026-08-21 규칙) → **6**(2026-09-09 팀, PLAN-TEAM 결정 16). 숫자를
// 주석에 적어 둔 것이 드리프트의 원인이었으므로 여기서는 세지 않는다 — **항목의 정본은
// `RAIL_ITEMS`(screens.ts) 하나**이고 이 파일의 표들은 그 키 전수를 `Record<RailKey, …>` 로
// 받는다(빠뜨리면 컴파일 에러다). 아래 주석에 남은 "3항목/3칸" 표현은 그 시절 사고 기록으로
// 남긴 것이지 현재 개수가 아니다.
//
// 왜 컴포넌트 파일 밖인가: trayMetrics.ts·bottomBarMetrics.ts 와 같은 이유다. (a) 컴포넌트
// 파일에서 함수·상수를 내보내면 react-refresh 경고가 는다(AppHeader.tsx 가 이미 한 건 쓰고
// 있다) (b) 예산 테스트가 화면 코드를 정방향으로 import 해 숫자를 대조할 수 없다.
//
// ⚠️ 여기서 `chromeBudget.ts` 를 import 하지 않는다. 그쪽은 코트 축척 계산(useStageMetrics·
// court)까지 끌고 오는 모듈이라, AppHeader 가 그것을 통째로 지고 다니게 된다. 예산 행과의
// 대조는 **테스트가** 양쪽을 각각 import 해서 한다(trayMetrics 가 간 길과 같다).
import type { ComponentType } from 'react';
import { IconBoard, IconLibrary, IconRules, IconSessions, IconSettings, IconTeam } from '../ui/icons.tsx';
import type { IconProps } from '../ui/icons.tsx';
import type { NavTarget } from './useAppHistory.ts';
import type { RailKey } from './screens.ts';

/** 레일 항목의 아이콘. 레일과 헤더 세그먼트가 **같은 그림**을 써야 좁은 창으로 넘어간 사용자가
 *  같은 것을 보고 있다고 알아본다 — 각자 고르면 조용히 갈라진다. */
export const RAIL_ICONS: Record<RailKey, ComponentType<IconProps>> = {
  board: IconBoard,
  drills: IconLibrary,
  sessions: IconSessions,
  team: IconTeam,
  rules: IconRules,
  settings: IconSettings,
};

/** 레일 항목이 history 엔트리에 싣고 가는 대상. 아이콘과 같은 이유로 여기 한 곳에 둔다 —
 *  레일과 헤더 세그먼트가 각자 정하면 **좁은 창에서만 다르게 동작하는** 내비가 된다.
 *
 *  ⚠️ **[보드]는 `{ kind: 'board' }` 를 반드시 싣는다.** 2026-08-14 기현님 지시:
 *  *"드릴 편집 하다가 보드를 누르면 드릴 내용이 보드로 가는데 절대 금지다. 그 둘은 별개다
 *  절대적으로."*
 *
 *  그전에는 레일이 대상 없이 `go('board')` 만 불렀고, AppShell 의 `stageFromNav` 는 대상 없는
 *  엔트리에 null 을 돌려 **StageTarget 을 그대로 뒀다**. 그래서 드릴을 편집하다 [보드]를 누르면
 *  화면 키는 board 로 가고 레일 활성도 [보드]로 옮겨 가는데 자리에는 여전히 그 드릴이 떠 있었다
 *  — 사용자에게는 *"드릴 내용이 보드로 갔다"* 로 보인다.
 *
 *  옛 계약은 *"들렀다 와도 손에 든 판은 그대로"*(계획서 2.1 원칙 2)였다. 그 문장이 맞는 것은
 *  손에 든 것이 **자유 전술판일 때뿐**이고, 드릴일 때는 판과 드릴을 섞어 버린다. 지금은
 *  레일이 목적지를 **명시**하므로 그 갈림 자체가 없다. 대상 없는 board 엔트리(= `back('board')`
 *  의 대체 경로)에 대한 `stageFromNav` 의 관용은 그대로 둔다 — 시연을 끝내고 돌아오는 길은
 *  자기가 나왔던 자리로 돌아가야 한다. */
export const RAIL_NAV_TARGETS: Record<RailKey, NavTarget | undefined> = {
  board: { kind: 'board' },
  drills: undefined,
  sessions: undefined,
  // 팀도 대상 없이 간다 — 레일에서 들어오면 **목록**이다(세션·규칙과 같다). 상세(`/team/<id>`)
  // 는 카드를 눌러야 열린다.
  team: undefined,
  rules: undefined,
  settings: undefined,
};

/** 헤더 안쪽 여백. 좁으면 상하 4·좌우 12 로 줄인다.
 *
 *  상하 4 는 취향이 아니라 **세로 예산의 산술**이다: 헤더 행의 좁은 창 확정값은 52 이고
 *  (§5.2 — 되돌리기 44px 를 지키느라 없애지 않은 그 한 줄), 그 안에 44px 짜리 표적이 서려면
 *  남는 상하 여백이 (52 − 44) / 2 = 4 뿐이다. 여기를 8 로 두면 세그먼트가 헤더를 60 으로
 *  밀어 세로 예산 132 가 깨지고, 그만큼 코트 축척이 줄어든다. */
export const HEADER_PAD_PX = {
  wide: { x: 24, y: 8 },
  // ⚠️ 2026-08-14 기현님 지시(*"좁은 창 헤더의 위아래 높이가 조금 줄어들었으면"*)로 4 → 2.
  // 헤더 행도 52 → **48** 이 된다. 더는 못 줄인다: 안에 서는 것이 `--hit`(44) 짜리 표적이라
  // 48 − 44 = 4 가 남는 전부이고, 0 으로 두면 활성 칸의 테두리가 헤더 위아래 변에 딱 붙는다.
  // 아이콘(28px)은 표적보다 작아 높이를 안 민다 — 그래서 아이콘이 들어와도 48 그대로다.
  narrow: { x: 12, y: 2 },
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

// ── 가로 예산 (2026-09-09 검수) ──────────────────────────────────────────────────────
// 여기까지 이 파일에는 **세로 예산만** 있었다. 그 사이 칸은 3 → 6 으로 늘었고, 6칸째가 들어온
// 커밋에서 좁은 창(360·412) 헤더의 마지막 칸들이 화면 밖으로 밀려났다 — 그런데 body 에 가로
// 스크롤이 없어 **손이 닿지 않았다**(ja/360 에서는 [設定]이, en/412 에서는 [Rules]·[Settings]가).
// [설정]이 닿지 않으면 그 기기에서 동기화·백업으로 가는 유일한 문이 닫힌다(AGENTS §1.7
// «좁은 창에서 기능이 사라지면 안 된다»).
//
// 그래서 둘을 같이 둔다. (a) `AppNavSegment` 의 nav 를 가로 스크롤 컨테이너로 만들어 **넘쳐도
// 닿게** 한다 — 라벨 폭은 언어마다 다르고 jsdom 이 못 재므로, «넘치는가» 를 계산으로 맞히려
// 들지 않고 넘침 자체를 안전하게 만든다. (b) 아래 함수로 **라벨을 다 지웠을 때의 하한**을
// 세어, 칸이 늘 때 그 하한이 가장 좁은 지원 폭을 넘는지 테스트가 알게 한다.

/** 라벨을 전부 지우고 아이콘만 남겼을 때 세그먼트의 nav 가 요구하는 최소 폭.
 *  칸은 곧 표적이라 `--hit` 밑으로 못 줄인다(기본 44 · 큰 터치 56) — 그것이 이 하한의 정체다.
 *  `gapPx` 는 컴포넌트의 칸 사이 간격(0.125rem = 2px)이다. */
export const navSegmentMinWidthPx = (hitPx: number, itemCount: number, gapPx = 2): number =>
  itemCount * hitPx + Math.max(0, itemCount - 1) * gapPx;

/** 가장 좁은 지원 폭(px)에서 헤더 좌측 세그먼트의 nav 에게 남는 가로 예산.
 *  헤더 좌우 여백(narrow 12×2)과 앱 아이콘 한 벌(28 + marginRight 2 + 바깥 gap 6)을 뺀 값이다. */
export const navSegmentWidthBudgetPx = (viewportPx: number): number =>
  viewportPx - HEADER_PAD_PX.narrow.x * 2 - (28 + 2 + 6);
