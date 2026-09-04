// 규칙 화면 조항 도해(2026-08-21)의 공용 껍데기 — 제목띠 + 그림 + 캡션.
//
// 보드 장면(`RuleScenePlayer`)과 **다른 물건**이다. 장면은 `Drill` 을 시간축으로 재생하는
// 코트 애니메이션이고, 도해는 코트가 아닌 것(공·장비·시간·징계처럼 판 위에서 벌어지지 않는
// 조항)을 한 장의 정지 그림으로 설명한다. 둘은 한 조항에 함께 놓일 수 있다.
//
// ⚠️ **`stage-svg` 를 달지 않는다.** 그 클래스는 코트 전용 갈고리로 강제색 제외(`contrast.css`)
// 와 함께 `touch-action: none` 을 물고 오는데(`appShell.css` 머리말), 도해는 세로로 긴 읽기
// 흐름 안에 있어 터치 스크롤이 죽으면 태블릿에서 조항을 못 읽는다. 대신 도해는 **강제색에서
// 스스로 살아남게** 그린다 — 구분은 전부 모양·라벨·치수선이 지고 색은 장식만 한다(색이 전부
// CanvasText 로 치환돼도 선 그림으로 읽힌다). 그래서 제외 갈고리가 필요 없다.
import type { ReactNode } from 'react';

/** 보드 장면(`RulesScreen.RuleScenePlayer`)의 `maxWidth: 560` 과 같은 값 — 한 조항 안에서
 *  도해와 코트가 같은 폭으로 서야 눈이 흔들리지 않는다. */
export const FIGURE_MAX_WIDTH_PX = 560;

export interface FigureCardProps {
  /** 그림 위 제목띠. 도해가 여러 장일 때 무엇을 보는 중인지 알려 준다. */
  title: string;
  /** SVG `viewBox` 의 가로:세로 — 카드가 폭에 맞춰 늘어날 때 높이를 잡는다. */
  aspect: `${number} / ${number}`;
  /** 그림 아래 한 줄 설명. 그림이 말하지 못하는 근거·수치를 여기서 말한다. */
  caption?: string;
  children: ReactNode;
}

export function FigureCard({ title, aspect, caption, children }: FigureCardProps) {
  return (
    <figure
      style={{
        maxWidth: FIGURE_MAX_WIDTH_PX,
        marginTop: 18,
        border: '1px solid var(--border)',
        borderRadius: 16,
        background: 'var(--panel-2)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '9px 14px',
          borderBottom: '1px solid var(--border)',
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: 'var(--faint-text)',
        }}
      >
        {title}
      </div>
      <div style={{ width: '100%', aspectRatio: aspect, padding: '10px 12px' }}>{children}</div>
      {caption && (
        <figcaption
          style={{
            padding: '0 14px 12px',
            fontSize: '0.8125rem',
            lineHeight: 1.55,
            color: 'var(--muted)',
          }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
