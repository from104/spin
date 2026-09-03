// 노트 띠의 높이 규칙만 본다 — 나머지(포스터·단일 활성·컨트롤)는 `RulesScreen.test.tsx` 담당.
//
// 지키는 것 두 가지가 서로 반대 방향이라 한 파일에 같이 둔다:
//  ① 노트가 있는 장면은 **여전히** min=max 고정이어야 한다(재생 중 노트 길이가 달라져도 판이 안 뛴다).
//  ② 노트가 한 줄도 없는 장면은 그 64px 을 빈 채로 물고 있으면 안 된다.
// 한쪽만 재면 "다 접어 버리기"나 "아무것도 안 하기"가 초록으로 통과한다.
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RuleSceneBlock } from './RuleSceneBlock.tsx';
import { buildRuleScene } from './ruleScenes.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

function renderScene(sceneId: Parameters<typeof buildRuleScene>[0]) {
  return render(
    <SettingsProvider>
      <RuleSceneBlock sceneId={sceneId} active={false} onActivate={() => {}} />
    </SettingsProvider>,
  );
}

/** 인라인 style 로 박은 고정 높이를 DOM 에서 그대로 찾는다 — 상수를 import 해서 비교하면
 *  상수를 0 으로 바꾸는 회귀가 그대로 통과한다. */
const fixedBands = (root: HTMLElement) => root.querySelectorAll('[style*="min-height: 64px"]');

describe('RuleSceneBlock — 노트 띠 높이', () => {
  it('노트가 있는 장면은 고정 높이 띠를 그대로 쓴다 (판이 위아래로 안 뛰게)', () => {
    const { container } = renderScene('field-tour');
    const note = screen.getByText(/코트 규격은 28×15m/);
    expect(note.parentElement).toHaveStyle({ minHeight: '64px', maxHeight: '64px' });
    expect(fixedBands(container)).toHaveLength(1);
  });

  it('노트가 있는 **다스텝** 장면도 고정 높이를 유지한다 — 고정이 실제로 필요한 유일한 경우', () => {
    // 위 케이스(field-tour)는 1스텝이라, 판정을 "1스텝일 때만 고정"으로 좁히는 회귀를 못 잡는다.
    // 그런데 64px 고정이 애초에 막으려던 것은 **재생 중** 노트 길이가 달라져 판이 뛰는 것이라,
    // 보호가 정말 필요한 쪽은 다스텝이다. 손코딩 장면 9벌 중 하나로 그 자리를 막는다.
    const { container } = renderScene('ramming');
    const steps = buildRuleScene('ramming').steps;
    expect(steps.length).toBeGreaterThan(1);
    expect(steps.every((s) => s.note)).toBe(true); // 전제가 깨지면 이 케이스는 무의미해진다
    expect(fixedBands(container)).toHaveLength(1);
  });

  it('노트가 없는 다스텝 장면은 STEP 줄만 남기고 64px 고정을 풀어 준다', () => {
    const { container } = renderScene('corner');
    // 전제: 기현님이 편집기로 만든 장면이라 스텝 노트가 한 줄도 없다.
    expect(buildRuleScene('corner').steps.every((s) => !s.note)).toBe(true);
    // STEP 줄은 진행 위치를 알려 주는 유일한 읽을거리라 남는다.
    expect(screen.getByText('STEP 1/5')).toBeInTheDocument();
    expect(fixedBands(container)).toHaveLength(0);

    // 노트도 STEP 줄도 없는 1스텝 장면(set-ball)도 같은 결론(fixedBands 0) — 띠를 아예 안 만든다.
    const single = renderScene('set-ball');
    expect(buildRuleScene('set-ball').steps).toHaveLength(1);
    expect(within(single.container).queryByText(/^STEP /)).toBeNull();
    expect(fixedBands(single.container)).toHaveLength(0);
  });
});
