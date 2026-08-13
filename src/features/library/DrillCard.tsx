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
import { categoryColor } from '../../core/colors.ts';
import { courtDefFor } from '../../model/court.ts';
import type { DrillSummary } from '../../model/summary.ts';

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

export function DrillCard({ drill, onOpen, onPresent, onDuplicate, onDelete, onExport }: DrillCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

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

  // §6.4 — 카드 상자의 비율은 그 드릴의 **크기까지** 따라간다. 크기를 빼면 25×14 드릴만
  // 30×18 비율 상자 안에 그려져 위아래에 검은 띠가 남는다(썸네일은 xMidYMid meet 이다).
  const courtDef = courtDefFor(drill.courtMode, drill.courtSize);

  return (
    <div
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
        aria-label={`${drill.title} 열기`}
        style={{ display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left', flex: 1 }}
      >
        {/* 코트 비율 상자 — 카드마다 자기 코트의 viewBox 비율. svg 는 상자를 꽉 채운다(fill prop). */}
        <div
          style={{
            position: 'relative',
            aspectRatio: `${courtDef.vbW} / ${courtDef.vbH}`,
            borderBottom: '1px solid var(--border)',
          }}
        >
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
          <span style={{ position: 'absolute', top: 10, left: 10 }}>
            <Pill tone="category" color={categoryColor(drill.category)}>
              {drill.category}
            </Pill>
          </span>
        </div>
        <div style={{ padding: '14px 15px 15px', display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 700, letterSpacing: -0.2 }}>{drill.title}</div>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.71875rem', color: 'var(--muted)', fontWeight: 500 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconLevel />
              {drill.level}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconClock />
              {drill.durationMin}분
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconListSteps />
              {drill.stepCount}스텝
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
          aria-label={`${drill.title} 시연 시작`}
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
          시연
        </button>
      </div>

      <div style={{ position: 'absolute', top: 8, right: 8 }} ref={menuRef}>
        <button
          ref={menuBtnRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={`${drill.title} 더보기`}
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
          }}
        >
          <IconMore />
        </button>
        {menuOpen && (
          <div
            id={menuId}
            role="menu"
            aria-label={`${drill.title} 작업`}
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
              복제
            </MenuItem>
            <MenuItem
              onClick={() => {
                closeMenu();
                onExport();
              }}
            >
              파일로 내보내기
            </MenuItem>
            <MenuItem
              tone="danger"
              onClick={() => {
                closeMenu();
                onDelete();
              }}
            >
              삭제
            </MenuItem>
          </div>
        )}
      </div>
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
