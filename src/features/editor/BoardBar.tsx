import { useId, useRef, useState } from 'react';
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
   *  손잡이는 [코트 비우기] 확인 모달 안에 있다(머리말 ⚠️). */
  onResetGoals(): void;
  /** 지금 판 한 벌 — 내보내기 시트가 그림·인쇄를 여기서 굽는다(§6.4). */
  drill: Drill;
  showGrid: boolean;
  showRuleZones: boolean;
}

export function BoardBar({ courtMode, courtSize, courtLocked, onReset, onResetGoals, drill, showGrid, showRuleZones }: BoardBarProps) {
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
            **판을 건드리지 않는 동작**이므로 파괴적 버튼 줄에 섞지 않고 위에 따로 둔다. */}
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
