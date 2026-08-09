// §6.8 재편 — 자유 전술판 하단 바. 드릴 편집의 TransportBar 자리를 그대로 쓴다(전술판은
// 1장짜리라 스텝 이동·재생이 없다). 레이아웃 골격을 TransportBar 와 맞춰 두 모드를 오갈 때
// 판이 세로로 튀지 않게 한다.
//
// 여기가 코트 전환 **잠금 사유**를 말하는 유일한 자리다. 헤더의 세그먼트는 잠기면 클릭 시
// 토스트를 띄우지만(§6.10 공 도구 제한과 같은 패턴), 토스트는 사라지므로 "왜 못 바꾸는지"가
// 화면에 남지 않는다 — 스크린리더 사용자에게도 상시 근거가 필요하다.

export interface BoardBarProps {
  /** 코트 전환이 잠겨 있는가(= 판이 리셋 상태가 아니다). */
  courtLocked: boolean;
  onReset(): void;
}

export function BoardBar({ courtLocked, onReset }: BoardBarProps) {
  return (
    <div style={{ flex: 'none', borderTop: '1px solid var(--border)', background: 'var(--panel)', padding: '12px 24px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, maxWidth: 940, margin: '0 auto' }}>
        <button
          type="button"
          onClick={onReset}
          style={{
            minHeight: 44,
            padding: '0 16px',
            borderRadius: 9,
            border: '1px solid var(--border-strong)',
            background: 'transparent',
            color: 'var(--text)',
            fontSize: '0.78125rem',
            fontWeight: 700,
          }}
        >
          전술판 초기화
        </button>

        <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: '0.6875rem', color: 'var(--faint-text)' }}>
          {courtLocked
            ? '코트 형태를 바꾸려면 먼저 초기화하세요 — 풀 코트와 하프 코트는 규격이 달라 배치를 옮겨 담을 수 없습니다.'
            : '지금은 코트 형태를 자유롭게 바꿀 수 있습니다.'}
        </p>
      </div>
    </div>
  );
}
