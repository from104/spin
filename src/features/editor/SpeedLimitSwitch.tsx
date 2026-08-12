// 개체 이동 속도 제한 스위치. 전술판(BoardBar)과 드릴 편집(TransportBar)이 같은 것을 쓴다.
//
// 설정 화면이 아니라 판 **하단**에 두는 이유: 실제 파워체어 속도(10 km/h)를 지키며 움직임을
// 확인하는 것과, 판을 빨리 짜는 것은 목적이 다르다. 한 세션 안에서 수시로 오가므로 설정을
// 열었다 닫는 거리가 있으면 그냥 안 쓰게 된다.
import { useSettingsActions, useSettingsState } from '../../store/settings/SettingsProvider.tsx';
import { prunePhysics } from '../../storage/prefs.ts';

export function SpeedLimitSwitch() {
  const { prefs, physics } = useSettingsState();
  const { setPrefs } = useSettingsActions();
  const on = physics.speedLimit;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="개체 이동 속도 제한"
      title={
        on
          ? '실제 파워체어 속도(10 km/h)로 움직입니다. 끄면 포인터를 즉시 따라옵니다.'
          : '개체가 포인터를 즉시 따라옵니다. 켜면 실제 파워체어 속도로 움직입니다.'
      }
      onClick={() => setPrefs({ physics: prunePhysics({ ...prefs.physics, speedLimit: !on }) })}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        flex: 'none',
        minHeight: 'var(--hit)',
        padding: '0 14px',
        borderRadius: 9,
        // 켜짐이 기본이자 '사실적인' 상태다. 꺼졌을 때를 액센트로 강조한다 —
        // 제한을 푼 채로 두고 왜 빠른지 모르는 상황이 더 나쁘다.
        border: on ? '1px solid var(--border)' : '1.5px solid var(--accent)',
        background: on ? 'transparent' : 'color-mix(in srgb, var(--accent) 14%, transparent)',
        color: on ? 'var(--muted)' : 'var(--text)',
        fontSize: '0.75rem',
        fontWeight: 700,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          width: 34,
          height: 20,
          borderRadius: 10,
          flex: 'none',
          background: on ? 'var(--accent)' : 'var(--border-strong)',
          transition: 'background .16s ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: on ? 17 : 3,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left .16s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,.35)',
          }}
        />
      </span>
      속도 제한 {on ? '켬' : '끔'}
    </button>
  );
}
