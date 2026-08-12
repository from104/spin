// §5.2 / 결정 ③(A) 인스펙터의 **자리** 계약 — "이 패널이 판을 밀어내는가" 를 값 하나로 답한다.
//
// 2026-08-12 확정: PC 도 **오버레이 기본** + [고정] 핀. 근거는 1280×800 실측에서
// pxPerUnit 0.9176 → 1.1505 (+25.4%) — 판이 커지는 것은 PC 에서도 이득이고, 핀은 한 클릭이며
// 그 상태가 prefs 에 남는다(계획서 §9-③).
//
// 이 모듈이 컴포넌트에서 분리된 순수 함수인 이유: 완료 판정 (a) *"오버레이 상태에서 코트 상자
// 폭이 인스펙터 유무와 무관"* 은 jsdom 이 레이아웃을 계산하지 않아 DOM 만으로는 끝까지 확인할
// 수 없다. 폭을 먹는 유일한 자리를 함수 하나로 좁혀 두면 그 계약을 **값으로** 단언할 수 있고,
// 2.3 의 크롬 예산(폭 합계 117)도 같은 값을 읽어 두 곳이 갈라지지 않는다.

/** 붙박이(핀) 상태의 패널 폭. 프로토타입 359–398행에서 그대로 온 값이다. */
export const INSPECTOR_WIDTH_PX = 312;
/** 붙박이일 때만 생기는 좌측 경계선 1px. 크롬 예산 표의 "312+1" 이 이것이다. */
export const INSPECTOR_BORDER_PX = 1;
/** [고정] 핀이 **나타나는** 컨테이너 폭 하한. 창이 아니라 편집기 컨테이너 기준이다 —
 *  같은 1100 이라도 판정 대상이 다르다(§5.1 의 useIsNarrow 는 창 기준이고 2.3 소관). */
export const INSPECTOR_PIN_MIN_PX = 1100;

export type InspectorMode = 'hidden' | 'overlay' | 'pinned';

export interface InspectorLayoutInput {
  /** 사용자가 패널을 열어 두었는가. 닫혀 있으면 두 모드 모두 DOM 에서 빠진다(§7.5 탭 순서). */
  open: boolean;
  /** prefs.inspectorPinned — 기기를 옮겨도 따라오는 취향. */
  pinned: boolean;
  /** 편집기 컨테이너의 실측 폭(px). 측정 전(0)이면 좁은 것으로 본다. */
  containerWidthPx: number;
}

/** 핀 버튼을 낼지. 좁은 컨테이너에서 313px 을 떼어 주면 코트가 남는 게 없다(§5.2). */
export function canPinInspector(containerWidthPx: number): boolean {
  return containerWidthPx >= INSPECTOR_PIN_MIN_PX;
}

/** prefs 는 기기를 따라 옮겨 다닌다 — 27인치에서 핀을 켠 사람이 태블릿에서 같은 prefs 로 열면
 *  `pinned === true` 인 채로 좁은 화면에 들어온다. 그때 붙박이로 서면 1024 중 313 을 떼어
 *  판이 남지 않으므로 **오버레이로 물러난다.** 핀 자체를 끄지는 않는다(PC 로 돌아가면 되살아난다). */
export function inspectorMode({ open, pinned, containerWidthPx }: InspectorLayoutInput): InspectorMode {
  if (!open) return 'hidden';
  return pinned && canPinInspector(containerWidthPx) ? 'pinned' : 'overlay';
}

/** 이 패널이 **가로 흐름에서 실제로 먹는** 폭. 완료 판정 (a) 의 본체다 —
 *  오버레이는 out-of-flow 라 0 이고, 그래서 코트 상자가 인스펙터 유무와 무관해진다. */
export function inspectorChromeWidthPx(mode: InspectorMode): number {
  return mode === 'pinned' ? INSPECTOR_WIDTH_PX + INSPECTOR_BORDER_PX : 0;
}
