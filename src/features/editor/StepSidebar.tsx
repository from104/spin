// §PLAN-STEP-EDITING.md 화면 배치 · 스텝 카드 — 왼쪽 세로 스텝 바(기현님 확정 2026-08-17).
//
// ── 왜 사이드바인가 (계획서 §화면 배치) ─────────────────────────────────────────────────
// 드릴 편집의 "스텝을 고르고 복제·이동한다"는 하단 TransportBar 의 가로 칩 줄(2026-08-12
// 재편)에 살고 있었다. 조사(RESEARCH-DRILL-EDITORS.md)가 가져온 것은 PPT/FastDraw 류의
// **왼쪽 세로 슬라이드 바** 문법이다 — 목록·선택·복제·이동·사슬·삭제를 한 자리에 모으고,
// TransportBar 는 재생 컨트롤만 남긴다(TransportBar.tsx 머리말). ②(목록·현재 스텝 강조·
// 탭 이동·단일 카드 드래그 재정렬)·③(카드 복제 버튼 + 틈의 + 버튼)에 이어 이 파일은 이제
// **④ 사슬 토글**(내부 틈에만, GapSlot 의 chain)까지 담고, 이제 **⑤ 다중 선택**(선택 모드
// 토글·체크박스·일괄 이동/복제/삭제)까지 마저 얹는다.
//
// ── 선택은 명시적 모드다, 그리고 화면 상태다 (§다중 선택, 기현님 확정 2026-08-17) ──────────
// 오조작 없는 명시적 모드 진입이라는 것이 핵심이다 — 상시 체크박스가 아니라 [선택 모드] 를
// 눌러야 카드에 체크박스가 나타나고 카드 탭의 뜻이 (STEP_SELECT → 체크 토글로) 바뀐다. 모드를
// 끄면 체크가 전부 풀린다. `selectMode`·`checkedIds` 는 **컴포넌트 로컬(useState)** 이고
// 리듀서·undo 에 없다 — "이 카드에 체크가 됐나" 는 문서의 내용이 아니라 지금 화면을 보는
// 사람의 작업 맥락이라, 새로고침하거나 다른 기기에서 열면 사라지는 게 맞다(사슬·복제처럼
// 드릴에 저장되는 값과는 급이 다르다).
//
// ── 일괄 이동은 별도 훅이다, 단일 드래그를 안 건드린다 ────────────────────────────────────
// `useStepGroupReorderDrag`(병행 훅)가 있다. `useStepReorderDrag`(단일 카드) 를 확장하지 않고
// 나란히 둔 이유: 단일 드래그의 좌표계("자기 자신을 뺀 전체 카드 중심")와 묶음 드래그의
// 좌표계("그룹 전체를 뺀 나머지 카드 중심")가 다르고, 하나의 훅에 두 좌표계를 욱여넣으면
// 옛 계약(예: `onCommit(id, toIndex)`의 단일 id 시그니처)이 깨진다. 카드의 `onPointerDown` 에서
// **어느 훅을 부를지만 갈라 낸다** — 체크된 카드를 끌면 그룹 훅, 아니면(선택 모드 밖이거나
// 체크 안 된 카드) 단일 훅. 두 훅의 미리보기(`state`)는 같은 렌더 루프 안에서 함께 `order` 를
// 만든다(아래 렌더 코드 참고) — 동시에 열릴 일이 없으므로(포인터 세션이 하나뿐) 겹칠 걱정은 없다.
//
// ── 사슬은 내부 틈에만 있다 (§사슬, 기현님 확정 2026-08-17) ────────────────────────────
// 맨 앞·맨 뒤 틈은 "경계" 가 아니다 — 그 바깥에는 이을 스텝이 없다. 그래서 루프 안에서
// i(=gap index) ≥ 1 인 틈만 `chain` 을 채워 GapSlot 에 넘긴다(i=0 은 undefined, 루프 밖의
// 마지막 GapSlot 은 애초에 chain 인자를 안 넘긴다). 틈 i(1 ≤ i ≤ N-1)가 지고 있는 스텝은
// **교리대로 "다음 스텝"**(model/drill.ts DrillStep.cut 주석) — order[i], 곧 그 반복의 `s`
// 그 자체다(같은 값을 gapDuplicateSpec 이 "위 스텝"을 가리키는 것과 방향이 반대이니 헷갈리지
// 말 것: 복제는 "무엇을 복제해 여기 넣나" 이고 사슬은 "이 경계가 누구 소관이나" 라 기준이 다르다).
//
// ── 연결 방식은 셋이고, 해제는 키 삭제다 (2026-09-08, docs/PLAN-STEP-LINK.md) ─────────────
// 틈 버튼은 이제 **3상태 순환**이다: 딜레이 연결(키 없음) → 딜레이 없는 연결(`seamless`) →
// 끊김(`cut`) → …. 이 컴포넌트는 `onSetLink(id, link)` 로 셋 중 하나라는 뜻만 위로 보내고,
// 저장형(예외 키 두 개)으로 옮기는 것은 `model/stepLink.ts` 의 `stepLinkPatch` 다.
// `false` 로 실린 키는 `STEP_META` 리듀서가 "그 필드를 지워라" 로 해석한다 — `cut: false` 를
// 그대로 저장하면 validate.ts 정화기가 다음 로드 때 버리므로(교리: true 만 정의역) 애초에
// 메모리에도 안 남기는 편이 맞다.
//
// ── 복제는 후방이 기본, 예외는 맨 앞 틈 하나뿐 (§복제, 기현님 확정 2026-08-17) ──────────────
// 카드의 복제 버튼과 틈 g(1 ≤ g ≤ steps.length)의 + 버튼은 **같은 결과**를 낸다: "위 스텝의
// 복제를 바로 뒤에" — `duplicateStep` 의 기본 삽입 자리(`i+1`)가 이미 그 자리이므로
// `onDuplicateStep(id)` 를 `toIndex` 없이 부르면 끝난다(전방 복제는 이걸로 해결된다 — 카드
// k 의 "복제해서 위에 넣고 싶다" 는 카드 k-1 의 [아래로 복제] 와 같은 결과다). 맨 앞 틈(g=0)
// 만 다르다: 복제 대상은 있어도(첫 스텝) "위 스텝" 이 없어서 기본 자리(1)가 아니라 0 을
// 명시해야 한다 — 그래서 `onDuplicateStep(steps[0].id, 0)` 한 곳만 `toIndex` 를 싣는다.
//
// ── 스텝 카드 = 번호 + 썸네일만 ──────────────────────────────────────────────────────────
// "스텝 정보 최소화"(기현님 확정) — 이름은 카드에서 안 보인다. `DrillStep.name` 필드 자체는
// 당분간 모델에 남고(구현 순서 ⑦이 note 로 병합해 정리한다), 이 화면은 그 필드를 그냥 안 읽는다.
//
// ── 썸네일 계산은 TransportBar 의 칩 시절 것을 그대로 물려받는다 ────────────────────────
// `thumbs`/`teamColors` 메모, `CourtThumbnail glyphScale` 배선은 옛 TransportBar 의 사진 뭉치
// 로직 그대로다(2026-08-12 감사 evidence: 드릴이 안 바뀌면 다시 안 그린다). 배수 상수만
// `SIDEBAR_GLYPH_SCALE`(CourtThumbnail.tsx)로 바뀌었다 — 카드가 칩보다 훨씬 커서 목록 카드에
// 가까운 배수로 완전 보정할 수 있다(그 상수의 계산 주석 참고).
//
// ── 순서 바꾸기: 끌기 + 키보드 ───────────────────────────────────────────────────────────
// 끌기는 HTML5 DnD 가 아니라 포인터 이벤트다(태블릿에서 HTML5 DnD 는 사실상 죽어 있다 —
// useStepReorderDrag.ts 머리말). 세로 목록이라 축만 'y' 로 바뀌었을 뿐 문턱·미리보기·커밋
// 시점 규칙은 옛 가로 칩과 같다. 포인터 조작이 실패하기 쉬운 상황(끌기 정밀도가 필요한 조작을
// 마우스·터치가 아닌 다른 경로로 하는 경우 전반)을 위해 키보드 경로도 장식이 아니라 동등한
// 주 경로다: Space 로 집고 ↑/↓ 로 옮기고 Space/Enter 로 놓고 Esc 로 되돌린다. 세로 목록이라
// 좌우(←/→)가 아니라 상하(↑/↓) 를 쓴다 — 그 두 키는 전역에서 아무 것도 안 먹고 있다
// (core/keymap.ts: 스텝 이동은 PageUp/PageDown, 개체 이동은 포커스가 개체에 있을 때만).
//
// ── 접힘/고정은 같은 컴포넌트의 표시 모드다 ──────────────────────────────────────────────
// 좁은 창·세로 화면(collapsed)이면 고정 자리 대신 **여는 버튼**만 남고, 열면 판 위 **오버레이**
// 로 뜬다(닫기 = 바깥 탭 또는 같은 버튼 재클릭). 목록·재정렬 로직(`body`)은 두 모드가 완전히
// 같은 JSX 를 공유한다 — 감싸는 뼈대(고정 <nav> ↔ 오버레이 <nav> + 배경)만 갈린다.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Drill } from '../../model/drill.ts';
import type { StepId } from '../../core/ids.ts';
import { nextStepLink, stepLink } from '../../model/stepLink.ts';
import type { StepLink } from '../../model/stepLink.ts';
import { courtDefFor } from '../../model/court.ts';
import {
  IconListSteps,
  IconPlus,
  IconCopy,
  IconChainLinked,
  IconChainSeamless,
  IconChainCut,
  IconCheck,
  IconClose,
  IconDelete,
} from '../../ui/icons.tsx';
import { CourtThumbnail, SIDEBAR_GLYPH_SCALE } from '../../render/CourtThumbnail.tsx';
import { buildStepThumb } from '../../model/thumb.ts';
import { LIMITS } from '../../model/validate.ts';
import { liveRegion } from '../../ui/LiveRegion.tsx';
import { movedOrder, movedOrderGroup } from './bottomBarMetrics.ts';
import { useStepReorderDrag } from './useStepReorderDrag.ts';
import { useStepGroupReorderDrag } from './useStepGroupReorderDrag.ts';
import { StepCardMenu } from './StepCardMenu.tsx';
import type { StepCardMenuTarget } from './StepCardMenu.tsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx';
import { useLongPressMenu } from './useLongPressMenu.ts';
import { useT } from '../../i18n/useT.ts';

export interface StepSidebarProps {
  /** 카드마다 판을 그리므로 steps 만으로는 부족하다 — cast·팀 색·코트가 함께 필요하다. */
  drill: Drill;
  /** 체크한 스텝이 바뀔 때마다 알린다(2026-08-27). **상태는 여전히 여기 로컬이다** — 위로
   *  보내는 것은 사본뿐이고, 리듀서·undo 에는 들어가지 않는다(이 파일 머리말의 결정 그대로).
   *
   *  쓰는 곳은 내보내기 시트다: *"선택한 것만, 또는 전체를 고르게 해야 한다"*(기현 지시).
   *  시트가 사이드바의 체크를 **기본값**으로 집어야 하는데, 그러려면 값이 위로 한 번은
   *  올라와야 한다. 끌어올리지 않고 알리기만 하는 이유는 그것으로 충분하기 때문이다. */
  onCheckedStepsChange?(ids: ReadonlySet<StepId>): void;
  stepId: StepId;
  onSelectStep(id: StepId): void;
  /** 순서 변경. `toIndex` 는 옮긴 **뒤**의 자리(edits.ts moveStep 과 같은 규칙). */
  onReorderStep(id: StepId, toIndex: number): void;
  /** 복제(§복제, 기현님 확정 2026-08-17). `toIndex` 를 안 주면 `STEP_DUPLICATE`/
   *  `duplicateStep` 의 기본값(바로 뒤)이 그대로 적용된다 — 카드 자체의 복제 버튼과 틈
   *  g>0 의 + 버튼이 이 경로다. **맨 앞 틈(g=0)** 만 `toIndex: 0` 을 실어 보내
   *  "첫 스텝의 복제를 맨 앞에" 규칙을 만든다(actions.ts STEP_DUPLICATE 주석 참고). */
  onDuplicateStep(id: StepId, toIndex?: number): void;
  /** 연결 방식 설정(④ 사슬 토글, 기현님 확정 2026-08-17 → 2026-09-08 3상태). **내부 틈에만**
   *  존재한다 — 카드 i-1 과 i 사이 경계는 "다음 스텝"(교리대로 카드 i, 곧 `id`) 이 진다.
   *  저장형(두 개의 예외 키)으로 옮기는 것은 호출자가 아니라 `model/stepLink.ts` 의
   *  `stepLinkPatch` 다 — 이 컴포넌트는 셋 중 하나라는 뜻만 위로 보낸다.
   *  맨 앞·맨 뒤 틈은 경계가 없어 이 콜백 자체가 안 불린다(GapSlot 에 버튼이 없다). */
  onSetLink(id: StepId, link: StepLink): void;
  /** 좁은 창·세로 화면이면 true(EditorWorkspace 의 `narrow || portrait`). */
  collapsed: boolean;
  /** ⑤ 다중 선택 — 일괄 이동(기현님 확정 2026-08-17). `ids` 는 순서가 뜻이 없다(체크한 순서가
   *  아니라 `d.steps` 원본 순서로 다시 정렬된다, edits.ts moveSteps 참고). `toIndex` 는
   *  **선택되지 않은 나머지 스텝들의 순서 안에서의 삽입 자리** — 이 컴포넌트의 그룹 드래그
   *  (`useStepGroupReorderDrag`)가 재는 좌표계와 같다. */
  onMoveSteps(ids: StepId[], toIndex: number): void;
  /** ⑤ 일괄 복제. 선택 묶음의 사본을 마지막 선택 카드 뒤에 상대 순서대로 삽입한다
   *  (edits.ts duplicateSteps). 정원 가드는 이 컴포넌트가 버튼을 잠그는 것으로 미리 막는다. */
  onDuplicateSteps(ids: StepId[]): void;
  /** ⑤ 일괄 삭제. 드릴에는 스텝이 최소 1장은 남아야 한다(edits.ts deleteSteps) — 전량 선택이면
   *  이 컴포넌트가 버튼을 미리 잠근다. 현재 스텝이 삭제 묶음에 있으면 리듀서(uiReducer)가
   *  남는 스텝으로 stepId 를 옮긴다. */
  onDeleteSteps(ids: StepId[]): void;
  /** 단일 삭제(2026-08-18 우클릭 메뉴의 [삭제]) — STEP_DELETE 그대로. 마지막 1장 가드는
   *  메뉴가 항목을 잠그는 것으로 미리 막고, 리듀서 쪽 deleteStep 가드가 마지막 문이다.
   *  현재 스텝을 지우면 uiReducer 가 이웃으로 stepId 를 옮긴다(기존 STEP_DELETE 규칙). */
  onDeleteStep(id: StepId): void;
}

/** 사이드바 고정/오버레이 폭. 좌우 패딩(`SIDEBAR_PAD_PX` 10×2)을 빼면 카드가 실제로 채우는
 *  폭이 134px 다 — `CourtThumbnail` 의 `SIDEBAR_GLYPH_SCALE` 계산 주석이 이 숫자에서 나온다.
 *  두 상수가 갈리면 그 주석이 거짓말을 하므로 폭을 바꿀 때는 함께 고친다.
 *  ⚠️ 크롬 예산표(chromeBudget.ts 'stepSidebar' 행)의 wide 도 이 값의 사본이다 — 함께 고친다.
 *
 *  220 → **154** (2026-08-18 기현님: *"왼쪽 바 썸네일이 2/3크기여야함"*) — 카드 200 → 134
 *  (× 2/3), 패딩은 그대로. 줄어든 66px 는 코트가 돌려받는다. */
export const SIDEBAR_WIDTH_PX = 154;
export const SIDEBAR_PAD_PX = 10;

const cardNumberBadge = (selected: boolean) =>
  ({
    position: 'absolute',
    left: 6,
    top: 6,
    minWidth: 18,
    height: 18,
    padding: '0 4px',
    borderRadius: 5,
    background: selected ? 'var(--accent)' : 'color-mix(in srgb, var(--panel) 82%, transparent)',
    color: selected ? 'var(--accent-ink-strong)' : 'var(--muted)',
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '0.75rem',
    fontWeight: 700,
    lineHeight: '18px',
    textAlign: 'center',
  }) as const;

/** 카드 사이·양 끝의 틈. 드래그 중 놓을 자리를 보여주는 얇은 표시(`active`)와,
 *  그 자리에 복제를 꽂아 넣는 [+] 버튼을 함께 담는다(PLAN-STEP-EDITING.md 구현 순서 ③).
 *  사슬 토글(④)이 이후 같은 자리에 마저 얹힌다. `data-gap-index` 는 "이 틈이 몇 번째인가"
 *  를 재정렬 계산·테스트가 찾는 자리다.
 *
 *  [+] 는 **상시 노출**을 골랐다(계획서 "호버/포커스 시 노출 또는 상시" 중 후자) — 이 사이드
 *  바는 인라인 스타일뿐 CSS 클래스 문법이 없어(파일 전체 참고) 호버 전용 노출을 하려면
 *  마우스 진입/이탈마다 상태를 들고 있어야 하는데, 그 상태가 틈마다 하나씩 늘어나는 비용이
 *  터치·키보드에서는 애초에 의미도 없다(호버가 없다). 항상 보이는 작은 버튼 하나가 더 싸고
 *  더 접근성 있다. */
/** 내부 틈에만 실리는 연결 방식 순환 버튼(④ → 2026-09-08 3상태). `link` 는 이 틈 바로 다음
 *  카드의 연결 방식이다(교리대로 "다음 스텝"이 경계를 진다 — model/stepLink.ts). */
interface GapChain {
  link: StepLink;
  onCycle: () => void;
}

/** 세 상태의 아이콘·색·이름표. **색은 보조 신호일 뿐** 모양이 먼저 갈린다(강제색 모드에서
 *  색이 전부 날아가도 고리가 붙었는지·화살이 있는지·벌어졌는지로 읽힌다).
 *  `#ff6b6b` 는 ObjectMenu.tsx 의 삭제 항목과 같은 경고색 — 이 파일에 danger 토큰이 없어
 *  기존 관행을 그대로 물려받는다(옛 사슬 버튼 주석). */
const LINK_UI = {
  delay: { key: 'editor.stepSidebar.gap.link.delay', Icon: IconChainLinked, color: 'var(--muted)', border: 'var(--border-strong)' },
  seamless: {
    key: 'editor.stepSidebar.gap.link.seamless',
    Icon: IconChainSeamless,
    color: 'var(--accent-text)',
    border: 'var(--accent-text)',
  },
  cut: { key: 'editor.stepSidebar.gap.link.cut', Icon: IconChainCut, color: '#ff6b6b', border: '#ff6b6b' },
} as const;

function GapSlot({
  index,
  active,
  disabled,
  label,
  onDuplicate,
  chain,
  tut,
}: {
  index: number;
  active: boolean;
  disabled: boolean;
  label: string;
  onDuplicate: () => void;
  /** undefined = 맨 앞·맨 뒤 틈(경계 없음) — 사슬 버튼 자체를 안 그린다. */
  chain?: GapChain;
  /** 튜토리얼 앵커(`data-tut`). **맨 뒤 틈에만** 준다(2026-08-30) — [한 장 더 찍기] 버튼이
   *  없어지며 그 앵커가 갈 곳이 필요했고, 스텝을 늘리는 길이 이제 이 [+] 뿐이다. */
  tut?: string;
}) {
  const t = useT();
  return (
    <div
      data-gap-index={index}
      data-tut={tut}
      style={{
        position: 'relative',
        flex: 'none',
        // 16 → 36 (2026-08-18 기현님: "스텝 사이 버튼 2배로 커져야 터치 조작 대응") —
        // 버튼이 32px 가 되면서 틈도 그것을 담을 만큼 자랐다. 카드가 2/3 로 줄어든 만큼
        // 세로 리듬 총합은 오히려 짧아진다.
        height: 36,
        margin: '1px 0',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          height: active ? 10 : 4,
          borderRadius: 3,
          background: active ? 'var(--accent)' : 'transparent',
          transition: 'height 120ms ease, background 120ms ease',
        }}
      />
      {/* [+]와 사슬 토글을 한 가로줄로 묶는다 — 둘 다 이 틈의 상시 노출 버튼이라 같은 이유로
          같은 자리(항상 보임)를 쓴다(옛 GapSlot 머리말 참고). */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <button
          type="button"
          aria-label={label}
          title={disabled ? t('editor.stepSidebar.maxStepsNotice', { max: LIMITS.maxSteps }) : label}
          disabled={disabled}
          onClick={onDuplicate}
          style={{
            // 16 → 32 (2배, 터치 대응 — 위 틈 높이와 같은 지시). --hit(44)에는 못 미치지만
            // 틈은 카드 사이 보조 표적이라 카드 리듬을 다 먹을 수는 없다 — 2배가 절충이다.
            width: 32,
            height: 32,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            border: '1px solid var(--border-strong)',
            background: 'var(--panel)',
            color: 'var(--muted)',
            opacity: disabled ? 0.4 : 1,
          }}
        >
          <IconPlus size={16} />
        </button>
        {chain &&
          (() => {
            // 3상태 **순환** 버튼이다(PLAN-STEP-LINK 결정 6): 클릭 하나로 딜레이 연결 → 딜레이
            // 없는 연결 → 끊김 → … 을 돈다. 하위메뉴를 열지 않는 이유는 셋뿐이라 메뉴가 과하고,
            // 정밀 조작이 어려운 입력(터치·보조기기)에서 "버튼 하나를 여러 번" 이 가장 싸기
            // 때문이다.
            //
            // ⚠️ `aria-pressed` 를 **안 쓴다** — 셋 중 하나는 눌림/안 눌림의 이진이 아니라서,
            // 붙이면 보조기술이 "delay 는 안 눌림, cut 은 눌림" 이라는 없는 뜻을 읽어 준다.
            // 대신 이름표가 현재와 **다음** 상태를 함께 말한다(누르면 무엇이 되는지가 순환
            // 버튼에서는 이름의 일부다).
            const cur = LINK_UI[chain.link];
            const nxt = LINK_UI[nextStepLink(chain.link)];
            // 반복되는 컨트롤이라 이름에 **어느 경계인지**(스텝 a·b)가 있어야 보조기술 목록에서 갈린다
            // (2026-09-08 검수 — 검수 전에는 셋이 다 같은 이름이었다).
            const label = t('editor.stepSidebar.gap.link.aria', { a: index, b: index + 1, current: t(cur.key), next: t(nxt.key) });
            return (
              <button
                type="button"
                aria-label={label}
                title={label}
                onClick={chain.onCycle}
                style={{
                  width: 32,
                  height: 32,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  border: `1px solid ${cur.border}`,
                  background: 'var(--panel)',
                  color: cur.color,
                }}
              >
                <cur.Icon size={20} />
              </button>
            );
          })()}
      </div>
    </div>
  );
}

/** 틈 g 의 [+] 가 "무엇을 복제해 어디 꽂는지" 는 g 하나로 정해진다(파일 머리말 §복제 참고).
 *  g=0(맨 앞) 만 예외고, g ≥ 1 은 전부 "바로 위 스텝(g-1)을 그 자리(g)에" 로 같은 규칙이다
 *  — 그 경우 `duplicateStep` 의 기본 삽입 자리가 이미 g 라 `toIndex` 를 안 싣는다.
 *  `order`(화면 순서, 드래그 중이면 미리보기)를 받는다 — 이 틈이 실제로 무엇 사이에 있는지는
 *  화면에 보이는 순서 기준이어야 하기 때문이다. */
function gapDuplicateSpec(
  g: number,
  order: { id: StepId }[],
  t: ReturnType<typeof useT>,
): { sourceId: StepId; toIndex?: number; label: string } {
  if (g === 0) return { sourceId: order[0]!.id, toIndex: 0, label: t('editor.stepSidebar.gap.duplicateFirstLabel') };
  return { sourceId: order[g - 1]!.id, label: t('editor.stepSidebar.gap.duplicateAfterLabel', { g }) };
}

export function StepSidebar({
  drill,
  onCheckedStepsChange,
  stepId,
  onSelectStep,
  onReorderStep,
  onDuplicateStep,
  onSetLink,
  collapsed,
  onMoveSteps,
  onDuplicateSteps,
  onDeleteSteps,
  onDeleteStep,
}: StepSidebarProps) {
  const t = useT();
  const steps = drill.steps;
  // 정원(§복제 가드) — 복제 버튼(카드·틈) 전부 이 하나로 잠근다. "한 장 더 찍기" 와 같은
  // 기준(LIMITS.maxSteps)이다: 복제도 결국 스텝을 한 장 늘리는 조작이라 정원 이유가 같다.
  const atMax = steps.length >= LIMITS.maxSteps;

  // ⑤ 다중 선택 — 화면 상태(ephemeral). 모드를 끄면 체크도 함께 지운다("끄면 선택 해제",
  // 파일 머리말 §선택은 명시적 모드다). 켤 때도 비워서 시작한다 — 지난번에 뭘 체크했었는지가
  // 다음 진입까지 살아 있으면 "내가 언제 이걸 체크했지" 가 된다.
  const [selectMode, setSelectMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<StepId>>(new Set());
  // 선택 모드를 끄면 checkedIds 가 비워지므로 빈 집합이 자동으로 전달된다 — 시트는 그때
  // "선택한 스텝" 선택지를 감춘다(고를 수 없는 것을 보여 주지 않는다).
  useEffect(() => {
    onCheckedStepsChange?.(checkedIds);
  }, [checkedIds, onCheckedStepsChange]);
  const toggleSelectMode = useCallback(() => {
    setSelectMode((v) => !v);
    setCheckedIds(new Set());
  }, []);
  const toggleChecked = useCallback((id: StepId) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  // 일괄 복제 정원 가드 — [한 장 더 찍기]·개별 복제와 같은 기준(LIMITS.maxSteps), 다만 여기는
  // "지금 체크된 장수만큼 늘어난다" 를 미리 계산해야 한다.
  const batchDupBlocked = checkedIds.size === 0 || steps.length + checkedIds.size > LIMITS.maxSteps;
  // 일괄 삭제 최소 1장 가드 — 기존 STEP_DELETE(deleteStep)와 같은 불변식을 "전량 선택" 으로
  // 옮긴 것이다: 체크한 것을 전부 지우면 드릴에 스텝이 하나도 안 남는 경우를 막는다.
  const batchDelBlocked = checkedIds.size === 0 || checkedIds.size >= steps.length;

  // 카드 사진. 드릴이 바뀔 때만 다시 만든다 — TransportBar 시절 칩과 같은 이유
  // (드릴이 안 바뀌면 재사용, 60장이라도 CourtThumbnail 이 새 props 로 다시 그리지 않는다).
  const thumbs = useMemo(() => new Map(drill.steps.map((s, i) => [s.id, buildStepThumb(drill, i)])), [drill]);
  const teamColors = useMemo(
    () => ({
      home: drill.teams.home.color,
      away: drill.teams.away.color,
      homeGk: drill.teams.home.gkColor,
      awayGk: drill.teams.away.gkColor,
    }),
    [drill.teams],
  );
  const courtDef = courtDefFor(drill.courtMode, drill.courtSize);
  const cardAspectCss = `${courtDef.vbW} / ${courtDef.vbH}`;

  const cardRefs = useRef(new Map<StepId, HTMLButtonElement>());
  const measureCenters = useCallback(
    () =>
      // 지금 **화면 순서**로 재야 한다(세로 목록이라 top 기준). steps 순서로 재면 미리보기로
      // 자리를 바꾼 뒤 판정이 어긋난다 — DOM 을 직접 훑는 이유다.
      [...cardRefs.current.values()]
        .filter((el) => el.isConnected)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return r.top + r.height / 2;
        }),
    [],
  );
  const drag = useStepReorderDrag({
    axis: 'y',
    measureCenters,
    onCommit: (id, to) => {
      onReorderStep(id, to);
      liveRegion.say(t('editor.stepSidebar.announce.movedTo', { pos: to + 1 }));
    },
  });

  // ⑤ 묶음 드래그의 "나머지" 좌표계 — measureCenters(단일)와 같은 DOM 을 훑되, 그룹 id 는
  // 뺀다(useStepGroupReorderDrag.ts 머리말 — 그룹을 뺀 나머지 카드 중심이 기준이다).
  const measureRestCenters = useCallback(
    (groupIds: ReadonlySet<StepId>) =>
      [...cardRefs.current.entries()]
        .filter(([id, el]) => el.isConnected && !groupIds.has(id))
        .sort((a, b) => a[1].getBoundingClientRect().top - b[1].getBoundingClientRect().top)
        .map(([, el]) => {
          const r = el.getBoundingClientRect();
          return r.top + r.height / 2;
        }),
    [],
  );
  const groupDrag = useStepGroupReorderDrag({
    measureRestCenters,
    onCommit: (ids, toIndex) => {
      onMoveSteps(ids, toIndex);
      liveRegion.say(t('editor.stepSidebar.announce.movedGroup', { n: ids.length }));
    },
  });

  // 키보드 순서 바꾸기의 '집은' 상태. 집힌 카드는 ↑/↓ 를 전역으로 안 넘기고 자기가 먹는다.
  const [held, setHeld] = useState<{ id: StepId; origin: number } | null>(null);
  const hintId = useId();

  // 끌기 중에는 미리보기 순서로 그린다. 커밋은 손을 뗄 때 한 번이다. 두 드래그(단일·묶음)는
  // 한 포인터 세션에서 하나만 열리므로(카드 하나의 onPointerDown 이 둘 중 하나만 부른다)
  // 동시에 둘 다 non-null 일 일이 없다 — 그래도 순서는 명시로 정한다(묶음이 있으면 묶음 우선).
  const order = groupDrag.state
    ? movedOrderGroup(steps, groupDrag.state.ids, groupDrag.state.to)
    : drag.state
      ? movedOrder(steps, drag.state.from, drag.state.to)
      : steps;
  // 묶음 드래그 중 하이라이트할 틈의 index — groupDrag.state.to 는 "나머지 안에서의 자리"라
  // 전체 `order` 좌표계와 다르다(파일 머리말 §일괄 이동은 별도 훅). 이미 계산해 둔 미리보기
  // `order` 안에서 그룹의 **첫 카드가 지금 있는 자리**를 찾으면 좌표 변환 없이 정확한 답이 나온다
  // — 그 자리 바로 앞 틈이 곧 "묶음이 꽂힐 틈" 이다.
  const groupGapIndex = groupDrag.state ? order.findIndex((s) => groupDrag.state!.ids.has(s.id)) : -1;

  // 일괄 복제 — 체크된 묶음(steps 원본 순서로, 체크한 순서가 아니다)을 넘긴다. 정원에서
  // 막히면(가드가 뚫려도 edits.ts duplicateSteps 가 마지막 문) 조용히 원본을 돌려줄 뿐이라
  // UI 는 버튼을 미리 잠가 "눌렀는데 아무 일도 안 일어난다" 를 피한다(다른 정원 가드들과 같다).
  const handleBatchDuplicate = useCallback(() => {
    if (batchDupBlocked) return;
    const ids = steps.filter((s) => checkedIds.has(s.id)).map((s) => s.id);
    onDuplicateSteps(ids);
    setCheckedIds(new Set());
    liveRegion.say(t('editor.stepSidebar.announce.duplicated', { n: ids.length }));
  }, [batchDupBlocked, steps, checkedIds, onDuplicateSteps, t]);

  // 일괄 삭제 — 되돌릴 수는 있어도(STEPS_DELETE 도 COMMIT_TYPES) 한 번의 오조작이 N장을
  // 가져간다. 그래서 여기서는 즉시 지우지 않고 확인만 연다(PLAN-DELETE-SAFETY.md §C-1) —
  // 실제 삭제는 아래 confirmBatchDelete. 단일 삭제(카드 메뉴 onDeleteStep)는 그대로
  // 안 묻는다 — 가장 자주 지우는 대상이라 매번 묻는 피로가 크고, undo 토스트로 충분하다.
  const [pendingBatchDelete, setPendingBatchDelete] = useState<StepId[] | null>(null);
  const handleBatchDelete = useCallback(() => {
    if (batchDelBlocked) return;
    setPendingBatchDelete(steps.filter((s) => checkedIds.has(s.id)).map((s) => s.id));
  }, [batchDelBlocked, steps, checkedIds]);
  const confirmBatchDelete = useCallback(() => {
    if (!pendingBatchDelete) return;
    // liveRegion.say 는 여기 없다 — onDeleteSteps(EditorWorkspace)가 이제 undo 토스트를
    // 띄우고, 그 role=status 가 이미 낭독 채널이다(ui/Toast.tsx 머리말) — 같은 말을 두 번
    // 듣게 하지 않으려고 이 함수로 옮기며 지웠다.
    onDeleteSteps(pendingBatchDelete);
    setCheckedIds(new Set());
    setPendingBatchDelete(null);
  }, [pendingBatchDelete, onDeleteSteps]);

  // 스텝이 바뀌면 그 카드가 보이도록 목록을 굴린다. jsdom 에는 scrollIntoView 가 없다 —
  // 존재 가드 후 호출한다.
  useEffect(() => {
    cardRefs.current.get(stepId)?.scrollIntoView?.({ block: 'nearest' });
  }, [stepId]);

  const onCardKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, s: { id: StepId }, i: number) => {
    if (e.key === ' ') {
      // 네이티브 click(Space 로 발화)과 전역 재생 토글을 **둘 다** 막는다. 여기서 막지 않으면
      // 집으려던 순간 스텝이 선택되고 재생이 켜진다.
      e.preventDefault();
      e.stopPropagation();
      if (held?.id === s.id) {
        setHeld(null);
        liveRegion.say(t('editor.stepSidebar.announce.movedTo', { pos: i + 1 }));
      } else {
        setHeld({ id: s.id, origin: i });
        liveRegion.say(t('editor.stepSidebar.announce.grabbed', { n: i + 1 }));
      }
      return;
    }
    if (!held || held.id !== s.id) return; // 집지 않았으면 ↑/↓ 는 아무 것도 안 건드린다

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      const to = i + (e.key === 'ArrowUp' ? -1 : 1);
      if (to < 0 || to >= steps.length) return; // 끝에서는 조용히 멈춘다(감아 돌지 않는다)
      onReorderStep(s.id, to);
      liveRegion.say(t('editor.stepSidebar.announce.movedTo', { pos: to + 1 }));
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // 전역 Esc(선택 해제)까지 함께 터지면 되돌린 이유가 안 보인다
      onReorderStep(s.id, held.origin);
      setHeld(null);
      liveRegion.say(t('editor.stepSidebar.announce.returned'));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      setHeld(null);
      liveRegion.say(t('editor.stepSidebar.announce.movedTo', { pos: i + 1 }));
    }
  };

  // gapDuplicateSpec 은 g=0 만 toIndex 를 싣고 g≥1 은 안 싣는다(기본 자리가 이미 맞아서) —
  // `onDuplicateStep(id, undefined)` 로 그대로 넘기면 스파이 단언에 "명시적 undefined 인자"가
  // 남아 호출부(카드 버튼)와 시그니처가 갈려 보인다. 여기서 한 군데로 모아 없앤다.
  const fireDuplicate = useCallback(
    (spec: { sourceId: StepId; toIndex?: number }) => {
      if (spec.toIndex === undefined) onDuplicateStep(spec.sourceId);
      else onDuplicateStep(spec.sourceId, spec.toIndex);
    },
    [onDuplicateStep],
  );

  const panelId = useId();
  const [open, setOpen] = useState(false);

  // 우클릭 메뉴(2026-08-18) — 화면 상태(ephemeral). 카드의 onContextMenu 가 연다. 메뉴의
  // [선택]은 toggleSelectMode 를 안 거친다 — 그 함수는 체크를 비우는데, 메뉴의 뜻은 "이
  // 카드부터 고르기 시작" 이라 켜면서 그 카드를 체크한 채 시작해야 한다.
  const [menu, setMenu] = useState<StepCardMenuTarget | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  // 터치·펜 롱프레스로도 같은 메뉴를 연다(2026-08-20 — 마우스 우클릭과 진입 방식을 맞춘다.
  // 전에는 onContextMenu 가 마우스 전용이라 터치에서는 이 메뉴에 닿을 방법이 없었다). 캔버스
  // 객체(EditorStage 등)와 같은 훅을 재사용한다. id → index 는 열리는 순간에 order.findIndex
  // 로 다시 구한다 — 누른 순간의 i 를 클로저로 들고 있으면 500ms 타이머가 도는 사이 순서가
  // 바뀌었을 때(드물지만) 어긋난 자리를 가리킨다.
  const longPressMenu = useLongPressMenu(
    useCallback(
      (id: string, x: number, y: number) => {
        const index = order.findIndex((s) => s.id === id);
        setMenu({ x, y, id: id as StepId, index });
      },
      [order],
    ),
  );
  const startSelectWith = useCallback(
    (id: StepId) => {
      setSelectMode(true);
      setCheckedIds(new Set([id]));
      liveRegion.say(t('editor.stepSidebar.announce.selectModeOnWithOne'));
    },
    [t],
  );

  const body = (
    <>
      <span id={hintId} className="sr-only">
        {t('editor.stepSidebar.keyboardHint')}
      </span>
      {/* ⑤ 다중 선택 상단 바 — 항상 마운트된 한 줄(2026-08-20 재설계, 기현님 피드백 "UI가 너무
          출렁인다"). 예전엔 선택모드가 켜질 때 카운트+일괄버튼 줄이 새로 마운트돼 헤더 높이가
          늘고 카드 목록이 밀렸다. 지금은 이 줄 자체(minHeight 고정)가 꺼짐/켜짐 상관없이 항상
          있고 **내용만** 바뀐다 — 높이가 고정이니 아래 목록이 밀릴 일이 없다. 154px
          (SIDEBAR_WIDTH_PX) - 패딩 20px = 134px 밖에 없어 닫기·복제·삭제는 아이콘 전용이다
          (aria-label 로 이름은 그대로 — getByRole name 단언은 화면 글자든 aria-label 이든
          가리지 않는다). 카운트만 눈에 보이는 글자로 남긴다(getByText 단언 대상이기도 하고,
          "지금 몇 장 골랐는지"는 아이콘으로 못 담는 정보라서). */}
      <div
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          minHeight: 'var(--hit)',
          padding: `${SIDEBAR_PAD_PX}px ${SIDEBAR_PAD_PX}px 0`,
        }}
      >
        {selectMode ? (
          <>
            <button
              type="button"
              aria-pressed={true}
              aria-label={t('editor.stepSidebar.selectMode.off')}
              onClick={toggleSelectMode}
              style={{
                flex: 'none',
                minHeight: 'var(--hit)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
                borderRadius: 8,
                border: '1px solid var(--accent)',
                background: 'color-mix(in srgb, var(--accent) 16%, var(--panel))',
                color: 'var(--accent)',
              }}
            >
              <IconClose size={15} />
            </button>
            {/* aria-live — 체크할 때마다 몇 장인지 스크린리더가 즉시 말해 준다. */}
            <div
              aria-live="polite"
              style={{ flex: 'none', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              {t('editor.stepSidebar.selectedCount', { n: checkedIds.size })}
            </div>
            <button
              type="button"
              disabled={batchDupBlocked}
              aria-label={t('editor.stepSidebar.batchDuplicateButton')}
              title={
                checkedIds.size > 0 && steps.length + checkedIds.size > LIMITS.maxSteps
                  ? t('editor.stepSidebar.maxStepsNotice', { max: LIMITS.maxSteps })
                  : t('editor.stepSidebar.batchDuplicateTitle')
              }
              onClick={handleBatchDuplicate}
              style={{
                flex: 'none',
                minHeight: 'var(--hit)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
                borderRadius: 8,
                border: '1px solid var(--border-strong)',
                background: 'var(--panel)',
                color: 'var(--text)',
                opacity: batchDupBlocked ? 0.4 : 1,
              }}
            >
              <IconCopy size={14} />
            </button>
            <button
              type="button"
              disabled={batchDelBlocked}
              aria-label={t('editor.stepSidebar.batchDeleteButton')}
              title={
                checkedIds.size > 0 && checkedIds.size >= steps.length
                  ? t('editor.stepSidebar.batchDeleteMinTitle')
                  : t('editor.stepSidebar.batchDeleteTitle')
              }
              onClick={handleBatchDelete}
              style={{
                flex: 'none',
                minHeight: 'var(--hit)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
                borderRadius: 8,
                border: '1px solid var(--border-strong)',
                background: 'var(--panel)',
                color: '#ff6b6b', // ObjectMenu.tsx 의 삭제 항목과 같은 경고색(GapSlot 사슬 끊김과 같은 관행)
                opacity: batchDelBlocked ? 0.4 : 1,
              }}
            >
              <IconDelete size={14} />
            </button>
          </>
        ) : (
          <button
            type="button"
            aria-pressed={false}
            onClick={toggleSelectMode}
            style={{
              flex: 1,
              minHeight: 'var(--hit)',
              borderRadius: 8,
              border: '1px solid var(--border-strong)',
              background: 'var(--panel)',
              color: 'var(--text)',
              fontSize: '0.78125rem',
              fontWeight: 600,
              // ⚠️ **명시해야 한다**(기현 지시 2026-08-30). 네이티브 button 은 글자를 가운데
              //    두지만 `styles/tokens.css` 의 리셋이 `text-align: left` 로 덮는다 — 이 앱의
              //    버튼은 대개 아이콘+글자가 왼쪽에서 시작하는 줄이라 그 리셋이 맞다. 여기만
              //    다르다: 폭을 꽉 채우는(flex:1) 글자 하나짜리 칸이라, 왼쪽에 붙으면 오른쪽
              //    절반이 이유 없이 비어 보인다.
              textAlign: 'center',
            }}
          >
            {t('editor.stepSidebar.selectMode.on')}
          </button>
        )}
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: SIDEBAR_PAD_PX,
        }}
      >
        {order.flatMap((s, i) => {
          const selected = s.id === stepId;
          const checked = checkedIds.has(s.id);
          const dragging = drag.state?.id === s.id || (groupDrag.state !== null && checked);
          const grabbed = held?.id === s.id;
          const gap = gapDuplicateSpec(i, order, t);
          // 내부 틈(1 ≤ i ≤ order.length-1)에만 사슬이 있다 — i=0(맨 앞)은 이 루프 안에서
          // 걸러지고, 맨 뒤 틈은 루프 밖에서 따로 그리는 GapSlot(chain 을 안 넘김)이라 애초에
          // 이 분기를 안 탄다. "다음 스텝"(교리)은 바로 이 반복의 `s` = order[i] 다.
          const chain: GapChain | undefined =
            i >= 1 ? { link: stepLink(s), onCycle: () => onSetLink(s.id, nextStepLink(stepLink(s))) } : undefined;
          return [
            <GapSlot
              key={`gap-${s.id}`}
              index={i}
              active={(drag.state !== null && drag.state.to === i) || groupGapIndex === i}
              disabled={atMax}
              label={gap.label}
              onDuplicate={() => fireDuplicate(gap)}
              chain={chain}
            />,
            <div key={s.id} style={{ position: 'relative', flex: 'none', width: '100%', aspectRatio: cardAspectCss }}>
              <button
                ref={(el) => {
                  if (el) cardRefs.current.set(s.id, el);
                  else cardRefs.current.delete(s.id);
                }}
                type="button"
                // 화면 순서를 재정렬 계산·테스트가 읽는 자리. ARIA 의미가 아니라 순전한 배관이라
                // aria-posinset(특정 role 을 요구한다) 대신 평범한 데이터 속성을 쓴다.
                // `data-step-id` 는 카드가 없앤 이름표(name) 대신 테스트가 "화면 순서가 아니라
                // 실제 어느 스텝인가" 를 식별하는 자리다 — aria-label 은 표시 위치(`i+1`)라
                // 순서가 바뀌면 같은 값이 다른 스텝에서도 나온다.
                data-index={i}
                data-step-id={s.id}
                aria-current={selected ? 'step' : undefined}
                // 선택 모드에서는 이 버튼이 **체크박스로 이중 역할**을 한다(§다중 선택, 체크박스는
                // "실제 input 또는 aria-pressed" 둘 중 하나면 된다 — 카드 전체가 이미 버튼이라
                // aria-pressed 를 얹는 쪽을 골랐다. 별도 input 을 끼우면 <button> 안에 <input> 이
                // 되어 무효한 HTML 이 된다). aria-label 은 두 모드 다 순번뿐이다(cards() 테스트
                // 헬퍼가 두 모드에서 같은 이름으로 찾을 수 있어야 한다).
                aria-pressed={selectMode ? checked : undefined}
                aria-label={t('editor.stepSidebar.cardAriaLabel', { n: i + 1 })}
                aria-describedby={hintId}
                onPointerDown={(e) => {
                  // 선택 모드에서 체크된 카드를 끌면 묶음 드래그, 아니면(모드 밖이거나 체크
                  // 안 된 카드) 평소대로 단일 드래그 — 파일 머리말 §일괄 이동은 별도 훅이다.
                  if (selectMode && checked) groupDrag.start(e, checkedIds);
                  else drag.start(e, s.id, i);
                  // 롱프레스 메뉴 타이머를 같이 건다 — 훅은 이벤트를 가로채지 않고 마우스는
                  // 스스로 배제하며, 손가락이 10px 넘게 움직이면(=끌기가 이겼다) 알아서 접는다.
                  longPressMenu.onPointerDown(s.id, e);
                }}
                onClick={() => {
                  // 끌기의 뒤끝이 선택/체크로 둔갑하지 않게(두 훅 다 확인 — 한 세션엔 하나만
                  // 열리지만 어느 쪽이 열렸었는지 여기서는 모른다).
                  if (drag.consumeDragClick() || groupDrag.consumeDragClick()) return;
                  if (selectMode) toggleChecked(s.id);
                  else onSelectStep(s.id);
                }}
                // 우클릭·롱프레스 메뉴(2026-08-18 기현 지시, 2026-08-20 롱프레스 합류) — 좌표는
                // 포인터 자리(clientX/Y). index 는 useLongPressMenu 의 open 콜백이 연다(위
                // longPressMenu 정의부 주석).
                onContextMenu={(e) => {
                  longPressMenu.onContextMenu(s.id, e);
                }}
                onKeyDown={(e) => onCardKeyDown(e, s, i)}
                onBlur={() => grabbed && setHeld(null)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: 'var(--elev)',
                  border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                  outline: grabbed ? '2px dashed var(--accent)' : undefined,
                  outlineOffset: 2,
                  opacity: dragging ? 0.55 : 1,
                  // 세로 목록이라 드래그 축(y)과 목록 스크롤 축(y)이 같다 — 카드 위에서 시작한
                  // 손짓은 재정렬이 가져간다(옛 가로 칩도 같은 트레이드오프였다, touchAction:
                  // 'pan-y'). 목록이 넘칠 때 터치로 굴리려면 카드가 아니라 틈을 잡아야 한다.
                  touchAction: 'pan-x',
                }}
              >
                <span aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
                  <CourtThumbnail
                    fill
                    mode={drill.courtMode}
                    size={drill.courtSize}
                    thumb={thumbs.get(s.id)}
                    teamColors={teamColors}
                    glyphScale={SIDEBAR_GLYPH_SCALE}
                  />
                </span>
                <span aria-hidden="true" style={cardNumberBadge(selected)}>
                  {i + 1}
                </span>
                {/* 체크박스 시각 표시 — **장식**이다(aria-hidden). 실제 체크 상태는 카드 버튼의
                    aria-pressed 가 나른다(위 주석). 번호 배지(top-left)·복제 버튼(top-right)과
                    안 겹치도록 아래 여백에 둔다. */}
                {selectMode && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: 6,
                      bottom: 6,
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`,
                      background: checked ? 'var(--accent)' : 'color-mix(in srgb, var(--panel) 82%, transparent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-ink-strong)',
                    }}
                  >
                    {checked && <IconCheck size={12} />}
                  </span>
                )}
              </button>
              {/* 카드 복제 버튼(§복제) — 선택 버튼과 형제다(중첩 <button> 은 무효한 HTML이라
                  같은 자리를 absolute 로 나눠 쓴다). 항상 보인다(GapSlot 머리말과 같은 이유). */}
              <button
                type="button"
                aria-label={t('editor.stepSidebar.duplicateBelowAriaLabel', { n: i + 1 })}
                title={atMax ? t('editor.stepSidebar.maxStepsNotice', { max: LIMITS.maxSteps }) : t('editor.stepSidebar.duplicateBelowTitle')}
                disabled={atMax}
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateStep(s.id);
                }}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: 6,
                  width: 20,
                  height: 20,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  border: 'none',
                  background: 'color-mix(in srgb, var(--panel) 82%, transparent)',
                  color: 'var(--muted)',
                  opacity: atMax ? 0.4 : 1,
                }}
              >
                <IconCopy size={12} />
              </button>
            </div>,
          ];
        })}
        {/* 맨 뒤 틈 — 2026-08-30 부터 **스텝을 늘리는 유일한 길**이다(기현 지시로 [한 장 더
            찍기] 버튼이 없어졌다). 그래서 튜토리얼 앵커가 여기로 왔다. */}
        <GapSlot
          index={order.length}
          active={false}
          disabled={atMax}
          tut="editor-add-step"
          label={gapDuplicateSpec(order.length, order, t).label}
          onDuplicate={() => fireDuplicate(gapDuplicateSpec(order.length, order, t))}
        />
      </div>
      {/* 재생 컨트롤(2026-08-18)은 여기 없다 — 2026-08-20 재설계(§D)로 편집·시연 공용
          PlaybackControls 가 되어 EditorWorkspace 하단 줄(노트 옆, 최우측)로 옮겨 갔다.
          이 사이드바는 다시 스텝 목록 전용이다. */}
      {/* 우클릭 메뉴 — 포털(document.body)이라 접힘 오버레이의 z-계층과도 안 얽힌다. */}
      <StepCardMenu
        target={menu}
        atMax={atMax}
        canDelete={steps.length > 1}
        onClose={closeMenu}
        onStartSelect={startSelectWith}
        onDuplicate={(id, toIndex) => (toIndex === undefined ? onDuplicateStep(id) : onDuplicateStep(id, toIndex))}
        onDelete={onDeleteStep}
      />
      {pendingBatchDelete && (
        <ConfirmDialog
          open
          onCancel={() => setPendingBatchDelete(null)}
          onConfirm={confirmBatchDelete}
          title={t('editor.stepSidebar.batchDeleteConfirm.title')}
          body={t('editor.stepSidebar.batchDeleteConfirm.body', { n: pendingBatchDelete.length })}
          confirmLabel={t('editor.stepSidebar.batchDeleteConfirm.confirm')}
          cancelLabel={t('editor.stepSidebar.batchDeleteConfirm.cancel')}
        />
      )}
    </>
  );

  if (!collapsed) {
    return (
      <nav
        aria-label={t('editor.stepSidebar.navAriaLabel')}
        data-tut="editor-step-sidebar"
        style={{
          flex: 'none',
          width: SIDEBAR_WIDTH_PX,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--panel)',
        }}
      >
        {body}
      </nav>
    );
  }

  // ── 접힘 모드 — 여는 버튼 + 오버레이(닫기 = 바깥 탭 또는 같은 버튼) ─────────────────────
  // 부모(EditorWorkspace)의 `<main>` 이 이미 position:relative 라 여기서 absolute 로 그 상자
  // 기준에 뜬다(InspectorHost 의 오버레이와 같은 자리 규칙).
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? t('editor.stepSidebar.overlay.closeAriaLabel') : t('editor.stepSidebar.overlay.openAriaLabel')}
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 20,
          width: 'var(--hit)',
          height: 'var(--hit)',
          borderRadius: 10,
          background: 'var(--panel)',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 6px 16px rgba(0,0,0,.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text)',
        }}
      >
        <IconListSteps size={18} />
      </button>
      {open && (
        // 바깥 탭 = 배경 자체를 눌렀을 때만(target===currentTarget) — ui/Modal.tsx 의 백드롭과
        // 같은 판정이다. 자식(카드·버튼)을 눌렀을 때는 새지 않는다.
        <div
          data-sidebar-backdrop=""
          aria-hidden="true"
          onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}
          style={{ position: 'absolute', inset: 0, zIndex: 24, background: 'rgba(0,0,0,.25)' }}
        />
      )}
      {open && (
        <nav
          id={panelId}
          aria-label={t('editor.stepSidebar.navAriaLabel')}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            zIndex: 25,
            width: `min(${SIDEBAR_WIDTH_PX}px, 88%)`,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            background: 'var(--panel)',
            borderRight: '1px solid var(--border-strong)',
            boxShadow: '10px 0 30px rgba(0,0,0,.35)',
          }}
        >
          {body}
        </nav>
      )}
    </>
  );
}
