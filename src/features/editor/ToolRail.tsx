// §6.10 판 가장자리 트레이 — **개체**(끌어다 놓는 말)와 **기능**(모드)을 나눠 담는다.
//
// 2026-08-11 기현 지시로 재편했다. 이전에는 8종이 한 줄로 섞여 있었고 개체도 "도구를 고르고
// 코트를 찍는" 2단계였는데, 공개판에서 두 카톡방이 독립적으로 "배치를 못 하겠다" 고 했다.
// 이제 개체는 트레이에 **말처럼 놓여 있고** 끌어다 놓으면 된다. 탭하면 예전 2단계도 그대로
// 동작한다(이미 그 방법을 익힌 사용자가 있다 — 김경일님이 방에서 대신 설명해 준 그 경로).
//
// 기능 도구는 모드라서 끌 것이 없다. 그래서 아래쪽에 따로 모은다.
import { Fragment, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { ChairId } from '../../core/ids.ts';
import type { ToolId } from '../../physics/index.ts';
import { CONE_COLORS } from '../../core/colors.ts';
import { CHAIR } from '../../core/constants.ts';
import { numberedName } from '../../model/chairLabel.ts';
import { IconToolNote, IconToolRoute } from '../../ui/icons.tsx';
import { TOOLS, type ToolDef } from './toolDefs.ts';
import {
  CHIP_BOX_H_CSS,
  CHIP_H_CSS,
  CHIP_ROW_GAP,
  CHIP_W_CSS,
  TOOL_BTN_H,
  TOOL_BTN_W,
  TRAY_BAND_1ROW_CSS,
  TRAY_BAND_DIVIDER_MARGIN_X,
  TRAY_BAND_DIVIDER_MARGIN_Y,
  TRAY_BAND_PAD_X,
  TRAY_BAND_PAD_Y,
  TRAY_DIVIDER_H,
  TRAY_DIVIDER_MARGIN_Y,
  TRAY_GAP,
  TRAY_ITEM_GAP,
  TRAY_PAD_Y,
  TRAY_ROW_CAP_CSS,
  TRAY_ROW_MAX_CSS,
} from './trayMetrics.ts';
import type { TrayDragItem } from './useTrayDrag.ts';

/** 트레이의 선수 주차 슬롯. 배치 여부와 상관없이 **전원**이 자리를 유지한다 —
 *  코트에서 빼냈을 때 어디로 돌아가는지 보여야 하고, 트레이 길이도 들쭉날쭉하지 않는다. */
export interface ChairSlot {
  id: ChairId;
  number: string;
  color: string;
  ink: string;
  /** §3.4 선수 실명. 칩에 **그리지는 않는다** — 52px 폭에 이름이 들어가지 않고, 등번호를 2/3
   *  크기로 줄여 놓은 2026-08-11 결정과도 충돌한다. 손잡이 **이름**(스크린리더)과 툴팁에만
   *  실린다: 눈으로는 번호로 찾고, 소리로는 사람 이름으로 찾는다. */
  name?: string;
  /** 코트에 나가 있는가. 참이면 빈 슬롯(점선)으로 그리고 끌 수 없다. */
  placed: boolean;
}

export interface ToolRailProps {
  tool: ToolId;
  onSelectTool(id: ToolId): void;
  coneSlot: 0 | 1;
  onConeSlotChange(slot: 0 | 1): void;
  ballCount: number;
  ballMax: number;
  /** 색깔별로 코트에 나가 있는 콘 수. 색마다 상한이 따로라 하나로 합칠 수 없다. */
  coneCounts: readonly [number, number];
  coneMax: number;
  chairSlots: readonly ChairSlot[];
  pendingPlayerId: ChairId | null;
  onArmPlayer(id: ChairId): void;
  courtLabel: string;
  // ⚠️ 2026-08-14 — `tray`·`onTrayChange`·`drillUses` 셋이 **사라졌다.** 서랍이 플라이아웃이
  // 되면서 "열린 채로 둔다" 라는 상태 자체가 없어졌기 때문이다(본문 플라이아웃 주석에 경위).
  // `prefs.tray` 저장값은 storage 에 남아 있지만 아무도 안 읽는다 — 옛 기기에서 넘어온 값이
  // 조용히 무시되는 것이 맞다(지우면 그 기기의 prefs 파싱이 깨진다).
  /** 태블릿 세로에서는 트레이를 판 **아래**에 가로로 눕힌다(§6.4). */
  orientation?: 'vertical' | 'horizontal';
  /** 줌 3개(확대·축소·100%) — 2026-08-14 기현님 지시로 코트 위 떠 있던 묶음에서 **기둥 맨 위**로
   *  옮겨 왔다(설계서 §3-ㄱ, StageControls.tsx 머리말이 근거를 갖는다).
   *
   *  ⚠️ **선택 prop 인 이유**: 트레이는 판(EditorWorkspace) 밖에서도 렌더된다 — 지금 트레이만
   *  떼어 그리는 자리가 테스트 2파일이고, 무대(CourtStageHandle)가 없는 그 자리에 줌은 부를
   *  대상 자체가 없다. 배선이 끊기면 조용히 사라지는 것이 대가인데, 그것은 두 통합 테스트가
   *  **이름으로** 잡는다: boardTargetBudget 의 대조군이 `'확대'` 를 직접 찍고(구역 표본),
   *  EditorWorkspace.viewControls.test 가 그 버튼이 `nav[data-tray]` **안**에 있는지 본다. */
  // ⚠️ 2026-08-15 — **줌 3개와 되돌리기·다시하기가 여기서 사라졌다**(드릴 편집 재설계 ①).
  //
  // 2026-08-14 에 자유 전술판이 그 둘을 오른쪽 기능 바로 옮겼는데, 드릴 편집은 옛 배치라
  // 트레이에 그대로 있었다. 그래서 **같은 앱의 두 화면에서 줌의 자리가 정반대**였다 —
  // §3 불변식 1(절대 위치로 만드는 공간 기억)이 지키려던 것을 화면을 옮기는 순간 스스로
  // 깨고 있었다. 이제 둘 다 기능 바에 있고, 트레이는 **판에 놓는 것**만 갖는다.
  //
  // 그 결과 이 컴포넌트에는 모드 분기가 하나도 없다 — 전술판과 드릴이 같은 트레이를 쓴다.
  /** 끌어다 놓기 연결(useTrayDrag.start). 없으면 탭만 동작한다 — 테스트·프리젠터용. */
  onItemPointerDown?(item: TrayDragItem, e: ReactPointerEvent, onTap: () => void): void;
}

/** 트레이 칩의 화면 크기 — **전부 `--hit` 파생이다**(§5.4). 이전에는 33px 고정이라 칩 상자가
 *  30×39, 이 앱 주력 조작(끌어다 놓기)의 손잡이가 44 미달이었다. 이제 상자 가로가 정확히
 *  `--hit` 이다: 기본 44 → 상자 44×60, 큰 터치 타깃 56 → 상자 56×78.
 *
 *  칩은 코트 칩과 **같은 비율**(37.5 : 25)이되 **세로로 세워서** 쓴다(기현 지시 2026-08-11):
 *  트레이는 세로 레일이라, 칩을 눕히면 두 개가 한 줄에 못 들어가 줄당 하나가 되고 선수
 *  8명이면 트레이가 두 배로 길어진다. 세워도 같은 물건으로 읽히는 이유는 비율·머리·볼가드가
 *  그대로이기 때문이다 — 코트에서 위를 향한 휠체어와 똑같은 그림이다. */
/** 치수 식은 trayMetrics.ts 에 있다 — 크롬 예산 테스트와 화면이 같은 식을 쓰기 위해서다. */

/** 칩을 감싸는 상자. 배치 여부와 상관없이 같은 크기라야 칸이 어긋나지 않고, 테두리·여백을
 *  안쪽으로 넣어야(border-box) 선택 테두리가 붙었다 떨어질 때 줄이 밀리지 않는다. */
const TRAY_CHIP_BOX = {
  flex: 'none' as const,
  boxSizing: 'border-box' as const,
  width: 'var(--hit)',
  height: CHIP_BOX_H_CSS,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/** 트레이는 **판의 일부**다(기현 결정 2026-08-11) — 배경을 코트 패널과 같은 `--panel-2` 로 두어
 *  패널 경계가 보이지 않게 하고, 대신 안쪽 그림자로 얕은 홈을 판다. 실제 전술판에서 말이
 *  놓여 있는 가장자리처럼 보이게 하는 것이 목적이라, 별도 패널 색(`--panel`)을 쓰지 않는다. */
const RAIL_BASE = {
  flex: 'none',
  background: 'var(--panel-2)',
  display: 'flex',
  gap: TRAY_GAP,
  position: 'relative' as const,
};

const RAIL_STYLE = {
  ...RAIL_BASE,
  // ── 2026-08-14 P3: 폭 못박음을 **구간**으로 뒤집었다 (설계서 §4.1) ─────────────────────
  // 옛 결정(지우지 않는다): *"폭 = 칩 줄(§5.4). 크롬 예산의 toolRail 행(wide/narrow 93)이 이
  // 식의 hit=44 값이고, 큰 터치 타깃(56)이면 117 이다"* — 그 93 은 지금도 참이지만 이제
  // **하한**이다. 코트 칸이 자기 종횡비만큼만 쓰고 남긴 폭이 여기로 흘러든다.
  //
  //  · `flex:'1 1 0'` — base 를 **0** 으로 둬야 한다. `'1 1 auto'` 면 base 가 max-content 라
  //    라인이 넘쳐 코트 칸까지 함께 줄어든다(§4.1 함정 1).
  //    ⚠️ 값을 `'1 1 0px'` 로 적은 이유: jsdom 의 cssstyle 이 **단위 없는 `0`** 을 flex 축약형에서
  //    거부해 선언 자체를 통째로 버린다(2026-08-14 프로브 실측 — `flex:'1 1 0'` → style 속성에
  //    아무것도 안 남는다). 브라우저에서 `0` 과 `0px` 은 같고, `0%` 는 **다르다**(주축 크기가
  //    미확정인 shrink-to-fit 컨테이너에서 백분율 base 는 content 로 되돌아가 함정 1 을 되살린다).
  //  · minWidth 2열 = 지금 값. 폭 제약 기기(1280·1920 핀)는 여기서 멈춰 오늘과 같은 배치가 된다.
  //    옛 근거도 그대로 살아 있다: *"개체 그룹은 스크롤 컨테이너라 min-content 기여가 0 이다 —
  //    안쪽 칩 줄이 아무리 넓어도 트레이를 벌리지 못하고 조용히 잘린다."* 그래서 하한은 여전히
  //    **여기서** 못박아야 한다(칩 줄에 맡기면 스크롤러가 그 기여를 삼킨다).
  //  · maxWidth 5열 = 240(hit 44)/300(hit 56). 없으면 half/flat 이 1024×600 에서 9열 슬래브가 된다.
  flex: '1 1 0px',
  minWidth: TRAY_ROW_MAX_CSS,
  maxWidth: TRAY_ROW_CAP_CSS,
  // 판 오른쪽 가장자리의 홈. 선 하나로 자르면 다시 별도 패널로 보인다.
  // ⚠️ **한 줄도 바꾸지 마라**(설계서 §4.4): 여태 이 홈은 86px 빈 배경 옆이라 "떠 있는 패널
  // 가장자리" 로 읽혔다. 코트 그림이 홈에 **닿는 순간** 비로소 의도대로 "판에 파인 얕은 홈" 이 된다.
  boxShadow: 'inset 7px 0 12px -10px rgba(0,0,0,.55)',
  flexDirection: 'column' as const,
  alignItems: 'center',
  padding: `${TRAY_PAD_Y}px 0`,
};

/** 가로 트레이 — 세로 화면에서 판 아래. 항목이 많아 좁은 태블릿에서는 넘칠 수 있어 가로
 *  스크롤을 연다.
 *
 *  ── 2026-08-14 P5: **1행 76px → 2행 132px 띠** (설계서 §4.7) ──────────────────────────
 *  옛 결정(지우지 않는다): *"줄바꿈하면 트레이 높이가 들쭉날쭉해져 코트 크기가 흔들린다."*
 *  그 걱정은 지금도 옳고, 그래서 wrap 을 여는 대신 **높이를 못박았다** — `height` 가 고정이면
 *  줄이 몇 개로 흐르든 코트가 받는 상자는 한 픽셀도 안 변한다(들쭉날쭉의 원인은 wrap 이 아니라
 *  `height:auto` 였다). 넘치는 줄은 `overflowY:'auto'` 가 받는다.
 *
 *  왜 2행인가 — **축척 절벽이 상한을 정한다.** 띠를 올리면 가용 높이가 줄고 176px 에서
 *  `rotForFit` 이 90 → 0 으로 뒤집혀 480×800 세로 full 코트의 축척이 0.5976 → 0.5527 로 뚝
 *  떨어졌다. (2026-08-14: 그 절벽은 **세로 창**의 것이었다 — 지금 띠는 가로 창의 것이라 문턱이
 *  아래다. 3행(≈182+)은 상한 밖이라 **2행이 물리적 최대다.** 대가는 세로 full 코트 축척
 *  0.7176 → 0.6497(**−9.5%**) 하나뿐이고, 가로 전 기기는 이 상수를 안 쓴다.
 *
 *  ⚠️ **세로 전용 서랍안은 기각됐다 — 되살리지 마라**(2026-08-14 기현님 확정). 서랍을 여는
 *  순간 띠가 76 → 132 가 되어 **코트 축척이 0.7176 → 0.6497 로 바뀐다 = 판 위 모든 개체가
 *  움직인다.** *"컨트롤을 열었더니 판이 줄었다"* 는 조준 대상이 사용 중에 움직이는 것이라 스크롤보다
 *  나쁘다. 서랍이 승인된 대체재인 것은 맞지만 **판 크기를 바꾸는 서랍은 아니었다.** 띠 높이는
 *  개폐·내용·드릴과 무관하게 **상수**라야 한다 — 그것이 `height` 를 못박은 두 번째 이유다. */
const RAIL_STYLE_H = {
  ...RAIL_BASE,
  boxShadow: 'inset 0 7px 12px -10px rgba(0,0,0,.55)',
  flexDirection: 'row' as const,
  // ⚠️ 2026-08-14 — `wrap` 에서 **`nowrap`** 으로 돌아왔다(기현님 결정). 띠가 세로 화면의
  //    것이던 시절에는 2행으로 눕히는 편이 나았지만, 이제 띠는 **가로 화면**의 것이고
  //    가로 화면에서 모자라는 것은 정확히 높이다(trayMetrics 의 trayBandHeightPx 머리말).
  //    넘치면 아래 `overflowX` 로 좌우 스크롤한다 — 띠 높이가 상수라 코트는 안 흔들린다.
  flexWrap: 'nowrap' as const,
  height: TRAY_BAND_1ROW_CSS,
  alignItems: 'center',
  // ⚠️ **'center' 로 되돌리지 마라.** 두 가지가 동시에 깨진다(2026-08-12 3차 검증 실측).
  //  ① §3 불변식 1 이 무효가 된다 — 서랍 내용물은 주축 **끝**에 붙는데 중앙정렬이면 끝에
  //     폭이 붙는 순간 앞쪽 표적이 **전부** 왼쪽으로 밀린다(작도 114px · 설명 57px · 둘 다
  //     171px → 85.5px 이동). 절대 위치로 쌓인 공간 기억이 깨지는 것이 점진
  //     공개를 버리고 서랍을 고른 유일한 이유인데, 하필 **태블릿을 무릎에 세우는 그 자세**
  //     (세로 화면 → 가로 트레이)에서 무효가 된다.
  //  ② 넘칠 때 첫 항목에 손이 닿지 않는다 — flex 의 중앙정렬은 양쪽으로 넘치고 시작 쪽
  //     넘침은 scrollLeft 로 갈 수 없다. 7인치 세로에서 표적 13개(약 741px)는 이미 넘치므로
  //     **1번 선수가 영영 안 잡힌다.**
  // ── 2026-08-14 기현님 지시: *"아래의 트레이가 가운데 정렬이 되어야 한다"* ──────────────
  // 위 두 경고는 **`center` 에 대한 것이고 지금 값은 `safe center` 다.** 그 한 낱말이 정확히
  // 위험 ②를 막는다: `safe` 는 내용이 넘치는 순간 정렬을 `start` 로 되돌린다(CSS Box Alignment
  // §4.2). 즉 들어갈 때는 가운데, 넘칠 때는 왼쪽 붙임 — "1번 선수가 영영 안 잡힌다" 는 사고가
  // 원리적으로 안 난다. 위험 ①(서랍이 앞을 민다)은 이미 없다: 서랍이 흐름 밖 플라이아웃이라
  // 열려도 띠의 내용 폭이 한 픽셀도 안 변한다.
  // 지원: Chrome 93+ · Firefox 63+ · Safari 16.4+. 못 알아듣는 브라우저는 선언 전체를 버리고
  // 기본값 `flex-start` 로 남으므로, **실패해도 옛 동작**이다(가운데 정렬만 안 될 뿐).
  justifyContent: 'safe center',
  // ⚠️ **교차축에도 같은 규칙이 필요하다**(2026-08-14 P5). wrap 이 열리는 순간 `align-content`
  //    가 살아나는데 기본값 `stretch`(또는 `center`)면 ① 줄이 하나일 때와 둘일 때 **첫 줄의 y 가
  //    달라진다** — 서랍을 열어 줄이 하나 늘면 선수 칩이 통째로 위로 올라간다(§3 불변식 1 위반,
  //    justifyContent 를 flex-start 로 둔 것과 **같은 이유의 세로판**) ② 3행으로 넘칠 때 위쪽
  //    넘침은 scrollTop 으로 갈 수 없어 첫 줄에 손이 안 닿는다(위 ②의 세로판).
  //    ⚠️ nowrap 으로 돌아온 지금 이 줄은 **놀고 있다.** 지우지 않는 이유: wrap 을 다시 켜는
  //    순간 위 두 사고가 그대로 되살아나고, 그때 이 줄이 없으면 아무도 이유를 모른다.
  alignContent: 'flex-start',
  padding: `${TRAY_BAND_PAD_Y}px ${TRAY_BAND_PAD_X}px`,
  // 1행이라 좁은 창에서는 줄이 넘친다 — **여기가 유일한 도달 경로다.**
  overflowX: 'auto' as const,
  // 세로로는 넘칠 수 없다(1행 + 높이 고정). overflowY 를 열면 1px 반올림에 세로 스크롤바가
  // 생겨 띠가 그만큼 좁아지므로 **닫아 둔다.**
  overflowY: 'hidden' as const,
};

const BALL_TOOL = TOOLS.find((t) => t.id === 'ball')!;
const CONE_TOOL = TOOLS.find((t) => t.id === 'cone')!;
/** 상자 라벨이자 스크린리더 이름. 52px 폭에 '주황 콘'은 넘쳐서 화면에는 색 이름만 쓴다. */
const CONE_SLOT_NAMES = ['주황', '파랑'] as const;
/** 모드 도구 — 끌 것이 없다. 'player' 는 트레이에 칩으로 직접 놓이므로 여기서 뺀다
 *  (키보드 단축키 P 는 toolDefs 에 그대로 살아 있다).
 *
 *  ⚠️ 3.-1 로 이 5종이 상시 3표적이 됐고, 3.7 이 서랍을 §3 대로 둘로 가르며 상시 4표적이
 *  됐다가, 2026-08-16 지우개 제거로 **상시 3표적**(선택 · 작도 손잡이 · 설명 손잡이)이 됐다.
 *  첫 화면 표적 실측은 그만큼 내려간다 — §3 이 예고한 미착수분(도움말 1 · 빈 판 채우기 1)의
 *  여유가 오히려 늘었다. 예산은 여기서 낸다.
 *
 *  **무엇을 남기고 무엇을 접었나**(§3 트레이 그림의 `기능: [선택]` + `▸ 작도` `▸ 설명`):
 *  - `select` 는 접을 수 없다 — 개체를 고르고 옮기는 기본 모드이자 다른 모드에서 빠져나오는
 *    유일한 상시 출구다. 이걸 두 번 눌러야 하는 자리로 보내면 모든 조작이 한 번씩 비싸진다.
 *  - `erase` 는 **도구 자체가 없어졌다**(2026-08-16 기현 지시). 잘못 놓은 것을 지우는 일이
 *    잦다는 옛 근거는 여전히 옳지만, 마우스로 그 일을 하는 길은 **원래부터 지우개가 아니었다**
 *    — 오른쪽 버튼/길게 누르기 → 개체 메뉴 → [삭제], 또는 코트에서 **트레이로 끌어 복귀**
 *    (칩·공·콘). 둘 다 그대로다. 지우개는 그 위에 얹힌 셋째 문이었을 뿐이다.
 *  - `route`·`pass`·`note` 는 접는다. 셋 다 "판 위에 그려 넣는 것"이지 **드릴을 만들 때 쓰는
 *    도구지 판을 읽을 때 쓰는 도구가 아니다** — 첫 화면에서 상시 표적일 필요가 없다. 다만
 *    한 서랍이 아니라 둘이다(아래 `DRAWERS` 주석). 접힌 뒤에도 단축키 R·P·T 는 그대로 살아
 *    있고, 그것으로 도구가 켜지면 그 서랍이 그 순간 열린다(§3 불변식 2 — 잠긴 기능 0개).
 *  조준 비용이 큰 입력을 기준으로 "표적 2개를 줄이는 것 vs 두 번 누르게 하는 것"을
 *  항목마다 저울질한 결과다: 접힌 셋은 **한 세션에 한 번** 서랍을 열면 그 뒤로는 예전과 같은
 *  1회 조준이고(열린 서랍은 다시 닫히지 않는다), 남긴 둘은 매 조작마다 오가는 도구다. */
// 2026-08-16 지우개가 사라져 상시 노출은 **선택 하나**다(근거는 toolDefs 의 그 주석).
const ALWAYS_TOOLS = TOOLS.filter((t) => t.id === 'select');

/** §3 트레이 서랍 2개의 개폐 상태. `prefs.tray` 와 **같은 모양**이다(3.0 이 세워 둔 필드) —
 *  그쪽이 이 값을 기기 재시작 너머로 들고 가는 저장소이고, 화면의 신뢰값은 컴포넌트 state 다. */
export interface TrayDrawers {
  draw: boolean;
  note: boolean;
}
type DrawerKey = keyof TrayDrawers;
/** 하위 도구를 고른 뒤 서랍이 닫히기까지. 0 이면 방금 고른 것이 눈에 안 남고, 연달아 둘을
 *  고르려던 손이 허공을 짚는다. 400ms 는 "골랐다" 를 읽고 손이 떠날 만한 최소치다. */
export const FLYOUT_PICK_CLOSE_MS = 400;
/** 포인터가 손잡이·패널 밖으로 나간 뒤 닫히기까지. 손잡이와 패널 사이에 1~2px 틈이 있어
 *  0 이면 그 사이를 지나가다 닫힌다. */
export const FLYOUT_LEAVE_CLOSE_MS = 260;

/** 서랍 표 — 이름 · 손잡이 아이콘 · 담긴 도구. **3.-1 은 셋을 한 서랍(`작도`)에 몰아 두었고
 *  3.7 이 §3 대로 가른다.** 그때의 유보 사유(3m 링이 아직 도구가 아니라 `설명` 이 한 칸짜리
 *  서랍이 된다)는 지금도 사실이지만, 가르는 이유가 그보다 크다: 서랍은 **접는 장치가 아니라
 *  고르는 장치**다. 한 서랍에 몰아 두면 코트 위에 설명만 붙이는 사람(시연용 판을 다듬는 코치)이
 *  이동·패스 화살표까지 상시 표적으로 떠안고, 반대로 화살표만 그리는 사람은 메모를 떠안는다.
 *
 *  ⚠️ 이 갈림에서 **메모가 `작도` 에서 `설명` 으로 한 칸 옮겨 간다.** 개폐로 움직이는 것이
 *  아니라 **재편으로** 움직이는 것이라 §3 불변식 1 위반은 아니다(FALSIFICATION §26.6 이
 *  3.-1 에서 미리 예고해 둔 이동이다) — 그래도 자리를 옮긴 것은 사실이라 커밋 메시지에 적는다. */
const DRAWERS = [
  { key: 'draw', label: '작도', Icon: IconToolRoute, tools: TOOLS.filter((t) => t.id === 'line' || t.id.startsWith('shape')) },
  { key: 'note', label: '설명', Icon: IconToolNote, tools: TOOLS.filter((t) => t.id === 'note') },
] as const satisfies readonly { key: DrawerKey; label: string; Icon: typeof IconToolRoute; tools: readonly ToolDef[] }[];

const BTN_STYLE = {
  position: 'relative' as const,
  width: TOOL_BTN_W,
  height: TOOL_BTN_H,
  // 큰 터치 타깃이면 52×50 도 56 까지 자란다(§5.4 — 트레이의 손잡이는 전부 --hit 을 따른다).
  // 기본 44 에서는 min 이 지기 때문에 52×50 그대로다.
  minWidth: 'var(--hit)',
  minHeight: 'var(--hit)',
  borderRadius: 11,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
};


/** 코트 칩의 축소판. 좌표계를 코트와 **똑같이** 쓰고(뷰박스가 곧 차체) 스케일만 다르므로,
 *  차체 치수를 바꾸면 트레이도 따라온다 — 두 곳에 숫자를 적어 두면 반드시 어긋난다.
 *
 *  코트에서 휠체어는 가로로 놓인다(앞이 오른쪽). 트레이만 세로로 세워 두면 같은 말이
 *  두 모습으로 보인다 — 머리(피벗)와 볼가드가 어느 쪽인지도 사라진다. */
function TrayChairArt({ color, ink, number, empty }: { color?: string; ink?: string; number: string; empty?: boolean }) {
  const half = CHAIR.widthPx / 2;
  return (
    <svg
      aria-hidden
      // 차체 좌표계는 코트와 **같다**(앞이 +x). 뷰박스만 가로세로를 바꿔 잡고 안쪽을 -90°
      // 돌려 앞이 위를 보게 한다 — 그림 자체를 다시 그리면 두 곳이 어긋나기 시작한다.
      // 크기는 CSS 로 --hit 파생이다(§5.4) — 뷰박스 좌표계라 안쪽 그림·등번호가 통째로 스케일된다.
      viewBox={`${-half} ${-CHAIR.pivotToFrontPx} ${CHAIR.widthPx} ${CHAIR.lengthPx}`}
      style={{ display: 'block', overflow: 'visible', width: CHIP_W_CSS, height: CHIP_H_CSS }}
    >
      <g transform="rotate(-90)">
      <rect
        x={-CHAIR.pivotToRearPx}
        y={-half}
        width={CHAIR.lengthPx}
        height={CHAIR.widthPx}
        rx={5}
        fill={empty ? 'none' : color}
        stroke={empty ? 'var(--border-strong)' : 'rgba(255,255,255,.92)'}
        strokeWidth={2.2}
        strokeDasharray={empty ? '5 4' : undefined}
      />
      {!empty && (
        <>
          {/* 볼가드(앞) · 머리(피벗) — 어느 쪽이 앞인지 알려 주는 두 표식 */}
          <rect
            x={CHAIR.pivotToFrontPx - CHAIR.guardPx}
            y={-half}
            width={CHAIR.guardPx}
            height={CHAIR.widthPx}
            rx={2}
            fill="rgba(255,255,255,.24)"
            stroke="rgba(255,255,255,.92)"
            strokeWidth={1.4}
          />
          <circle cx={0} cy={0} r={4.2} fill="rgba(255,255,255,.92)" />
        </>
      )}
      {/* 등번호는 되돌려 세운다. 코트에서도 칩이 아무리 돌아도 숫자는 절대 눕지 않는다
          (§3.4 — writer 가 rotate(-θ) 를 기록한다). 여기서는 그 θ 가 고정 90° 다. */}
      <g transform={`translate(${CHAIR.centroidOffsetPx} 0) rotate(90)`}>
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fill={empty ? 'var(--faint-text)' : ink}
          style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: (20 * 2) / 3 }}
        >
          {number}
        </text>
      </g>
      </g>
    </svg>
  );
}

/** 개체 **상자**. 트레이의 개체는 코트에 "그리는" 것이 아니라 상자에서 꺼내는 것이고,
 *  코트에서 도로 끌어다 넣으면 상자로 돌아간다. 안쪽 그림자로 얕게 파인 홈을 만들어
 *  버튼(눌러서 켜는 것)이 아니라 담긴 것을 꺼내는 자리로 읽히게 한다. */
const BOX_STYLE = {
  ...BTN_STYLE,
  border: '1px solid var(--border-strong)',
  background: 'color-mix(in srgb, var(--text) 5%, transparent)',
  boxShadow: 'inset 0 2px 5px -2px rgba(0,0,0,.55)',
};

/** 상자에 **남은** 개수. 코트에 놓은 수가 아니다 — 손이 다음에 알고 싶은 것은
 *  "몇 개 놓았나"가 아니라 "몇 개 더 꺼낼 수 있나"다. 0이면 상자가 빈 것으로 보인다. */
function RemainingBadge({ n }: { n: number }) {
  const empty = n <= 0;
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 16,
        height: 16,
        padding: '0 3px',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: '0.625rem',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        border: '1px solid var(--border-strong)',
        background: empty ? 'transparent' : 'var(--panel)',
        color: empty ? 'var(--faint-text)' : 'var(--text)',
      }}
    >
      {n}
    </span>
  );
}

function ActiveRing() {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 11,
        border: '1.5px solid var(--accent)',
        background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
      }}
    />
  );
}

/** 모드 버튼 한 칸. 상시 2종과 서랍 안 3종이 **같은 컴포넌트**라야 서랍을 열었을 때
 *  칸 모양이 달라지지 않는다(달라지면 접힌 것이 '다른 등급의 도구'로 읽힌다). */
function ToolButton({ def, active, onSelect }: { def: ToolDef; active: boolean; onSelect(): void }) {
  return (
    <button
      type="button"
      title={def.key ? `${def.label} (${def.key})` : def.label}
      aria-pressed={active}
      onClick={onSelect}
      style={{ ...BTN_STYLE, color: active ? 'var(--accent-text)' : 'var(--muted)' }}
    >
      {active && <ActiveRing />}
      <span style={{ position: 'relative', display: 'flex' }}>
        <def.Icon />
      </span>
      <span style={{ position: 'relative', fontSize: '0.6875rem', fontWeight: 600 }}>{def.label}</span>
      {/* 단축키 글자를 **버튼 위에** 둔다(2026-08-16 기현 지시). 도움말 모달에만 있으면
          열어보기 전까지 존재를 모르고, 코치는 대개 열어보지 않는다. 모서리에 작게 얹어
          아이콘·라벨의 자리를 뺏지 않는다. `aria-hidden` — 스크린리더에게는 이미 버튼
          이름이 있고, 여기 글자를 읽으면 "선택 V" 처럼 두 번 불린다. */}
      {def.key && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 2,
            right: 3,
            fontSize: '0.5625rem',
            fontWeight: 700,
            lineHeight: 1,
            fontFamily: "'Space Grotesk', sans-serif",
            opacity: active ? 0.9 : 0.45,
          }}
        >
          {def.key}
        </span>
      )}
    </button>
  );
}

export function ToolRail({
  tool,
  onSelectTool,
  coneSlot,
  onConeSlotChange,
  ballCount,
  ballMax,
  coneCounts,
  coneMax,
  chairSlots,
  pendingPlayerId,
  onArmPlayer,
  courtLabel,
  orientation = 'vertical',
  onItemPointerDown,
}: ToolRailProps) {
  const horiz = orientation === 'horizontal';
  // ⚠️ 세로 트레이는 **판 오른쪽**에 있으므로 플라이아웃을 왼쪽(코트 쪽)으로 편다. 오른쪽으로
  // 펴면 화면 밖이다 — 트레이가 왼쪽에 있던 시절의 `left:'100%'` 를 그대로 두면 콘 색 선택이
  // 통째로 잘린다. 가로 트레이는 판 아래에 있으니 위쪽으로 편다(같은 이유).
  const ballHintId = useId();
  const coneHintId = useId();
  const drawerId = useId();

  // ─── 서랍 = **플라이아웃** (2026-08-14 기현님 재설계) ──────────────────────────────
  // 기현님 지시: *"작도, 메모 아이콘 서랍은 마우스가 오버 또는 손으로 터치(클릭)할 때 —
  // 트레이가 가로일 때는 위로, 세로일 때는 왼쪽으로 펼쳐졌다가, 하위 아이콘이 선택되면
  // 딜레이 갖고 닫히는 것으로."*
  //
  // 옛 서랍은 **자리를 차지하며 인라인으로 펼쳐졌고**, 그래서 §3 불변식 1(조준 대상이 사용
  // 중에 이동하지 않는다)을 지키려고 손잡이를 기능 구역 맨 끝에 못박고, 첫 서랍을 열면 둘째
  // 손잡이가 밀리는 대가를 감수하고, 한 번 열린 서랍은 다시 안 닫는 규칙까지 세워야 했다.
  // 플라이아웃은 그 대가를 **원인째** 없앤다 — 떠 있는 동안에도 흐름을 한 픽셀도 안 먹으므로
  // 어떤 표적도 움직이지 않는다. 그래서 아래 셋이 통째로 사라졌다:
  //   · `prefs.tray` 개폐 저장(열린 채로 둘 것이 없다)
  //   · 불변식 2 의 "단축키로 접힌 도구를 켜면 그 서랍이 열린다"(도구는 켜지고, 열 것이 없다)
  //   · 불변식 3 의 "드릴이 쓰는 말에 맞춰 서랍이 열린다"(같은 이유)
  // 셋 다 **접힌 것을 어떻게 다시 펴는가** 의 답이었고, 이제 펴는 것은 손이 닿기만 하면 된다.
  //
  // 열림: 포인터가 손잡이에 들어오거나(hover) 손잡이를 누르면(터치·키보드) 연다.
  // 닫힘: ① 하위 도구를 고르면 `FLYOUT_PICK_CLOSE_MS` 뒤 — 즉시 닫으면 방금 고른 것이
  //          눈에 안 남고, 연달아 둘을 고르려던 손이 허공을 짚는다.
  //       ② 포인터가 손잡이·패널 밖으로 나가면 `FLYOUT_LEAVE_CLOSE_MS` 뒤 — 손잡이와 패널
  //          사이를 지날 때 잠깐 밖이 되는 구간이 있어 0 이면 지나가다 닫힌다.
  //       ③ Esc.
  // ⚠️ **패널은 포털로 `document.body` 에 붙인다** (2026-08-14 기현님 신고: *"작도 및 메모
  // 서랍이 안 펼쳐진다"*). 원인은 트레이 자신의 `overflow` 였다: 가로 띠는 `overflowX:'auto'`
  // 이고, CSS 는 한 축이 visible 이 아니면 **다른 축도 clip 이 된다**(overflow-y:hidden 과
  // 짝지어 두 축 모두 잘린다). 그래서 위로 뜨는 패널이 띠 경계에서 통째로 잘려 아무것도
  // 안 보였다. 세로 기둥에서는 판 덩어리의 `overflow:hidden` 이 같은 일을 한다.
  // 자르는 조상을 없앨 수는 없다(띠의 좌우 스크롤이 유일한 도달 경로다). 그래서 흐름에서
  // 아예 빼낸다 — Modal 이 간 길과 같다. 대신 위치를 **손잡이를 재서** 정해야 한다.
  const [flyout, setFlyout] = useState<{ key: DrawerKey; rect: DOMRect } | null>(null);
  // ⚠️ 마우스는 **hover 로 이미 연 뒤에 click 이 온다.** click 을 단순 토글로 두면 마우스로
  // 손잡이를 누르는 순간 방금 열린 패널이 도로 닫힌다(2026-08-14 테스트로 재현). 그래서
  // 클릭의 뜻을 포인터 종류로 가른다: **마우스면 언제나 '열기'**(닫기는 벗어나면 저절로),
  // 터치·키보드면 토글(그쪽에는 '벗어남' 이 없으므로 다시 눌러 닫을 길이 있어야 한다).
  const lastPointerType = useRef<string>('');
  const handleRefs = useRef<Partial<Record<DrawerKey, HTMLElement | null>>>({});
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  const closeSoon = useCallback(
    (ms: number) => {
      cancelClose();
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
        setFlyout(null);
      }, ms);
    },
    [cancelClose],
  );
  // 언마운트에 타이머를 남기면 사라진 컴포넌트에 setState 가 간다(useTrayDrag 가 남긴 교훈).
  useEffect(() => cancelClose, [cancelClose]);
  useEffect(() => {
    if (flyout === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setFlyout(null);
    };
    // 창이 바뀌거나 띠를 좌우로 굴리면 잰 좌표가 낡는다 — 따라다니게 하는 대신 닫는다.
    // 떠 있는 동안은 손이 패널 위에 있으므로, 그 사이에 창을 만지는 것은 "그만두겠다" 다.
    const onGone = (): void => setFlyout(null);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onGone);
    window.addEventListener('scroll', onGone, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onGone);
      window.removeEventListener('scroll', onGone, true);
    };
  }, [flyout]);

  /** 손잡이를 재서 연다. rect 는 **열던 순간의 값**이다(위 이펙트가 낡으면 닫는다). */
  const openFlyout = useCallback((key: DrawerKey, el: HTMLElement | null | undefined) => {
    if (!el) return;
    cancelClose();
    setFlyout({ key, rect: el.getBoundingClientRect() });
  }, [cancelClose]);

  const ballRemaining = Math.max(0, ballMax - ballCount);
  const isBallCapped = ballRemaining <= 0;

  /** 끌 수 있는 개체 버튼의 공통 배선. 문턱을 못 넘으면 onTap 이 불린다(=예전 2단계 경로).
   *  style 은 여기서 주지 않는다 — 호출부가 자기 style 과 합쳐야 해서 섞이면 순서 사고가 난다.
   *  대신 `touchAction:'none'` 을 각 버튼 style 에 직접 넣는다(빠지면 태블릿에서 드래그 도중
   *  브라우저가 스크롤·확대로 포인터를 가져가 세션이 끊긴다). */
  const dragProps = (item: TrayDragItem, onTap: () => void) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      if (onItemPointerDown) onItemPointerDown(item, e, onTap);
    },
    // 끌어다 놓기를 못 쓰는 환경(키보드·보조기기 포함)에서도 탭은 되어야 한다.
    // 배선된 경로에서는 마우스 탭을 pointerdown(useTrayDrag 문턱)이 처리하므로, 여기서
    // 조건 없이 onTap 을 부르면 **이중 발화**다. 키보드 활성화(Enter·Space)는 pointerdown
    // 없이 click 만 오고 그때 detail 이 0 이다 — 그 경우만 통과시킨다(§5.6).
    onClick: (e: ReactMouseEvent) => {
      if (!onItemPointerDown || e.detail === 0) onTap();
    },
  });

  const divider = (
    <div
      aria-hidden
      style={{
        flex: 'none',
        alignSelf: 'stretch',
        ...(horiz
          ? // 값은 옛 리터럴 '6px 4px' 와 바이트 동일하다 — 상수로 올린 이유는 띠 줄나눔 모형
            // (trayBandLayoutAt)이 구분선 폭 9(= 1 + 4×2)를 **같은 상수에서** 세게 하기 위해서다.
            {
              width: TRAY_DIVIDER_H,
              margin: `${TRAY_BAND_DIVIDER_MARGIN_Y}px ${TRAY_BAND_DIVIDER_MARGIN_X}px`,
              background: 'var(--border)',
            }
          : { height: TRAY_DIVIDER_H, margin: `${TRAY_DIVIDER_MARGIN_Y}px 12px`, background: 'var(--border)' }),
      }}
    />
  );

  return (
    // data-tray: 코트에서 끌어온 개체를 여기 놓으면 빼낸다(useEditorPointer 가 좌표로 찾는다).
    <nav aria-label="도구" data-tray="" style={horiz ? RAIL_STYLE_H : RAIL_STYLE}>

      {/* ─── 개체(벤치): 판에 올려놓는 말. 끌어다 놓거나, 탭해서 고른 뒤 코트를 찍는다. ───
          **트레이에서 스크롤하는 곳은 여기 하나뿐이다**(설계서 §4.3). 근거 셋:
           ① §3 불변식 1 의 정의상 그렇다 — nav 전체를 스크롤러로 하면 모든 표적 위치가 스크롤
              오프셋의 함수가 된다. 스크롤러에 넣어도 되는 것은 **개수가 내용에 따라 변하는 표적**뿐이다.
           ② 개체 구역만이 그렇다 — chairSlots 는 드릴마다 다르고 코트에 나간 선수는
              `<span aria-hidden>` 이 되어 표적 수가 실제로 변한다. 줌 3·도구 4 는 항상 고정.
           ③ 이미 그 구조였다. 새 기구 없음.

          2026-08-14 P3 — 세로에서 이 구역이 column 에서 **row + wrap** 으로 바뀌었다.
          칩 줄은 width:100% 라 자기 줄을 통째로 쓰고, 공·주황콘·파랑콘 셋은 그 다음 줄에
          **나란히** 선다. 실측(1024×600·hit 44·5열, 판 높이 468 / 고정 182 / 벤치 가용 286):
          세로로 쌓으면 125+6+50+6+50+6+50 = **293 → 7px 넘쳐 스크롤**, 한 줄로 흐르면
          125+6+50 = **181 → 여유 105**. 이 재편이 없으면 "1024×600 에서 스크롤 없이" 가 거짓이다. */}
      <div
        aria-label="개체"
        role="group"
        style={{
          flex: horiz ? 'none' : '0 1 auto',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: horiz ? 'nowrap' : 'wrap',
          alignItems: 'center',
          // 줄이 남는 세로를 나눠 갖지 않게 한다 — stretch 면 상자가 세로로 늘어나 손잡이
          // 크기가 창마다 달라진다(§3 불변식 1 이 막는 것과 같은 종류의 흔들림).
          alignContent: 'flex-start',
          justifyContent: 'flex-start',
          gap: TRAY_GAP,
          minHeight: 0,
          // 선수가 8명 다 미배치면 세로로 길다 — 트레이 안에서만 스크롤한다.
          ...(horiz ? { overflowX: 'auto' as const } : { overflowY: 'auto' as const, width: '100%' }),
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            // ⚠️ **'center' 로 되돌리지 마라 — RAIL_STYLE_H:156-164 의 경고가 wrap 축에서 그대로
            //    재현된다.** 5열에 칩 8개면 1행 5·2행 3 인데, 중앙정렬이면 2행 셋이 1행 아래에
            //    맞춰 서지 않고 가운데로 모인다 = 같은 선수 칩이 열 수에 따라 다른 x 에 선다.
            //    절대 위치로 쌓인 공간 기억이 깨지는 것이 서랍을 고른 유일한 이유다.
            justifyContent: 'flex-start',
            gap: CHIP_ROW_GAP,
            // 2026-08-14 P3: 옛 `width/minWidth: TRAY_ROW_MAX_CSS` 못박음을 **뺐다** — 그것이
            // 2열을 강제하던 장본인이다(트레이가 넓어져도 칩 줄이 93px 에 갇혀 있었다).
            // 이제 부모 폭을 그대로 받아 흐르고, 100% 라 wrap 흐름에서 **자기 줄을 통째로** 쓴다
            // (그래서 공·콘 셋이 다음 줄에 나란히 선다).
            ...(horiz ? {} : { width: '100%' }),
          }}
        >
          {chairSlots.map((c) => {
            const armed = pendingPlayerId === c.id;
            // §3.4 — 이름이 있으면 '2번 김민수', 없으면 예전 그대로 '2번'. 형식은 model/chairLabel
            // 이 쥔다(트레이·시연·계획서가 같은 말로 부르게).
            const who = numberedName(c.number, c.name);
            // 나가 있는 선수는 **빈 자리**로 남긴다. 버튼이 아니라 표식이라 끌 수도, 누를 수도 없다.
            if (c.placed) {
              return (
                <span
                  key={c.id}
                  aria-hidden="true"
                  title={`${who} — 코트에 나가 있습니다. 코트에서 이리로 끌어다 놓으면 돌아옵니다.`}
                  style={{ ...TRAY_CHIP_BOX, opacity: 0.5 }}
                >
                  <TrayChairArt number={c.number} empty />
                </span>
              );
            }
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={armed}
                aria-label={`${who} 선수 배치`}
                title={`${who} — 끌어다 놓거나 탭한 뒤 코트를 누르세요`}
                {...dragProps({ kind: 'player', chairId: c.id }, () => onArmPlayer(c.id))}
                style={{
                  ...TRAY_CHIP_BOX,
                  touchAction: 'none',
                  position: 'relative',
                  borderRadius: 7,
                  border: armed ? '2px solid var(--accent)' : '2px solid transparent',
                  filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.45))',
                }}
              >
                <TrayChairArt color={c.color} ink={c.ink} number={c.number} />
              </button>
            );
          })}
        </div>

        {/* 공 상자 */}
        <button
          type="button"
          title={
            isBallCapped
              ? `${BALL_TOOL.label} — 상자가 비었습니다. 코트의 공을 트레이로 끌어다 놓으면 돌아옵니다.`
              : `${BALL_TOOL.label} (${BALL_TOOL.key}) — ${ballRemaining}개 남음, 끌어다 놓으세요`
          }
          aria-pressed={tool === 'ball'}
          aria-disabled={isBallCapped || undefined}
          aria-describedby={ballHintId}
          {...dragProps({ kind: 'ball' }, () => onSelectTool('ball'))}
          style={{
            ...BOX_STYLE,
            touchAction: 'none',
            color: tool === 'ball' ? 'var(--accent-text)' : 'var(--muted)',
            opacity: isBallCapped ? 0.5 : 1,
          }}
        >
          {tool === 'ball' && <ActiveRing />}
          <span style={{ position: 'relative', display: 'flex' }}>
            <BALL_TOOL.Icon />
          </span>
          <span
            style={{
              position: 'relative',
              fontSize: '0.6875rem',
              fontWeight: 600,
            }}
          >
            {BALL_TOOL.label}
          </span>
          <RemainingBadge n={ballRemaining} />
        </button>
        {/* 남은 개수는 이름이 아니라 **설명**이다. 이름에 넣으면 개수가 바뀔 때마다
            같은 버튼이 다른 것으로 들리고, 이름으로 찾는 코드도 전부 깨진다. */}
        <span id={ballHintId} className="sr-only">
          {isBallCapped ? `상자가 비었습니다 — 최대 ${ballMax}개` : `${ballRemaining}개 남음`}
        </span>

        {/* 콘 상자 — 색마다 따로 둔다(기현 지시 2026-08-11). 예전에는 한 버튼을 다시 눌러
            색을 바꾸는 팝오버였는데, 색마다 남은 개수가 따로 있으면 배지 하나로 둘을
            나타낼 수 없다. 상자를 나누면 어느 색이 몇 개 남았는지가 누르기 전에 보인다. */}
        {CONE_COLORS.map((color, i) => {
          const idx = i as 0 | 1;
          const name = CONE_SLOT_NAMES[idx];
          const remaining = Math.max(0, coneMax - coneCounts[idx]);
          const empty = remaining <= 0;
          const active = tool === 'cone' && coneSlot === idx;
          return (
            <Fragment key={color}>
              <button
                type="button"
                aria-label={`${name} 콘`}
                aria-pressed={active}
                aria-disabled={empty || undefined}
                aria-describedby={`${coneHintId}-${idx}`}
                title={
                  empty
                    ? `${name} 콘 — 상자가 비었습니다. 코트의 콘을 트레이로 끌어다 놓으면 돌아옵니다.`
                    : `${name} 콘 — ${remaining}개 남음, 끌어다 놓으세요`
                }
                {...dragProps({ kind: 'cone', coneSlot: idx }, () => {
                  onConeSlotChange(idx);
                  onSelectTool('cone');
                })}
                style={{
                  ...BOX_STYLE,
                  touchAction: 'none',
                  color: active ? 'var(--accent-text)' : 'var(--muted)',
                  opacity: empty ? 0.5 : 1,
                }}
              >
                {active && <ActiveRing />}
                <span style={{ position: 'relative', display: 'flex', color }}>
                  <CONE_TOOL.Icon />
                </span>
                <span
                  style={{
                    position: 'relative',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                  }}
                >
                  {name}
                </span>
                <RemainingBadge n={remaining} />
              </button>
              {/* 공 상자와 같은 이유로 설명이다. 게다가 aria-label 이 붙은 버튼은
                안쪽 텍스트가 아예 낭독되지 않아, 넣어 봐야 들리지 않는다. */}
              <span id={`${coneHintId}-${idx}`} className="sr-only">
                {empty ? `상자가 비었습니다 — 최대 ${coneMax}개` : `${remaining}개 남음`}
              </span>
            </Fragment>
          );
        })}
      </div>

      {divider}

      {/* ─── 기능: 모드. 끌 것이 없다. ───
          2026-08-14 P3 — 세로에서도 **row + wrap** 이다. 폭이 넓어진 기둥에서 손잡이 4개가
          한 줄로 흐르면 고정 구역이 215 → 50 으로 떨어진다(설계서 §4.3 검산표). 그 165px 이
          그대로 벤치로 간다 — 열 수가 2 → 5 로 늘어도 세로가 모자라면 아무 소용이 없다.
          이름은 '기능' 그대로다: nav 자신이 aria-label="도구" 라, 구역까지 '도구' 로 부르면
          스크린리더가 "도구 탐색, 도구 그룹" 을 읽는다(설계서 §4.3 의 이름은 참고로만 따른다). */}
      <div
        aria-label="기능"
        role="group"
        style={{
          flex: 'none',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: horiz ? 'nowrap' : 'wrap',
          alignItems: 'center',
          alignContent: 'flex-start',
          // 서랍이 열려 뒤에 폭이 붙어도 앞 손잡이가 안 밀리는 조건(§3 불변식 1).
          justifyContent: 'flex-start',
          gap: TRAY_ITEM_GAP,
          ...(horiz ? {} : { width: '100%' }),
        }}
      >
        {ALWAYS_TOOLS.map((t) => (
          <ToolButton key={t.id} def={t} active={t.id === tool} onSelect={() => onSelectTool(t.id)} />
        ))}

        {/* 서랍 손잡이 2개 — **처음부터 보인다. 닫혀 있을 뿐이다**(§3). 손잡이도 내용물도
            기능 구역의 **맨 끝**이라, 서랍이 열려도 위쪽(선수 칩·상자·선택) 좌표가 한 픽셀도
            안 움직인다(§3 불변식 1 — 조준 대상이 사용 중에 이동하지 않는다). 손잡이를 끝에
            두는 이 규칙이 옛날 지우개 버튼을 손잡이 **앞**으로 올린 이유였고, 지우개가 사라진
            지금도 규칙은 그대로다 — 새 버튼이 생기면 역시 손잡이 앞에 선다.

            서랍 **사이**의 대가 하나는 감수한다 — 첫 서랍(작도)을 열면 둘째 손잡이(설명)가
            그 내용물만큼 아래로 밀린다. 대안은 손잡이 둘을 붙여 놓고 내용물을 그 아래로 모으는
            것인데, 그러면 열린 서랍이 둘일 때 [선][원][삼각][사각][메모]가 한 줄로 이어져 **어느 것이
            어느 서랍에서 나왔는지가 사라진다** — 손잡이 옆에 붙어 있지 않은 것은 서랍이 아니다.
            밀림이 한 번뿐이라는 점이 이 선택의 근거다: 서랍은 열면 그대로 남고(prefs.tray),
            그 뒤로는 두 손잡이 모두 영구히 같은 자리다. */}
        {DRAWERS.map((d) => {
          const isOpen = flyout?.key === d.key;
          const active = d.tools.some((t) => t.id === tool);
          const panelId = `${drawerId}-${d.key}`;
          return (
            // 손잡이와 패널이 DOM 상 떨어져 있으므로(패널은 포털) 마우스가 둘 사이를 오갈 때
            // `pointerleave` 가 한 번 난다 — 그것을 `FLYOUT_LEAVE_CLOSE_MS` 의 유예가 받는다.
            <div key={d.key} style={{ flex: 'none', display: 'flex' }}>
              <button
                type="button"
                ref={(el) => {
                  handleRefs.current[d.key] = el;
                }}
                aria-expanded={isOpen}
                aria-controls={isOpen ? panelId : undefined}
                // 도형 3종은 숫자 키가 없다(§7.5f 의 1–8 을 안 늘렸다) — 그때는 문자 키를 보인다.
                // 빈 괄호 `원()` 이 그대로 나가던 자리다(2026-08-14 DOM 대조로 발견).
                title={`${d.label} — ${d.tools.map((t) => `${t.label}(${t.key})`).join(' · ')}`}
                onPointerEnter={(e) => {
                  // 마우스만 hover 로 연다. 터치는 pointerenter 도 함께 쏘는데, 그것까지 받으면
                  // 손가락이 닿는 순간 열리고 곧이어 click 이 토글해 **바로 닫힌다.**
                  if (e.pointerType !== 'mouse') return;
                  openFlyout(d.key, handleRefs.current[d.key]);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType !== 'mouse') return;
                  closeSoon(FLYOUT_LEAVE_CLOSE_MS);
                }}
                onPointerDown={(e) => {
                  lastPointerType.current = e.pointerType;
                }}
                onClick={(e) => {
                  cancelClose();
                  // 마우스는 hover 로 이미 열린 뒤 click 이 온다 — 토글로 두면 누르는 순간
                  // 도로 닫힌다. 마우스는 언제나 '열기', 터치·키보드만 토글이다.
                  const byMouse = e.detail > 0 && lastPointerType.current === 'mouse';
                  if (!byMouse && isOpen) setFlyout(null);
                  else openFlyout(d.key, handleRefs.current[d.key]);
                }}
                style={{ ...BTN_STYLE, color: active ? 'var(--accent-text)' : 'var(--muted)' }}
              >
                {active && <ActiveRing />}
                <span style={{ position: 'relative', display: 'flex' }}>
                  <d.Icon />
                </span>
                <span
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                  }}
                >
                  {d.label}
                  {/* 여는 방향 표식. 이름에는 안 들어간다 — 상태는 aria-expanded 가 말한다.
                      가로 띠는 위로(▴), 세로 기둥은 왼쪽으로(◂) 편다. */}
                  <span aria-hidden style={{ fontSize: '0.5625rem', lineHeight: 1 }}>
                    {horiz ? '▴' : '◂'}
                  </span>
                </span>
              </button>

              {/* 닫힌 서랍은 **DOM 에 없다** — 첫 화면 표적 예산의 대상은 '보이는 표적'이고,
                  숨긴 채 두면 키보드 순회에는 남아 예산만 못 줄이고 조준만 어려워진다.
                  포털인 이유와 좌표를 재는 이유는 위 flyout state 주석에 있다. */}
              {isOpen && flyout
                ? createPortal(
                    <div
                      id={panelId}
                      role="group"
                      aria-label={`${d.label} 도구`}
                      onPointerEnter={cancelClose}
                      onPointerLeave={(e) => {
                        if (e.pointerType !== 'mouse') return;
                        closeSoon(FLYOUT_LEAVE_CLOSE_MS);
                      }}
                      style={{
                        position: 'fixed',
                        zIndex: 40,
                        display: 'flex',
                        flexDirection: 'row',
                        flexWrap: 'nowrap',
                        alignItems: 'center',
                        gap: TRAY_ITEM_GAP,
                        padding: 5,
                        borderRadius: 10,
                        border: '1px solid var(--border-strong)',
                        background: 'var(--panel)',
                        boxShadow: '0 8px 20px rgba(0,0,0,.45)',
                        // 가로 띠는 손잡이 **위**로, 세로 기둥은 **왼쪽**으로 편다(기현 지시).
                        // 둘 다 판 안쪽 방향이라 코트를 가리되 화면 밖으로는 안 나간다.
                        ...(horiz
                          ? { left: flyout.rect.left, bottom: window.innerHeight - flyout.rect.top + 6 }
                          : { right: window.innerWidth - flyout.rect.left + 6, top: flyout.rect.top }),
                      }}
                    >
                      {d.tools.map((t) => (
                        <ToolButton
                          key={t.id}
                          def={t}
                          active={t.id === tool}
                          onSelect={() => {
                            onSelectTool(t.id);
                            closeSoon(FLYOUT_PICK_CLOSE_MS);
                          }}
                        />
                      ))}
                    </div>,
                    document.body,
                  )
                : null}
            </div>
          );
        })}
      </div>

      {!horiz && (
        <div
          style={{
            marginTop: 'auto',
            fontSize: '0.5625rem',
            color: 'var(--faint-text)',
            textAlign: 'center',
            lineHeight: 1.5,
            padding: '0 4px',
          }}
        >
          {courtLabel}
        </div>
      )}
    </nav>
  );
}
