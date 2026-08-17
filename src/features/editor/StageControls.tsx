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
import type { CSSProperties } from 'react';
import { IconPlus, IconRedo, IconUndo } from '../../ui/icons.tsx';

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

// 2026-08-18 — 여기 있던 ViewControls([보기▾]·[속성])가 **폐기됐다**(기현님: "속성 버튼 및
// 그 안의 내용 폐기" · "결과적으로 하단에는 노트 빼고 다 삭제"). [보기]·격자·골 지역·도움말은
// 기능 바(FunctionBar)가 이미 맡고 있었고, [속성]은 인스펙터(InspectorPanel/InspectorHost)와
// 함께 사라졌다 — 드릴 제목·설명은 헤더 인라인, 스텝 조작은 왼쪽 사이드바가 후계다.
