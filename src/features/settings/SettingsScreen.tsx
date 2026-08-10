// §4.6(설정)·§6.8(화면 골격)·§7.4(uiScale) — 설정 화면. 마크업은 docs/prototype/template.html
// 512–595행("설정 / SETTINGS")을 뼈대로 삼되, 정적 sc-for 목데이터 대신 SettingsProvider 의
// 실제 prefs 로 채우고, 프로토타입에 없던 물리 파라미터·UI 배율·접근성 3종·상대 팀 색상 행을
// DESIGN.md §4.6/§7.3/§7.4/§7.5/§7.8 요구대로 추가한다.
//
// 이 화면은 §8 표대로 app-shell 을 import 하지 않는다 — 헤더(제목·부제)는 app-shell 의
// useStaticHeaderConfig 가 정적으로 채운다(AppShell.tsx "settings 도... 마찬가지로 정적 헤더를
// 받는다"). `<main id="main" tabIndex={-1}>` 는 §7.5a 대로 이 화면이 직접 렌더한다.
//
// 부트 스크립트(index.html)가 심어 둔 테마와 App.tsx 의 ThemeEffects 가 uiScale·큰 터치 타깃
// 부작용을 이미 처리하므로(§4.6/§7.4), 이 화면은 prefs 를 쓰기만 하면 된다 — 별도로
// document.documentElement 를 건드리지 않는다.
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useSettings } from '../../store/settings/SettingsProvider.tsx';
import { useLibrary } from '../../store/library/LibraryProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { bumperKmhMax, prunePhysics } from '../../storage/prefs.ts';
import { TEAM_COLOR_CHOICES, inkFor } from '../../core/colors.ts';
import { FORMATIONS } from '../../model/defaults.ts';
import { COURT_MODES, type CourtMode } from '../../model/court.ts';
import { Segmented } from '../../ui/Segmented.tsx';
import { Toggle } from '../../ui/Toggle.tsx';
import { Button } from '../../ui/Button.tsx';
import { IconCheck } from '../../ui/icons.tsx';
import { exportAllDrillsToFile } from './dataExport.ts';

const COLOR_NAMES: Record<string, string> = {
  '#d93a3a': '빨강',
  '#1f6bb8': '파랑',
  '#e08a12': '주황',
  '#7c5cd6': '보라',
};

const COURT_MODE_SHORT_LABELS: Record<CourtMode, string> = { full: '풀', half: '하프', flat: '플랫' };

export function SettingsScreen() {
  const { prefs, physics, persistFailed, setPrefs } = useSettings();
  const { drills } = useLibrary();
  const toast = useToast();

  // savePrefs 가 처음 실패한 순간(Safari 프라이빗 모드 등)에만 1회 안내한다(§4.6).
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (persistFailed && !notifiedRef.current) {
      notifiedRef.current = true;
      toast.show('설정이 이 탭에서만 유지됩니다.');
    }
  }, [persistFailed, toast]);

  const patchZone = (key: 'sTowRearMax' | 'sSpinMin' | 'sTowFrontMin', value: number) => {
    const zones = { ...(prefs.physics.zones ?? {}), [key]: value };
    setPrefs({ physics: prunePhysics({ ...prefs.physics, zones }) });
  };
  const patchSpeed = (key: 'linearKmh' | 'bumperKmh' | 'editorSpeedMultiplier', value: number) => {
    setPrefs({ physics: prunePhysics({ ...prefs.physics, [key]: value }) });
  };
  const restorePhysicsDefaults = () => setPrefs({ physics: {} });

  const handleExportAll = async () => {
    if (drills.length === 0) {
      toast.show('내보낼 드릴이 없습니다.');
      return;
    }
    const n = await exportAllDrillsToFile(drills.map((d) => d.id));
    toast.show(n > 0 ? `드릴 ${n}개를 내보냈습니다.` : '내보낼 드릴이 없습니다.');
  };

  return (
    <main id="main" tabIndex={-1} style={{ flex: 1, overflowY: 'auto', outline: 'none', padding: '26px 30px 46px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Section title="화면">
          <Row title="테마" desc="체육관 조명에 맞춰 선택하세요">
            <Segmented
              ariaLabel="테마"
              value={prefs.theme}
              onChange={(v) => setPrefs({ theme: v })}
              options={[
                { value: 'dark', label: '다크' },
                { value: 'light', label: '라이트' },
              ]}
            />
          </Row>
          <Row title="격자 표시" desc="편집기 코트 위에 좌표 격자를 표시합니다">
            <Toggle checked={prefs.showGrid} onChange={(v) => setPrefs({ showGrid: v })} ariaLabel="격자 표시" />
          </Row>
          <Row title="격자 칸 라벨 표시" desc="격자 칸마다 좌표 이름을 함께 표시합니다">
            <Toggle checked={prefs.showGridLabels} onChange={(v) => setPrefs({ showGridLabels: v })} ariaLabel="격자 칸 라벨 표시" />
          </Row>
          <Row title="골 지역 가이드 표시" desc="최대 2인 규칙 영역을 코트에 강조">
            <Toggle checked={prefs.showRuleZones} onChange={(v) => setPrefs({ showRuleZones: v })} ariaLabel="골 지역 가이드 표시" />
          </Row>
          <Row title="UI 배율" desc="체육관 태블릿 등에서 화면 요소를 더 크게 봅니다" borderBottom={false}>
            <Segmented
              ariaLabel="UI 배율"
              value={String(prefs.a11y.uiScale) as '1' | '1.15' | '1.3'}
              onChange={(v) => setPrefs({ a11y: { ...prefs.a11y, uiScale: Number(v) as 1 | 1.15 | 1.3 } })}
              options={[
                { value: '1', label: '100%' },
                { value: '1.15', label: '115%' },
                { value: '1.3', label: '130%' },
              ]}
            />
          </Row>
        </Section>

        <Section title="재생">
          <Row title="스텝 전환 속도" desc="시연 시 자동 재생 간격">
            <Segmented
              ariaLabel="스텝 전환 속도"
              value={String(prefs.playbackSpeed) as '0.5' | '1' | '2'}
              onChange={(v) => setPrefs({ playbackSpeed: Number(v) as 0.5 | 1 | 2 })}
              options={[
                { value: '0.5', label: '0.5×' },
                { value: '1', label: '1.0×' },
                { value: '2', label: '2.0×' },
              ]}
            />
          </Row>
          <Row title="마지막 스텝에서 반복" desc="끝나면 처음 스텝으로 되돌아갑니다" borderBottom={false}>
            <Toggle checked={prefs.loop} onChange={(v) => setPrefs({ loop: v })} ariaLabel="마지막 스텝에서 반복" />
          </Row>
        </Section>

        <Section title="팀">
          <Row title="우리 팀 색상" desc="코트 위 칩에 적용됩니다">
            <TeamColorSwatches ariaLabel="우리 팀 색상" value={prefs.teams.home.color} otherValue={prefs.teams.away.color} onChange={(c) => setPrefs({ teams: { ...prefs.teams, home: { ...prefs.teams.home, color: c } } })} />
          </Row>
          <Row title="상대 팀 색상" desc="상대 팀 칩에 적용됩니다">
            <TeamColorSwatches ariaLabel="상대 팀 색상" value={prefs.teams.away.color} otherValue={prefs.teams.home.color} onChange={(c) => setPrefs({ teams: { ...prefs.teams, away: { ...prefs.teams.away, color: c } } })} />
          </Row>
          <Row title="기본 포메이션" desc="새 드릴 생성 시 초기 배치">
            <Segmented
              ariaLabel="기본 포메이션"
              value={prefs.defaultFormation}
              onChange={(v) => setPrefs({ defaultFormation: v })}
              options={FORMATIONS.map((f) => ({ value: f, label: f }))}
            />
          </Row>
          <Row title="기본 코트 모드" desc="새 드릴을 만들 때 코트 선택 화면에서 미리 강조 표시됩니다(선택은 매번 확인)" borderBottom={false}>
            <Segmented
              ariaLabel="기본 코트 모드"
              value={prefs.defaultCourtMode ?? 'ask'}
              onChange={(v) => setPrefs({ defaultCourtMode: v === 'ask' ? null : (v as CourtMode) })}
              options={[
                { value: 'ask', label: '항상 묻기' },
                ...COURT_MODES.map((m) => ({ value: m, label: COURT_MODE_SHORT_LABELS[m] })),
              ]}
            />
          </Row>
        </Section>

        <Section title="시연">
          <Row title="화면 꺼짐 방지" desc="시연 중 기기 화면이 자동으로 잠기지 않게 합니다">
            <Toggle
              checked={prefs.present.wakeLock}
              onChange={(v) => setPrefs({ present: { ...prefs.present, wakeLock: v } })}
              ariaLabel="화면 꺼짐 방지"
            />
          </Row>
          <Row title="자동 전체화면" desc="시연 화면으로 이동하면 자동으로 전체화면을 시도합니다" borderBottom={false}>
            <Toggle
              checked={prefs.present.autoFullscreen}
              onChange={(v) => setPrefs({ present: { ...prefs.present, autoFullscreen: v } })}
              ariaLabel="자동 전체화면"
            />
          </Row>
        </Section>

        <Section title="접근성">
          <Row title="큰 터치 타깃" desc="컨트롤의 히트 영역만 커집니다(시각 크기는 UI 배율이 담당)">
            <Toggle checked={prefs.a11y.largeTargets} onChange={(v) => setPrefs({ a11y: { ...prefs.a11y, largeTargets: v } })} ariaLabel="큰 터치 타깃" />
          </Row>
          <Row title="모션 줄이기" desc="전환 애니메이션을 줄입니다">
            <Segmented
              ariaLabel="모션 줄이기"
              value={prefs.a11y.reduceMotion}
              onChange={(v) => setPrefs({ a11y: { ...prefs.a11y, reduceMotion: v } })}
              options={[
                { value: 'system', label: '시스템 따름' },
                { value: 'always', label: '항상 켬' },
              ]}
            />
          </Row>
          <Row title="편집기 단축키" desc="문자 단일 키 단축키의 발화 오작동을 막습니다(음성 인식 등)" borderBottom={false}>
            <Segmented
              ariaLabel="편집기 단축키"
              value={prefs.a11y.singleKeyShortcuts}
              onChange={(v) => setPrefs({ a11y: { ...prefs.a11y, singleKeyShortcuts: v } })}
              options={[
                { value: 'on', label: '단일 키' },
                { value: 'modifier', label: '수식키 필요' },
                { value: 'off', label: '끔' },
              ]}
            />
          </Row>
        </Section>

        <Section title="물리" desc="휠체어 드래그 4존 경계와 속도 상한을 조정합니다. 값을 조정하면 이웃한 경계가 순서를 지키도록 자동으로 밀립니다.">
          <SliderRow
            label="후방 견인 경계"
            desc="이 지점 이하를 잡으면 후방 견인 존. 0 이면 차체 밖 가이드로만 견인한다"
            ariaLabel="후방 견인 경계"
            value={physics.zones.sTowRearMax}
            min={0}
            max={0.18}
            step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(v) => patchZone('sTowRearMax', v)}
          />
          <SliderRow
            label="제자리 회전 시작"
            desc="이 지점부터 제자리 회전 존"
            ariaLabel="제자리 회전 시작"
            value={physics.zones.sSpinMin}
            min={0.22}
            max={0.45}
            step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(v) => patchZone('sSpinMin', v)}
          />
          <SliderRow
            label="전방 견인 시작"
            desc="이 지점부터 전방 견인 존. 1 이면 차체 밖 가이드로만 견인한다"
            ariaLabel="전방 견인 시작"
            value={physics.zones.sTowFrontMin}
            min={0.6}
            max={1}
            step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(v) => patchZone('sTowFrontMin', v)}
          />
          <SliderRow
            label="전후진 속도 상한"
            desc="직선 이동·견인의 최고 속도"
            ariaLabel="전후진 속도 상한"
            value={physics.linearKmh}
            min={4}
            max={16}
            step={0.5}
            format={(v) => `${v.toFixed(1)} km/h`}
            onChange={(v) => patchSpeed('linearKmh', v)}
          />
          <SliderRow
            label="회전(앞범퍼) 속도 상한"
            desc="제자리 회전·견인 시 각속도의 최고 속도"
            ariaLabel="회전 속도 상한"
            value={physics.bumperKmh}
            min={10}
            max={bumperKmhMax(physics.linearKmh)}
            step={1}
            format={(v) => `${Math.round(v)} km/h`}
            onChange={(v) => patchSpeed('bumperKmh', v)}
          />
          <SliderRow
            label="편집 속도 배수"
            desc="드래그와 놓은 뒤 이어가기, 둘 다의 속도 상한에 곱해집니다"
            ariaLabel="편집 속도 배수"
            value={physics.editorSpeedMultiplier}
            min={1}
            max={4}
            step={0.5}
            format={(v) => `${v.toFixed(1)}배`}
            onChange={(v) => patchSpeed('editorSpeedMultiplier', v)}
            borderBottom={false}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, marginTop: 4, borderTop: '1px solid var(--border)' }}>
            <Button variant="secondary" onClick={restorePhysicsDefaults}>
              기본값으로 복원
            </Button>
          </div>
        </Section>

        <Section title="데이터">
          <Row title="드릴 내보내기" desc="전체 드릴을 JSON으로 저장해 팀과 공유" borderBottom={false}>
            <Button variant="secondary" aria-disabled={drills.length === 0} onClick={() => void handleExportAll()}>
              내보내기
            </Button>
          </Row>
        </Section>

        <div style={{ textAlign: 'center', fontSize: '0.71875rem', color: 'var(--faint-text)', paddingTop: 4, lineHeight: 1.6 }}>
          SPIN · Strategy Planner for INclusive football
        </div>
      </div>
    </main>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 15, background: 'var(--panel)', overflow: 'hidden' }}>
      <div style={{ padding: '15px 18px 13px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.84375rem', fontWeight: 700 }}>{title}</div>
        {desc && <div style={{ fontSize: '0.71875rem', color: 'var(--faint-text)', marginTop: 4, lineHeight: 1.5 }}>{desc}</div>}
      </div>
      <div style={{ padding: '6px 18px 16px', display: 'flex', flexDirection: 'column' }}>{children}</div>
    </section>
  );
}

function Row({ title, desc, children, borderBottom = true }: { title: string; desc?: string; children: ReactNode; borderBottom?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 0', borderBottom: borderBottom ? '1px solid var(--border)' : undefined, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 220px', minWidth: 180 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 650 }}>{title}</div>
        {desc && <div style={{ fontSize: '0.71875rem', color: 'var(--faint-text)', marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

interface SliderRowProps {
  label: string;
  desc?: string;
  ariaLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  borderBottom?: boolean;
}

function SliderRow({ label, desc, ariaLabel, value, min, max, step, format, onChange, borderBottom = true }: SliderRowProps) {
  return (
    <Row title={label} desc={desc} borderBottom={borderBottom}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 220px', minWidth: 200 }}>
        <input
          type="range"
          aria-label={ariaLabel}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, height: 'var(--hit)', accentColor: 'var(--accent)' }}
        />
        <span
          style={{
            flex: 'none',
            width: 76,
            textAlign: 'right',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.75rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {format(value)}
        </span>
      </div>
    </Row>
  );
}

interface TeamColorSwatchesProps {
  ariaLabel: string;
  value: string;
  otherValue: string;
  onChange: (c: string) => void;
}

/** §7.7 "팀 색 스와치 role=radio aria-checked... 선택 표시는 링 + 안쪽 체크 마크" ·
 *  §7.8 "상대가 이미 쓰는 색은 aria-disabled 처리". */
function TeamColorSwatches({ ariaLabel, value, otherValue, onChange }: TeamColorSwatchesProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const toast = useToast();
  const n = TEAM_COLOR_CHOICES.length;

  const moveFocus = (from: number, delta: number) => {
    let i = from;
    for (let step = 0; step < n; step++) {
      i = ((i + delta) % n + n) % n;
      if (TEAM_COLOR_CHOICES[i] !== otherValue) break;
    }
    refs.current[i]?.focus();
  };

  const pick = (c: string) => {
    if (c === otherValue) {
      toast.show('상대 팀과 같은 색은 선택할 수 없습니다.');
      return;
    }
    onChange(c);
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} style={{ display: 'flex', gap: 7, flex: 'none' }}>
      {TEAM_COLOR_CHOICES.map((c, i) => {
        const active = c === value;
        const disabled = c === otherValue;
        return (
          <button
            key={c}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-disabled={disabled || undefined}
            aria-label={`팀 색상: ${COLOR_NAMES[c] ?? c}`}
            tabIndex={active ? 0 : -1}
            onClick={() => pick(c)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                moveFocus(i, 1);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                moveFocus(i, -1);
              }
            }}
            style={{
              flex: 'none',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: disabled ? 0.4 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: c,
                border: active ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {active && <IconCheck size={14} style={{ color: inkFor(c) }} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
