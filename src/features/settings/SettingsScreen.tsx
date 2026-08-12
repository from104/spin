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
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSettings } from '../../store/settings/SettingsProvider.tsx';
import { useLibrary } from '../../store/library/LibraryProvider.tsx';
import { loadPrefs } from '../../storage/prefs.ts';
import { Modal } from '../../ui/Modal.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { bumperKmhMax, prunePhysics } from '../../storage/prefs.ts';
import { TEAM_COLOR_CHOICES, inkFor } from '../../core/colors.ts';
import { FORMATIONS } from '../../model/defaults.ts';
import { COURT_MODES, type CourtMode } from '../../model/court.ts';
import { Segmented } from '../../ui/Segmented.tsx';
import { Toggle } from '../../ui/Toggle.tsx';
import { Button } from '../../ui/Button.tsx';
import { IconCheck } from '../../ui/icons.tsx';
import { backupReportLine, restoreBackupFromFile } from './dataExport.ts';

const COLOR_NAMES: Record<string, string> = {
  '#d93a3a': '빨강',
  '#1f6bb8': '파랑',
  '#e08a12': '주황',
  '#7c5cd6': '보라',
};

const COURT_MODE_SHORT_LABELS: Record<CourtMode, string> = { full: '풀', half: '하프', flat: '플랫' };

export function SettingsScreen() {
  const { prefs, physics, persistFailed, setPrefs } = useSettings();
  const { refresh } = useLibrary();
  const toast = useToast();

  // ── §6.1b 기기 이사 파일 읽기 ────────────────────────────────────────────────────────────
  // 고른 파일을 곧바로 복원하지 않는다. 복원은 남의 기기 내용을 이 기기에 섞는 일이고, 그중
  // **설정 복원은 되돌릴 수 없는 접근성 사고**가 될 수 있어서(largeTargets·uiScale 이 말없이
  // 바뀐다) 반드시 한 번 묻는다. 그 물음이 곧 체크박스 하나짜리 모달이다.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [withPrefs, setWithPrefs] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const restoreBtnRef = useRef<HTMLButtonElement | null>(null);
  const restoreDialogId = useId();

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

  const runRestore = async () => {
    const file = pendingFile;
    if (!file || restoring) return;
    setRestoring(true);
    try {
      const report = await restoreBackupFromFile(file, { prefs: withPrefs ? 'replace' : 'skip' });
      // ★ 목록을 다시 읽는다. LibraryProvider 는 앱 최상단에서 한 번만 로드하므로(App.tsx),
      //   빼면 IDB 에는 들어왔는데 목록에는 새로고침 전까지 안 뜬다 = "복원이 안 된 것" 으로 보인다.
      await refresh();
      // ★ 설정을 덮었다면 React 상태도 저장소에서 다시 읽어야 한다. 안 그러면 화면은 옛 값을
      //   보여주고, 그 상태에서 스위치 하나만 건드려도 **방금 복원한 설정이 통째로 되돌아간다**
      //   (setPrefs 가 화면의 옛 prefs 위에 패치를 얹어 저장하기 때문).
      if (report.prefs === 'restored') setPrefs(loadPrefs());
      toast.show(backupReportLine(report));
    } catch (e) {
      toast.show(e instanceof Error && e.message.length > 0 ? e.message : '기기 이사 파일을 읽지 못했습니다.');
    } finally {
      setRestoring(false);
      setPendingFile(null);
      setWithPrefs(false);
    }
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
          <Row title="큰 터치 타깃" desc="버튼·트레이 칩·코트 위 집기 반경이 44 → 56px 로 커집니다(글자 크기는 UI 배율이 담당)">
            <Toggle checked={prefs.a11y.largeTargets} onChange={(v) => setPrefs({ a11y: { ...prefs.a11y, largeTargets: v } })} ariaLabel="큰 터치 타깃" />
          </Row>
          <Row title="놓임 소리·진동" desc="개체를 놓거나 막히거나 트레이로 되돌릴 때 짧은 소리와 진동으로 알립니다">
            <Toggle checked={prefs.a11y.sound} onChange={(v) => setPrefs({ a11y: { ...prefs.a11y, sound: v } })} ariaLabel="놓임 소리·진동" />
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

        {/* §6.1b/§6.4 — **내보내기는 여기 없다.** [보드] 하단 [내보내기] 하나로 모았다(2026-08-12,
            4.7). 옛 '드릴 내보내기' 는 목록 화면에도 같은 버튼이 있던 중복이었고, 담기는 것이
            드릴뿐이라 세션·설정·전술판이 어떤 파일에도 안 들어가는 **거짓 백업**이었다.
            남은 것은 그 파일을 다시 여는 길이다. */}
        <Section title="데이터" desc="기기 이사 파일은 [보드] 화면 아래 [내보내기] → [기기 이사 파일]에서 만듭니다.">
          <Row title="기기 이사 파일 읽기" desc="다른 기기에서 만든 SPIN 백업(.spin.json)을 이 기기로 가져옵니다" borderBottom={false}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = ''; // 같은 파일을 다시 골라도 change 가 오게 한다
                if (f) setPendingFile(f);
              }}
            />
            <Button ref={restoreBtnRef} variant="secondary" onClick={() => fileInputRef.current?.click()}>
              파일 고르기
            </Button>
          </Row>
        </Section>

        <div style={{ textAlign: 'center', fontSize: '0.71875rem', color: 'var(--faint-text)', paddingTop: 4, lineHeight: 1.6 }}>
          SPIN · Strategy Planner for INclusive football
        </div>
      </div>

      <Modal
        open={pendingFile !== null}
        onClose={() => {
          setPendingFile(null);
          setWithPrefs(false);
        }}
        titleId={restoreDialogId}
        title="이 파일을 읽을까요?"
        returnFocusRef={restoreBtnRef}
      >
        <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', lineHeight: 1.6 }}>
          <strong>{pendingFile?.name}</strong>
          <br />
          드릴과 세션은 <strong>사본으로 추가</strong>됩니다 — 이 기기에 있는 것은 지워지지 않습니다.
        </p>
        {/* ⚠️ 기본값은 **꺼짐**이다(storage/transfer.ts RestoreBackupOptions 의 근거). 백업 파일은
            드릴을 얻으려고 남에게서 받는 경우가 기기 이사만큼 흔한데, 그때 설정을 통째로 덮으면
            큰 표적·UI 배율·단일키 단축키가 말없이 바뀐다 — 이 앱 주 사용자에게는 접근성 사고다.
            그래서 그 사실을 체크박스 옆 문구로 **화면에 드러낸다**(4.1 이 4.7 에 넘긴 요구). */}
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={withPrefs}
            onChange={(e) => setWithPrefs(e.target.checked)}
            style={{ marginTop: 3, width: 18, height: 18, flex: 'none' }}
          />
          <span style={{ fontSize: '0.78125rem', lineHeight: 1.6 }}>
            설정도 함께 복원
            <span style={{ display: 'block', color: 'var(--faint-text)', fontSize: '0.71875rem' }}>
              끄면 이 기기의 테마·UI 배율·큰 터치 타깃 같은 설정이 그대로 유지됩니다. 기기를 옮기는 중이라면 켜세요.
            </span>
          </span>
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button
            variant="secondary"
            onClick={() => {
              setPendingFile(null);
              setWithPrefs(false);
            }}
          >
            취소
          </Button>
          <Button variant="primary" aria-disabled={restoring} onClick={() => void runRestore()}>
            {restoring ? '읽는 중…' : '읽기'}
          </Button>
        </div>
      </Modal>
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
