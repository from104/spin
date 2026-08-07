// §6.11/부록A: 목록 화면 드릴 카드. 마크업은 template.html 172–205행을 그대로 이식하되,
// 썸네일은 정적 dots/arrow 대신 CourtThumbnail(§3.11 ThumbSpec)로 실제 첫 스텝을 그린다.
import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { CourtThumbnail } from '../../render/CourtThumbnail.tsx';
import { Pill } from '../../ui/Pill.tsx';
import { IconClock, IconLevel, IconListSteps } from '../../ui/icons.tsx';
import { categoryColor } from '../../core/colors.ts';
import type { DrillSummary } from '../../model/summary.ts';

export interface DrillCardProps {
  drill: DrillSummary;
  onOpen(): void;
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

export function DrillCard({ drill, onOpen, onDuplicate, onDelete, onExport }: DrillCardProps) {
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
        style={{ display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left' }}
      >
        <div style={{ position: 'relative', aspectRatio: '320/192', borderBottom: '1px solid var(--border)' }}>
          <CourtThumbnail
            mode={drill.courtMode}
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
              내보내기
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
