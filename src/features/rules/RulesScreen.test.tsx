// 규칙 화면(2026-08-22 주제별 재설계) 스모크 테스트 — 카드 홈·주제 상세·비교표·단일 활성.
// 장면 데이터 자체는 `ruleScenes.test.ts`, 조항 도해는 `RuleFigure.test.tsx`, 콘텐츠 모델
// 불변식은 `ruleTopics.test.ts` 가 따로 본다 — 여기서는 "화면에 실제로 붙어 나오는가" 만 본다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulesScreen } from './RulesScreen.tsx';
import { ruleTopicsFor } from './ruleTopics.ts';
import type { RuleTopicKey } from './ruleTopics.ts';
import { ruleContentFor } from './ruleContent.ts';
import { RESTART_COLUMNS } from './restartTable.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import type { HomeNav } from '../home/nav.ts';

function makeNav(onOpenRuleTopic: (key?: string) => void): HomeNav {
  return {
    newDrill: vi.fn(),
    openDrill: vi.fn(),
    goLibrary: vi.fn(),
    openSession: vi.fn(),
    presentDrill: vi.fn(),
    presentSession: vi.fn(),
    openRuleTopic: onOpenRuleTopic,
  };
}

/** 실제 AppShell 과 같은 계약(URL 이 선택 상태의 유일한 출처)을 로컬 state 로 흉내 낸다 —
 *  RulesScreen 은 controlled 컴포넌트라 `nav.openRuleTopic()` 호출만으로는 화면이 안 바뀐다,
 *  그 호출이 "다음 렌더의 topic prop" 으로 돌아와야 바뀐다(실제로는 react-router 가 그 역할). */
function Harness({ initialTopic }: { initialTopic?: string }) {
  const [topic, setTopic] = useState(initialTopic);
  return <RulesScreen topic={topic} nav={makeNav(setTopic)} />;
}

function renderRules(initialTopic?: string) {
  return render(
    <SettingsProvider>
      <Harness initialTopic={initialTopic} />
    </SettingsProvider>,
  );
}

/** jsdom 에는 matchMedia 가 없다 — 안 깔면 useIsNarrow 가 항상 넓은 쪽으로 굳는다
 *  (AppShell.wiring.test.tsx 의 같은 이름 헬퍼와 동일한 이유·구현). */
function stubMedia(narrow: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: q.includes('max-width') ? narrow : false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}

const TOPICS = ruleTopicsFor('ko');

/** 제목은 개편 때마다 바뀌지만 key 는 딥링크라 잘 안 바뀐다 — 제목은 데이터에서 읽는다.
 *  인자를 `string` 이 아니라 `RuleTopicKey` 로 좁혀야 오타가 **컴파일 때** 잡힌다 — string 이면
 *  없는 key 가 런타임에 `undefined.title` 로 터지고, 그때 non-null `!` 은 거짓말이 된다. */
const titleOf = (key: RuleTopicKey) => TOPICS.find((t) => t.key === key)!.title;

describe('RulesScreen — 카드 홈', () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubMedia(false);
  });

  it('9주제 카드가 전부 뜬다', () => {
    renderRules();
    expect(TOPICS).toHaveLength(9);
    for (const topic of TOPICS) {
      expect(screen.getByRole('button', { name: topic.title })).toBeInTheDocument();
    }
  });

  it('기본 진입은 홈이다 — 어떤 주제 제목도 아직 안 보인다', () => {
    renderRules();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('튜토리얼 앵커가 렌더된 DOM 에 실제로 붙는다', () => {
    // `ruleTopics.test.ts` 는 **데이터**(어느 주제가 앵커를 갖는가)만 지킨다. 정작 8→9 개편에서
    // 조용히 깨졌던 자리는 `RulesHome` 이 그 데이터를 `data-tut` 으로 **내보내는** 한 줄이었다
    // (그전엔 `i === 0` 위치 의존이라 첫 카드가 basics→intro 로 바뀌자 배지 없는 카드를 가리켰다).
    // 튜토리얼이 실제로 쓰는 조회(`document.querySelector`)와 같은 경로로 재야 그 줄이 지켜진다.
    renderRules();
    const anchored = document.querySelectorAll('[data-tut="rules-card"]');
    expect(anchored).toHaveLength(1);
    expect(anchored[0]).toHaveAccessibleName(titleOf('basics'));
    expect(document.querySelectorAll('[data-tut="rules-appendix"]')).toHaveLength(1);
    expect(document.querySelector('[data-tut="rules-appendix"]')).toHaveAccessibleName(titleOf('rulebook'));
  });

  it('카드를 고르면 상세로 들어간다 — 되돌아가는 [목록으로]는 앱 헤더의 것이라 AppShell.wiring.test 가 잰다', async () => {
    renderRules();
    const user = userEvent.setup();
    // 제목 문자열을 직접 쓰지 않고 인덱스로 집는다 — 카드 구성이 바뀔 때마다 깨지지 않게.
    await user.click(screen.getByRole('button', { name: TOPICS[0]!.title }));
    expect(screen.getByRole('heading', { level: 2, name: TOPICS[0]!.title })).toBeInTheDocument();
    // 상세에 들어가면 다른 주제의 '카드' 버튼은 사라진다 — 아래쪽 [다음 주제] 링크는 접근성
    // 이름이 제목보다 길어서(안내 문구 포함) 정확 일치로는 안 잡힌다.
    expect(screen.queryByRole('button', { name: TOPICS[1]!.title })).toBeNull();
    // 2026-09-03: 문서 안 [← 홈으로] 는 헤더 [← 목록으로] 로 올라갔다 — 이 화면 단독 렌더에는 없다.
    expect(screen.queryByRole('button', { name: /홈으로|목록으로/ })).toBeNull();
  });

  it('상세 하단의 이전/다음 주제로 이웃 주제를 오간다', async () => {
    renderRules();
    const user = userEvent.setup();
    // 두 번째 주제로 들어가면 이전=첫 주제·다음=세 번째 주제가 있다.
    await user.click(screen.getByRole('button', { name: TOPICS[1]!.title }));
    expect(screen.getByRole('heading', { level: 2, name: TOPICS[1]!.title })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: new RegExp(TOPICS[2]!.title) }));
    expect(screen.getByRole('heading', { level: 2, name: TOPICS[2]!.title })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: new RegExp(TOPICS[1]!.title) }));
    expect(screen.getByRole('heading', { level: 2, name: TOPICS[1]!.title })).toBeInTheDocument();
  });

  it('주제를 열면 제목(h2)이 포커스를 받는다 — 이전/다음으로 넘어가도 마찬가지', async () => {
    // AppShell 의 §7.6 포커스 이펙트는 화면 키가 안 바뀌는 주제 전환에서는 안 돈다 —
    // 이 문서가 스스로 제목으로 포커스를 옮기지 않으면 [다음 주제]를 누른 뒤 포커스가
    // 사라진 노드에 남는다(9CARDS §8-6b).
    renderRules();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: TOPICS[0]!.title }));
    expect(screen.getByRole('heading', { level: 2, name: TOPICS[0]!.title })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: new RegExp(TOPICS[1]!.title) }));
    expect(screen.getByRole('heading', { level: 2, name: TOPICS[1]!.title })).toHaveFocus();
  });

  it('다음 주제로 넘어가면 스크롤이 맨 위로 돌아온다', async () => {
    // 포커스와 스크롤 복귀는 같은 이펙트의 두 줄인데, 포커스만 재면 스크롤 줄을 지워도 아무도
    // 모른다. 되감는 대상이 `window` 가 아니라 `<main id="main">` 인 것이 핵심이다 —
    // `appShell.css` 가 html/body/#root 를 `overflow:hidden` 으로 못박아 페이지 자체는 안 구른다.
    renderRules();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: TOPICS[0]!.title }));

    const scroller = document.getElementById('main')!;
    scroller.scrollTop = 400;
    await user.click(screen.getByRole('button', { name: new RegExp(TOPICS[1]!.title) }));
    expect(scroller.scrollTop).toBe(0);
  });

  it('첫 주제엔 이전 주제 링크가 없고, 마지막 주제엔 다음 주제 링크가 없다', async () => {
    const first = renderRules();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: TOPICS[0]!.title }));
    expect(screen.queryByText('이전 주제')).toBeNull();

    // 되돌아가는 버튼은 앱 헤더의 것이라 이 화면 단독 렌더에는 없다 — 마지막 주제는 딥링크로 연다.
    first.unmount();
    renderRules(TOPICS[TOPICS.length - 1]!.key);
    expect(screen.queryByText('다음 주제')).toBeNull();
  });
});

describe('RulesScreen — topic prop(딥링크)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubMedia(false);
  });

  it('topic prop 이 있으면 클릭 없이도 그 주제 상세로 곧장 뜬다', () => {
    renderRules('two-on-one');
    expect(screen.getByRole('heading', { level: 2, name: titleOf('two-on-one') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: titleOf('basics') })).toBeNull();
  });

  it('알 수 없는 topic 은 조용히 카드 홈으로 떨어진다(404 없음)', () => {
    renderRules('no-such-topic');
    expect(screen.getByRole('button', { name: titleOf('basics') })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });
});

describe('RulesScreen — 도해·부록', () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubMedia(false);
  });

  it('산문 소제목이 본문과 눈에 띄게 다르다 — 크기와 선 둘 다', async () => {
    // 2026-08-31 이전에는 소제목이 본문과 **글자 크기가 같았고**(둘 다 0.9375rem) 굵기만 달랐다.
    // 카드 하나에 소제목이 6개까지 늘어난 뒤로는 훑어서 절을 찾을 수가 없었다.
    // 굵기는 jsdom 이 스타일시트를 안 태워도 인라인으로 읽히지만, 굵기만으로는 그때도 통과했다 —
    // 그래서 **크기**와 **선**을 함께 잰다. 색은 안 잰다(고대비 모드에서 치환되므로 색에 기대면 안 된다).
    renderRules();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: titleOf('basics') }));

    const heading = screen.getByRole('heading', { level: 3, name: '코트' });
    const body = screen.getByText(/기본 규격은 28×15m/);
    const size = (el: HTMLElement) => Number.parseFloat(getComputedStyle(el).fontSize);
    expect(size(heading)).toBeGreaterThan(size(body));
    expect(heading.style.borderBottom).not.toBe('');
  });

  it('"선수·코트·공·장비" 주제에 공 도해가 붙는다', async () => {
    // 2026-09-03 까지는 장비 도해(전진·후진 10km/h 막대)도 함께 쟀다. 그 도해는 기현님이
    // 조악하다고 판정해 지웠고, 10km/h 는 산문이 말한다 — 그래서 여기서는 공 도해만 잰다.
    renderRules();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: titleOf('basics') }));
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
    expect(screen.getAllByText('33cm').length).toBeGreaterThan(0);
    expect(screen.queryByText('전진 10km/h'), '장비 도해는 다시 오지 않는다').toBeNull();
  });

  it('"공식 룰 북" 주제에 18개조가 압축 목록으로 전부 뜬다', async () => {
    renderRules();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: titleOf('rulebook') }));
    const laws = ruleContentFor('ko');
    expect(laws).toHaveLength(18);
    for (const law of laws) {
      expect(screen.getByText(law.title)).toBeInTheDocument();
    }
  });

  it('"그 외의 반칙" 주제에 경고 7종·퇴장 8종 카드 목록이 붙는다', async () => {
    renderRules();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: titleOf('fouls') }));
    expect(screen.getByText(/경고\(옐로카드\) 7종/)).toBeInTheDocument();
    expect(screen.getByText(/퇴장\(레드카드\) 8종/)).toBeInTheDocument();
  });
});

describe('RulesScreen — 재개 비교표', () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubMedia(false);
  });

  it('7열 표가 뜨고, 열을 고르면 그 재개가 표시로 선택된다', async () => {
    renderRules();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: titleOf('restarts') }));

    const table = screen.getByRole('table');
    for (const col of RESTART_COLUMNS) {
      expect(within(table).getByRole('button', { name: col.label })).toBeInTheDocument();
    }
    expect(within(table).getByRole('button', { name: '킥오프' })).toHaveAttribute('aria-current', 'true');

    await user.click(within(table).getByRole('button', { name: '코너킥' }));
    expect(within(table).getByRole('button', { name: '코너킥' })).toHaveAttribute('aria-current', 'true');
    expect(within(table).getByRole('button', { name: '킥오프' })).not.toHaveAttribute('aria-current');
  });

  it('좁은 화면에서는 표 대신 재개별 카드로 접힌다(가로 스크롤 없음)', async () => {
    stubMedia(true);
    renderRules();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: titleOf('restarts') }));

    expect(screen.queryByRole('table')).toBeNull();
    // 첫 재개(킥오프)가 기본으로 펼쳐져 있다 — 넓은 화면의 "표 아래 기본 kickoff 재생기"와
    // 같은 기본값이다.
    const first = screen.getByRole('button', { name: RESTART_COLUMNS[0]!.label });
    expect(first).toHaveAttribute('aria-expanded', 'true');
    // 포스터는 펼쳐진 카드 '안'에서 찾는다 — 이 주제가 contested-touch 장면까지 흡수해
    // (9CARDS §3.2) 같은 화면에 표 바깥 포스터가 하나 더 있다.
    expect(within(first.parentElement!).getByRole('button', { name: '장면 재생' })).toBeInTheDocument();

    const second = screen.getByRole('button', { name: RESTART_COLUMNS[1]!.label });
    expect(second).toHaveAttribute('aria-expanded', 'false');
    await user.click(second);
    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(first).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('RulesScreen — 포스터+단일 활성', () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubMedia(false);
  });

  it('여러 장면이 있는 주제에서 하나를 재생하면 나머지는 포스터로 남고, 다른 것을 재생하면 앞엣것이 포스터로 되돌아간다', async () => {
    renderRules();
    const user = userEvent.setup();
    // "2-on-1 반칙" 주제 — 장면은 6개인데 **포스터는 5개다**(2026-09-01 갱신).
    // 2026-09-01 에 `two-on-one-gk-only`(기현님 신규, 3스텝)가 이 카드에 들어와 장면 5→6,
    // 포스터 4→5 가 됐다. 아래는 그 전(2026-08-31)의 경위이고 지금도 유효하다:
    // 줄어든 이유: `two-on-one` 이 기현님 편집기 드릴로 교체되면서 **1스텝** 정지 판이 됐고
    // (계획 PLAN-RULES-9CARDS.md §4.2 — 정적 배치 설명이라 의도에 맞다), `RuleSceneBlock` 은
    // `steps.length > 1` 일 때만 포스터를 그린다 — 1스텝은 재생할 것이 없어 처음부터 판이 그대로
    // 뜬다. 나머지 4개(active·gk·open·escape)는 손코딩 다스텝 장면이라 그대로다.
    // ⚠️ 이 4가 흔들리면 원인은 여기가 아니라 **장면의 스텝 수**다 —
    // `ruleScenes.test.ts` 의 `RULE_SCENE_EXPECT.steps` 가 먼저 빨개져 어느 장면인지 가리킨다.
    await user.click(screen.getByRole('button', { name: titleOf('two-on-one') }));

    const posters = () => screen.getAllByRole('button', { name: '장면 재생' });
    expect(posters()).toHaveLength(5);

    // 하나를 재생하면 그 장면만 포스터에서 빠진다 — 5 − 1 = 4.
    await user.click(posters()[0]!);
    expect(screen.getAllByRole('button', { name: '일시정지' })).toHaveLength(1);
    expect(posters()).toHaveLength(4);

    await user.click(posters()[0]!); // 이제 남은 첫 포스터 = 원래 둘째 장면
    expect(screen.getAllByRole('button', { name: '일시정지' })).toHaveLength(1);
    expect(posters()).toHaveLength(4); // 하나만 활성 — 늘지도 줄지도 않는다
  });
});
