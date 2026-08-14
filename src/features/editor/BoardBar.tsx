// ⚠️⚠️ **2026-08-14 — 이 파일은 더 이상 어느 화면도 쓰지 않는다.**
//
// 기현님 재설계로 자유 전술판의 하단 바가 통째로 사라졌다: [코트 비우기]·[내보내기]·속도 제한·
// [보기]·[속성]이 전부 오른쪽 기능 바(FunctionBar.tsx)로 갔다. 드릴 편집은 아직 옛 배치지만
// 그쪽이 쓰는 것은 TransportBar 이므로, BoardBar 를 부르는 곳은 **테스트 말고는 없다.**
//
// 지우지 않고 남기는 이유: 드릴 편집 재설계가 아직 남아 있고, 그때 이 파일의 판단들(코트 설명
// 두 줄 공존 · 비우기 확인의 문구 · 하단 바 세로 리듬)을 다시 읽게 된다. 다만 **살아 있는
// 코드로 오해하지 마라** — 여기를 고쳐도 화면은 한 픽셀도 안 바뀐다. 드릴 편집 재설계가
// 끝나면 이 파일과 BoardBar.test.tsx 를 함께 지운다.
//
import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
// §6.8 재편 — 자유 전술판 하단 바. 드릴 편집의 TransportBar 자리를 그대로 쓴다(전술판은
// 1장짜리라 스텝 이동·재생이 없다). 레이아웃 골격을 TransportBar 와 맞춰 두 모드를 오갈 때
// 판이 세로로 튀지 않게 한다.
//
// 여기가 코트 전환 **잠금 사유**를 말하는 유일한 자리다. 헤더의 세그먼트는 잠기면 클릭 시
// 토스트를 띄우지만(§6.10 공 도구 제한과 같은 패턴), 토스트는 사라지므로 "왜 못 바꾸는지"가
// 화면에 남지 않는다 — 스크린리더 사용자에게도 상시 근거가 필요하다.
//
// ⚠️ **[골대 원위치]는 2026-08-12(4.7) 에 이 바에서 확인 모달 안으로 내려갔다. 되돌리지 마라 —
//    되돌리면 첫 화면 표적 예산이 41 이 되어 `src/test/boardTargetBudget.test.tsx` 의
//    "서랍이 둘 다 열린 실사용 상태" it 이 빨개진다.**
//    실측(2026-08-12): 서랍 둘 다 열린 상태 40 = 상한 40, 여유 0. §6.4 가 이 바에 [내보내기]
//    1개를 요구했으므로 같은 바에서 1개를 내줘야 했고, 후보는 셋뿐이었다 —
//    [코트 비우기]·[개체 이동 속도 제한]은 예산 게이트의 대조군이 구역 표본으로 직접 이름을
//    찍어 두었고(=지우면 게이트가 세는 규칙째 헐거워진다), 남는 것이 [골대 원위치]였다.
//    골대는 **휠체어에 밀려서만** 움직이는 드문 사고이고(GoalPost.tsx), 코트를 비우면 어차피
//    판이 새로 서면서 골대도 제자리로 간다 — 즉 '코트를 되돌리는 곳' 은 원래 하나였고 그
//    모달이 그 자리다. 대가는 발견성이다: 밀린 골대만 되돌리려면 [코트 비우기] → 모달 →
//    [골대만 원위치] 로 한 단계가 늘었다. 5.4 가 예산을 더 쓰지 않고 자리를 벌면 되돌려도 된다.
//
// ── 그 대가가 실제로 청구됐다 (2026-08-13, 기현님 실기 신고) ─────────────────────────────
// 위 판단은 *"기능이 있는가"* 로는 옳았고 *"찾을 수 있는가"* 로는 틀렸다. **이 앱의 주 사용자가
// 못 찾았다** — 원문 *"골대 원위치 버튼 어디있나?"*. 밀린 골대 하나 되돌리려고 *"코트를
// 비울까요?"* 라는 제목의, *"되돌릴 수 없습니다"* 라고 경고하는 창을 여는 사람은 없다.
// 그래서 **주 자리는 인스펙터([드릴 정보] 구역 맨 끝)로 옮겼다**(InspectorPanel.tsx 의
// `GoalResetField` 머리말이 근거다). 인스펙터는 닫혀 있으면 DOM 에 없어 예산을 한 칸도 안 쓴다 —
// 위 ⚠️ 의 "바로 되돌리지 마라" 는 **여전히 유효**하다(바로 올리면 41 이 되어 게이트가 빨개진다).
//
// **모달 안의 [골대만 원위치] 는 남긴다.** 지우면 4.7 이후 이 길을 배운 사람이 잃는데, 닫힌
// 모달은 표적 0개라 남겨 두는 값이 공짜다. 두 손잡이는 EditorWorkspace 의 **같은 `resetGoals`
// 참조**를 부른다(EditorWorkspace.resetGoals.test.tsx 가 소스와 동작 양쪽으로 못박는다) —
// 각자 world 를 부르면 "막혔을 때 알린다" 같은 규칙이 한쪽에서만 조용히 사라진다.

import { Modal } from '../../ui/Modal.tsx';
import { SpeedLimitSwitch } from './SpeedLimitSwitch.tsx';
import { Button } from '../../ui/Button.tsx';
import { BAR_HINT_GAP_PX, BAR_HINT_LINE_HEIGHT, bottomBarPadCss } from './bottomBarMetrics.ts';
import { courtDefFor } from '../../model/court.ts';
import type { CourtMode, CourtSize } from '../../model/court.ts';
import type { Drill } from '../../model/drill.ts';
import { ExportSheet } from '../export/ExportSheet.tsx';

/** 문구 한 줄의 공통 스타일(§3.11). nowrap+ellipsis 는 멋이 아니라 **높이 보증**이다 —
 *  줄이 접히면 문구 스택이 --hit 를 넘어 바가 자란다(bottomBarMetrics 의 barHintStackPx 주석).
 *  잘린 전문은 title 로 남긴다. 스크린리더는 시각 말줄임과 무관하게 전문을 읽는다. */
const HINT_LINE_STYLE = {
  margin: 0,
  fontSize: '0.6875rem', // = BAR_HINT_FONT_PX(11). bottomBarMetrics.test 가 등식을 붙잡는다
  lineHeight: BAR_HINT_LINE_HEIGHT,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

export interface BoardBarProps {
  /** 지금 판의 코트. §3.11 — courtDefFor(mode, size).desc 를 여기서 되살린다. */
  courtMode: CourtMode;
  /** §6.4 — 크기 3단. desc 는 크기마다 다른 문장이다('규격 최대' / '표준 농구 코트' / '규격 최소'). */
  courtSize?: CourtSize;
  /** 코트 전환이 잠겨 있는가(= 판이 리셋 상태가 아니다). */
  courtLocked: boolean;
  onReset(): void;
  /** 골대만 원위치로. 휠체어에 밀린 골대를 되돌린다(§5.4) — 판 전체는 건드리지 않는다.
   *  여기(확인 모달 안)는 **둘째 손잡이**다. 주 자리는 인스펙터다(머리말 2026-08-13 절).
   *  두 손잡이는 같은 핸들러를 받는다. */
  onResetGoals(): void;
  /** 지금 판 한 벌 — 내보내기 시트가 그림·인쇄를 여기서 굽는다(§6.4). */
  drill: Drill;
  showGrid: boolean;
  showRuleZones: boolean;
  /** 뷰 컨트롤 두 손잡이(`[보기▾]` · `[속성]`) — 2026-08-14 기현님 지시로 코트 위 떠 있던
   *  묶음에서 이 바로 내려왔다(설계서 §3-ㄴ: 기둥은 *판의 물리적 부품*, 하단 바는 *앱 크롬*).
   *
   *  ⚠️ **요소를 통째로 받는 이유**: 두 바(BoardBar·TransportBar)가 **같은 컴포넌트 인스턴스**를
   *  써야 하고(EditorWorkspace 의 `toolRail` 과 같은 규율 — §5.1 "컨테이너만 바꾼다"), props 8개를
   *  두 바에 복제하면 한쪽만 배선이 낡는다. 선택 prop 인 이유는 바를 떼어 렌더하는 자리가
   *  테스트 5파일이기 때문이고, 배선이 끊기면 boardTargetBudget 의 마지막 대조군(이름 '속성'
   *  버튼을 눌러 인스펙터를 연다)과 EditorWorkspace.viewControls.test 가 즉시 빨개진다.
   *
   *  **맨 끝에 둔다** — 앞선 손잡이들([코트 비우기]·[내보내기]·속도 스위치)의 x 가 한 픽셀도
   *  안 움직여야 한다(§3 불변식 1 과 같은 규율. 3.9 가 도움말을 묶음 끝에 단 것과 같다). */
  viewControls?: ReactNode;
}

export function BoardBar({ courtMode, courtSize, courtLocked, onReset, onResetGoals, drill, showGrid, showRuleZones, viewControls }: BoardBarProps) {
  // 비우기는 **되돌릴 수 없다**(BOARD_SET 이 히스토리를 비운다 — actions.ts 주석).
  // 그래서 반드시 확인을 받는다. 되돌리기로 살릴 수 있는 조작이었다면 물을 이유가 없다.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const confirmId = useId();
  const clearBtnRef = useRef<HTMLButtonElement | null>(null);
  const exportBtnRef = useRef<HTMLButtonElement | null>(null);

  // §3.11 — 렌더 참조 0건이던 CourtDef.desc 를 여기서 되살린다. 코트 세그먼트가 §5.2 에서
  // 하단 바로 내려오면 이 줄이 그 세그먼트의 설명이 된다 — 자리를 먼저 잡아 두는 셈이다.
  const desc = courtDefFor(courtMode, courtSize).desc;
  const lockHint = courtLocked
    ? '코트 형태를 바꾸려면 먼저 코트를 비우세요 — 풀 코트와 하프 코트는 규격이 달라 배치를 옮겨 담을 수 없습니다.'
    : '지금은 코트 형태를 자유롭게 바꿀 수 있습니다.';

  return (
    // 세로 여백은 TransportBar 와 **같은 출처**에서 온다(bottomBarMetrics) — 크롬 예산의
    // '하단 바' 행은 두 바 중 큰 쪽이라, 한쪽만 줄이면 예산이 조용히 틀어진다.
    <div style={{ flex: 'none', borderTop: '1px solid var(--border)', background: 'var(--panel)', padding: bottomBarPadCss() }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, maxWidth: 940, margin: '0 auto' }}>
        <button
          type="button"
          ref={clearBtnRef}
          onClick={() => setConfirmOpen(true)}
          style={{
            minHeight: 'var(--hit)',
            padding: '0 16px',
            borderRadius: 9,
            border: '1px solid var(--border-strong)',
            background: 'transparent',
            color: 'var(--text)',
            fontSize: '0.78125rem',
            fontWeight: 700,
          }}
        >
          코트 비우기
        </button>

        {/* §6.4 — 내보내기는 여기 하나뿐이다. 헤더가 아니라 하단 바인 이유는 narrow 헤더가
            52px 한 줄이기 때문이고(§5.2), 시트(3항목)는 닫혀 있으면 DOM 에 없어 예산 밖이다. */}
        <button
          type="button"
          ref={exportBtnRef}
          onClick={() => setExportOpen(true)}
          aria-haspopup="dialog"
          style={{
            minHeight: 'var(--hit)',
            padding: '0 14px',
            borderRadius: 9,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--muted)',
            fontSize: '0.75rem',
            fontWeight: 600,
            flex: 'none',
          }}
        >
          내보내기
        </button>

        <SpeedLimitSwitch />

        {/* §3.11 — 코트 설명(desc)과 잠금 사유가 **딴 줄로 공존**한다. 같은 슬롯을 조건으로
            나눠 쓰면 잠기는 순간 설명이 사라진다 — 그건 공존이 아니라 자리 다툼이다.
            두 줄(≈34px)은 버튼(--hit 44)보다 낮아 바 높이(60)는 한 픽셀도 안 변한다. */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: BAR_HINT_GAP_PX }}>
          <p title={desc} style={{ ...HINT_LINE_STYLE, color: 'var(--muted)' }}>
            {desc}
          </p>
          <p title={lockHint} style={{ ...HINT_LINE_STYLE, color: 'var(--faint-text)' }}>
            {lockHint}
          </p>
        </div>

        {viewControls}
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        titleId={confirmId}
        title="코트를 비울까요?"
        returnFocusRef={clearBtnRef}
      >
        <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', lineHeight: 1.6 }}>
          코트 위의 선수·공·콘·화살표·메모가 모두 사라집니다. <strong>되돌릴 수 없습니다.</strong>
          <br />
          선수는 오른쪽 명단에 남아 있어 다시 놓을 수 있습니다.
        </p>
        {/* 밀린 골대만 되돌리는 길. 예산 때문에 바에서 여기로 내려왔다(머리말 ⚠️) —
            **판을 건드리지 않는 동작**이므로 파괴적 버튼 줄에 섞지 않고 위에 따로 둔다.
            2026-08-13: 주 자리는 인스펙터로 갔고 여기는 둘째 손잡이로 남는다(머리말 뒷절).
            이름이 [골대만 원위치] 인 것은 이 모달의 문맥('비우기' 와 대비) 때문이다 — 인스펙터
            쪽은 [골대 원위치] 다. 두 이름을 통일하지 않는 이유가 그것이다. */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--faint-text)', lineHeight: 1.6, marginBottom: 10 }}>
            골대만 휠체어에 밀렸다면 판을 비울 필요가 없습니다.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setConfirmOpen(false);
              onResetGoals();
            }}
          >
            골대만 원위치
          </Button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setConfirmOpen(false);
              onReset();
            }}
          >
            비우기
          </Button>
        </div>
      </Modal>

      {/* ⚠️ 시트는 **닫혀 있어도 마운트된 채**여야 한다 — [인쇄]를 고르면 시트가 닫히고,
          인쇄 트리(PrintRoot)는 이 컴포넌트 안에 산다. 조건부로 렌더하면 인쇄가 시작되기 전에
          트리가 사라져 백지가 인쇄된다(ExportSheet.tsx 머리말). 닫힌 시트의 표적은 0개다. */}
      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        drill={drill}
        stepIndex={0}
        showGrid={showGrid}
        showRuleZones={showRuleZones}
        returnFocusRef={exportBtnRef}
      />
    </div>
  );
}
