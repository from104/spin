// §6.8/§6.10 "코트 선택(풀/하프/플랫)은 드릴 생성 시 1회, 이후에는 cloneToCourt 로만 전환".
// 프로토타입 template.html 211–234행("코트 종료 선택") 마크업을 그대로 이식한다.
import { COURT_DEFS, COURT_MODES, type CourtMode } from '../../model/court.ts';
import { CourtPreview } from '../../render/CourtPreview.tsx';
import { COURT_BG } from '../../core/colors.ts';

export interface CourtPickerProps {
  onPick(mode: CourtMode): void;
}

export function CourtPicker({ onPick }: CourtPickerProps) {
  return (
    <main
      id="main"
      tabIndex={-1}
      style={{
        flex: 1,
        overflowY: 'auto',
        outline: 'none',
        padding: '34px 30px 46px',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ maxWidth: 1000, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: 2.2,
              color: 'var(--accent-text)',
              marginBottom: 11,
            }}
          >
            COURT SETUP
          </div>
          <h1 style={{ fontSize: '1.5625rem', fontWeight: 800, letterSpacing: '-0.7px' }}>어떤 코트로 진행하십니까?</h1>
          <p style={{ fontSize: '0.84375rem', color: 'var(--muted)', marginTop: 8 }}>
            시작 직전에 한 번만 선택합니다. 이후에는 변경할 수 없습니다.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {COURT_MODES.map((mode) => (
            <CourtOption key={mode} mode={mode} onPick={() => onPick(mode)} />
          ))}
        </div>
      </div>
    </main>
  );
}

function CourtOption({ mode, onPick }: { mode: CourtMode; onPick(): void }) {
  const def = COURT_DEFS[mode];
  return (
    <button
      type="button"
      onClick={onPick}
      style={{
        border: '1px solid var(--border)',
        borderRadius: 16,
        background: 'var(--panel)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        textAlign: 'left',
        minHeight: 'var(--hit)',
      }}
    >
      <div style={{ height: 158, borderRadius: 11, background: COURT_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        <CourtPreview mode={mode} />
      </div>
      <div>
        <div style={{ fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '-0.2px' }}>{def.label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>{def.desc}</div>
      </div>
      <div style={{ marginTop: 'auto', fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.71875rem', fontWeight: 700, color: 'var(--faint-text)', letterSpacing: 0.5 }}>
        {def.dims}
      </div>
    </button>
  );
}
