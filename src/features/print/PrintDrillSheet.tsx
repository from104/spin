// §6.3 문서 ② **드릴 시트** — 1페이지 = 1스텝. 60스텝까지 그대로 60장이 된다.
//
// 이 트리는 화면 트리와 **별개**다(계획서 6.3 "인쇄 전용 트리"). 화면 컴포넌트에 @media print
// 를 덕지덕지 붙이면 둘 다 망가진다 — 편집기는 창 안에 갇혀야 하고(§6.4) 종이는 갇히면 안
// 된다. 평소에는 `styles/print.css` 의 `.spin-print { display:none }` 으로 통째로 접혀 있다.
import { DRILL_LEVEL_LABELS, DRILL_TYPE_LABELS, SITUATION_LABELS } from '../../model/drill.ts';
import type { Drill } from '../../model/drill.ts';
import { namedRosterOf } from '../../model/chairLabel.ts';
import type { Locale } from '../../i18n/locale.ts';
import { PrintCourt } from './PrintCourt.tsx';
import type { PrintViewSwitches } from './PrintRoot.tsx';
import { prepFor, prepLine } from './prep.ts';
import { PRINT_PAGE_CLASS } from './printDom.ts';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import { translate } from '../../i18n/useT.ts';

export interface PrintDrillSheetProps {
  drill: Drill;
  view: PrintViewSwitches;
}

/** "중급 · 전술 · 킥인 · 12분". 훈련량(반복·세트·인터벌)은 v8 에서 폐기됐다 — 옛 문서의 값은
 *  마이그레이션이 description 말미에 글로 보존하므로 종이에서도 그 줄로 나온다. */
function metaLine(drill: Drill, locale: Locale): string {
  const parts: string[] = [DRILL_LEVEL_LABELS[locale][drill.level], DRILL_TYPE_LABELS[locale][drill.drillType]];
  if (drill.situation !== undefined) parts.push(SITUATION_LABELS[locale][drill.situation]);
  parts.push(translate(locale, 'print.minutes', { n: drill.durationMin }));
  return parts.join(' · ');
}

export function PrintDrillSheet({ drill, view }: PrintDrillSheetProps) {
  const t = useT();
  const locale = useLocale();
  const prep = prepLine(prepFor(drill), locale);
  const total = drill.steps.length;
  // §7 3.4 선수 실명(§0.5 미배송 빚, 2026-08-20) — 시연 화면(PresentRunner)의 범례와
  // 같은 값·같은 규칙(namedRosterOf). 첫 장에만(위 목적·코칭 포인트와 같은 이유 — 드릴
  // 전체 정보를 60장마다 반복하지 않는다).
  const namedRoster = namedRosterOf(drill.cast.chairs);

  return (
    <>
      {drill.steps.map((step, i) => (
        <section key={step.id} className={PRINT_PAGE_CLASS} data-print-page="step" data-step-index={i}>
          <header className="spin-print-head">
            <span className="spin-print-title">{drill.title}</span>
            {/* n/N — 종이가 흩어졌을 때 순서를 되찾는 유일한 단서다. */}
            <span className="spin-print-num">{t('print.stepCounter', { i: i + 1, total })}</span>
          </header>

          {prep && (
            <p className="spin-print-prep">
              <b>{t('print.prepLabel')}</b> {prep}
            </p>
          )}

          <PrintCourt drill={drill} step={step} view={view} ariaLabel={t('print.stepCourtAriaLabel', { title: drill.title, i: i + 1 })} />

          <div className="spin-print-body">
            {/* step.name 은 과제⑦ 이후 항상 '' 다(validate.ts 정화기가 로드 시 note 로
                이관해 비운다) — `step.name ||` 폴백은 이제 죽은 가지라 지웠다. 옛 이름은
                note 첫 줄로 살아 있고, 아래 문단이 그 줄부터 그대로 보여준다(검증 결함
                수정, 2026-08-17). */}
            <h2 className="spin-print-steptitle">{t('print.stepHeading', { i: i + 1 })}</h2>
            {/* white-space: pre-line(styles/print.css) — 병합된 옛 이름이 note 첫 줄로
                들어와 있어, 줄바꿈을 살려야 "이름 줄"과 "본문 줄"이 종이 위에서도 나뉜다. */}
            {step.note && <p className="spin-print-note">{step.note}</p>}
            {step.durationMs !== undefined && (
              <p className="spin-print-dim">{t('print.stepDuration', { sec: Math.round(step.durationMs / 100) / 10 })}</p>
            )}
          </div>

          {/* 드릴 전체에 걸린 정보(목적·코칭 포인트)는 **첫 장에만** 싣는다. 60장에 같은 문단을
              60번 찍으면 코치가 매 장에서 같은 글을 다시 읽어야 하고, 정작 그 장의 스텝 메모가
              아래로 밀린다. */}
          {i === 0 && (
            <footer className="spin-print-foot">
              <p className="spin-print-dim">{metaLine(drill, locale)}</p>
              {drill.objective && (
                <p className="spin-print-objective">
                  <b>{t('presentInfo.objectiveLabel')}</b> {drill.objective}
                </p>
              )}
              {drill.coachingPoints && drill.coachingPoints.length > 0 && (
                <ul className="spin-print-points">
                  {drill.coachingPoints.map((p, k) => (
                    <li key={k}>{p}</li>
                  ))}
                </ul>
              )}
              {/* 변형(v8, USPSA Variation) — 목적과 같은 '드릴 전체' 정보라 첫 장에만. */}
              {drill.variation && (
                <p className="spin-print-dim">
                  <b>{t('presentInfo.variationLabel')}</b> {drill.variation}
                </p>
              )}
              {drill.equipment && (
                <p className="spin-print-dim">
                  <b>{t('print.equipmentLabel')}</b> {drill.equipment}
                </p>
              )}
              {namedRoster.length > 0 && (
                <p className="spin-print-dim">
                  <b>{t('print.rosterLabel')}</b> {namedRoster.join(' · ')}
                </p>
              )}
            </footer>
          )}
        </section>
      ))}
    </>
  );
}
