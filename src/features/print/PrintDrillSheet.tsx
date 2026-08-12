// §6.3 문서 ② **드릴 시트** — 1페이지 = 1스텝. 60스텝까지 그대로 60장이 된다.
//
// 이 트리는 화면 트리와 **별개**다(계획서 6.3 "인쇄 전용 트리"). 화면 컴포넌트에 @media print
// 를 덕지덕지 붙이면 둘 다 망가진다 — 편집기는 창 안에 갇혀야 하고(§6.4) 종이는 갇히면 안
// 된다. 평소에는 `styles/print.css` 의 `.spin-print { display:none }` 으로 통째로 접혀 있다.
import type { Drill } from '../../model/drill.ts';
import { PrintCourt } from './PrintCourt.tsx';
import { prepFor, prepLine } from './prep.ts';
import { PRINT_PAGE_CLASS } from './printDom.ts';

export interface PrintDrillSheetProps {
  drill: Drill;
}

/** "중급 · 슈팅 · 12분 · 3회 × 2세트 · 인터벌 30초". 0 은 **미지정**이라 아예 안 적는다
 *  (§7 3.3 — 1 을 기본값으로 두면 정하지도 않은 "1회 × 1세트" 를 종이가 사실인 양 찍는다). */
function metaLine(drill: Drill): string {
  const parts: string[] = [drill.level, drill.category, `${drill.durationMin}분`];
  const reps = drill.reps ?? 0;
  const sets = drill.sets ?? 0;
  if (reps > 0 && sets > 0) parts.push(`${reps}회 × ${sets}세트`);
  else if (reps > 0) parts.push(`${reps}회`);
  else if (sets > 0) parts.push(`${sets}세트`);
  const interval = drill.intervalSec ?? 0;
  if (interval > 0) parts.push(`인터벌 ${interval}초`);
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
            <h2 className="spin-print-steptitle">{step.name || `스텝 ${i + 1}`}</h2>
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
