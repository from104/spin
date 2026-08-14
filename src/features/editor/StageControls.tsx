// §6.4 줌 컨트롤(a11y blocker — "줌/팬은 필수 기능이다") + 격자/골 지역 가이드 토글.
// 코트 위 우상단에 떠 있는 --hit×--hit(기본 44, 큰 터치 타깃 56) 버튼 묶음 — §5.4 실배선.
//
// ── 2026-08-14 기현님 지시로 뒤집음 (설계서 §2-③ · §3-ㄱㄴ · §5-P2) ─────────────────────
// **코트 위에 떠 있던 7개 묶음(position:absolute)을 해체했다.** 위 두 줄은 그때의 결정이라
// 지우지 않고 남긴다 — 왜 한때 코트 위였는지가 아래 판단의 전제다.
//
// 뒤집은 근거(기현님 원문): *"오른쪽 툴바들이 직관적이지 않다"*. 정체는 **성격이 다른 셋이
// 한 자리에 섞여 있던 것**이다 — 개체(벤치) · 도구(모드) · 뷰 컨트롤(줌·격자·도움말).
// *"실물 자석판에 줌 버튼은 없다."* 그래서 성격으로 가른다:
//   · 확대 · 축소 · 100%      → **기둥(트레이) 맨 위**(ZoomGroup). 판을 보며 쓰는 것이라 상시.
//   · 격자(#) · 골 지역 가이드(Z) · 도움말(?) → **[보기] 팝오버 안**(ViewControls).
//   · [속성]                  → **하단 바**(ViewControls). 기둥은 *판의 물리적 부품*(벤치·도구),
//                               하단 바는 *앱 크롬* 이다.
// 실측(2026-08-14, boardTargetBudget 의 BUDGET 을 임시 1 로 낮춰 뽑음): 첫 화면 표적
// **37 → 35**, 서랍 둘 다 열린 실사용 상태 **40 → 38**(상한 40, 여유 0 → 2). 사라진 셋은
// 정확히 격자·골 지역 가이드·도움말이고 더해진 하나가 [보기] 다.
//
// 코트 위를 비우는 것 자체가 두 번째 값이다: 흐름 밖 요소가 판 위에 남아 있으면 §4.5 의
// 가장자리 56px 고무줄 띠(edgePanBandPx)와 영영 자리를 다툰다. 이제 이 파일에는
// `position:'absolute'` 가 한 곳도 없다.
//
// 파일 이름을 그대로 둔 이유: *왜 이것들이 코트 위에 떠 있었는가* 의 기록이 여기 있고, 파일을
// 갈아치우면 그 기록과 blame 이 함께 끊긴다. 이 파일은 이제 "옛 스테이지 컨트롤 7개가 각자
// 이사 간 뒤의 두 조각" 이다.
//
// ── 2026-08-14 (같은 날, 두 번째 지시) ──────────────────────────────────────────────
// *"undo, redo 버튼을 줌 버튼과 묶어 배치"* — **헤더에 있던 되돌리기·다시하기가 여기로 왔다**
// (HistoryGroup). 이 파일이 세 조각이 된 것이 아니라, 위에서 정한 규칙("판을 보며 쓰는 것은
// 판 옆에")이 헤더에 남아 있던 마지막 둘까지 데려온 것이다. 근거는 HistoryGroup 머리말에.
import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { IconPlus, IconRedo, IconUndo } from '../../ui/icons.tsx';
import { Modal } from '../../ui/Modal.tsx';

/** 옛 묶음의 버튼 크기 — 한 픽셀도 안 바꾼다(§5.4 "--hit 실배선" 목록. ToolRail.hit.test 가 본다). */
const BTN: CSSProperties = {
  width: 'var(--hit)',
  height: 'var(--hit)',
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'color-mix(in srgb, var(--panel) 82%, transparent)',
  border: '1px solid var(--border)',
  color: 'var(--muted)',
};

export interface ZoomControls {
  onZoomIn(): void;
  onZoomOut(): void;
  onZoomReset(): void;
}

/** 줌 3개 — **기둥(트레이) 맨 위**의 구역(설계서 §3-ㄱ, §4.3).
 *
 *  왜 하단 바가 아닌가: 7인치 세로에서 하단 바가 한 줄 8칸이 된다.
 *  왜 코트 위가 아닌가: 이 재설계의 **숨은 이득**(코트 네 변의 56px 고무줄 띠가 완전히 비는 것,
 *  §4.5)을 도로 버리게 된다. 기둥은 판 조작을 위해 손이 이미 가 있는 곳이다.
 *
 *  ⚠️ **2열 배치다**(`flexWrap:'wrap'` + 세로 기둥에서 width:100%). 기둥 폭은 지금 칩 두 줄
 *  (`calc(var(--hit)*2 + 5px)` = 44→93, 56→117)이고 버튼 둘 + gap 5 가 정확히 그 폭이라 딱
 *  맞는다. 1열로 세우면 142px(44 기준)를 먹어 1024×600 가용 468 에서 벤치가 93px 밖에 못 쓴다 —
 *  2열이면 93px 이라 절반이다(설계서 §4.3 고정 구역 검산). 폭을 여기서 **못박지 않는** 이유는
 *  P3 가 기둥을 유동 폭으로 바꾸기 때문이다: wrap 이면 넓어진 기둥에서 3열·4열로 저절로 흐른다. */
export function ZoomGroup({ orientation, onZoomIn, onZoomOut, onZoomReset }: ZoomControls & { orientation: 'vertical' | 'horizontal' }) {
  const horiz = orientation === 'horizontal';
  return (
    // role=group aria-label="확대" — 설계서 §4.3 의 이름 그대로다. 첫 화면 표적 예산의 대조군이
    // **'확대' 를 이름으로 찍으므로**(boardTargetBudget.test.tsx) 이 아래 버튼 이름도 한 글자도
    // 바꾸지 마라. 예산이 세는 것은 상호작용 요소라 이 group 자체는 표적이 아니다.
    <div
      role="group"
      aria-label="확대"
      style={{
        flex: 'none',
        display: 'flex',
        flexDirection: 'row',
        flexWrap: horiz ? 'nowrap' : 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        ...(horiz ? {} : { width: '100%' }),
      }}
    >
      <button type="button" aria-label="확대" onClick={onZoomIn} style={BTN}>
        <IconPlus size={16} />
      </button>
      <button type="button" aria-label="축소" onClick={onZoomOut} style={{ ...BTN, fontSize: '1.125rem', fontWeight: 700 }}>
        −
      </button>
      <button type="button" aria-label="줌 초기화" onClick={onZoomReset} style={{ ...BTN, fontSize: '0.625rem', fontWeight: 700 }}>
        100%
      </button>
    </div>
  );
}

export interface HistoryControls {
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
}

/** 되돌리기·다시하기 둘 — **줌 바로 아래**, 같은 묶음으로 읽히는 자리(기현 지시 2026-08-14:
 *  *"undo, redo 버튼을 줌 버튼과 묶어 배치"*).
 *
 *  ── 왜 헤더에서 여기로 옮겼는가 ────────────────────────────────────────────────────
 *  옛 자리는 앱 헤더 우측(`AppHeader` 의 HistoryControl)이었다. 판을 만지는 손과 헤더는
 *  화면의 정반대 끝이라, 한 번 되돌릴 때마다 발 마우스가 판을 떠나 왕복해야 했다. 줌 3개를
 *  기둥 맨 위로 올린 것과 **같은 판단**이다 — 판을 보며 쓰는 컨트롤은 판 옆에 있어야 한다.
 *
 *  **옮긴 것이지 늘린 것이 아니다.** 헤더의 둘은 지웠다: 남겨 두면 이름이 같은 표적이 둘이
 *  되어(§3 표적 예산 35 → 37, 서랍 둘 다 연 실사용은 38 → 40 으로 상한에 붙는다) 예산도
 *  스크린리더도 함께 나빠진다.
 *
 *  ⚠️ **줌과 한 구역으로 합치지 않는다.** `role="group" aria-label="확대"` 안에 되돌리기가
 *  들어가면 스크린리더가 "확대 그룹, 되돌리기" 라고 읽는다. 눈으로는 한 덩어리, 이름으로는
 *  두 구역 — 그 둘은 모순이 아니다(구분선 없이 붙여 두는 것이 시각적 묶음이다).
 *
 *  개수가 **항상 2로 고정**이라 §3 불변식 1(서랍을 여닫아도 위쪽 표적이 안 움직인다)을
 *  건드리지 않는다. 못 되돌릴 때는 사라지는 것이 아니라 `disabled` 다 — 사라지면 아래 벤치
 *  좌표가 통째로 움직인다. */
export function HistoryGroup({
  orientation,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: HistoryControls & { orientation: 'vertical' | 'horizontal' }) {
  const horiz = orientation === 'horizontal';
  const btn = (enabled: boolean): CSSProperties => ({
    ...BTN,
    color: enabled ? 'var(--text)' : 'var(--muted)',
    opacity: enabled ? 1 : 0.4,
  });
  return (
    <div
      role="group"
      aria-label="편집 이력"
      style={{
        flex: 'none',
        display: 'flex',
        flexDirection: 'row',
        flexWrap: horiz ? 'nowrap' : 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        ...(horiz ? {} : { width: '100%' }),
      }}
    >
      {/* 이름은 헤더에 있던 것을 **한 글자도 안 바꿨다** — 옮긴 것이지 새로 만든 것이 아니고,
          이미 이 이름으로 찍는 테스트가 여러 파일에 있다(placementPresets·InspectorPanel 등). */}
      <button
        type="button"
        aria-label="되돌리기"
        title="되돌리기 (Ctrl+Z)"
        disabled={!canUndo}
        onClick={onUndo}
        style={btn(canUndo)}
      >
        <IconUndo />
      </button>
      <button
        type="button"
        aria-label="다시하기"
        title="다시하기 (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={onRedo}
        style={btn(canRedo)}
      >
        <IconRedo />
      </button>
    </div>
  );
}

/** 하단 바 손잡이 — 바의 다른 버튼([코트 비우기]·[내보내기])과 같은 리듬이다. 높이는 `--hit`
 *  이므로 이 둘이 들어와도 바 높이(60/64)는 한 픽셀도 안 변한다(bottomBarMetrics 의 그 식). */
const BAR_BTN: CSSProperties = {
  minHeight: 'var(--hit)',
  padding: '0 14px',
  borderRadius: 9,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--muted)',
  fontSize: '0.75rem',
  fontWeight: 600,
  flex: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
};

/** 팝오버 안의 한 줄. 폭을 다 쓰고 높이는 `--hit` — 발 마우스·입 젓가락 조준이 이 앱의 기준이다. */
const MENU_ITEM: CSSProperties = {
  width: '100%',
  minHeight: 'var(--hit)',
  padding: '0 12px',
  borderRadius: 9,
  border: '1px solid var(--border)',
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: '0.8125rem',
  fontWeight: 600,
  textAlign: 'left',
};

export interface ViewControlsProps {
  showGrid: boolean;
  onToggleGrid(): void;
  showRuleZones: boolean;
  onToggleRuleZones(): void;
  /** 도움말 열기(3.9 [E-4]) — 버튼이 없으면 도움말은 Shift+? 를 이미 아는 사람만 여는 문서다.
   *
   *  ⚠️ 2026-08-14: 이 손잡이는 이제 **[보기] 팝오버 안**이다. 누르면 팝오버를 **먼저 닫고**
   *  도움말을 연다 — 두 Modal 이 겹치면 Esc 가 안쪽이 아니라 **먼저 등록된 바깥쪽**을 닫는다
   *  (둘 다 document 캡처에 달리므로 호출 순서가 곧 등록 순서다). 메뉴는 항목을 고르면 닫히는
   *  것이 원래 규칙이기도 하다.
   *  그래서 **돌아갈 곳도 [보기] 버튼**이다: 도움말이 닫힐 때 [도움말] 항목은 이미 DOM 에
   *  없고, Modal 의 복귀는 `isConnected` 를 검사하므로(ui/Modal.tsx:70) 떼어진 노드를 주면
   *  포커스가 아무 데도 안 간다. EditorWorkspace 가 `viewButtonRef` 를 helpTriggerRef 에 꽂는다. */
  onShowHelp(): void;
  /** [보기] 버튼 — 도움말이 닫힐 때 돌아올 곳. Safari 는 클릭이 버튼에 포커스를 주지 않아
   *  Modal 의 openedBy 폴백이 body 가 된다(3.9 완료 판정) — ref 로 못박는다. */
  viewButtonRef?: RefObject<HTMLButtonElement | null>;
  /** [속성] 여닫기 — 인스펙터가 오버레이가 되면서(결정 ③) 그것을 부르는 손잡이가 필요해졌다.
   *
   *  ⚠️ 옛 근거는 *"코트 우상단은 어느 방향·어느 폭에서도 비어 있는 유일한 자리다. 하단 바에
   *  두면 BoardBar/TransportBar 둘 다 고쳐야 하고, 시트가 올라올 때 그 손잡이를 자기가 덮는다.
   *  이 버튼은 떠 있으므로 레이아웃 폭·높이를 한 픽셀도 먹지 않는다"* 였다.
   *  2026-08-14 기현님 지시로 뒤집었다 — **바 둘을 고치는 대가는 한 번이고**(이 컴포넌트 하나를
   *  둘이 함께 쓴다), 코트 위를 비우는 값은 매 조작마다 돌아온다(§4.5). 세로 화면에서 시트가
   *  이 손잡이를 덮는 것은 사실이지만, 그때도 시트 자신의 [닫기]와 Esc 가 있고 **덮인 손잡이를
   *  다시 눌러 닫는 것보다 그쪽이 짧다.** */
  inspectorOpen: boolean;
  onToggleInspector(): void;
  inspectorPanelId: string;
  inspectorButtonRef?: RefObject<HTMLButtonElement | null>;
}

/** 하단 바의 뷰 컨트롤 두 손잡이 — `[보기▾]` 팝오버와 `[속성]`.
 *
 *  ── 왜 `Modal` 인가(새 오버레이를 만들지 않는 이유) ─────────────────────────────────
 *  Esc 우선순위(모달 > 인스펙터 > 전역 선택 해제)는 플래그가 아니라 **등록 단계**가 보장한다
 *  (InspectorHost.tsx:17-24). `Modal` 은 document **캡처**에서 Esc 를 잡아 stopPropagation 하고,
 *  인스펙터는 **자기 루트 요소**(타깃/버블)에만 단다 — 그래서 팝오버가 떠 있으면 인스펙터도
 *  전역 선택 해제도 원리적으로 호출되지 않는다. 새 오버레이를 세우면 그 보장을 **다시 처음부터**
 *  세워야 하고, 그것이 정확히 이 저장소가 피해 온 실패다.
 *  `ui/Drawer` 는 트랩이 없고 Esc 를 자기 루트에 달아 인스펙터와 **같은 단계**가 된다 —
 *  우선순위가 등록이 아니라 DOM 위치에 의존하게 되므로 쓰지 않는다. 폭 380px 오른쪽 패널이라
 *  토글 3개짜리 메뉴의 모양도 아니다.
 *  `Modal` 이 주는 나머지: 포커스 트랩 · 열면 첫 항목으로 포커스 · 닫으면 트리거로 복귀
 *  (`isConnected` 검사 포함) · 바깥 클릭으로 닫기 · **닫히면 DOM 에 아예 없다**(예산 밖).
 *  대가는 하나다 — 가운데 뜨는 모달이라 **켜는 동안 판을 가린다.** 격자를 켜 놓고 그 효과를
 *  보려면 닫아야 한다(토글은 즉시 반영되고, 닫는 것은 Esc 한 번 또는 바깥 클릭 한 번이다).
 *  기현님 실기 확인 항목으로 올린다: 붙박이 팝오버가 필요하면 그때 만든다. */
export function ViewControls({
  showGrid,
  onToggleGrid,
  showRuleZones,
  onToggleRuleZones,
  onShowHelp,
  viewButtonRef,
  inspectorOpen,
  onToggleInspector,
  inspectorPanelId,
  inspectorButtonRef,
}: ViewControlsProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const localRef = useRef<HTMLButtonElement | null>(null);
  const firstItemRef = useRef<HTMLButtonElement | null>(null);
  // 밖에서 ref 를 안 줘도 복귀가 성립해야 한다 — 폴백 ref 를 항상 하나 들고 있는다.
  const btnRef = viewButtonRef ?? localRef;

  // 열면 **첫 항목**(격자)에 선다. Modal 은 패널 안 첫 포커스 대상으로 보내는데 그것이
  // [닫기](DOM 순서상 제목보다 앞)라, 메뉴로 쓰면 열자마자 '닫기' 위에 서게 된다 —
  // 토글 3개짜리 메뉴에서 한 칸을 더 움직여야 하는 것은 발 마우스 사용자에게 그냥 비용이다.
  // Modal 쪽 DOM 순서를 고치지 않는 이유: 그 [닫기]는 지금 모달 6곳이 공유한다.
  // 자식(Modal) 이펙트가 먼저, 부모(여기) 이펙트가 나중에 돌므로 이 한 줄이 마지막 말이 된다.
  useEffect(() => {
    if (open) firstItemRef.current?.focus({ preventScroll: true });
  }, [open]);

  const toggleStyle = (on: boolean): CSSProperties => ({
    ...MENU_ITEM,
    color: on ? 'var(--accent-text)' : 'var(--text)',
    borderColor: on ? 'var(--accent)' : 'var(--border)',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
      <button
        type="button"
        ref={btnRef}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        style={BAR_BTN}
      >
        보기
        {/* 여는 방향 표식. 이름에는 안 들어간다(aria-hidden) — 상태는 aria-expanded 가 말한다.
            트레이 서랍 손잡이(ToolRail 의 ▸/▾)와 같은 규칙이다. */}
        <span aria-hidden style={{ fontSize: '0.5625rem', lineHeight: 1 }}>
          ▾
        </span>
      </button>

      <button
        type="button"
        ref={inspectorButtonRef}
        aria-label="속성"
        aria-expanded={inspectorOpen}
        aria-controls={inspectorPanelId}
        onClick={onToggleInspector}
        style={{
          ...BAR_BTN,
          fontWeight: 700,
          color: inspectorOpen ? 'var(--accent-text)' : 'var(--muted)',
          borderColor: inspectorOpen ? 'var(--accent)' : 'var(--border)',
        }}
      >
        속성
      </button>

      <Modal open={open} onClose={() => setOpen(false)} titleId={titleId} title="보기" returnFocusRef={btnRef}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 이름은 옛 코트 위 버튼의 것을 **한 글자도 안 바꿨다** — 화면 글자('격자')는 이름
              ('격자 표시 전환')의 부분집합이라 WCAG 2.5.3(Label in Name)도 지킨다. */}
          <button
            type="button"
            ref={firstItemRef}
            aria-pressed={showGrid}
            aria-label="격자 표시 전환"
            onClick={onToggleGrid}
            style={toggleStyle(showGrid)}
          >
            <span aria-hidden style={{ width: '1.25rem', textAlign: 'center', fontWeight: 700 }}>
              #
            </span>
            격자
          </button>
          <button
            type="button"
            aria-pressed={showRuleZones}
            aria-label="골 지역 가이드 전환"
            onClick={onToggleRuleZones}
            style={toggleStyle(showRuleZones)}
          >
            <span aria-hidden style={{ width: '1.25rem', textAlign: 'center', fontWeight: 700 }}>
              Z
            </span>
            골 지역 가이드
          </button>
          <button
            type="button"
            aria-label="도움말"
            aria-haspopup="dialog"
            onClick={() => {
              // 순서가 계약이다 — 팝오버를 먼저 닫아야 Esc 가 도움말을 닫는다(머리말 ⚠️).
              setOpen(false);
              onShowHelp();
            }}
            style={MENU_ITEM}
          >
            <span aria-hidden style={{ width: '1.25rem', textAlign: 'center', fontWeight: 700 }}>
              ?
            </span>
            도움말
          </button>
        </div>
      </Modal>
    </div>
  );
}
