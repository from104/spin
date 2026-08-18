// §6.3 문서 ② **드릴 시트** — 1페이지 = 1스텝. 60스텝까지 그대로 60장이 된다.
//
// 이 트리는 화면 트리와 **별개**다(계획서 6.3 "인쇄 전용 트리"). 화면 컴포넌트에 @media print
// 를 덕지덕지 붙이면 둘 다 망가진다 — 편집기는 창 안에 갇혀야 하고(§6.4) 종이는 갇히면 안
// 된다. 평소에는 `styles/print.css` 의 `.spin-print { display:none }` 으로 통째로 접혀 있다.
import { DRILL_TYPE_LABELS, SITUATION_LABELS } from '../../model/drill.ts';
import type { Drill } from '../../model/drill.ts';
import { PrintCourt } from './PrintCourt.tsx';
import { prepFor, prepLine } from './prep.ts';
import { PRINT_PAGE_CLASS } from './printDom.ts';

export interface PrintDrillSheetProps {
  drill: Drill;
}

/** "중급 · 전술 · 킥인 · 12분". 훈련량(반복·세트·인터벌)은 v8 에서 폐기됐다 — 옛 문서의 값은
 *  마이그레이션이 description 말미에 글로 보존하므로 종이에서도 그 줄로 나온다. */
function metaLine(drill: Drill): string {
  const parts: string[] = [drill.level, DRILL_TYPE_LABELS[drill.drillType]];
  if (drill.situation !== undefined) parts.push(SITUATION_LABELS[drill.situation]);
  parts.push(`${drill.durationMin}분`);
  return parts.join(' · ');
}

export function PrintDrillSheet({ drill }: PrintDrillSheetProps) {
  const prep = prepLine(prepFor(drill));
  const total = drill.steps.length;

  return (
    <>
      {drill.steps.map((step, i) => (
        <section key={step.id} className={PRINT_PAGE_CLASS} data-print-page="step" data-step-index={i}>
          <header className="spin-print-head">
            <span className="spin-print-title">{drill.title}</span>
            {/* n/N — 종이가 흩어졌을 때 순서를 되찾는 유일한 단서다. */}
            <span className="spin-print-num">
              스텝 {i + 1}/{total}
            </span>
          </header>

          {prep && (
            <p className="spin-print-prep">
              <b>준비물</b> {prep}
            </p>
          )}

          <PrintCourt drill={drill} step={step} ariaLabel={`${drill.title} 스텝 ${i + 1} 코트`} />

          <div className="spin-print-body">
            {/* step.name 은 과제⑦ 이후 항상 '' 다(validate.ts 정화기가 로드 시 note 로
                이관해 비운다) — `step.name ||` 폴백은 이제 죽은 가지라 지웠다. 옛 이름은
                note 첫 줄로 살아 있고, 아래 문단이 그 줄부터 그대로 보여준다(검증 결함
                수정, 2026-08-17). */}
            <h2 className="spin-print-steptitle">스텝 {i + 1}</h2>
            {/* white-space: pre-line(styles/print.css) — 병합된 옛 이름이 note 첫 줄로
                들어와 있어, 줄바꿈을 살려야 "이름 줄"과 "본문 줄"이 종이 위에서도 나뉜다. */}
            {step.note && <p className="spin-print-note">{step.note}</p>}
            {step.durationMs !== undefined && <p className="spin-print-dim">이 스텝 {Math.round(step.durationMs / 100) / 10}초</p>}
          </div>

          {/* 드릴 전체에 걸린 정보(목적·코칭 포인트)는 **첫 장에만** 싣는다. 60장에 같은 문단을
              60번 찍으면 코치가 매 장에서 같은 글을 다시 읽어야 하고, 정작 그 장의 스텝 메모가
              아래로 밀린다. */}
          {i === 0 && (
            <footer className="spin-print-foot">
              <p className="spin-print-dim">{metaLine(drill)}</p>
              {drill.objective && (
                <p className="spin-print-objective">
                  <b>목적</b> {drill.objective}
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
                  <b>변형</b> {drill.variation}
                </p>
              )}
              {drill.equipment && (
                <p className="spin-print-dim">
                  <b>장비</b> {drill.equipment}
                </p>
              )}
            </footer>
          )}
        </section>
      ))}
    </>
  );
}
