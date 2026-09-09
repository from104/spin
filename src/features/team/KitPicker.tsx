// 팀 색 — 팔레트(미리 고르는 색 ≤4개) + 킷 배치(홈·어웨이·중립 × 필드·GK).
// 2026-09-09 기현 지시: *"팀 색은 홈, 어웨이, 중립 세트 정할 수 있고. 색 4개를 미리 선택하고
// 배치하는식으로 (색 고른 갯수만큼 배치 가능 최대 4개)"*. 모델 정본은 `model/team.ts`.
//
// **한 줄 원칙**: 색을 고르는 일과 색을 배치하는 일은 다른 조작이다 — 위는 팔레트, 아래는 배치.
//
// ── 이 파일이 지키는 것 ──────────────────────────────────────────────────────────
// - **저장을 모른다.** `model/team.ts` 의 순수 헬퍼로 다음 팀을 만들어 `onChange` 로 올려보낼
//   뿐이고 IDB 쓰기는 `TeamDetail` 한 곳이다(그 파일 머리말).
// - ⚠️ **색 입력은 드래그 중에 저장하지 않는다.** `<input type="color">` 의 onChange 는 선택기를
//   끄는 동안 매 프레임 떨어져, 그 자리에서 저장하면 한 번 고르는 데 IDB 쓰기 + 동기화 이벤트가
//   수십~수백 건 나간다(2026-09-09 검수에서 실측 20건). 드래그 중에는 로컬 초안만 갱신하고
//   저장은 `onBlur` 에 한 번 — 이 화면의 다른 칸(이름·리그·메모)이 처음부터 지키던 규율이다.
// - ⚠️ **배치는 세로 팝업 하나다**(2026-09-09 기현 지시: *"색 선택을 가로로 늘어놓는 대신 세로
//   팝업으로 해야해"*). 슬롯마다 팔레트 전체를 가로로 펼치면 한 줄이 색 8개(필드 4 + GK 4)가 되어
//   반 폭 카드에서 줄이 접히고, 표적 사이 간격이 무너진다. 지금은 슬롯당 **현재 색 버튼 하나**가
//   서고 목록은 눌러야 열린다.
//   ── ⚠️ 2026-09-09: 이 자리에 네이티브 라디오 무리(`role=radio` ×4 ×2)가 있었다 ─────────
//   그때의 근거는 «화살표 이동·로빙 초점이 공짜» 였다. 세로 팝업이 그 이점을 지우지 않도록
//   목록 안의 화살표 이동·Enter 선택·Esc 닫기·초점 복귀를 **손으로 구현했다**(아래 ColorSelect).
//   대가: 현재 색을 보려면 버튼 하나만 보면 되지만, 다른 색을 보려면 한 번 눌러야 한다.
// - 팝업 관례는 `features/library/DrillCard.tsx` 의 카드 메뉴를 그대로 따른다 — 문서 pointerdown
//   으로 바깥 클릭 닫기, Esc 닫기 + 여는 버튼으로 초점 복귀. 공용 부품을 새로 만들지 않는다.
import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Team, TeamKit, TeamKitKind } from '../../model/team.ts';
import { TEAM_KIT_KINDS, TEAM_PALETTE_MAX, addPaletteColor, removePaletteColor, setKit, setPaletteColor } from '../../model/team.ts';
import { Button } from '../../ui/Button.tsx';
import { useT } from '../../i18n/useT.ts';
import type { DictKey } from '../../i18n/ko.ts';

const KIND_KEY: Record<TeamKitKind, DictKey> = {
  home: 'team.kits.kindHome',
  away: 'team.kits.kindAway',
  neutral: 'team.kits.kindNeutral',
};

/** 킷 한 벌이 가진 두 자리. 배열로 두는 이유: 두 자리가 **같은 위젯**이라 화면도 같은 코드로
 *  그려야 한다 — 필드만 고치고 GK 를 빠뜨리는 부류의 어긋남이 여기서 사라진다. */
const SLOTS = [
  { slot: 'field', labelKey: 'team.kits.slotField' },
  { slot: 'gk', labelKey: 'team.kits.slotGk' },
] as const satisfies readonly { slot: keyof TeamKit; labelKey: DictKey }[];

export interface KitPickerProps {
  team: Team;
  onChange(next: Team): void;
}

export function KitPicker({ team, onChange }: KitPickerProps) {
  const t = useT();
  /** 색 선택기 드래그 중의 **화면용 초안**(머리말 참조). 인덱스 → 아직 저장하지 않은 색. */
  const [draft, setDraft] = useState<Record<number, string>>({});

  return (
    <div role="group" aria-label={t('team.kits.legend')} style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 견본과 ✕ 는 한 줄에 나란히(세로로 쌓으면 ✕ 가 다음 줄로 떨어져 라벨과 어긋난다 — 2026-09-09 관문 스크린샷). */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, minHeight: 'var(--hit)' }}>
        <span style={{ ...legendStyle, minWidth: 56 }}>{t('team.kits.paletteLabel')}</span>
        {team.palette.map((c, i) => {
          const name = t('team.kits.colorName', { n: i + 1 });
          return (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
              <input
                type="color"
                aria-label={name}
                title={name}
                value={draft[i] ?? c}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft((d) => ({ ...d, [i]: v }));
                }}
                onBlur={() => {
                  const v = draft[i];
                  setDraft((d) => {
                    const { [i]: _drop, ...rest } = d;
                    return rest;
                  });
                  if (v !== undefined && v !== c) onChange(setPaletteColor(team, i, v));
                }}
                style={swatchInputStyle}
              />
              {/* 마지막 한 색은 지울 수 없다 — 팔레트가 비면 킷이 가리킬 색이 없다(model/team.ts). */}
              {team.palette.length > 1 && (
                <button
                  type="button"
                  aria-label={t('team.kits.removeColor', { n: i + 1 })}
                  title={t('team.kits.removeColor', { n: i + 1 })}
                  onClick={() => onChange(removePaletteColor(team, i))}
                  style={removeStyle}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
        {team.palette.length < TEAM_PALETTE_MAX && (
          <Button variant="secondary" onClick={() => onChange(addPaletteColor(team))}>
            {t('team.kits.addColor')}
          </Button>
        )}
      </div>

      {TEAM_KIT_KINDS.map((kind) => (
        <KitRow key={kind} team={team} kind={kind} onChange={onChange} />
      ))}
    </div>
  );
}

function KitRow({ team, kind, onChange }: { team: Team; kind: TeamKitKind; onChange(next: Team): void }) {
  const t = useT();
  const kit = team.kits[kind];
  const kindName = t(KIND_KEY[kind]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, minHeight: 'var(--hit)' }}>
      <span style={{ ...legendStyle, minWidth: 56 }}>{kindName}</span>
      {/* 홈은 켜고 끄는 것이 아니다 — 지울 수 없는 한 벌이다(model/team.ts TeamKits). */}
      {kind !== 'home' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 'var(--hit)', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={kit !== undefined}
            aria-label={t('team.kits.useLabel', { kind: kindName })}
            onChange={(e) => {
              // 켤 때는 홈 킷을 본떠 시작한다 — 빈 자리에서 색 둘을 처음부터 고르게 하는 것보다,
              // 이미 쓰고 있는 배치에서 한 칸만 바꾸는 편이 «갈아입는 벌» 이라는 뜻에 가깝다.
              onChange(setKit(team, kind, e.target.checked ? { ...team.kits.home } : undefined));
            }}
          />
          {t('team.kits.use')}
        </label>
      )}
      {kit &&
        SLOTS.map(({ slot, labelKey }) => {
          const slotName = t(labelKey);
          return (
            <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={legendStyle}>{slotName}</span>
              <ColorSelect
                palette={team.palette}
                value={kit[slot]}
                listLabel={t('team.kits.groupLabel', { kind: kindName, slot: slotName })}
                buttonLabel={(n) => t('team.kits.optionLabel', { kind: kindName, slot: slotName, n })}
                onSelect={(i) => onChange(setKit(team, kind, { ...kit, [slot]: i }))}
              />
            </div>
          );
        })}
      {/* 규정상 GK 는 다른 선수와 구분돼야 한다(Laws) — 막지 않고 말만 한다(결정 8 의 규율). */}
      {kit && kit.field === kit.gk && <p style={hintStyle}>{t('team.detail.gkColorHint')}</p>}
    </div>
  );
}

/** 색 하나를 고르는 세로 팝업. 여는 버튼이 **지금 고른 색 그 자체**라, 닫혀 있을 때도 배치가
 *  한눈에 읽힌다(칸마다 «현재 값» 을 글자로 다시 적지 않아도 되는 이유).
 *
 *  ⚠️ 고르면 **곧바로 저장한다**. 팔레트의 `<input type="color">` 가 드래그 중 저장을 미루는 것과
 *  일부러 다르다 — 저쪽은 손을 떼기 전까지 값이 매 프레임 바뀌지만, 여기는 한 번 누르는 것이
 *  곧 한 번의 결정이라 미룰 «중간 값» 이 없다. */
function ColorSelect({
  palette,
  value,
  listLabel,
  buttonLabel,
  onSelect,
}: {
  palette: readonly string[];
  value: number;
  listLabel: string;
  buttonLabel(n: number): string;
  onSelect(index: number): void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  /** 열 때 위로 뒤집을지. 화면 아래쪽 카드에서 목록이 창 밖으로 나가면 고를 수 없는 항목이 생긴다.
   *  jsdom 은 `getBoundingClientRect` 가 전부 0 이라 언제나 아래로 편다 — 뒤집기는 실기 항목이다. */
  const [flip, setFlip] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = palette[value] ?? palette[0] ?? '#000000';

  const close = (focusBack: boolean): void => {
    setOpen(false);
    if (focusBack) btnRef.current?.focus();
  };

  const openList = (): void => {
    const rect = btnRef.current?.getBoundingClientRect();
    const need = palette.length * 48 + 16; // 항목 44 + 간격 — 어림값이면 충분하다(뒤집기 판정뿐)
    setFlip(rect !== undefined && rect.bottom + need > window.innerHeight && rect.top > need);
    setOpen(true);
  };

  // 바깥 클릭·Esc — `features/library/DrillCard.tsx` 의 카드 메뉴와 같은 처리(머리말).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 열리면 **지금 고른 항목**에 초점을 준다 — 목록의 첫 항목에 주면 화살표를 몇 번 눌러야 하는지가
  // 지금 값에 따라 달라져, 키보드로는 어디서 시작하는지 알 수 없다.
  useEffect(() => {
    if (!open) return;
    const items = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    items?.[Math.min(value, items.length - 1)]?.focus();
  }, [open, value]);

  /** 목록 안 화살표 이동. 끝에서 반대편으로 감는다 — 색이 넷뿐이라 «더 못 간다» 는 침묵보다
   *  한 바퀴 도는 편이 빠르다. */
  const moveFocus = (from: number, delta: number): void => {
    const items = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    if (!items || items.length === 0) return;
    const next = (from + delta + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={buttonLabel(value + 1)}
        title={buttonLabel(value + 1)}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(e) => {
          // ↓ 로도 연다 — 목록을 여는 표준 제스처이고, Enter/Space 는 버튼이 알아서 클릭으로 만든다.
          if (!open && e.key === 'ArrowDown') {
            e.preventDefault();
            openList();
          }
        }}
        style={{ ...triggerStyle, background: current }}
      />
      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={listLabel}
          onKeyDown={(e) => {
            const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
            const at = items.indexOf(e.target as HTMLElement);
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              moveFocus(at < 0 ? value : at, e.key === 'ArrowDown' ? 1 : -1);
            }
          }}
          style={{ ...listStyle, ...(flip ? { bottom: 'calc(var(--hit) + 4px)' } : { top: 'calc(var(--hit) + 4px)' }) }}
        >
          {palette.map((c, i) => (
            <button
              key={i}
              type="button"
              role="option"
              aria-selected={i === value}
              onClick={() => {
                onSelect(i);
                close(true);
              }}
              style={optionRowStyle}
            >
              <span aria-hidden style={{ ...optionSwatchStyle, background: c }} />
              {t('team.kits.colorName', { n: i + 1 })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const legendStyle: CSSProperties = { fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 };

/** 색 입력도 표적이라 `--hit` 을 지킨다 — 네이티브 `<input type="color">` 의 기본 크기는 23px 이다. */
const swatchInputStyle: CSSProperties = {
  width: 'var(--hit)',
  height: 'var(--hit)',
  minWidth: 44,
  minHeight: 44,
  padding: 2,
  borderRadius: '0.6rem',
  border: '1px solid var(--border)',
  background: 'var(--elev)',
};

/** 목록을 여는 버튼 = 지금 고른 색 견본 그 자체. */
const triggerStyle: CSSProperties = {
  width: 'var(--hit)',
  height: 'var(--hit)',
  minWidth: 44,
  minHeight: 44,
  borderRadius: '0.6rem',
  border: '1px solid var(--border-strong)',
  padding: 0,
};

/** 세로 팝업. 카드 밖으로 넘칠 수 있으므로 부모에 `overflow: hidden` 을 두지 않는다 —
 *  ⚠️ TeamDetail 의 절 패널은 overflow 를 안 걸고 있고, 걸면 이 목록이 잘린다. */
const listStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  zIndex: 10,
  minWidth: 140,
  border: '1px solid var(--border-strong)',
  borderRadius: 10,
  background: 'var(--panel)',
  boxShadow: '0 12px 26px -10px rgba(0,0,0,.55)',
  padding: 6,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const optionRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 'var(--hit)',
  padding: '0 8px',
  borderRadius: 6,
  fontSize: '0.8125rem',
  fontWeight: 600,
  textAlign: 'left',
};

const optionSwatchStyle: CSSProperties = {
  flex: 'none',
  width: 26,
  height: 26,
  borderRadius: 7,
  border: '1px solid var(--border-strong)',
};

/** ⚠️ 지우기도 표적이라 `--hit` 을 지킨다 — 글자가 작다고 표적을 줄이지 않는다. 색 견본 아래
 *  같은 폭으로 서므로 팔레트 한 칸은 세로로 길어지고, 그 대가로 잘못 누를 일이 줄어든다. */
const removeStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--faint-text)',
  lineHeight: 1,
  width: 'var(--hit)',
  minWidth: 44,
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  background: 'transparent',
  border: 0,
};

const hintStyle: CSSProperties = { fontSize: '0.75rem', color: 'var(--faint-text)', margin: 0 };
