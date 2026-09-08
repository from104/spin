// 팀 상세의 [라인업] 절 (PLAN-TEAM 결정 8·17). 코트 4칸(그중 골키퍼 1) + 벤치 + 대기.
//
// ⚠️ **셈하고 경고할 뿐, 입력을 막지 않는다**(결정 8). 코트에 5명을 올려도, PF2 를 3명 넣어도
//    버튼이 잠기지 않는다 — 훈련 중에는 규정을 일부러 벗어나 세우는 일이 흔하고, 앱이 그것을
//    못 하게 막으면 도구가 아니라 심판이 된다(선례: SessionEditorScreen 의 참가자 경고).
//    판정은 전부 `lineupWarnings`(순수 함수)가 하고 여기서는 그리기만 한다 — 규칙을 화면 코드에
//    한 번 더 적으면 두 벌이 되고, 한쪽만 고쳐지는 날 종이와 화면이 갈린다.
//
// 경고는 `role="status"` 라이브 리전으로 읽힌다 — 시각 색(노랑)만으로 말하면 보조기술 사용자에게
// 는 아무 일도 안 일어난 것과 같다(AGENTS §1.7).
//
// 「코트 위 PF1 최소 2명」 경고는 **여기에도 없다** — 규정 근거가 없다(조사 §4.2). 명단 전체의
// 등급 조합도 경고가 아니다(R6). 노란 것은 오직 `lineupWarnings` 가 돌려준 셋뿐이다.
import type { CSSProperties } from 'react';
import type { Player } from '../../model/roster.ts';
import type { Lineup, LineupWarning, Team } from '../../model/team.ts';
import { countByClass, lineupWarnings, setLineup } from '../../model/team.ts';
import type { PlayerId } from '../../core/ids.ts';
import { Button } from '../../ui/Button.tsx';
import { useT } from '../../i18n/useT.ts';
import { ClassChips } from './TeamCard.tsx';

/** 코트 칸 수. 규정상 한 팀 4명이다 — 빈 칸을 몇 개 그릴지가 이 값에서 나온다.
 *  ⚠️ 이 값은 **표시용 칸 수**이지 상한이 아니다: 5명이 들어오면 5칸을 그린다(막지 않는 결정 8). */
const COURT_SLOTS = 4;

export interface LineupBoardProps {
  team: Team;
  onChange(next: Team): void;
}

export function LineupBoard({ team, onChange }: LineupBoardProps) {
  const t = useT();
  const lineup: Lineup = team.lineup ?? { court: [], bench: [] };
  const byId = new Map(team.players.map((p) => [p.id, p]));
  // 비활성 선수는 라인업에 새로 넣을 수 없다(대기 목록에서 뺀다). 이미 들어가 있는 사람은
  // **그리기는 한다** — 저장본을 화면이 조용히 버리면 "왜 한 명이 사라졌지" 가 된다.
  const placed = new Set<PlayerId>([...lineup.court, ...lineup.bench]);
  const available = team.players.filter((p) => p.active !== false && !placed.has(p.id));
  const warnings = lineupWarnings(team);

  const commit = (next: Lineup) => onChange(setLineup(team, next.court.length === 0 && next.bench.length === 0 && next.gk === undefined ? undefined : next));

  const removeFrom = (id: PlayerId) =>
    commit({
      court: lineup.court.filter((x) => x !== id),
      ...(lineup.gk !== undefined && lineup.gk !== id ? { gk: lineup.gk } : {}),
      bench: lineup.bench.filter((x) => x !== id),
    });

  const toCourt = (id: PlayerId) =>
    commit({
      court: [...lineup.court.filter((x) => x !== id), id],
      ...(lineup.gk !== undefined ? { gk: lineup.gk } : {}),
      bench: lineup.bench.filter((x) => x !== id),
    });

  const toBench = (id: PlayerId) =>
    commit({
      court: lineup.court.filter((x) => x !== id),
      // 코트에서 벤치로 내려가면 GK 지정은 따라가지 않는다 — GK 는 코트 위의 자리다(R1).
      ...(lineup.gk !== undefined && lineup.gk !== id ? { gk: lineup.gk } : {}),
      bench: [...lineup.bench.filter((x) => x !== id), id],
    });

  const setGk = (id: PlayerId) => commit({ court: lineup.court, gk: lineup.gk === id ? undefined : id, bench: lineup.bench });

  if (team.players.length === 0) {
    return (
      <div data-tut="team-lineup">
        <p style={hintStyle}>{t('team.lineup.noPlayers')}</p>
      </div>
    );
  }

  const courtCounts = countByClass(team, lineup.court);
  const benchCounts = countByClass(team, lineup.bench);

  return (
    <div data-tut="team-lineup" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 경고 — 목록보다 **위**다. 아래에 두면 명단이 길 때 화면 밖으로 밀린다. */}
      <div role="status" aria-label={t('team.lineup.warningsLabel')} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {warnings.length === 0 ? <p style={hintStyle}>{t('team.lineup.ok')}</p> : warnings.map((w) => <WarningLine key={w.kind} warning={w} />)}
      </div>

      <Group
        title={t('team.lineup.courtTitle')}
        sub={t('team.lineup.courtSub')}
        counts={courtCounts}
        empty={Math.max(0, COURT_SLOTS - lineup.court.length)}
      >
        {lineup.court.map((id) => {
          const p = byId.get(id);
          if (!p) return null; // 명단에서 지워진 id — removePlayer 가 걷지만 파일에서 올 수 있다
          return (
            <Slot key={id} player={p} gk={lineup.gk === id}>
              {/* 이름이 상태를 따라 바뀐다 — 같은 버튼이 지정·해제 둘을 하므로, 이름이 고정이면
                  스크린리더 사용자는 이미 GK 인 사람에게 "골키퍼로 지정" 을 듣는다. */}
              <SlotButton
                label={lineup.gk === id ? t('team.lineup.unsetGk', { name: p.name }) : t('team.lineup.setGk', { name: p.name })}
                short={t('team.lineup.gkBadge')}
                active={lineup.gk === id}
                onClick={() => setGk(p.id)}
              />
              <SlotButton label={t('team.lineup.toBench', { name: p.name })} short="↓" onClick={() => toBench(p.id)} />
              <SlotButton label={t('team.lineup.removeFrom', { name: p.name })} short="✕" onClick={() => removeFrom(p.id)} />
            </Slot>
          );
        })}
      </Group>

      <Group title={t('team.lineup.benchTitle')} counts={benchCounts} empty={0}>
        {lineup.bench.map((id) => {
          const p = byId.get(id);
          if (!p) return null;
          return (
            <Slot key={id} player={p}>
              <SlotButton label={t('team.lineup.toCourt', { name: p.name })} short="↑" onClick={() => toCourt(p.id)} />
              <SlotButton label={t('team.lineup.removeFrom', { name: p.name })} short="✕" onClick={() => removeFrom(p.id)} />
            </Slot>
          );
        })}
      </Group>

      <div>
        <h4 style={groupTitleStyle}>{t('team.lineup.availableTitle')}</h4>
        {available.length === 0 ? (
          <p style={hintStyle}>{t('team.lineup.availableEmpty')}</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {available.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', borderRadius: 10, padding: '2px 4px 2px 10px' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{p.name}</span>
                {p.klass && <span style={miniChipStyle}>{p.klass}</span>}
                <SlotButton label={t('team.lineup.toCourt', { name: p.name })} short="↑" onClick={() => toCourt(p.id)} />
                <SlotButton label={t('team.lineup.toBench', { name: p.name })} short="↓" onClick={() => toBench(p.id)} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Button variant="secondary" disabled={team.lineup === undefined} onClick={() => onChange(setLineup(team, undefined))}>
          {t('team.lineup.clear')}
        </Button>
        <p style={hintStyle}>{t('team.lineup.hint')}</p>
      </div>
    </div>
  );
}

function WarningLine({ warning }: { warning: LineupWarning }) {
  const t = useT();
  const text =
    warning.kind === 'pf2-over'
      ? t('team.lineup.warn.pf2Over', { count: warning.count })
      : warning.kind === 'under-min'
        ? t('team.lineup.warn.underMin', { count: warning.count })
        : t('team.lineup.warn.noGk');
  // R7 툴팁은 PF2 초과에만 붙는다 — 제재(간접 FK + 옐로카드 2장)가 걸리는 것은 그 조항뿐이다.
  const tip = warning.kind === 'pf2-over' ? t('team.lineup.warn.pf2OverTip') : undefined;
  return (
    <p title={tip} style={warnStyle}>
      {text}
      {tip && <span style={{ display: 'block', fontWeight: 400, marginTop: 2 }}>{tip}</span>}
    </p>
  );
}

function Group({
  title,
  sub,
  counts,
  empty,
  children,
}: {
  title: string;
  sub?: string;
  counts: { pf1: number; pf2: number; unclassified: number };
  empty: number;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div>
      <h4 style={groupTitleStyle}>
        {title}
        {sub && <span style={{ fontWeight: 500, color: 'var(--faint-text)', marginLeft: 6, fontSize: '0.75rem' }}>{sub}</span>}
        <span style={{ marginLeft: 8, display: 'inline-flex', gap: 5 }}>
          <ClassChips pf1={counts.pf1} pf2={counts.pf2} unclassified={counts.unclassified} />
        </span>
      </h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {children}
        {Array.from({ length: empty }, (_, i) => (
          <div key={`empty-${i}`} style={{ ...slotStyle, borderStyle: 'dashed', color: 'var(--faint-text)', justifyContent: 'center' }}>
            {t('team.lineup.emptySlot')}
          </div>
        ))}
      </div>
    </div>
  );
}

function Slot({ player, gk, children }: { player: Player; gk?: boolean; children: React.ReactNode }) {
  const t = useT();
  return (
    <div style={{ ...slotStyle, ...(gk ? { borderColor: 'var(--accent)' } : {}) }}>
      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{player.name}</span>
      {player.klass && <span style={miniChipStyle}>{player.klass}</span>}
      {gk && <span style={{ ...miniChipStyle, color: 'var(--accent)' }}>{t('team.lineup.gkBadge')}</span>}
      {children}
    </div>
  );
}

/** 칸 안의 조작 버튼(GK 지정·코트↑·벤치↓·빼기 ✕). `aria-label`·`title` 을 **짝**으로 준다
 *  (AGENTS §1.7) — 보이는 글자는 화살표 한 글자라 그것만으로는 무엇을 하는 버튼인지 읽히지 않는다.
 *
 *  ── ⚠️ 2026-09-09: 32×32 였던 것을 `--hit` 로 올린다(검수) ─────────────────────────────
 *  라인업의 **유일한 조작 표적**인데 32 로 고정이라, 표적 예산의 하한(기본 44 · 큰 터치 56)을
 *  밑돌았고 [큰 터치] 설정이 이 화면에서만 아무 효과가 없었다. 대기 선수 칩에서는 ↑↓ 둘이
 *  4px 간격으로 붙어 오조작도 쉬웠다. 칩이 커져 줄이 넘치는 것은 `flex-wrap` 이 받는다 —
 *  표적을 줄여서 줄 수를 맞추는 것은 이 앱에서 하지 않는 거래다. */
function SlotButton({ label, short, active, onClick }: { label: string; short: string; active?: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      style={{
        minWidth: 'var(--hit)',
        minHeight: 'var(--hit)',
        // 글리프(↑↓✕·GK)를 표적 한가운데에 — 전역 button 패딩·기본 정렬에 맡기면 글자가 위·왼쪽으로 쏠린다(2026-09-09 기현님 지적).
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        lineHeight: 1,
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: active ? 'var(--accent)' : 'var(--elev)',
        color: active ? 'var(--accent-ink-strong)' : 'var(--muted)',
        fontSize: '0.6875rem',
        fontWeight: 700,
      }}
    >
      {short}
    </button>
  );
}

const groupTitleStyle: CSSProperties = { fontSize: '0.8125rem', fontWeight: 700, margin: '0 0 6px', display: 'flex', alignItems: 'center', flexWrap: 'wrap' };

const slotStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  minHeight: 'var(--hit)',
  padding: '2px 6px 2px 10px',
  border: '1px solid var(--border)',
  borderRadius: 10,
  background: 'var(--panel-2)',
};

const miniChipStyle: CSSProperties = { fontSize: '0.625rem', fontWeight: 700, color: 'var(--muted)' };

const hintStyle: CSSProperties = { fontSize: '0.75rem', color: 'var(--faint-text)', margin: 0 };

/** 노란 경고. 색 리터럴을 안 쓰고 `--warn-text` 토큰을 쓴다(AGENTS §1.4 — 색은 토큰만, 토큰은
 *  추가만). 다크·라이트가 **다른 노랑**이어야 하는 것이 토큰이어야 하는 이유다: 다크의 밝은
 *  호박색은 흰 바탕에서 1.8:1 로 사실상 안 보인다(tokens.css 의 그 주석).
 *  색만으로 말하지 않도록 `role="status"` 가 문장을 읽어 준다(위 머리말). */
const warnStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--warn-text)',
  background: 'var(--panel-2)',
  border: '1px solid var(--warn-text)',
  borderRadius: 8,
  padding: '6px 10px',
};
