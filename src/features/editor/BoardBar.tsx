import { useId, useRef, useState } from 'react';
// §6.8 재편 — 자유 전술판 하단 바. 드릴 편집의 TransportBar 자리를 그대로 쓴다(전술판은
// 1장짜리라 스텝 이동·재생이 없다). 레이아웃 골격을 TransportBar 와 맞춰 두 모드를 오갈 때
// 판이 세로로 튀지 않게 한다.
//
// 여기가 코트 전환 **잠금 사유**를 말하는 유일한 자리다. 헤더의 세그먼트는 잠기면 클릭 시
// 토스트를 띄우지만(§6.10 공 도구 제한과 같은 패턴), 토스트는 사라지므로 "왜 못 바꾸는지"가
// 화면에 남지 않는다 — 스크린리더 사용자에게도 상시 근거가 필요하다.

import { Modal } from '../../ui/Modal.tsx';
import { SpeedLimitSwitch } from './SpeedLimitSwitch.tsx';
import { Button } from '../../ui/Button.tsx';
import { BAR_HINT_GAP_PX, BAR_HINT_LINE_HEIGHT, bottomBarPadCss } from './bottomBarMetrics.ts';
import { COURT_DEFS } from '../../model/court.ts';
import type { CourtMode } from '../../model/court.ts';

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
  /** 지금 판의 코트. §3.11 — COURT_DEFS[mode].desc 를 여기서 되살린다. */
  courtMode: CourtMode;
  /** 코트 전환이 잠겨 있는가(= 판이 리셋 상태가 아니다). */
  courtLocked: boolean;
  onReset(): void;
  /** 골대만 원위치로. 휠체어에 밀린 골대를 되돌린다(§5.4) — 판 전체는 건드리지 않는다. */
  onResetGoals(): void;
}

export function BoardBar({ courtMode, courtLocked, onReset, onResetGoals }: BoardBarProps) {
  // 비우기는 **되돌릴 수 없다**(BOARD_SET 이 히스토리를 비운다 — actions.ts 주석).
  // 그래서 반드시 확인을 받는다. 되돌리기로 살릴 수 있는 조작이었다면 물을 이유가 없다.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmId = useId();
  const clearBtnRef = useRef<HTMLButtonElement | null>(null);

  // §3.11 — 렌더 참조 0건이던 CourtDef.desc 를 여기서 되살린다. 코트 세그먼트가 §5.2 에서
  // 하단 바로 내려오면 이 줄이 그 세그먼트의 설명이 된다 — 자리를 먼저 잡아 두는 셈이다.
  const desc = COURT_DEFS[courtMode].desc;
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

        {/* 골대는 휠체어에 밀려서만 움직이므로(임의로 못 옮긴다) 되돌리는 길이 여기밖에 없다.
            항상 켜 둔다 — 안 밀린 상태에서 눌러도 무해하고, 활성 여부를 물으려면 물리 상태를
            매 프레임 들여다봐야 한다. */}
        <button
          type="button"
          onClick={onResetGoals}
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
          골대 원위치
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
    </div>
  );
}
