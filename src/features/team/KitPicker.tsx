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
// - **배치는 네이티브 라디오**다. `role="radio"` 를 흉내 낸 버튼 무리는 화살표 이동·로빙 초점을
//   손으로 구현해야 하고, 그 구현이 빠지면 키보드 사용자에게는 표적 4개가 탭 4번이 된다.
import { useState } from 'react';
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
            <div key={slot} role="radiogroup" aria-label={t('team.kits.groupLabel', { kind: kindName, slot: slotName })} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={legendStyle}>{slotName}</span>
              {team.palette.map((c, i) => {
                const label = t('team.kits.optionLabel', { kind: kindName, slot: slotName, n: i + 1 });
                const checked = kit[slot] === i;
                return (
                  <input
                    key={i}
                    type="radio"
                    name={`kit-${team.id}-${kind}-${slot}`}
                    checked={checked}
                    aria-label={label}
                    title={label}
                    onChange={() => onChange(setKit(team, kind, { ...kit, [slot]: i }))}
                    style={{ ...optionStyle, background: c, outline: checked ? '2px solid var(--accent)' : 'none' }}
                  />
                );
              })}
            </div>
          );
        })}
      {/* 규정상 GK 는 다른 선수와 구분돼야 한다(Laws) — 막지 않고 말만 한다(결정 8 의 규율). */}
      {kit && kit.field === kit.gk && <p style={hintStyle}>{t('team.detail.gkColorHint')}</p>}
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

/** 배치 표적. 네이티브 라디오의 기본 그림을 지우고 색 견본 자체를 표적으로 삼는다 —
 *  ⚠️ `appearance:none` 을 써도 요소는 라디오 그대로라 화살표 이동·로빙 초점이 살아 있다. */
const optionStyle: CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  width: 'var(--hit)',
  height: 'var(--hit)',
  minWidth: 44,
  minHeight: 44,
  borderRadius: '0.6rem',
  border: '1px solid var(--border-strong)',
  outlineOffset: 2,
  margin: 0,
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
