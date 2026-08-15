// 오른쪽 기능 바 — 자유 전술판의 **앱 조작을 한 기둥으로 모은 자리**(기현 지시 2026-08-14).
//
// ── 왜 만들었는가 ────────────────────────────────────────────────────────────────────
// 같은 성격의 조작이 화면 세 곳에 흩어져 있었다:
//   · 헤더 우측  — 코트 형태 3단 세그먼트
//   · 하단 바    — [코트 비우기] · [내보내기] · 속도 제한 · [보기▾] · [속성]
//   · 속성 패널  — 코트 크기 3단 · [골대 원위치]
// 기현님 지시: *"상단의 코트 형태 선택, 하단의 코트비우기, 내보내기, 속도 제한 등 하나로
// 합쳐서 오른쪽 사이드에 아이콘으로(이름 2~4자 표시, 긴 설명은 툴팁으로) 일괄 배치"*.
//
// 판의 **물리적 부품**(칩·작도·메모)은 트레이가 갖고, 판을 **다루는 앱 기능**은 여기가 갖는다.
// 이 경계가 옛 "기둥 = 부품 / 하단 바 = 앱 크롬" 판단과 같은 선이다 — 달라진 것은 앱 크롬이
// 아래가 아니라 **옆**에 선다는 것뿐이고, 그래야 트레이가 코트 긴 변으로 옮겨 다녀도
// (가로 코트면 아래, 세로 코트면 오른쪽) 이 바는 자리가 안 흔들린다.
//
// ── 왜 팝오버 둘을 남겼는가([코트]·[보기]) ─────────────────────────────────────────────
// 형태 3 + 크기 3 을 펼치면 그것만으로 표적이 6 이고, 격자·골 지역 가이드·도움말까지 펴면 9 다.
// 11칸 기둥이 20칸이 되면 §3 불변식 1(절대 위치로 만드는 공간 기억)이 먼저 무너진다.
// **한 번 정해 놓고 자주 안 바꾸는 것**만 접었다 — 자주 쓰는 줌·이력·비우기·내보내기는 상시다.
//
// ── 이름 규칙(WCAG 2.5.3 Label in Name) ──────────────────────────────────────────────
// 화면 글자는 **반드시 aria-label 의 부분 문자열**이어야 한다. 음성 제어 사용자가 보이는 글자를
// 그대로 불렀을 때 그 버튼이 눌려야 하기 때문이다. 그래서 '줌 초기화' 의 화면 글자는 '초기화'
// (부분 문자열 ✓)이지 '원배율'(✗)이 아니다. 새 항목을 더할 때 이 규칙을 먼저 확인하라.
import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import {
  IconClear,
  IconExport,
  IconEye,
  IconBoard,
  IconGoalReset,
  IconRedo,
  IconSaveDrill,
  IconSides,
  IconSpeed,
  IconUndo,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
} from '../../ui/icons.tsx';
import { Modal } from '../../ui/Modal.tsx';
import { Button } from '../../ui/Button.tsx';
import { ExportSheet } from '../export/ExportSheet.tsx';
import { COURT_DEFS, COURT_SIZE_LABELS, COURT_SIZES, courtDefFor, type CourtMode, type CourtSize } from '../../model/court.ts';
import type { Drill, TeamSide, TeamStyle } from '../../model/drill.ts';
import { useSettingsActions, useSettingsState } from '../../store/settings/SettingsProvider.tsx';
import { prunePhysics } from '../../storage/prefs.ts';

/** 바 한 칸. 높이를 `--hit` 로 **못박지 않고** min 으로 둔다 — 아이콘 위에 2~4자 이름이 서므로
 *  실제로는 그보다 조금 높다(44 기준 ≈46). 큰 터치 타깃(56)에서는 min 이 이긴다. */
const ITEM: CSSProperties = {
  width: 'var(--hit)',
  minHeight: 'var(--hit)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  padding: '3px 0',
  borderRadius: 10,
  border: '1px solid transparent',
  background: 'transparent',
  color: 'var(--muted)',
  flex: 'none',
};

/** 아이콘 아래 이름. 9px 은 **읽으라고 있는 글자가 아니라 자리를 찾으라고 있는 글자**다 —
 *  뜻은 아이콘이 지고, 이 줄은 "아까 그 자리" 를 눈으로 짚게 해 준다. 긴 설명은 title 이다. */
const ITEM_LABEL: CSSProperties = {
  fontSize: '0.5625rem',
  lineHeight: 1.1,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  whiteSpace: 'nowrap',
};

const DIVIDER: CSSProperties = {
  flex: 'none',
  alignSelf: 'stretch',
  height: 1,
  margin: '4px 10px',
  background: 'var(--border)',
};

/** 팝오버 안의 한 줄. 트레이 서랍·[보기] 메뉴와 같은 리듬이다. */
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

function BarItem({
  label,
  name,
  title,
  onClick,
  disabled,
  active,
  accent,
  buttonRef,
  children,
  ...aria
}: {
  /** 화면에 보이는 2~4자. **`name` 의 부분 문자열이어야 한다**(머리말 이름 규칙). */
  label: string;
  /** 접근성 이름(aria-label). */
  name: string;
  /** 긴 설명 — 툴팁. */
  title: string;
  onClick(): void;
  disabled?: boolean;
  active?: boolean;
  /** 주 액션 — 기둥에서 **하나뿐**이다. 둘이 되는 순간 어느 것도 주가 아니게 된다. */
  accent?: boolean;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
  'aria-haspopup'?: 'dialog';
  'aria-expanded'?: boolean;
}) {
  return (
    <button
      type="button"
      ref={buttonRef}
      aria-label={name}
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...ITEM,
        color: accent ? 'var(--accent-ink-strong)' : active ? 'var(--accent-text)' : 'var(--muted)',
        borderColor: accent ? 'var(--accent)' : active ? 'var(--accent)' : 'transparent',
        background: accent
          ? 'var(--accent)'
          : active
            ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
            : 'transparent',
        opacity: disabled ? 0.4 : 1,
      }}
      {...aria}
    >
      {children}
      <span aria-hidden style={ITEM_LABEL}>
        {label}
      </span>
    </button>
  );
}

export interface FunctionBarProps {
  onZoomIn(): void;
  onZoomOut(): void;
  onZoomReset(): void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
  /** 코트 형태·크기. 판이 비어 있을 때만 바꿀 수 있다(D12 — 규격이 달라 배치를 옮겨 담을 수 없다). */
  courtMode: CourtMode;
  courtSize: CourtSize;
  courtLocked: boolean;
  onCourtModeChange(mode: CourtMode): void;
  onCourtSizeChange(size: CourtSize): void;
  onLockedAttempt(): void;
  onResetGoals(): void;
  /** 진영 — `ruleZones[0]`(풀=왼쪽 골, 하프=유일한 골)을 지키는 팀. 골 지역 3인 반칙이 이
   *  값을 따라 **수비 팀에만** 걸린다(2026-08-15 기현 지시). */
  defense: TeamSide;
  teams: Record<TeamSide, TeamStyle>;
  /** 한 번 누르면 두 팀이 자리를 맞바꾼다. **플랫 코트에서는 비활성**이다 — 골 지역이 없어
   *  진영이라는 개념 자체가 없다. */
  onToggleDefense(): void;
  onReset(): void;
  /** 내보내기 시트가 굽는 것은 지금 리듀서가 든 판이다(물리 세계가 아니라 모델). */
  drill: Drill;
  showGrid: boolean;
  onToggleGrid(): void;
  showRuleZones: boolean;
  onToggleRuleZones(): void;
  onShowHelp(): void;
  /** 자유 전술판을 드릴 라이브러리에 새 항목으로 넣는다 — 옛 헤더의 주 액션이었다.
   *  2026-08-14 기현님 지시로 헤더가 넓은 창에서 사라지면서 갈 곳이 여기밖에 없었다. */
  onSaveAsDrill(): void;
  /** 도움말이 닫힐 때 돌아올 곳 — EditorWorkspace 가 helpTriggerRef 에 꽂는다. */
  viewButtonRef?: RefObject<HTMLButtonElement | null>;
}

export function FunctionBar({
  onZoomIn,
  onZoomOut,
  onZoomReset,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  courtMode,
  courtSize,
  courtLocked,
  onCourtModeChange,
  onCourtSizeChange,
  onLockedAttempt,
  onResetGoals,
  defense,
  teams,
  onToggleDefense,
  onReset,
  drill,
  showGrid,
  onToggleGrid,
  showRuleZones,
  onToggleRuleZones,
  onShowHelp,
  onSaveAsDrill,
  viewButtonRef,
}: FunctionBarProps) {
  const [courtOpen, setCourtOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const courtId = useId();
  const viewId = useId();
  const confirmId = useId();
  const courtBtnRef = useRef<HTMLButtonElement | null>(null);
  const localViewRef = useRef<HTMLButtonElement | null>(null);
  const clearBtnRef = useRef<HTMLButtonElement | null>(null);
  const exportBtnRef = useRef<HTMLButtonElement | null>(null);
  const firstCourtRef = useRef<HTMLButtonElement | null>(null);
  const firstViewRef = useRef<HTMLButtonElement | null>(null);
  const viewBtnRef = viewButtonRef ?? localViewRef;

  const { prefs, physics } = useSettingsState();
  const { setPrefs } = useSettingsActions();
  const speedLimit = physics.speedLimit;

  // 메뉴로 쓰는 Modal 은 열면 [닫기](DOM 순서상 앞)에 포커스가 간다 — 한 칸을 더 움직여야 하는
  // 것은 발 마우스 사용자에게 그냥 비용이다. 자식(Modal) 이펙트가 먼저, 부모(여기)가 나중에
  // 돌므로 이 두 줄이 마지막 말이 된다(ViewControls 가 간 길과 같다).
  useEffect(() => {
    if (courtOpen) firstCourtRef.current?.focus({ preventScroll: true });
  }, [courtOpen]);
  useEffect(() => {
    if (viewOpen) firstViewRef.current?.focus({ preventScroll: true });
  }, [viewOpen]);

  const def = courtDefFor(courtMode, courtSize);
  const toggleStyle = (on: boolean): CSSProperties => ({
    ...MENU_ITEM,
    color: on ? 'var(--accent-text)' : 'var(--text)',
    borderColor: on ? 'var(--accent)' : 'var(--border)',
  });

  return (
    // ⚠️ `flexWrap:'wrap'` + `height:'100%'` — 칸이 세로로 안 들어가면 **둘째 열로 흐른다.**
    // 스크롤이 아니라 wrap 인 이유: 스크롤러에 넣으면 모든 표적 위치가 스크롤 오프셋의 함수가
    // 되고(§3 불변식 1), 무엇보다 [코트 비우기]·[내보내기]가 화면 밖으로 나가 **영영 못 닿는
    // 자리**가 생긴다(trayMetrics 의 위험 3 이 트레이에서 막은 것과 같은 사고다).
    // 1024×600·hit 44 에서 11칸 = 506 + 구분선 27 + 패딩 26 = 559 > main 높이 548 이므로
    // 그 화면은 이미 2열이다. 실측이 아니라 계산이지만, wrap 이면 어느 쪽이든 안 잘린다.
    <nav
      aria-label="판 조작"
      data-function-bar=""
      style={{
        flex: 'none',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        flexWrap: 'wrap',
        alignContent: 'flex-start',
        alignItems: 'center',
        gap: 2,
        padding: '13px 6px',
        borderLeft: '1px solid var(--border)',
        background: 'var(--panel)',
      }}
    >
      <BarItem label="확대" name="확대" title="판을 크게 봅니다 (Ctrl/⌘ +, 코트 위에서 휠 위로)" onClick={onZoomIn}>
        <IconZoomIn />
      </BarItem>
      <BarItem label="축소" name="축소" title="판을 작게 봅니다 (Ctrl/⌘ −, 코트 위에서 휠 아래로)" onClick={onZoomOut}>
        <IconZoomOut />
      </BarItem>
      <BarItem label="초기화" name="줌 초기화" title="배율과 화면 이동을 처음 상태로 (Ctrl/⌘ 0)" onClick={onZoomReset}>
        <IconZoomReset />
      </BarItem>

      <div aria-hidden style={DIVIDER} />

      {/* 못 되돌릴 때도 **사라지지 않고** disabled 다 — 사라지면 아래 칸 좌표가 통째로 움직인다. */}
      <BarItem label="되돌" name="되돌리기" title="마지막 조작을 되돌립니다 (Ctrl/⌘ Z)" onClick={onUndo} disabled={!canUndo}>
        <IconUndo size={18} />
      </BarItem>
      <BarItem label="다시" name="다시하기" title="되돌린 조작을 다시 합니다 (Ctrl/⌘ Shift Z)" onClick={onRedo} disabled={!canRedo}>
        <IconRedo size={18} />
      </BarItem>

      <div aria-hidden style={DIVIDER} />

      <BarItem
        label="코트"
        name="코트 형태와 크기"
        title={`${def.label} — ${def.desc}`}
        buttonRef={courtBtnRef}
        aria-haspopup="dialog"
        aria-expanded={courtOpen}
        onClick={() => setCourtOpen(true)}
      >
        <IconBoard size={18} />
      </BarItem>
      <BarItem
        label="골대"
        name="골대 원위치"
        title="휠체어에 밀린 골대를 제자리로 되돌립니다. 판의 다른 것은 건드리지 않습니다."
        onClick={onResetGoals}
      >
        <IconGoalReset />
      </BarItem>
      {/* 진영 — 골 지역 3인 반칙이 어느 팀에 걸리는지를 정한다. 화면의 골라인 뒤 점 둘
          (SideMarks)이 이 값을 그리고, 이 버튼이 그것을 뒤집는다.
          ⚠️ 플랫 코트는 `disabled` 다(존이 없다). `aria-disabled`+토스트가 아니라 네이티브
             disabled 인 이유: 코트 형태 잠금과 달리 여기엔 **설명할 이유가 없다** — 플랫에는
             골이 없다는 것이 판을 보면 그대로 보인다. */}
      <BarItem
        label="진영"
        name={`진영 바꾸기. 지금 ${teams[defense].label} 이(가) ${courtMode === 'half' ? '골' : '왼쪽 골'}`}
        title={
          courtMode === 'flat'
            ? '플랫 코트에는 골 지역이 없어 진영이 없습니다.'
            : `골 지역 3인 반칙은 **수비 팀에만** 걸립니다. 지금 ${courtMode === 'half' ? '골' : '왼쪽 골'}을 지키는 팀은 ${teams[defense].label} 입니다.`
        }
        disabled={courtMode === 'flat'}
        onClick={onToggleDefense}
      >
        <IconSides />
      </BarItem>
      <BarItem
        label="비우기"
        name="코트 비우기"
        title="코트 위의 선수·공·콘·화살표·메모를 모두 지웁니다. 되돌릴 수 없습니다."
        buttonRef={clearBtnRef}
        aria-haspopup="dialog"
        onClick={() => setConfirmOpen(true)}
      >
        <IconClear />
      </BarItem>

      <div aria-hidden style={DIVIDER} />

      <BarItem
        label="내보내기"
        name="내보내기"
        title="판을 인쇄하거나 이미지·백업 파일로 꺼냅니다."
        buttonRef={exportBtnRef}
        aria-haspopup="dialog"
        onClick={() => setExportOpen(true)}
      >
        <IconExport />
      </BarItem>
      {/* 속도 제한은 **켬이 기본이자 사실적인 상태**다. 꺼졌을 때를 강조한다 — 제한을 푼 채로
          두고 왜 빠른지 모르는 상황이 더 나쁘다(옛 SpeedLimitSwitch 의 그 판단 그대로). */}
      <BarItem
        label="속도"
        name={`개체 이동 속도 제한 ${speedLimit ? '켬' : '끔'}`}
        title={
          speedLimit
            ? '실제 파워체어 속도(10 km/h)로 움직입니다. 끄면 포인터를 즉시 따라옵니다.'
            : '개체가 포인터를 즉시 따라옵니다. 켜면 실제 파워체어 속도로 움직입니다.'
        }
        active={!speedLimit}
        onClick={() => setPrefs({ physics: prunePhysics({ ...prefs.physics, speedLimit: !speedLimit }) })}
      >
        <IconSpeed />
      </BarItem>
      <BarItem
        label="보기"
        name="보기"
        title="격자 · 골 지역 가이드 · 도움말"
        buttonRef={viewBtnRef}
        aria-haspopup="dialog"
        aria-expanded={viewOpen}
        onClick={() => setViewOpen(true)}
      >
        <IconEye />
      </BarItem>

      <div aria-hidden style={DIVIDER} />

      {/* 주 액션 — 옛 헤더의 [드릴로 저장]. 유일하게 **액센트로 칠한** 칸이고 기둥 맨 끝이다:
          맨 위는 줌이 이미 자리를 잡았고(손이 늘 가 있다), 새 칸을 위에 끼우면 아래 열한 칸의
          좌표가 통째로 밀린다(§3 불변식 1). 끝에 붙이면 아무것도 안 움직인다. */}
      <BarItem
        label="저장"
        name="드릴로 저장"
        title="지금 판을 드릴 라이브러리에 새 항목으로 넣습니다. 전술판은 그대로 남습니다."
        onClick={onSaveAsDrill}
        accent
      >
        <IconSaveDrill />
      </BarItem>

      {/* ── 코트 팝오버 — 형태 3 + 크기 3 ───────────────────────────────────────────── */}
      <Modal open={courtOpen} onClose={() => setCourtOpen(false)} titleId={courtId} title="코트" returnFocusRef={courtBtnRef}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 잠금은 **이름**으로도 말한다 — 옛 헤더 세그먼트의 계약 그대로다(`코트 형태` ↔
              `코트 형태(변경 불가)`). 화면에는 아래 문구가 있지만, 스크린리더로 구역에 들어온
              사람은 문구를 읽기 전에 이름부터 듣는다. */}
          <div
            role="radiogroup"
            aria-label={courtLocked ? '코트 형태(변경 불가)' : '코트 형태'}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {(['full', 'half', 'flat'] as const).map((m, i) => {
              const d = COURT_DEFS[m];
              const on = courtMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  ref={i === 0 ? firstCourtRef : undefined}
                  aria-checked={on}
                  // ⚠️ 네이티브 `disabled` 가 아니라 `aria-disabled` + 토스트다 — 키보드·스크린
                  // 리더 사용자도 **왜 안 되는지**를 들을 수 있어야 한다(§6.10 공 도구와 같은 패턴).
                  aria-disabled={courtLocked || undefined}
                  aria-label={d.label}
                  title={d.desc}
                  onClick={() => {
                    if (on) return;
                    // 잠겼으면 **바꾸지 않고 이유를 말한다.** disabled 로 두면 왜 안 되는지가
                    // 화면 어디에도 안 남는다(옛 헤더 세그먼트의 onLockedAttempt 와 같은 규율).
                    if (courtLocked) {
                      onLockedAttempt();
                      return;
                    }
                    setCourtOpen(false);
                    onCourtModeChange(m);
                  }}
                  style={toggleStyle(on)}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

          {/* 크기 3단은 **풀 코트에서만 뜻이 있다** — 하프·플랫은 값을 들고 다니되 판을 안 바꾼다
              (court.ts COURT_DEFS 근거). 그때 고르게 두면 판이 거짓말을 하므로 사실을 적는다. */}
          {courtMode !== 'full' ? (
            <p style={{ fontSize: '0.75rem', color: 'var(--faint-text)', lineHeight: 1.6 }}>
              현재 크기 {COURT_SIZE_LABELS[courtSize]} — 코트 크기 3단은 풀 코트에만 적용됩니다.
            </p>
          ) : courtLocked ? (
            // ⚠️ **잠기면 버튼을 안 낸다.** 형태 셋과 다른 이유: 형태는 눌러 보고 이유를 듣는
            // 것이 옛 헤더 세그먼트의 계약이었고(onLockedAttempt), 크기는 옛 인스펙터에서
            // *"골라도 안 변하는 컨트롤은 거짓말이다"* 라는 반대 계약을 갖고 있었다. 두 계약을
            // 한쪽으로 통일하지 않는 이유: 각자 그 자리에서 실기로 정해진 것이고, 여기서
            // 바꾸면 이번 이사가 **동작까지** 바꾸는 것이 된다. 값은 계속 보인다 — 못 바꾸는
            // 것과 안 보이는 것은 다르다.
            <p style={{ fontSize: '0.75rem', color: 'var(--faint-text)', lineHeight: 1.6 }}>
              현재 크기 {COURT_SIZE_LABELS[courtSize]} — 코트 크기를 바꾸려면 먼저 코트를 비우세요.
            </p>
          ) : (
            <div role="radiogroup" aria-label="코트 크기" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {COURT_SIZES.map((s) => {
                const on = courtSize === s;
                const d = courtDefFor('full', s);
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`코트 크기 ${COURT_SIZE_LABELS[s]}`}
                    title={d.desc}
                    onClick={() => {
                      if (on) return;
                      setCourtOpen(false);
                      onCourtSizeChange(s);
                    }}
                    style={toggleStyle(on)}
                  >
                    {/* 치수만 적으면 무엇이 표준인지 알 수 없다 — 규정상의 이름을 함께 낸다. */}
                    {COURT_SIZE_LABELS[s]}
                  </button>
                );
              })}
            </div>
          )}

          <p style={{ fontSize: '0.75rem', color: 'var(--faint-text)', lineHeight: 1.6, marginTop: 4 }}>
            {courtLocked
              ? '코트를 바꾸려면 먼저 판을 비우세요 — 규격이 달라 배치를 옮겨 담을 수 없습니다.'
              : '지금은 코트를 자유롭게 바꿀 수 있습니다.'}
          </p>
        </div>
      </Modal>

      {/* ── 보기 팝오버 — 격자 · 골 지역 가이드 · 도움말 ──────────────────────────────── */}
      <Modal open={viewOpen} onClose={() => setViewOpen(false)} titleId={viewId} title="보기" returnFocusRef={viewBtnRef}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            ref={firstViewRef}
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
              // 순서가 계약이다 — 팝오버를 **먼저 닫아야** Esc 가 도움말을 닫는다. 두 Modal 이
              // 겹치면 Esc 는 안쪽이 아니라 먼저 등록된 바깥쪽을 닫는다(둘 다 document 캡처).
              setViewOpen(false);
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

      {/* ── 비우기 확인 ─────────────────────────────────────────────────────────────── */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} titleId={confirmId} title="코트를 비울까요?" returnFocusRef={clearBtnRef}>
        <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', lineHeight: 1.6 }}>
          코트 위의 선수·공·콘·화살표·메모가 모두 사라집니다. <strong>되돌릴 수 없습니다.</strong>
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

      {/* ⚠️ 시트는 **닫혀 있어도 마운트된 채**여야 한다 — [인쇄]를 고르면 시트가 닫히고 인쇄
          트리(PrintRoot)는 이 안에 산다. 조건부로 렌더하면 백지가 인쇄된다. 닫힌 시트의 표적은 0 이다. */}
      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        drill={drill}
        stepIndex={0}
        showGrid={showGrid}
        showRuleZones={showRuleZones}
        returnFocusRef={exportBtnRef}
      />
    </nav>
  );
}
