// §6.11(대문 카드) · 부록 A: 대문 화면. 마크업은 docs/prototype/template.html 93–161행을
// 그대로 이식하되, 정적 sc-for 목데이터 대신 LibraryProvider 의 실데이터로 채운다(하드코딩 금지).
//
// 내비게이션: §8 "screen-home-library 의존은 store, render-court, ui-kit, model, storage 뿐"
// — app-shell 을 import 하지 않는다. 화면 전환·헤더 주 액션은 app-shell 이 내려주는 `HomeNav`
// prop 하나로만 한다(nav.ts). 헤더 자체(제목·부제·검색·주 액션)도 app-shell 이 정적으로 계산해
// 꽂는다(§ AppHeader.tsx "home/library/settings 는 useAppHeader 로 스스로를 못 알린다") — 이
// 화면은 헤더를 선언하지 않는다. `<main id="main" tabIndex={-1}>` 는 §7.5a 대로 각 화면이 직접
// 렌더한다(AppShell 은 화면 스위치 바깥에 별도 <main> 을 두지 않는다 — 통합 확인 완료).
import type { CSSProperties } from 'react';
import { useLibrary } from '../../store/library/LibraryProvider.tsx';
import { categoryColor } from '../../core/colors.ts';
import { pickNextSession, formatSessionWhen } from '../../model/session.ts';
import type { ResolvedSession } from '../../model/session.ts';
import { Button } from '../../ui/Button.tsx';
import { IconPlus } from '../../ui/icons.tsx';
import { computeHomeStats, countUpcomingSessions, formatRelative } from './format.ts';
import type { HomeNav } from './nav.ts';
import type { DrillId, SessionId } from '../../core/ids.ts';

const MAX_RECENT = 4;
const MAX_SESSION_DRILLS = 4;

export interface HomeScreenProps {
  nav: HomeNav;
}

export function HomeScreen({ nav }: HomeScreenProps) {
  const { drills, sessions } = useLibrary();
  const recent = drills.slice(0, MAX_RECENT);
  const stats = computeHomeStats(drills, sessions.length, countUpcomingSessions(sessions.map((s) => s.session), 7));
  const nextRaw = pickNextSession(sessions.map((s) => s.session));
  const next = nextRaw ? sessions.find((s) => s.session.id === nextRaw.id) : undefined;

  const goNewDrill = () => nav.newDrill();
  const openDrill = (id: DrillId) => nav.openDrill(id);
  const goLibrary = (tab?: 'drills' | 'sessions') => nav.goLibrary(tab ? { tab } : undefined);
  const openSession = (id: SessionId) => nav.openSession(id);

  return (
    <main id="main" tabIndex={-1} style={{ flex: 1, overflowY: 'auto', outline: 'none', padding: '26px 30px 46px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* 히어로 */}
        <section
          style={{
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            borderRadius: 18,
            background: 'var(--panel)',
            padding: '34px 34px 32px',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: -40,
              top: -40,
              width: 280,
              height: 280,
              borderRadius: '50%',
              background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
            }}
          />
          <div style={{ position: 'relative', maxWidth: 620 }}>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: 2.4,
                color: 'var(--accent-text)',
                marginBottom: 12,
              }}
            >
              STRATEGY PLANNER FOR INCLUSIVE FOOTBALL
            </div>
            <h1 style={{ fontSize: '2.125rem', fontWeight: 800, letterSpacing: -1, lineHeight: 1.18, textWrap: 'pretty' }}>
              4v4 코트 위의 모든 움직임을
              <br />
              설계하고, 재생하고, 공유하세요.
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: 13, lineHeight: 1.6, textWrap: 'pretty' }}>
              파워체어 풋볼 전용 전술 보드. 드릴을 스텝 단위로 만들고 팀 앞에서 그대로 시연할 수 있습니다.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
              <Button variant="primary" icon={<IconPlus size={16} />} onClick={goNewDrill}>
                새 드릴 만들기
              </Button>
              <Button variant="secondary" onClick={() => goLibrary()}>
                드릴 목록 보기
              </Button>
            </div>
          </div>
        </section>

        {/* 통계 4칸 */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--panel)', padding: '17px 18px' }}>
              <div style={{ fontSize: '0.71875rem', color: 'var(--muted)', fontWeight: 600 }}>{s.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 9 }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.6875rem', fontWeight: 700, letterSpacing: -1 }}>{s.value}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--faint-text)', fontWeight: 600 }}>{s.unit}</span>
              </div>
            </div>
          ))}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 18, alignItems: 'start' }}>
          {/* 최근 작업한 드릴 */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--panel)', overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px 13px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '0.84375rem', fontWeight: 700 }}>최근 작업한 드릴</span>
              {/* §7.3 표: "대문 '전체 보기 →'" 히트 44px 미달 → padding 8/10 + 상쇄 margin */}
              <button
                type="button"
                onClick={() => goLibrary()}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  padding: '8px 10px',
                  margin: '-8px -10px',
                  minHeight: 'var(--hit)',
                }}
              >
                전체 보기 →
              </button>
            </div>
            {recent.length === 0 ? (
              <div style={{ padding: '28px 18px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--faint-text)' }}>아직 만든 드릴이 없습니다.</p>
                <Button variant="secondary" icon={<IconPlus size={14} />} onClick={goNewDrill}>
                  새 드릴 만들기
                </Button>
              </div>
            ) : (
              recent.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => openDrill(d.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '13px 18px',
                    borderBottom: '1px solid var(--border)',
                    minHeight: 'var(--hit)',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      flex: 'none',
                      width: 44,
                      height: 32,
                      borderRadius: 7,
                      background: categoryColor(d.category),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: '#fff',
                    }}
                  >
                    {d.stepCount}
                  </span>
                  <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                    <span style={{ display: 'block', fontSize: '0.84375rem', fontWeight: 650 }}>{d.title}</span>
                    <span style={{ display: 'block', fontSize: '0.71875rem', color: 'var(--faint-text)', marginTop: 2 }}>
                      {d.category} · {d.level}
                    </span>
                  </span>
                  <span style={{ flex: 'none', fontSize: '0.71875rem', color: 'var(--faint-text)' }}>{formatRelative(d.updatedAt)}</span>
                </button>
              ))
            )}
          </div>

          {/* 다음 훈련 세션 */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--panel)', padding: '17px 18px 18px' }}>
            <div style={{ fontSize: '0.84375rem', fontWeight: 700, marginBottom: 14 }}>다음 훈련 세션</div>
            {!next ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--faint-text)' }}>예정된 세션이 없습니다.</p>
                <Button variant="secondary" icon={<IconPlus size={14} />} onClick={() => goLibrary('sessions')}>
                  세션 만들기
                </Button>
              </div>
            ) : (
              <NextSessionCard next={next} onOpen={() => openSession(next.session.id)} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function NextSessionCard({ next, onOpen }: { next: ResolvedSession; onOpen: () => void }) {
  const { session, items, totalMin } = next;
  const shown = items.slice(0, MAX_SESSION_DRILLS);
  const more = items.length - shown.length;
  const cardStyle: CSSProperties = { width: '100%', textAlign: 'left', display: 'block' };
  return (
    <button type="button" onClick={onOpen} style={cardStyle}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.375rem', fontWeight: 700, letterSpacing: -0.5 }}>
        {session.scheduledAt !== undefined ? formatSessionWhen(session.scheduledAt) : session.title}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 3 }}>
        {[session.location, `${totalMin}분`].filter(Boolean).join(' · ')}
      </div>
      <div style={{ height: 1, background: 'var(--border)', margin: '15px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {shown.map((it) => (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: it.missing ? 0.5 : 1 }}>
            <span aria-hidden style={{ flex: 'none', width: 7, height: 7, borderRadius: '50%', background: categoryColor(it.categoryCache) }} />
            <span style={{ fontSize: '0.78125rem', fontWeight: 600 }}>{it.missing ? `${it.titleCache} (삭제됨)` : it.titleCache}</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.71875rem', color: 'var(--faint-text)' }}>
              {it.durationOverrideMin ?? it.durationMinCache}분
            </span>
          </div>
        ))}
        {more > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--faint-text)' }}>+{more}개 더</div>}
      </div>
    </button>
  );
}
