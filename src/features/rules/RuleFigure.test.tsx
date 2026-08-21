// 조항 도해(2026-08-21 신설) — 커버리지·파생·갈고리 부재를 고정한다.
//
// 여기서 잡으려는 드리프트는 셋이다: ①조항이 없는 도해를 가리키는 것, ②도해가 물리 상수와
// 따로 놀기 시작하는 것(손으로 33 을 적어 넣고 상수만 바뀌는 경우), ③코트 전용 갈고리
// `stage-svg` 를 무심코 도해에 붙여 터치 스크롤을 죽이는 것.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RuleFigure } from './RuleFigure.tsx';
import { RULE_FIGURE_IDS } from './figures/ids.ts';
import { ruleContentFor } from './ruleContent.ts';
import { BALL } from '../../core/constants.ts';

const LAWS = ruleContentFor('ko');

describe('조항 도해', () => {
  it('대조군 — 도해가 최소 하나 있고, 그것을 다는 조항도 있다', () => {
    // 0개라서 전건 통과 를 막는다.
    expect(RULE_FIGURE_IDS.length).toBeGreaterThan(0);
    expect(LAWS.filter((l) => l.figureId).length).toBeGreaterThan(0);
  });

  it('모든 figureId 가 실존 도해를 가리킨다', () => {
    for (const law of LAWS) {
      if (!law.figureId) continue;
      expect(RULE_FIGURE_IDS, `Law ${law.law}`).toContain(law.figureId);
    }
  });

  it('제2조(공)는 도해를 단다 — 글자만 남지 않는다', () => {
    // 2026-08-21 기현님 지적("2조에서는 공이 주인공이어서 크기나 구조를 시각적으로")의 회귀 방지.
    expect(LAWS.find((l) => l.law === 2)?.figureId).toBe('ball');
  });

  it.each(RULE_FIGURE_IDS)('%s 도해가 그림 역할로 렌더된다', (id) => {
    render(<RuleFigure id={id} />);
    const imgs = screen.getAllByRole('img');
    expect(imgs.length).toBeGreaterThan(0);
    // 그림마다 대체 텍스트가 있어야 한다 — 스크린리더에서 도해가 통째로 사라지면 그 조항은
    // 다시 "글자만" 이 된다.
    for (const img of imgs) expect(img.getAttribute('aria-label')?.length ?? 0).toBeGreaterThan(10);
  });

  it('공 도해의 지름 표기가 BALL.diameterM 에서 파생된다', () => {
    render(<RuleFigure id="ball" />);
    const cm = Math.round(BALL.diameterM * 100);
    // 손으로 적은 33 이면 상수를 바꾸는 순간 여기가 빨개진다.
    expect(screen.getAllByText(`${cm}cm`).length).toBeGreaterThan(0);
  });

  it('도해 SVG 는 코트 전용 갈고리(stage-svg)를 달지 않는다', () => {
    // `.stage-svg` 는 강제색 제외와 함께 `touch-action: none` 을 물고 온다(FigureCard.tsx
    // 머리말). 도해는 세로로 긴 읽기 흐름 안에 있어 그걸 달면 태블릿에서 스크롤이 죽는다.
    const { container } = render(<RuleFigure id="ball" />);
    expect(container.querySelectorAll('.stage-svg')).toHaveLength(0);
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });
});
