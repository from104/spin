// 규칙 화면(2026-08-22 주제별 재설계) 스모크 테스트 — 카드 홈·주제 상세·비교표·단일 활성.
// 장면 데이터 자체는 `ruleScenes.test.ts`, 조항 도해는 `RuleFigure.test.tsx`, 콘텐츠 모델
// 불변식은 `ruleTopics.test.ts` 가 따로 본다 — 여기서는 "화면에 실제로 붙어 나오는가" 만 본다.
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulesScreen } from './RulesScreen.tsx';
import { ruleTopicsFor } from './ruleTopics.ts';
import { ruleContentFor } from './ruleContent.ts';
import { RESTART_COLUMNS } from './restartTable.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

function renderRules() {
  return render(
    <SettingsProvider>
      <RulesScreen />
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

describe('RulesScreen — 카드 홈', () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubMedia(false);
  });

  it('8주제 카드가 전부 뜬다', () => {
    renderRules();
    expect(TOPICS).toHaveLength(8);
    for (const topic of TOPICS) {
      expect(screen.getByRole('button', { name: topic.title })).toBeInTheDocument();
    }
  });

  it('기본 진입은 홈이다 — 어떤 주제 제목도 아직 안 보인다', () => {
    renderRules();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('카드를 고르면 상세로 들어가고, [홈으로]로 되돌아간다', async () => {
    renderRules();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '기본 규칙' }));
    expect(screen.getByRole('heading', { level: 2, name: '기본 규칙' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '경기 재개 한눈에' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '← 홈으로' }));
    expect(screen.getByRole('button', { name: '기본 규칙' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('상세 하단의 이전/다음 주제로 이웃 주제를 오간다', async () => {
    renderRules();
    const user = userEvent.setup();
    // 두 번째 주제(경기 재개 한눈에)로 들어가면 이전=기본 규칙·다음=아웃 오브 플레이가 있다.
    await user.click(screen.getByRole('button', { name: TOPICS[1]!.title }));
    expect(screen.getByRole('heading', { level: 2, name: TOPICS[1]!.title })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: new RegExp(TOPICS[2]!.title) }));
    expect(screen.getByRole('heading', { level: 2, name: TOPICS[2]!.title })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: new RegExp(TOPICS[1]!.title) }));
    expect(screen.getByRole('heading', { level: 2, name: TOPICS[1]!.title })).toBeInTheDocument();
  });

  it('첫 주제엔 이전 주제 링크가 없고, 마지막 주제엔 다음 주제 링크가 없다', async () => {
    renderRules();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: TOPICS[0]!.title }));
    expect(screen.queryByText('이전 주제')).toBeNull();

    await user.click(screen.getByRole('button', { name: '← 홈으로' }));
    await user.click(screen.getByRole('button', { name: TOPICS[TOPICS.length - 1]!.title }));
    expect(screen.queryByText('다음 주제')).toBeNull();
  });
});

describe('RulesScreen — 도해·부록', () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubMedia(false);
  });

  it('"기본 규칙" 주제에 공·장비 도해가 붙는다', async () => {
    renderRules();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '기본 규칙' }));
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
    expect(screen.getAllByText('33cm').length).toBeGreaterThan(0);
    expect(screen.getByText('전진 10km/h')).toBeInTheDocument();
    expect(screen.getByText('후진 10km/h')).toBeInTheDocument();
  });

  it('"공식 룰 북" 주제에 18개조가 압축 목록으로 전부 뜬다', async () => {
    renderRules();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '공식 룰 북' }));
    const laws = ruleContentFor('ko');
    expect(laws).toHaveLength(18);
    for (const law of laws) {
      expect(screen.getByText(law.title)).toBeInTheDocument();
    }
  });

  it('"그 외의 반칙" 주제에 경고 7종·퇴장 8종 카드 목록이 붙는다', async () => {
    renderRules();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '그 외의 반칙' }));
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
    await user.click(screen.getByRole('button', { name: '경기 재개 한눈에' }));

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
    await user.click(screen.getByRole('button', { name: '경기 재개 한눈에' }));

    expect(screen.queryByRole('table')).toBeNull();
    // 첫 재개(킥오프)가 기본으로 펼쳐져 있다 — 넓은 화면의 "표 아래 기본 kickoff 재생기"와
    // 같은 기본값이다.
    const first = screen.getByRole('button', { name: RESTART_COLUMNS[0]!.label });
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '장면 재생' })).toBeInTheDocument();

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
    // "2-on-1" 주제 — 장면 5개(전부 다스텝, 전부 포스터를 가진다).
    await user.click(screen.getByRole('button', { name: '2-on-1' }));

    const posters = () => screen.getAllByRole('button', { name: '장면 재생' });
    expect(posters()).toHaveLength(5);

    await user.click(posters()[0]!);
    expect(screen.getAllByRole('button', { name: '일시정지' })).toHaveLength(1);
    expect(posters()).toHaveLength(4);

    await user.click(posters()[0]!); // 이제 남은 첫 포스터 = 원래 둘째 장면
    expect(screen.getAllByRole('button', { name: '일시정지' })).toHaveLength(1);
    expect(posters()).toHaveLength(4); // 하나만 활성 — 늘지도 줄지도 않는다
  });
});
