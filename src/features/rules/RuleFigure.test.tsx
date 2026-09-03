// 조항 도해(2026-08-21 신설) — 커버리지·파생·갈고리 부재를 고정한다.
//
// 여기서 잡으려는 드리프트는 셋이다: ①조항이 없는 도해를 가리키는 것, ②도해가 물리 상수와
// 따로 놀기 시작하는 것(손으로 33 을 적어 넣고 상수만 바뀌는 경우), ③코트 전용 갈고리
// `stage-svg` 를 무심코 도해에 붙여 터치 스크롤을 죽이는 것.
import { describe, expect, it } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

/** 도해가 `useLocale()` 로 로케일별 문자열을 고르므로(2026-08-31 도해 다국어) 설정 컨텍스트가
 *  있어야 렌더된다. 이 테스트는 **한국어** 도해를 재는 것이므로 기본 로케일이면 충분하다. */
const render = (ui: ReactElement) => rtlRender(<SettingsProvider>{ui}</SettingsProvider>);
import { RuleFigure } from './RuleFigure.tsx';
import { RULE_FIGURE_IDS } from './figures/ids.ts';
import { ruleContentFor } from './ruleContent.ts';
import { BALL } from '../../core/constants.ts';
import { COURT_SIZE_LABELS, GOAL_HALF_PX } from '../../model/court.ts';
import { PX_PER_M } from '../../core/units.ts';
import { figureTextFor } from './figures/text.ts';
import { LAW } from './ruleConstants.ts';

const LAWS = ruleContentFor('ko');

describe('조항 도해', () => {
  // 🪦 '제4조(선수 장비)는 도해를 단다' 는 2026-09-03 에 지웠다 — 장비 도해 자체가 없어졌다(ids.ts 묘비).

  it('모든 figureId 가 실존 도해를 가리킨다', () => {
    // 0개라서 전건 통과 를 막는다(대조군).
    expect(RULE_FIGURE_IDS.length).toBeGreaterThan(0);
    expect(LAWS.filter((l) => l.figureId).length).toBeGreaterThan(0);
    for (const law of LAWS) {
      if (!law.figureId) continue;
      expect(RULE_FIGURE_IDS, `Law ${law.law}`).toContain(law.figureId);
    }
  });

  it('코트 규격 도해의 세 라벨이 COURT_SIZE_LABELS 에서 파생된다', () => {
    // 손으로 "표준 28 × 15 m (농구 코트)" 를 다시 적으면 편집기 코트 크기 선택 UI 문구가
    // 바뀔 때 이 도해만 따로 논다.
    render(<RuleFigure id="court" />);
    for (const label of Object.values(COURT_SIZE_LABELS.ko)) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
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

  it.each(RULE_FIGURE_IDS)('%s 도해 SVG 는 코트 전용 갈고리(stage-svg)를 달지 않는다', (id) => {
    // `.stage-svg` 는 강제색 제외와 함께 `touch-action: none` 을 물고 온다(FigureCard.tsx
    // 머리말). 도해는 세로로 긴 읽기 흐름 안에 있어 그걸 달면 태블릿에서 스크롤이 죽는다.
    // 2026-09-03 까지는 ball 한 장만 봤다 — 새 도해 4장이 들어오며 전 도해로 넓혔다.
    const { container } = render(<RuleFigure id={id} />);
    expect(container.querySelectorAll('.stage-svg')).toHaveLength(0);
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  // 2026-09-03 카드 1·2 도해 4장(PLAN §11) — 셋 다 '수치가 LAW 상수에서 파생되는가' 만 잰다.
  // lineage 는 단언이 없다: 연도·이름을 단언하면 검사표가 데이터를 베끼는 자기증명이다.
  it('등급 정원 도해의 칸 수가 LAW 에서 파생된다', () => {
    // 손으로 4·2 를 적어 넣으면 상한이 바뀔 때 이 도해만 따로 논다.
    const { container } = render(<RuleFigure id="pf-quota" />);
    expect(container.querySelectorAll('rect[data-slot]').length).toBe(LAW.teamMaxOnCourt);
    expect(container.querySelectorAll('rect[data-slot="pf2"]').length).toBe(LAW.pf2MaxOnCourt);
  });

  it('경기 시간 도해의 세 칸 폭이 LAW 의 분수에서 파생된다', () => {
    // 손으로 88·176 을 적으면 LAW.halfMin/halftimeMaxMin 이 바뀌어도 그림만 옛 비율로 남는다.
    const { container } = render(<RuleFigure id="match-clock" />);
    const w = (seg: string) =>
      Number(container.querySelector(`rect[data-seg="${seg}"]`)?.getAttribute('width'));
    expect(w('halftime') / w('first')).toBeCloseTo(LAW.halftimeMaxMin / LAW.halfMin, 5);
  });

  it('물림 도해의 인플레이 : 아웃 폭 비가 LAW.stuckBallSec 에서 파생된다', () => {
    // 축 스케일(px/초)이 LAW.stuckBallSec 에서 나오므로, 인플레이(5초분) ÷ 아웃(1초분) 은
    // 상수와 같아야 한다. 인플레이 폭을 300 으로 손으로 적으면 상수가 6 이 되는 순간 빨개진다.
    const { container } = render(<RuleFigure id="stuck-ball" />);
    const inPlay = container.querySelector('rect[data-seg="in-play"]');
    const out = container.querySelector('rect[data-seg="out"]');
    const w = (el: Element | null) => Number(el?.getAttribute('width'));
    expect(w(out)).toBeGreaterThan(0);
    expect(w(inPlay) / w(out)).toBeCloseTo(LAW.stuckBallSec);
  });

  // 2026-09-03 저녁 — 카드당 3장(goal-posts·goal-height). 역시 상수 파생만 잰다.
  it('골대 도해의 간격 라벨이 GOAL_HALF_PX·PX_PER_M 에서 파생된다', () => {
    // 손으로 '6m' 을 적어 넣으면 골대 폭 상수가 바뀔 때 이 도해만 옛 수치로 남는다.
    // 기대값도 text.ts 의 포맷 함수로 조립한다 — 검사표가 '6m' 이라는 문자열을 따로 아는 순간
    // 로케일 문구(예: 'width 6 m')가 바뀌어도 초록으로 남아 아무것도 지키지 못한다.
    const widthM = (GOAL_HALF_PX * 2) / PX_PER_M;
    const { container } = render(<RuleFigure id="goal-posts" />);
    const label = container.querySelector('text[data-dim="goal-width"]');
    expect(label?.textContent).toBe(figureTextFor('ko').goalPosts.width(widthM));
  });

  it('골 높이 도해의 한계선 높이 : 공 지름 비가 규정 상수에서 파생된다', () => {
    // 축척(px/cm) 하나에서 두 길이가 나오므로 픽셀 비 = LAW.liftedBallM : BALL.diameterM 이어야
    // 한다. 한계선을 100px 로 손으로 적으면(= "공 한 개 반쯤" 이라는 어림) 여기서 빨개진다.
    const { container } = render(<RuleFigure id="goal-height" />);
    const limitH = Number(container.querySelector('[data-limit-h]')?.getAttribute('data-limit-h'));
    const ballR = Number(container.querySelector('circle[data-ball="grounded"]')?.getAttribute('r'));
    expect(ballR).toBeGreaterThan(0);
    expect(limitH / (ballR * 2)).toBeCloseTo(LAW.liftedBallM / BALL.diameterM, 5);
  });
});
