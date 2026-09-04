// §6.3 문서 ① **세션 계획서** — 표지 1장 + 드릴마다 1장.
//
// 표지: 세션명 · 날짜 · 장소 · 총 시간 · 드릴 순서 타임테이블.
// 드릴 장: 코트 그림(첫 스텝) · 배정 시간 · 스텝별 코칭 메모 · 다음 휴식 · 준비물.
//
// 삭제된 드릴(참조만 남은 항목)은 **표지 표에는 남고 드릴 장은 안 만든다** — 그릴 코트가
// 없기 때문이다. 표에서까지 지우면 코치가 "내가 넣었던 그 드릴이 어디 갔지" 를 종이만 보고는
// 알 수 없다(sessionPlan.ts `planDrillEntries` 머리말과 짝).
import { PrintCourt } from './PrintCourt.tsx';
import type { PrintViewSwitches } from './PrintRoot.tsx';
import { prepLine } from './prep.ts';
import { PRINT_PAGE_CLASS } from './printDom.ts';
import { planDrillEntries, type SessionPlan } from './sessionPlan.ts';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';

export interface PrintSessionPlanProps {
  plan: SessionPlan;
  view: PrintViewSwitches;
}

export function PrintSessionPlan({ plan, view }: PrintSessionPlanProps) {
  const t = useT();
  const locale = useLocale();
  const drillEntries = planDrillEntries(plan);
  const prep = prepLine(plan.prep, locale);

  return (
    <>
      <section className={PRINT_PAGE_CLASS} data-print-page="cover">
        <h1 className="spin-print-h1">{plan.title}</h1>
        <p className="spin-print-meta">
          {[
            plan.when,
            plan.location,
            t('print.session.totalLabel', { min: plan.totalMin }),
            t('print.session.drillCount', { n: drillEntries.length }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {prep && (
          <p className="spin-print-prep">
            <b>{t('print.prepLabel')}</b> {prep}
          </p>
        )}
        {plan.note && <p className="spin-print-note">{plan.note}</p>}

        <table className="spin-print-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">{t('print.session.tableDrill')}</th>
              <th scope="col">{t('print.session.tableTime')}</th>
              <th scope="col">{t('print.session.tableRest')}</th>
              <th scope="col">{t('print.session.tableNote')}</th>
            </tr>
          </thead>
          <tbody>
            {plan.entries.map((e) => (
              <tr key={e.order} data-plan-row={e.order} data-missing={e.missing ? 'true' : undefined}>
                <td>{e.order}</td>
                <td>
                  {e.title}
                  {e.missing && <span className="spin-print-dim">{t('print.session.missingDrill')}</span>}
                </td>
                <td>{t('print.minutes', { n: e.durationMin })}</td>
                <td>{e.restAfterMin > 0 ? t('print.minutes', { n: e.restAfterMin }) : '—'}</td>
                <td>{e.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {drillEntries.map((e) => {
        const drill = e.drill!;
        const first = drill.steps[0];
        return (
          <section key={e.order} className={PRINT_PAGE_CLASS} data-print-page="drill" data-plan-order={e.order}>
            <header className="spin-print-head">
              <span className="spin-print-title">
                {e.order}. {e.title}
              </span>
              <span className="spin-print-num">
                {t('print.minutes', { n: e.durationMin })}
                {e.restAfterMin > 0 ? t('print.session.nextRestSuffix', { min: e.restAfterMin }) : ''}
              </span>
            </header>

            {e.prep && prepLine(e.prep, locale) && (
              <p className="spin-print-prep">
                <b>{t('print.prepLabel')}</b> {prepLine(e.prep, locale)}
              </p>
            )}

            {first && <PrintCourt drill={drill} step={first} view={view} ariaLabel={t('print.session.courtAriaLabel', { title: e.title })} />}

            <div className="spin-print-body">
              {drill.objective && (
                <p className="spin-print-objective">
                  <b>{t('presentInfo.objectiveLabel')}</b> {drill.objective}
                </p>
              )}
              {/* 스텝별 코칭 메모 — 세션 계획서는 드릴당 한 장이라 스텝 그림을 다 실을 수 없다.
                  대신 번호·메모를 순서대로 세워 코치가 현장에서 읽어 내려갈 수 있게 한다.
                  s.name 은 과제⑦ 이후 항상 '' 라(validate.ts 가 로드 시 note 로 이관) 옛
                  `s.name ||` 폴백은 죽은 가지였다 — 지금은 번호로 고정하고, 옛 이름은
                  note 첫 줄로 살아 있다(white-space: pre-line, styles/print.css, 검증
                  결함 수정 2026-08-17). */}
              <ol className="spin-print-steps">
                {drill.steps.map((s, i) => (
                  <li key={s.id} data-step-index={i}>
                    <b>{t('print.stepHeading', { i: i + 1 })}</b>
                    {s.note ? ` — ${s.note}` : ''}
                  </li>
                ))}
              </ol>
              {drill.coachingPoints && drill.coachingPoints.length > 0 && (
                <ul className="spin-print-points">
                  {drill.coachingPoints.map((p, k) => (
                    <li key={k}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}
