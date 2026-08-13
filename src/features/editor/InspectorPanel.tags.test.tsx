// 3.5 — 태그 · 설명. **태그는 자유 텍스트가 아니라 기존 태그 칩 선택식**이다(§7 3.5): 오타 태그가
// 검색을 악화시키고, 그 악화는 "태그가 하나 늘었다" 가 아니라 "검색이 가끔 안 된다" 로 나타난다.
// 그래서 여기서 보는 것은 세 가지다 —
//   (a) **남이 쓰는 태그가 칩으로 먼저 뜬다**(useKnownTags → 요약의 tags. 본문을 열지 않는다)
//   (b) 새로 만들 수는 있되 이미 있는 것과 같은 글자면 **하나로 합쳐진다**
//   (c) 고른 결과와 설명이 IDB 왕복에서 살아남는다
//
// EditorScreen.test.tsx 와 같은 이유로 `../../app/AppShell.tsx` 를 vi.mock 한다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { AppHeader, HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { LIMITS } from '../../model/validate.ts';
import type { DrillId } from '../../core/ids.ts';

let stageTarget: { kind: 'drill'; drillId: DrillId } = { kind: 'drill', drillId: 'dr_none' as DrillId };
vi.mock('../../app/AppShell.tsx', () => ({
  useStageTarget: () => stageTarget,
}));

const { EditorScreen } = await import('./EditorScreen.tsx');

function Wrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'board', go: () => {}, back: () => {} };
  return (
    <SettingsProvider>
      <ToastProvider>
        <HeaderProvider>
          <AppNavProvider value={nav}>
            <AppHeader />
            {children}
          </AppNavProvider>
        </HeaderProvider>
        <LiveRegion />
      </ToastProvider>
    </SettingsProvider>
  );
}

beforeEach(async () => {
  localStorage.clear();
  stageTarget = { kind: 'drill', drillId: 'dr_none' as DrillId };
  // ⚠️ IDB 는 파일 안에서 이어진다. 이 파일의 주제가 **"이 저장소에 이미 있는 태그"** 라
  // 앞 테스트가 심은 태그가 다음 테스트의 후보 목록에 그대로 나타난다(그 자체가 3.5 가
  // 맞다고 말하는 동작이지만, 단언은 못 쓰게 된다).
  const { repo } = await resolveDrillRepo();
  for (const s of await repo.listDrillSummaries()) await repo.deleteDrill(s.id);
});

/** 남이 이미 쓰고 있는 태그를 만든다 — 이 드릴은 편집하지 않는다. */
async function seedTags(tags: string[]) {
  const { repo } = await resolveDrillRepo();
  const other = await repo.createDrill({ courtMode: 'full', title: '남의 드릴' });
  await repo.putDrill({ ...other, tags }, { touch: false });
}

async function openTagsSection() {
  const { repo } = await resolveDrillRepo();
  const created = await repo.createDrill({ courtMode: 'full', empty: true });
  stageTarget = { kind: 'drill', drillId: created.id };
  const user = userEvent.setup();
  const view = render(<EditorScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: '속성' }));
  await screen.findByRole('complementary', { name: '드릴 속성' });
  return { user, drillId: created.id, view };
}

const tagGroup = () => screen.getByRole('group', { name: '태그' });
const chip = (name: string) => within(tagGroup()).getByRole('button', { name });
const chipNames = () =>
  within(tagGroup())
    .queryAllByRole('button')
    .map((b) => b.textContent);
const draftBox = () => screen.getByLabelText('새 태그') as HTMLInputElement;
const descBox = () => screen.getByLabelText('설명') as HTMLTextAreaElement;

describe('3.5 태그 — 기존 태그를 먼저 보여 주고, 고른 것이 저장된다', () => {
  it('남이 쓰는 태그가 칩으로 뜨고, 누르면 이 드릴의 태그가 되어 IDB 왕복에서 남는다', async () => {
    await seedTags(['수비 전환', '골클리어런스']);
    const { user, drillId, view } = await openTagsSection();

    // 요약(DrillSummary.tags)에서 읽어 온다 — 본문을 열지 않는다. 비동기라 findBy 로 기다린다.
    await screen.findByRole('button', { name: '수비 전환' });
    expect(chip('수비 전환')).toHaveAttribute('aria-pressed', 'false');

    await user.click(chip('수비 전환'));
    expect(chip('수비 전환')).toHaveAttribute('aria-pressed', 'true');
    // 대조군 — 안 누른 칩은 꺼진 채다(모든 칩이 켜지는 구현으로도 위 단언은 통과한다).
    expect(chip('골클리어런스')).toHaveAttribute('aria-pressed', 'false');

    view.unmount();
    const { repo } = await resolveDrillRepo();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      expect(saved?.tags).toEqual(['수비 전환']);
    });
  });

  it('켜진 칩을 다시 누르면 꺼진다 — 잘못 고른 태그에서 빠져나올 수 있어야 한다', async () => {
    await seedTags(['수비 전환']);
    const { user, drillId, view } = await openTagsSection();
    await screen.findByRole('button', { name: '수비 전환' });

    await user.click(chip('수비 전환'));
    await user.click(chip('수비 전환'));
    expect(chip('수비 전환')).toHaveAttribute('aria-pressed', 'false');

    view.unmount();
    const { repo } = await resolveDrillRepo();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      expect(saved?.tags).toEqual([]);
    });
  });

  it('새 태그를 만들 수 있고, 만든 것은 곧바로 켜진 칩이 된다', async () => {
    const { user, drillId, view } = await openTagsSection();
    expect(chipNames()).toEqual([]); // 첫 드릴 — 후보가 없다

    await user.type(draftBox(), '킥인');
    await user.click(screen.getByRole('button', { name: '추가' }));

    expect(chip('킥인')).toHaveAttribute('aria-pressed', 'true');
    expect(draftBox().value).toBe(''); // 만든 뒤 칸은 비어 다음 태그를 바로 적을 수 있다

    view.unmount();
    const { repo } = await resolveDrillRepo();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      expect(saved?.tags).toEqual(['킥인']);
    });
  });

  it('이미 있는 태그를 새로 적으면 **하나로 합쳐진다** — 이 항목이 막으려는 오타 태그 그 자체다', async () => {
    await seedTags(['수비 전환']);
    const { user } = await openTagsSection();
    await screen.findByRole('button', { name: '수비 전환' });
    await user.click(chip('수비 전환'));

    await user.type(draftBox(), '  수비 전환  '); // 앞뒤 공백은 다른 태그가 아니다
    await user.click(screen.getByRole('button', { name: '추가' }));

    expect(chipNames()).toEqual(['수비 전환']);
  });

  it('상한 12개에 닿으면 새 태그를 못 만들고, 켜진 칩은 계속 끌 수 있다 — 갇히지 않는다', async () => {
    const twelve = Array.from({ length: LIMITS.tagCount }, (_, i) => `태그${i}`);
    await seedTags(twelve);
    const { user } = await openTagsSection();
    await screen.findByRole('button', { name: '태그0' });

    for (const t of twelve) await user.click(chip(t));
    expect(draftBox()).toBeDisabled();
    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled();

    // 켜진 칩은 살아 있다. 여기가 막히면 12개에서 영영 못 빠져나온다.
    await user.click(chip('태그0'));
    expect(chip('태그0')).toHaveAttribute('aria-pressed', 'false');
    expect(draftBox()).not.toBeDisabled();
  });

  it('상한(24자)을 넘는 태그는 만들어지지 않는다 — 화면이 안 막으면 저장할 때 조용히 잘린다', async () => {
    const { user } = await openTagsSection();
    await user.type(draftBox(), '가'.repeat(LIMITS.tagLen + 6));
    await user.click(screen.getByRole('button', { name: '추가' }));
    expect(chipNames()).toEqual(['가'.repeat(LIMITS.tagLen)]);
  });
});

describe('3.5 설명', () => {
  it('적은 설명이 IDB 왕복에서 남고, 손을 뗄 때 저장값으로 되비친다', async () => {
    const { user, drillId, view } = await openTagsSection();

    await user.type(descBox(), '  전반 워밍업 뒤에 이어서 씁니다.  ');
    await user.click(draftBox()); // blur 커밋
    expect(descBox().value).toBe('전반 워밍업 뒤에 이어서 씁니다.');

    view.unmount();
    const { repo } = await resolveDrillRepo();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      expect(saved?.description).toBe('전반 워밍업 뒤에 이어서 씁니다.');
    });
  });

  it('이미 저장된 설명 뒤에 공백만 덧붙여도 손을 뗄 때 저장값으로 되비친다', async () => {
    const { user } = await openTagsSection();
    await user.type(descBox(), '전반 워밍업');
    await user.click(draftBox());
    expect(descBox().value).toBe('전반 워밍업');

    // ★ 여기가 되비침이 **유일한 수단**인 자리다. 위의 trim 한 번만 보면 헛통과한다 —
    //   '  …  ' → '전반 워밍업' 은 모델이 바뀌므로 `key={description}` 가 요소를 갈아 끼워
    //   화면이 따라온다. 이미 같은 값인 칸에 공백만 붙이면 커밋값이 그대로라 dispatch 도
    //   remount 도 없고, blur 의 되쓰기가 아니면 화면에 공백이 그대로 남는다.
    await user.type(descBox(), '   ');
    await user.click(draftBox());
    expect(descBox().value).toBe('전반 워밍업');
  });
});

describe('3.5 validate — 설명도 길이를 접는다', () => {
  const drillWithDescription = (description: unknown) => ({
    schemaVersion: 2,
    id: 'dr_x',
    title: 't',
    category: '기타',
    level: '초급',
    durationMin: 10,
    tags: [],
    description,
    courtMode: 'full',
    formation: '1-2-1',
    teams: {
      home: { label: '우리 팀', color: '#d93a3a', gkColor: '#f2c811' },
      away: { label: '상대', color: '#1f6bb8', gkColor: '#22a95b' },
    },
    cast: { chairs: [], balls: [], cones: [] },
    steps: [{ id: 'st_1', name: 's', note: '', chairs: {}, balls: {}, cones: {}, arrows: [], notes: [] }],
    createdAt: 1,
    updatedAt: 1,
  });

  it('상한(400자)을 넘는 설명은 절단하고 repair 를 남긴다 — 화면 상한만 믿으면 남이 만든 파일이 그대로 들어온다', async () => {
    const { validateDrill } = await import('../../model/validate.ts');
    const res = validateDrill(drillWithDescription('가'.repeat(1000)));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.description).toHaveLength(LIMITS.descriptionLen);
    expect(res.repairs.some((r) => r.path === 'description')).toBe(true);
  });

  it('상한 안의 설명은 손대지 않고 repair 도 안 남긴다', async () => {
    const { validateDrill } = await import('../../model/validate.ts');
    const res = validateDrill(drillWithDescription(' 짧은 설명 '));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.description).toBe(' 짧은 설명 ');
    expect(res.repairs).toHaveLength(0);
  });
});

describe('3.5 전술판', () => {
  it('자유 전술판에는 태그·설명 구역이 없다 — 그 판의 드릴은 목록에 실리지 않는다', async () => {
    const { InspectorPanel } = await import('./InspectorPanel.tsx');
    const { createDrill } = await import('../../model/defaults.ts');
    const drill = createDrill({ courtMode: 'full', empty: true });
    render(
      <InspectorPanel
        drill={drill}
        step={drill.steps[0]!}
        stepIndex={0}
        dispatch={() => {}}
        selection={new Set()}
        pendingPlayerId={null}
        onArmPlayer={() => {}}
        onEraseIds={() => {}}
        onResetGoals={() => {}}
        knownTags={['수비 전환']}
        showSteps={false}
      />,
    );
    expect(screen.queryByRole('group', { name: '태그' })).toBeNull();
    expect(screen.queryByLabelText('설명')).toBeNull();
    // 대조군 — 전술판에도 제목 칸은 있다(아무것도 안 그려져서 통과한 게 아니다).
    expect(screen.getByLabelText('제목')).toBeInTheDocument();
  });
});
