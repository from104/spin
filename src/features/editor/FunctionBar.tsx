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
// ── 무엇을 접는가([코트] 모달 · [보기] 서랍) ─────────────────────────────────────────
// 형태 3 + 크기 3 + 진영을 펼치면 그것만으로 표적이 7 이고, 격자·골 지역 가이드까지 펴면 9 다.
// 11칸 기둥이 20칸이 되면 §3 불변식 1(절대 위치로 만드는 공간 기억)이 먼저 무너진다.
// **한 번 정해 놓고 자주 안 바꾸는 것**만 접었다 — 자주 쓰는 줌·이력·비우기·내보내기는 상시다.
//
// 접는 장치가 둘인 것은 **성격이 다르기 때문**이다(2026-08-16 기현 지시로 갈렸다):
//   · [코트] = **모달**. 형태·크기·진영은 "들어가서 → 정하고 → 나온다" 인 한 판의 설정이고,
//     서로 얽혀 있다(진영은 골 지역이 있어야 뜻이 있고, 골 지역은 형태가 정한다). 배경을 덮고
//     설명을 나란히 읽히는 편이 낫다.
//   · [보기] = **서랍**(플라이아웃, useFlyout). 격자·골 지역 가이드는 판을 보면서 켰다 껐다
//     하는 토글이라, 매번 배경을 덮고 포커스를 가두는 것이 과했다. 트레이의 [작도]·[설명]과
//     같은 장치이고, 기둥이 오른쪽이라 **왼쪽으로** 편다.
// [도움말]은 어느 쪽에도 안 접는다 — 길을 잃었을 때 여는 문을 메뉴 안에 넣으면 길찾기를 한 겹
// 더 시키는 셈이다. 그 한 칸은 [진영]이 [코트] 모달로 들어가며 되돌려받았다(칸 수 13 그대로).
//
// ── 이름 규칙(WCAG 2.5.3 Label in Name) ──────────────────────────────────────────────
// 화면 글자는 **반드시 aria-label 의 부분 문자열**이어야 한다. 음성 제어 사용자가 보이는 글자를
// 그대로 불렀을 때 그 버튼이 눌려야 하기 때문이다. 그래서 줌 되돌리기 칸의 이름은 '배율 100%'
// 이고 화면 글자가 '100%'(부분 문자열 ✓)다 — 글자만 '100%' 로 바꾸고 이름을 '줌 초기화' 로
// 두면 규칙이 깨진다. 새 항목을 더할 때 이 규칙을 먼저 확인하라.
import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode, RefObject } from 'react';
import {
  IconClear,
  IconDrillInfoEdit,
  IconExport,
  IconBoard,
  IconGoalReset,
  IconGrid,
  IconRedo,
  IconRuleZone,
  IconSaveDrill,
  IconSides,
  IconSpeed,
  IconUndo,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
} from '../../ui/icons.tsx';
import type { FlyoutHandleProps } from './useFlyout.ts';
import { KEYMAP } from '../../core/keymap.ts';
import { Modal } from '../../ui/Modal.tsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx';
import { ExportSheet } from '../export/ExportSheet.tsx';
import { OptionText } from '../../ui/OptionText.tsx';
import { COURT_DEFS, COURT_SIZE_LABELS, COURT_SIZES, courtDefFor, type CourtMode, type CourtSize } from '../../model/court.ts';
import type { Drill, TeamSide, TeamStyle } from '../../model/drill.ts';
import type { StepId } from '../../core/ids.ts';
import { useSettingsActions, useSettingsState } from '../../store/settings/SettingsProvider.tsx';
import { prunePhysics } from '../../storage/prefs.ts';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';

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

/** 단축키 글자는 **여기서 정하지 않는다** — `core/keymap.ts` 가 정본이다(그 파일 머리말).
 *  툴팁에 키를 손으로 적어 두면 키맵이 바뀔 때 화면만 옛말을 한다: 실제로 이 자리에 `#`·`Z`
 *  라고 적혀 있었는데 진짜 키는 `Alt+G`·`Alt+Z` 였다(2026-08-16 발견). */
const keyLabel = (id: string): string => KEYMAP.find((d) => d.id === id)?.label ?? '';

/** 절 제목 — 모달이 네 갈래가 되면서 필요해졌다(2026-08-27). 라디오그룹의 aria-label 과
 *  **같은 문자열**을 쓴다: 보는 사람과 듣는 사람이 같은 이름으로 그 절을 부르게 된다. */
/** 모달 안 보조 설명. **말할 것이 있을 때만** 쓴다 — 2026-08-27 지시로 "아무 일 없음" 을
 *  알리던 줄들을 지웠다. 남은 것은 셋뿐이다: 잠긴 사유 · 크기가 안 먹는 사실 · 지금 진영. */
const HINT: CSSProperties = { fontSize: '0.75rem', color: 'var(--faint-text)', lineHeight: 1.6, margin: 0 };

const SECTION_LABEL: CSSProperties = { fontSize: '0.75rem', fontWeight: 700, color: 'var(--faint-text)', margin: 0 };

/** 모달 안 토글 한 줄. 기둥의 `BarItem`(아이콘만) 과 달리 **글자를 함께** 놓는다 — 모달은
 *  좁지 않고, 여기 온 사람은 아이콘을 이미 아는 사람이 아니다. */
const MODAL_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 'var(--hit)',
  padding: '0 12px',
  borderRadius: 10,
  fontSize: '0.875rem',
  fontWeight: 600,
  textAlign: 'left',
};
const MODAL_ACTION: CSSProperties = { ...MODAL_ROW, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' };

function ModalToggle({ on, onClick, icon, text, hint }: { on: boolean; onClick(): void; icon: ReactNode; text: string; hint: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      title={hint}
      style={{
        ...MODAL_ROW,
        border: on ? '1.5px solid var(--accent)' : '1px solid var(--border)',
        background: on ? 'color-mix(in srgb, var(--accent) 12%, var(--panel))' : 'var(--panel)',
        color: on ? 'var(--accent-text)' : 'var(--text)',
      }}
    >
      <span aria-hidden style={{ display: 'flex' }}>
        {icon}
      </span>
      {text}
    </button>
  );
}

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
  ...rest
}: {
  /** 화면에 보이는 2~4자. **`name` 의 부분 문자열이어야 한다**(머리말 이름 규칙). */
  label: string;
  /** 접근성 이름(aria-label). */
  name: string;
  /** 긴 설명 — 툴팁. */
  title: string;
  onClick?(e: ReactMouseEvent): void;
  disabled?: boolean;
  active?: boolean;
  /** 주 액션 — 기둥에서 **하나뿐**이다. 둘이 되는 순간 어느 것도 주가 아니게 된다. */
  accent?: boolean;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
  'aria-haspopup'?: 'dialog';
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
  /** 켬/끔 토글일 때. `active` 는 **보이는 것**만 말하므로 상태는 이쪽이 따로 져야 한다. */
  'aria-pressed'?: boolean;
  // 서랍 손잡이(`useFlyout` 의 handleProps)를 그대로 펼쳐 넣기 위한 통로. hover 로 여는 서랍은
  // click 만으로는 못 만든다 — 그래서 이 넷이 필요하고, 그 넷을 여기서 다시 적지 않는다.
} & Partial<Omit<FlyoutHandleProps, 'onClick'>>) {
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
      {...rest}
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
  /** 한 번 누르면 두 팀이 자리를 맞바꾼다. 손잡이는 **[코트] 모달 안**이다(2026-08-16 이사).
   *  플랫 코트에서는 버튼 자체를 안 낸다 — 골 지역이 없어 진영이라는 개념이 없다. */
  onToggleDefense(): void;
  /** [비우기] — **지금 스텝**을 비운다(전술판은 스텝이 하나라 곧 판 전체다). */
  onReset(): void;
  /** [정보] — 드릴 정보 시트를 연다. **드릴 모드에만 있다**(전술판에는 메타가 없다). 없으면
   *  칸 자체를 안 그린다 — 자리를 비워 두지 않는다(§3 불변식 1 은 있는 칸의 좌표를 지키는
   *  규칙이지, 없는 기능의 자리를 지키라는 규칙이 아니다). */
  onDrillInfo?(): void;
  /** 지금 스텝이 이미 비었는가. [비우기]를 끄는 데 쓴다 — 눌러도 안 변할 버튼을 살려 두지
   *  않는다(이 모달의 크기 3단이 세운 계약과 같은 규율). */
  stepEmpty: boolean;
  /** 내보내기 시트가 굽는 것은 지금 리듀서가 든 판이다(물리 세계가 아니라 모델). */
  drill: Drill;
  /** 지금 편집 중인 스텝의 인덱스. **내보내기 시트가 "이 스텝" 을 알아야 한다.**
   *
   *  ⚠️ 2026-08-27 까지 여기 없었고, 시트 호출부가 `stepIndex={0}` 을 박아 두고 있었다 —
   *  드릴 편집에서 3번 스텝을 보며 [그림]을 눌러도 **언제나 1번 스텝이 구워졌다.** 보드는
   *  스텝이 한 장뿐이라 무해했고, 그래서 드러나지 않았다(기현님 신고로 발견). */
  stepIndex: number;
  /** 사이드바에서 체크한 스텝 — 내보내기 시트의 [선택한 N장] 기본값이 된다(2026-08-27). */
  checkedStepIds?: ReadonlySet<StepId>;
  showGrid: boolean;
  /** 격자 **번호**. 화면 토글은 설정 화면에 있고 여기엔 없지만, **내보내기 시트를 거쳐
   *  인쇄까지 내려야 한다**(2026-08-27) — 종이에서 칸 이름으로 자리를 지목하기 위해서다. */
  showGridLabels: boolean;
  onToggleGrid(): void;
  showRuleZones: boolean;
  onToggleRuleZones(): void;
  /** 자유 전술판을 드릴 라이브러리에 새 항목으로 넣는다 — 옛 헤더의 주 액션이었다.
   *  2026-08-14 기현님 지시로 헤더가 넓은 창에서 사라지면서 갈 곳이 여기밖에 없었다.
   *  **드릴 편집에서는 뜻이 다르다**: 자동저장을 지금 밀어 넣는다(아래 `mode`). */
  onSaveAsDrill(): void;
  /** 어느 화면의 기둥인가(2026-08-15 드릴 편집 재설계 ②).
   *
   *  칸 목록이 하나 다르다 — 드릴에는 **[비우기]가 없다**(근거는 functionBarMetrics 의
   *  `FUNCTION_BAR_ITEMS_DRILL`). 나머지 열둘은 자리·순서·이름이 **같다**: 두 화면을 오가는
   *  코치가 같은 자리에서 같은 것을 누르는 것이 이 재설계의 전부다. */
  mode?: 'board' | 'drill';
  /** [코트]가 잠겼는가에 대한 설명. 드릴은 코트가 불변이라 언제나 잠겨 있다. */
  courtSizeLocked?: boolean;
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
  stepEmpty,
  onDrillInfo,
  drill,
  stepIndex,
  checkedStepIds,
  showGrid,
  showGridLabels,
  onToggleGrid,
  showRuleZones,
  onToggleRuleZones,
  onSaveAsDrill,
  mode = 'board',
}: FunctionBarProps) {
  const isBoard = mode === 'board';
  const [courtOpen, setCourtOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const courtId = useId();
  const courtBtnRef = useRef<HTMLButtonElement | null>(null);
  const exportBtnRef = useRef<HTMLButtonElement | null>(null);
  const firstCourtRef = useRef<HTMLButtonElement | null>(null);

  const { prefs, physics } = useSettingsState();
  const { setPrefs } = useSettingsActions();
  const speedLimit = physics.speedLimit;
  const t = useT();
  const locale = useLocale();

  // 메뉴로 쓰는 Modal 은 열면 [닫기](DOM 순서상 앞)에 포커스가 간다 — 한 칸을 더 움직여야 하는
  // 것은 발 마우스 사용자에게 그냥 비용이다. 자식(Modal) 이펙트가 먼저, 부모(여기)가 나중에
  // 돌므로 이 두 줄이 마지막 말이 된다(ViewControls 가 간 길과 같다).
  useEffect(() => {
    if (courtOpen) firstCourtRef.current?.focus({ preventScroll: true });
  }, [courtOpen]);

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
      aria-label={t('editor.functionBar.nav')}
      data-function-bar=""
      data-tut="board-functionbar"
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
      <BarItem
        label={t('editor.functionBar.zoomIn.label')}
        name={t('editor.functionBar.zoomIn.name')}
        title={t('editor.functionBar.zoomIn.title')}
        onClick={onZoomIn}
      >
        <IconZoomIn />
      </BarItem>
      <BarItem
        label={t('editor.functionBar.zoomOut.label')}
        name={t('editor.functionBar.zoomOut.name')}
        title={t('editor.functionBar.zoomOut.title')}
        onClick={onZoomOut}
      >
        <IconZoomOut />
      </BarItem>
      {/* 2026-08-16 기현 지시로 '초기화' → '100%'. '초기화' 는 이 기둥에서 **뜻이 겹쳤다** —
          [비우기]도 판을 초기화하고, 인쇄물의 '초기화' 도 있다. 배율은 되돌아갈 자리가 하나뿐
          이고 그 자리의 이름이 100% 다. 이름 규칙(머리말)상 aria-label 에 '100%' 가 들어가야
          화면 글자가 그 부분 문자열이 된다. */}
      <BarItem
        label={t('editor.functionBar.zoomReset.label')}
        name={t('editor.functionBar.zoomReset.name')}
        title={t('editor.functionBar.zoomReset.title', { key: keyLabel('view.zoomReset') })}
        onClick={onZoomReset}
      >
        <IconZoomReset />
      </BarItem>

      <div aria-hidden style={DIVIDER} />

      {/* 못 되돌릴 때도 **사라지지 않고** disabled 다 — 사라지면 아래 칸 좌표가 통째로 움직인다. */}
      <BarItem
        label={t('editor.functionBar.undo.label')}
        name={t('editor.functionBar.undo.name')}
        title={t('editor.functionBar.undo.title')}
        onClick={onUndo}
        disabled={!canUndo}
      >
        <IconUndo size={18} />
      </BarItem>
      <BarItem
        label={t('editor.functionBar.redo.label')}
        name={t('editor.functionBar.redo.name')}
        title={t('editor.functionBar.redo.title')}
        onClick={onRedo}
        disabled={!canRedo}
      >
        <IconRedo size={18} />
      </BarItem>

      <div aria-hidden style={DIVIDER} />

      <BarItem
        label={t('editor.functionBar.court.label')}
        name={t('editor.functionBar.court.name')}
        title={t('editor.functionBar.court.titleTemplate', { label: def.label[locale], desc: def.desc[locale] })}
        buttonRef={courtBtnRef}
        aria-haspopup="dialog"
        aria-expanded={courtOpen}
        onClick={() => setCourtOpen(true)}
      >
        <IconBoard size={18} />
      </BarItem>
      {/* ⚠️ 2026-08-16 — [진영]은 **[코트] 모달 안으로 들어갔다**(기현 지시). 진영은 골 지역이
          있어야 뜻이 있는 값이고(플랫에는 없다), 골 지역은 코트 형태가 정한다 — 즉 코트를
          정하는 자리에서 함께 정해지는 것이 맞다. 기둥에서는 그 셋이 서로 떨어져 있었다.
          빠진 한 칸은 [도움말]이 받았었다(2026-08-16) — 2026-08-20(§0.5 Phase 5)에 [도움말]이
          레일 상시 칸으로 옮겨가며 그 칸도 없어졌다. 칸 수는 이제 12/10. */}
      {/* ⚠️ [비우기]는 2026-08-28 부터 **[보드 설정] 모달 안**이다(기현 지시). 함께 뒤집힌 것:
          옛 기록은 *"[비우기]는 전술판에만 있다(2026-08-15). 드릴에는 되돌리기와 스텝이 있어
          '비운다' 가 한 가지 뜻으로 정해지지 않는다"* 였는데, 이제 **드릴 편집에도 있고** 뜻은
          하나로 정했다: **지금 스텝을 비운다**(STEP_CLEAR). 다른 스텝은 건드리지 않는다. */}

      <div aria-hidden style={DIVIDER} />

      <BarItem
        label={t('editor.functionBar.export.label')}
        name={t('editor.functionBar.export.name')}
        title={t('editor.functionBar.export.title')}
        buttonRef={exportBtnRef}
        aria-haspopup="dialog"
        onClick={() => setExportOpen(true)}
      >
        <IconExport />
      </BarItem>

      {/* [정보] — 2026-08-28 기현 지시로 헤더 제목 옆 ⓘ 에서 이사. **드릴에만** 있다(전술판에는
          메타가 없다). 아이콘이 시연 쪽(PresentSideBar)의 같은 칸과 **한 벌**이다: 밑판(정보
          카드)이 같고 수정자만 연필 ↔ 눈이다 — 여기서는 고칠 수 있다는 뜻이다.
          자리는 **맨 끝**이다. 위에 끼우면 아래 칸들의 좌표가 통째로 밀린다(§3 불변식 1) —
          전술판의 [드릴로 저장]이 끝에 붙은 것과 같은 이유다. */}
      {!isBoard && onDrillInfo && (
        <>
          <div aria-hidden style={DIVIDER} />
          <BarItem
            label={t('editor.functionBar.drillInfo.label')}
            name={t('editor.workspace.drillInfoAriaLabel')}
            title={t('editor.functionBar.drillInfo.title')}
            aria-haspopup="dialog"
            data-tut="drill-info"
            onClick={onDrillInfo}
          >
            <IconDrillInfoEdit />
          </BarItem>
        </>
      )}

      {isBoard && (
        <>
          <div aria-hidden style={DIVIDER} />

          {/* 주 액션 — 옛 헤더의 [드릴로 저장]. 유일하게 **액센트로 칠한** 칸이고 기둥 맨
              끝이다: 맨 위는 줌이 이미 자리를 잡았고(손이 늘 가 있다), 새 칸을 위에 끼우면
              아래 칸들의 좌표가 통째로 밀린다(§3 불변식 1). 끝에 붙이면 아무것도 안 움직인다.
              ⚠️ **드릴 편집에는 이 칸이 없다**(2026-08-20 기현님 지시, 옛 기록: 여기 있었다) —
              드릴 쪽 [저장]은 "드릴로 저장"이 아니라 "자동저장을 지금 밀어넣기"였는데,
              자동저장이 이미 돌고 있어 누를 이유가 없는 칸이었다. 단축키(useEditorKeyboard
              onSave)는 그대로 있다 — "지금 바로"가 필요하면 그 길로 간다. 칸·구분선 수 근거는
              functionBarMetrics.ts 의 FUNCTION_BAR_ITEMS_DRILL 머리말. */}
          <BarItem
            label={t('editor.functionBar.save.label')}
            name={t('editor.functionBar.save.nameDrill')}
            title={t('editor.functionBar.save.titleBoard')}
            onClick={onSaveAsDrill}
            accent
            data-tut="board-save"
          >
            <IconSaveDrill />
          </BarItem>
        </>
      )}

      {/* ── 코트 팝오버 — 형태 3 + 크기 3 ───────────────────────────────────────────── */}
      <Modal
        open={courtOpen}
        onClose={() => setCourtOpen(false)}
        titleId={courtId}
        title={t('editor.functionBar.courtModal.title')}
        closeLabel={t('common.close')}
        returnFocusRef={courtBtnRef}
      >
        {/* ── 2단 배치 (2026-08-27 기현 지시: *"모달에서 설명을 최소화 하고 2단으로 배치"*) ──
            왼쪽은 **코트가 무엇인가**(형태·크기·진영), 오른쪽은 **판이 어떻게 동작하는가**
            (표시·이동·골대). `auto-fit` + `minmax` 라 좁은 창에서는 저절로 1단으로 접힌다 —
            분기를 따로 두지 않는다.
            ⚠️ 이 모달의 설계 근거는 *"한 화면에 나란히 읽힌다"* 였다(파일 머리말). 넷이 들어와
               세로로 길어지면서 그 근거가 스크롤에 먹히고 있었고, 2단은 그것을 되돌린다. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 잠금은 **이름**으로도 말한다 — 옛 헤더 세그먼트의 계약 그대로다(`코트 형태` ↔
              `코트 형태(변경 불가)`). 화면에는 아래 문구가 있지만, 스크린리더로 구역에 들어온
              사람은 문구를 읽기 전에 이름부터 듣는다. */}
          <div
            role="radiogroup"
            aria-label={courtLocked ? t('editor.functionBar.courtModal.shapeGroupLabelLocked') : t('editor.functionBar.courtModal.shapeGroupLabel')}
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
                  aria-label={d.label[locale]}
                  title={d.desc[locale]}
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
                  <OptionText label={d.label[locale]} desc={d.desc[locale]} />
                </button>
              );
            })}
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

          {/* 크기 3단은 **풀 코트에서만 뜻이 있다** — 하프·플랫은 값을 들고 다니되 판을 안 바꾼다
              (court.ts COURT_DEFS 근거). 그때 고르게 두면 판이 거짓말을 하므로 사실을 적는다. */}
          {courtMode !== 'full' ? (
            <p style={HINT}>{t('editor.functionBar.courtModal.sizeInfoFullOnly', { size: COURT_SIZE_LABELS[locale][courtSize] })}</p>
          ) : courtLocked ? (
            // 드릴은 **비워도 안 열린다**(코트는 드릴을 만들 때 정해진다) — 전술판 문장을 그대로
            // 쓰면 아래 [비우기]를 누르면 열릴 것처럼 읽힌다. 2026-08-28 에 [비우기]가 이 모달로
            // 들어오면서 그 오독이 실제 행동을 부르게 돼(눌러도 안 열린다) 문장을 갈랐다.
            // ⚠️ **잠기면 버튼을 안 낸다.** 형태 셋과 다른 이유: 형태는 눌러 보고 이유를 듣는
            // 것이 옛 헤더 세그먼트의 계약이었고(onLockedAttempt), 크기는 옛 인스펙터에서
            // *"골라도 안 변하는 컨트롤은 거짓말이다"* 라는 반대 계약을 갖고 있었다. 두 계약을
            // 한쪽으로 통일하지 않는 이유: 각자 그 자리에서 실기로 정해진 것이고, 여기서
            // 바꾸면 이번 이사가 **동작까지** 바꾸는 것이 된다. 값은 계속 보인다 — 못 바꾸는
            // 것과 안 보이는 것은 다르다.
            <p style={HINT}>
              {isBoard
                ? t('editor.functionBar.courtModal.sizeInfoLocked', { size: COURT_SIZE_LABELS[locale][courtSize] })
                : t('editor.functionBar.courtModal.sizeInfoLockedDrill', { size: COURT_SIZE_LABELS[locale][courtSize] })}
            </p>
          ) : (
            <div
              role="radiogroup"
              aria-label={t('editor.functionBar.courtModal.sizeGroupLabel')}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              {COURT_SIZES.map((s) => {
                const on = courtSize === s;
                const d = courtDefFor('full', s);
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={t('editor.functionBar.courtModal.sizeRadioAriaLabel', { size: COURT_SIZE_LABELS[locale][s] })}
                    title={d.desc[locale]}
                    onClick={() => {
                      if (on) return;
                      setCourtOpen(false);
                      onCourtSizeChange(s);
                    }}
                    style={toggleStyle(on)}
                  >
                    {/* 치수만 적으면 무엇이 표준인지 알 수 없다 — 규정상의 이름을 함께 낸다.
                        그리고 그 셋이 무엇에 맞는 코트인지는 툴팁에만 있었다(터치에서는 없다). */}
                    <OptionText label={COURT_SIZE_LABELS[locale][s]} desc={d.desc[locale]} />
                  </button>
                );
              })}
            </div>
          )}

          {/* ⚠️ **잠겼을 때만** 적는다. 예전에는 안 잠겼을 때도 *"지금은 자유롭게 바꿀 수
              있습니다"* 를 냈는데, 그건 아무 일도 없다는 것을 굳이 말하는 줄이었다 — 설명을
              줄이라는 지시(2026-08-27)에서 첫 번째로 지운 자리다. 잠긴 사유는 남는다:
              못 바꾸는 이유가 화면 어디에도 없으면 안 된다. */}
          {courtLocked && (
            <p style={HINT}>{isBoard ? t('editor.functionBar.courtModal.mustClearFirst') : t('editor.functionBar.courtModal.lockedDrill')}</p>
          )}

          {/* ── 비우기 (2026-08-28 기현 지시로 기둥에서 이사) ───────────────────────────
              **잠금 사유 바로 밑**이다. 위 문구가 *"코트를 바꾸려면 먼저 판을 비우세요"* 라고
              말하는데 그 버튼이 기둥 저쪽에 있으면, 읽은 사람이 눈을 옮겨 찾아야 했다.
              이제 시키는 말과 시키는 대로 할 손잡이가 같은 자리에 있다.
              ⚠️ 이미 비었으면 **끈다**. 눌러도 안 변하는 컨트롤은 거짓말이라는 이 모달의 기존
                 계약(크기 3단)과 같은 규율이고, 여기서는 꺼짐 자체가 "이미 비었다" 를 말한다. */}
          <button
            type="button"
            aria-haspopup="dialog"
            disabled={stepEmpty}
            title={isBoard ? t('editor.functionBar.clear.title') : t('editor.functionBar.clear.titleDrill')}
            onClick={() => {
              setCourtOpen(false);
              setConfirmOpen(true);
            }}
            style={{ ...MODAL_ACTION, opacity: stepEmpty ? 0.45 : 1 }}
          >
            <span aria-hidden style={{ display: 'flex' }}>
              <IconClear />
            </span>
            {t('editor.functionBar.clear.name')}
          </button>

          {/* ── 진영 (2026-08-16 기현 지시로 기둥에서 이사) ─────────────────────────────
              골 지역 3인 반칙이 **어느 팀에 걸리는지**를 정한다. 화면의 골라인 뒤 깃발 둘
              (SideMarks)이 이 값을 그리고, 이 버튼이 그것을 뒤집는다. 여기로 온 이유: 진영은
              골 지역이 있어야 뜻이 있고 골 지역은 코트 형태가 정하므로, 형태를 고르는 자리가
              곧 진영을 정하는 자리다.
              ⚠️ 플랫에서는 **버튼을 안 낸다** — 기둥에서는 자리를 지켜야 해서(§3 불변식 1)
                 disabled 로 두었지만, 모달 안에는 지킬 절대 위치가 없다. 대신 크기 3단이 이미
                 세워 둔 계약을 따른다: *"골라도 안 변하는 컨트롤은 거짓말이다"* → 사실을 적는다. */}
          {courtMode === 'flat' ? (
            <p style={HINT}>{t('editor.functionBar.courtModal.flatNoDefense')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                aria-label={t('editor.functionBar.courtModal.defenseAriaLabelTemplate', {
                  team: teams[defense].label,
                  goal: courtMode === 'half' ? t('editor.functionBar.courtModal.goalWord') : t('editor.functionBar.courtModal.leftGoalWord'),
                })}
                title={t('editor.functionBar.courtModal.defenseTitle')}
                onClick={onToggleDefense}
                style={MENU_ITEM}
              >
                <span aria-hidden style={{ display: 'flex' }}>
                  <IconSides />
                </span>
                {t('editor.functionBar.courtModal.defenseButtonText')}
              </button>
              {/* 설명 최소화(2026-08-27) — 예전에는 *"지금 왼쪽 골을 지키는 팀은 **홈** 입니다
                  — 골 지역 3인 반칙은 이 팀에만 걸립니다"* 두 줄이었다. **지금 값**만 남기고
                  까닭은 버튼의 title 로 옮겼다: 매번 읽을 것은 값이고, 까닭은 한 번 읽으면 된다. */}
              <p style={HINT}>
                {t('editor.functionBar.courtModal.defenseNow', {
                  goal: courtMode === 'half' ? t('editor.functionBar.courtModal.goalWord') : t('editor.functionBar.courtModal.leftGoalWord'),
                  team: teams[defense].label,
                })}
              </p>
            </div>
          )}
        </div>

        {/* ── 오른쪽 단 — 판이 어떻게 동작하는가 ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* ── 표시 · 이동 · 골대 (2026-08-27 기현 지시로 기둥에서 들어왔다) ─────────────
              ⚠️ **2026-08-16 의 반대 방향 결정을 명시적으로 폐기한다.** 그때는 [보기]를 모달에서
              서랍으로 빼면서 근거를 이렇게 적었다: *"모달은 들어가서 고르고 나오는 것이라 한 번
              쓰고 마는 선택(형태·크기)에 맞고, 격자·골 지역은 판을 보면서 켰다 껐다 하는
              토글이라 배경을 덮고 포커스를 가두는 장치가 매번 과했다."*

              그 관찰 자체는 지금도 참이다 — 뒤집은 이유는 다른 축이다: **기둥에 흩어진 네 개가
              전부 "이 판이 어떻게 동작하는가" 라는 한 가지 이야기**인데 장치가 제각각이라
              (모달 하나 · 즉시 실행 하나 · 즉시 토글 하나 · 서랍 하나) 어디를 눌러야 할지가
              이름이 아니라 기억에 달려 있었다. 일관성을 택하고 토글의 번거로움을 감수한 것이며,
              그 대가는 실재한다(격자를 켜고 끄려면 매번 모달을 연다). 되돌릴 일이 생기면
              **이 문단이 그때의 판단이다** — 지우지 말고 다시 뒤집어 적을 것. */}
          <div role="group" aria-label={t('editor.functionBar.courtModal.viewGroupLabel')} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={SECTION_LABEL}>{t('editor.functionBar.courtModal.viewGroupLabel')}</p>
            <ModalToggle
              on={showGrid}
              onClick={onToggleGrid}
              icon={<IconGrid />}
              text={t('editor.functionBar.viewDrawer.grid.name')}
              hint={t('editor.functionBar.viewDrawer.grid.title', { key: keyLabel('view.grid') })}
            />
            <ModalToggle
              on={showRuleZones}
              onClick={onToggleRuleZones}
              icon={<IconRuleZone />}
              text={t('editor.functionBar.viewDrawer.ruleZone.name')}
              hint={t('editor.functionBar.viewDrawer.ruleZone.title', { key: keyLabel('view.ruleZones') })}
            />
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} aria-hidden />

          <div role="group" aria-label={t('editor.functionBar.courtModal.moveGroupLabel')} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={SECTION_LABEL}>{t('editor.functionBar.courtModal.moveGroupLabel')}</p>
            {/* 속도 제한은 **켬이 기본이자 사실적인 상태**다(실제 파워체어 10 km/h). 그래서
                토글의 '켜짐' 은 제한이 걸린 쪽이고, 끄면 아래 설명이 경고를 말한다 — 제한을
                푼 채로 두고 왜 빠른지 모르는 상황이 더 나쁘다(옛 SpeedLimitSwitch 의 판단). */}
            <ModalToggle
              on={speedLimit}
              onClick={() => setPrefs({ physics: prunePhysics({ ...prefs.physics, speedLimit: !speedLimit }) })}
              icon={<IconSpeed />}
              text={t('editor.functionBar.courtModal.speedText')}
              hint={speedLimit ? t('editor.functionBar.speed.titleOn') : t('editor.functionBar.speed.titleOff')}
            />
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} aria-hidden />

          <div role="group" aria-label={t('editor.functionBar.courtModal.goalGroupLabel')} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={SECTION_LABEL}>{t('editor.functionBar.courtModal.goalGroupLabel')}</p>
            {/* ⚠️ 이것만 **토글이 아니라 명령**이다(물리 세계의 골대를 제자리로 되돌린다).
                그래서 누르면 **모달을 닫는다** — 결과는 판에 있는데 배경이 덮여 있으면 무엇이
                일어났는지 볼 수 없다. 위 토글들과 생김새를 달리한 것도 같은 이유다. */}
            <button
              type="button"
              onClick={() => {
                setCourtOpen(false);
                onResetGoals();
              }}
              style={MODAL_ACTION}
            >
              <span aria-hidden style={{ display: 'flex' }}>
                <IconGoalReset />
              </span>
              {t('editor.functionBar.goalReset.name')}
            </button>
          </div>
        </div>
        </div>
      </Modal>

      {/* ── 비우기 확인 ─────────────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onReset();
        }}
        title={t('editor.functionBar.clearConfirm.title')}
        body={
          <>
            {/* 드릴은 **스텝이 여럿**이라 "코트 위의" 로는 범위를 알 수 없다 — 어디까지 지우는지가
                파괴적 조작의 확인에서 가장 중요한 한 줄이므로 모드별로 다른 문장을 쓴다. */}
            {isBoard ? t('editor.functionBar.clearConfirm.body') : t('editor.functionBar.clearConfirm.bodyDrill')}{' '}
            <strong>{t('editor.functionBar.clearConfirm.bodyStrong')}</strong>
          </>
        }
        confirmLabel={t('editor.functionBar.clearConfirm.confirm')}
        cancelLabel={t('editor.functionBar.clearConfirm.cancel')}
        // ⚠️ [비우기]가 아니라 **[보드 설정]** 으로 돌려보낸다 — 확인을 여는 그 누름이 모달을
        //    닫으므로 비우기 버튼은 이미 DOM 에 없다(Modal 의 isConnected 가드가 걸려 포커스가
        //    <body> 로 떨어진다). 사용자가 되돌아갈 자리는 모달을 연 그 칸이다.
        returnFocusRef={courtBtnRef}
      />

      {/* ⚠️ 시트는 **닫혀 있어도 마운트된 채**여야 한다 — [인쇄]를 고르면 시트가 닫히고 인쇄
          트리(PrintRoot)는 이 안에 산다. 조건부로 렌더하면 백지가 인쇄된다. 닫힌 시트의 표적은 0 이다. */}
      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        drill={drill}
        stepIndex={stepIndex}
        checkedStepIds={checkedStepIds}
        showGrid={showGrid}
        showGridLabels={showGridLabels}
        showRuleZones={showRuleZones}
        returnFocusRef={exportBtnRef}
      />
    </nav>
  );
}
