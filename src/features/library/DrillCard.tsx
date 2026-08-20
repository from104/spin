// §6.11/부록A: 목록 화면 드릴 카드. 마크업은 template.html 172–205행을 그대로 이식하되,
// 썸네일은 정적 dots/arrow 대신 CourtThumbnail(§3.11 ThumbSpec)로 실제 첫 스텝을 그린다.
//
// 2026-08-12 판 걸이(계획서 2.2 [드릴] 탭 · 로드맵 2.7):
// · 썸네일 상자가 320/192 고정이 아니라 **그 드릴 코트의 실제 비율**(COURT_DEFS viewBox)이다 —
//   하프/플랫(525×450)이 풀(825×525) 틀에 레터박스로 눌려 보이던 것을 없앤다.
// · 카드 하단에 상시 노출 [시연] 44px — 단일 드릴 시연이 3단계에서 1클릭이 된다.
//   계획서의 "상시 노출 [열기]" 는 별도 버튼이 아니라 **카드면 전체 버튼**이 담당한다(어차피
//   44px 를 훌쩍 넘는 상시 노출 표적이고, 같은 이름의 버튼을 둘 두면 보조기술에 중복 표적이 된다).
// · 케밥 3항목 유지, '내보내기' 라벨은 계획서 표기대로 '파일로 내보내기'.
import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { CourtThumbnail } from '../../render/CourtThumbnail.tsx';
import { Pill } from '../../ui/Pill.tsx';
import { IconClock, IconLevel, IconListSteps, IconPlay } from '../../ui/icons.tsx';
import { drillTypeColor } from '../../core/colors.ts';
import { DRILL_TYPE_LABELS, DRILL_LEVEL_LABELS } from '../../model/drill.ts';
import { courtDefFor } from '../../model/court.ts';
import type { DrillSummary } from '../../model/summary.ts';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';

export interface DrillCardProps {
  drill: DrillSummary;
  onOpen(): void;
  /** 판 걸이 카드의 상시 노출 [시연] — nav.presentDrill 로 직행하는 1클릭 경로다(2.7). */
  onPresent(): void;
  onDuplicate(): void;
  onDelete(): void;
  onExport(): void;
}

/** 카드 우상단 "⋯" 메뉴 — icons.tsx(ui-kit 소유)에 없는 아이콘이라 카드 로컬로 그린다. */
function IconMore({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

/** 케밥(⋯) 메뉴 — 카드와 목록 행(C11 목록 보기)이 **같은 컴포넌트**를 쓴다. 항목·라벨이
 *  보기 모드에 따라 달라지면 사용자가 모드를 바꿀 때마다 메뉴를 다시 배워야 한다. */
export function DrillKebabMenu({
  title,
  onDuplicate,
  onDelete,
  onExport,
  buttonStyle,
}: {
  title: string;
  onDuplicate(): void;
  onDelete(): void;
  onExport(): void;
  buttonStyle?: CSSProperties;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const t = useT();

  const closeMenu = () => {
    setMenuOpen(false);
    menuBtnRef.current?.focus();
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        ref={menuBtnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-label={t('drillCard.kebabMoreAriaLabel', { title })}
        onClick={() => setMenuOpen((v) => !v)}
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'color-mix(in srgb, var(--panel) 70%, transparent)',
          color: 'var(--text)',
          ...buttonStyle,
        }}
      >
        <IconMore />
      </button>
      {menuOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label={t('drillCard.kebabMenuAriaLabel', { title })}
          style={
            {
              position: 'absolute',
              right: 0,
              top: 36,
              zIndex: 10,
              minWidth: 140,
              border: '1px solid var(--border-strong)',
              borderRadius: 10,
              background: 'var(--panel)',
              boxShadow: '0 12px 26px -10px rgba(0,0,0,.55)',
              padding: 6,
              display: 'flex',
              flexDirection: 'column',
            } satisfies CSSProperties
          }
        >
          <MenuItem
            onClick={() => {
              closeMenu();
              onDuplicate();
            }}
          >
            {t('drillCard.duplicateMenuItem')}
          </MenuItem>
          <MenuItem
            onClick={() => {
              closeMenu();
              onExport();
            }}
          >
            {t('drillCard.exportMenuItem')}
          </MenuItem>
          <MenuItem
            tone="danger"
            onClick={() => {
              closeMenu();
              onDelete();
            }}
          >
            {t('drillCard.deleteMenuItem')}
          </MenuItem>
        </div>
      )}
    </div>
  );
}

export function DrillCard({ drill, onOpen, onPresent, onDuplicate, onDelete, onExport }: DrillCardProps) {
  // §6.4 — 카드 상자의 비율은 그 드릴의 **크기까지** 따라간다. 크기를 빼면 25×14 드릴만
  // 30×18 비율 상자 안에 그려져 위아래에 검은 띠가 남는다(썸네일은 xMidYMid meet 이다).
  const courtDef = courtDefFor(drill.courtMode, drill.courtSize);
  const t = useT();
  const locale = useLocale();

  return (
    <div
      data-tut="library-card"
      style={{
        position: 'relative',
        border: '1px solid var(--border)',
        borderRadius: 15,
        background: 'var(--panel)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('drillCard.openAriaLabel', { title: drill.title })}
        style={{ display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left', flex: 1 }}
      >
        {/* 썸네일 — 2026-08-19 기현님 지시 2차: *"가로도 1/2"*. 코트 상자 자체가 카드 폭의
            **절반**이다(비율은 코트 그대로 — 상자 안에 여백 없음). 처음(1차)에는 세로만 반으로
            줄여 양옆에 여백을 남겼는데, 가로까지 줄이라는 정정으로 상자를 통째로 절반 축척으로
            내렸다. 가운데 배치 — 카드의 다른 줄들과 시각적 축이 맞는다. */}
        <div style={{ position: 'relative', borderBottom: '1px solid var(--border)', background: 'var(--panel-2, var(--panel))' }}>
          <div style={{ width: '50%', margin: '0 auto', aspectRatio: `${courtDef.vbW} / ${courtDef.vbH}`, position: 'relative' }}>
            <CourtThumbnail
              fill
              mode={drill.courtMode}
              size={drill.courtSize}
              thumb={drill.thumb}
              teamColors={{
                home: drill.teams.home.color,
                away: drill.teams.away.color,
                homeGk: drill.teams.home.gkColor,
                awayGk: drill.teams.away.gkColor,
              }}
              className="drill-card-thumb"
            />
          </div>
          <span style={{ position: 'absolute', top: 10, left: 10 }}>
            {/* v8 — 유형 배지. 재구축 전 옛 요약(build<4)엔 drillType 이 없다 — 그 한 프레임은
                fallback 회색·빈 라벨로 그려질 뿐이라 방어만 하고 지나간다(summary.ts BUILD 4). */}
            <Pill tone="category" color={drillTypeColor(drill.drillType)}>
              {DRILL_TYPE_LABELS[locale][drill.drillType] ?? '—'}
            </Pill>
          </span>
        </div>
        <div style={{ padding: '14px 15px 15px', display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 700, letterSpacing: -0.2 }}>{drill.title}</div>
          {/* 부제 — 드릴 짧은 설명(§텍스트의 소속, PLAN-STEP-EDITING.md). summary.ts 가 이미
              한 줄로 자른 값이라 여기선 ellipsis 로 넘침만 막는다. 부제가 없으면(옛 드릴·설명
              미기재) 줄 자체를 만들지 않는다 — 빈 줄이 카드 세로 리듬을 깨는 걸 막는다. */}
          {drill.description && (
            <div style={{ fontSize: '0.78125rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: -5 }}>
              {drill.description}
            </div>
          )}
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.71875rem', color: 'var(--muted)', fontWeight: 500 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconLevel />
              {DRILL_LEVEL_LABELS[locale][drill.level]}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconClock />
              {t('common.minutes', { min: drill.durationMin })}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconListSteps />
              {t('common.steps', { count: drill.stepCount })}
            </span>
          </div>
        </div>
      </button>

      {/* 상시 노출 [시연] 44px — 세션 행(SessionTab.tsx)과 같은 라벨 관용구(`… 시연 시작`).
          카드면 버튼 안에 넣으면 버튼 중첩이라 형제로 둔다. */}
      <div style={{ padding: '0 11px 11px', display: 'flex' }}>
        <button
          type="button"
          onClick={onPresent}
          aria-label={t('drillCard.presentAriaLabel', { title: drill.title })}
          className="on-accent"
          style={{
            flex: 1,
            minHeight: 44,
            borderRadius: 11,
            background: 'var(--accent)',
            color: 'var(--accent-ink-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            fontSize: '0.8125rem',
            fontWeight: 700,
          }}
        >
          <IconPlay size={14} />
          {t('drillCard.presentButton')}
        </button>
      </div>

      <div style={{ position: 'absolute', top: 8, right: 8 }}>
        <DrillKebabMenu title={drill.title} onDuplicate={onDuplicate} onDelete={onDelete} onExport={onExport} />
      </div>
    </div>
  );
}

/** C11 목록 보기(썸네일 없음) 행 — 2026-08-19 기현님 지시. 카드와 **같은 행동 집합**
 *  (행 전체 = 열기 · [시연] · 케밥 메뉴)에 그림만 뺐다. 한 줄 44px+ 로 훑어 내리기용. */
export function DrillRow({ drill, onOpen, onPresent, onDuplicate, onDelete, onExport }: DrillCardProps) {
  const t = useT();
  const locale = useLocale();
  return (
    <div
      data-tut="library-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        border: '1px solid var(--border)',
        borderRadius: 11,
        background: 'var(--panel)',
        padding: '4px 8px 4px 4px',
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('drillCard.openAriaLabel', { title: drill.title })}
        style={{ flex: 1, minWidth: 0, minHeight: 44, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '0 6px' }}
      >
        <Pill tone="category" color={drillTypeColor(drill.drillType)}>
          {DRILL_TYPE_LABELS[locale][drill.drillType] ?? '—'}
        </Pill>
        <span style={{ fontSize: '0.875rem', fontWeight: 700, letterSpacing: -0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {drill.title}
        </span>
        {drill.description && (
          <span style={{ flex: 1, minWidth: 0, fontSize: '0.75rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {drill.description}
          </span>
        )}
        <span style={{ marginLeft: 'auto', flex: 'none', display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.71875rem', color: 'var(--muted)', fontWeight: 500 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconLevel />
            {DRILL_LEVEL_LABELS[locale][drill.level]}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconClock />
            {t('common.minutes', { min: drill.durationMin })}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconListSteps />
            {t('common.steps', { count: drill.stepCount })}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onPresent}
        aria-label={t('drillCard.presentAriaLabel', { title: drill.title })}
        className="on-accent"
        style={{
          flex: 'none',
          minHeight: 44,
          padding: '0 14px',
          borderRadius: 9,
          background: 'var(--accent)',
          color: 'var(--accent-ink-strong)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.8125rem',
          fontWeight: 700,
        }}
      >
        <IconPlay size={13} />
        {t('drillCard.presentButton')}
      </button>
      <DrillKebabMenu title={drill.title} onDuplicate={onDuplicate} onDelete={onDelete} onExport={onExport} buttonStyle={{ width: 44, height: 44 }} />
    </div>
  );
}

function MenuItem({ children, onClick, tone }: { children: string; onClick(): void; tone?: 'danger' }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        minHeight: 36,
        padding: '0 10px',
        borderRadius: 6,
        fontSize: '0.8125rem',
        fontWeight: 600,
        color: tone === 'danger' ? '#e0554a' : 'var(--text)',
        textAlign: 'left',
      }}
    >
      {children}
    </button>
  );
}
