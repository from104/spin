// 3.4 — 선수 실명. `ChairDef.name` 은 처음부터 모델에 있었고 읽는 곳이 인스펙터 명단 행 **하나**
// 였다: 트레이도 시연도 등번호만 말했다. 그래서 이 파일은 3.2 와 같은 이유로 **화면 끝에서 끝까지
// 한 줄로** 본다 — 인스펙터에 적는다 → 트레이 손잡이 이름이 그 자리에서 바뀐다 → 자동저장이
// IDB 에 쓴다 → 다시 읽어도 남아 있다. 조각내면 "적히기는 하는데 아무 데도 안 나오는" 상태가
// 전부 초록불이다(이 항목의 착수 전 상태가 정확히 그것이었다).
//
// **`empty: true` 드릴로 연다.** 기본 배치 드릴은 8대가 전부 코트에 나가 있어 트레이가 빈 주차
// 슬롯(`<span aria-hidden>`)만 그린다 — 손잡이 이름을 확인할 버튼이 하나도 없다.
//
// EditorScreen.test.tsx 와 같은 이유로 `../../app/AppShell.tsx` 를 vi.mock 한다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { AppHeader, HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { validateDrill } from '../../model/validate.ts';
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

beforeEach(() => {
  localStorage.clear();
  stageTarget = { kind: 'drill', drillId: 'dr_none' as DrillId };
});

/** 빈 판 드릴을 열고 인스펙터를 편 뒤, 명단에서 '우리 팀 2' 를 펼친다. */
async function openRoster() {
  const { repo } = await resolveDrillRepo();
  const created = await repo.createDrill({ courtMode: 'full', empty: true });
  stageTarget = { kind: 'drill', drillId: created.id };
  const user = userEvent.setup();
  const view = render(<EditorScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: '속성' }));
  await screen.findByRole('complementary', { name: '드릴 속성' });
  await user.click(screen.getByRole('button', { name: /우리 팀 2/ }));
  return { user, drillId: created.id, view };
}

const nameBox = () => screen.getByLabelText('이름') as HTMLInputElement;
const roleBox = () => screen.getByLabelText('역할') as HTMLSelectElement;

describe('3.4 선수 실명 — 적은 이름이 트레이와 저장본에 함께 반영된다', () => {
  it('이름을 적으면 트레이 손잡이 이름이 바뀌고 IDB 왕복에서도 남는다', async () => {
    const { user, drillId, view } = await openRoster();

    // 적기 전: 트레이는 등번호로만 부른다. 홈·원정에 각각 2번이 있으므로 **둘**이다 —
    // 이 대조군이 없으면 아래 단언이 "원래 하나였다" 로도 통과한다.
    expect(screen.getAllByRole('button', { name: '2번 선수 배치' })).toHaveLength(2);

    await user.type(nameBox(), '김민수');
    await user.click(roleBox()); // blur 커밋

    // (a) 트레이 — 이름이 붙은 쪽은 이제 하나뿐이고, 번호만으로 불리는 2번이 하나 남는다.
    expect(screen.getByRole('button', { name: '2번 김민수 선수 배치' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '2번 선수 배치' })).toHaveLength(1);
    // (b) 명단 행 — 폴백('우리 팀 2') 이 실명으로 바뀐다.
    expect(screen.getByRole('button', { name: '김민수미배치' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^우리 팀 2/ })).toBeNull();

    view.unmount(); // 화면 전환 = useAutosave 의 동기 플러시

    const { repo } = await resolveDrillRepo();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      const named = saved?.cast.chairs.filter((c) => c.name === '김민수') ?? [];
      expect(named).toHaveLength(1);
      expect(named[0]?.team).toBe('home');
      expect(named[0]?.number).toBe('2');
    });
  });

  it('이름을 지우면 등번호로 돌아간다 — 커밋값은 언제나 구체값(빈 문자열)이다', async () => {
    const { user, drillId, view } = await openRoster();
    await user.type(nameBox(), '김민수');
    await user.click(roleBox());
    expect(screen.getByRole('button', { name: '2번 김민수 선수 배치' })).toBeInTheDocument();

    await user.clear(nameBox());
    await user.click(roleBox());
    expect(screen.getAllByRole('button', { name: '2번 선수 배치' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: /우리 팀 2/ })).toBeInTheDocument();

    view.unmount();
    const { repo } = await resolveDrillRepo();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      const home2 = saved?.cast.chairs.find((c) => c.team === 'home' && c.number === '2');
      // `undefined` 를 실어 보내면 얕은 병합이 키를 undefined 로 남기고 JSON 경로에서만 사라진다
      // (같은 드릴이 저장 경로에 따라 달라진다). 그래서 화면은 '' 를 보낸다.
      expect(home2?.name).toBe('');
    });
  });

  it('공백만 적은 이름은 이름이 아니다 — 손을 뗄 때 빈 칸으로 되비치고 트레이도 번호 그대로다', async () => {
    const { user } = await openRoster();
    await user.type(nameBox(), '   ');
    await user.click(roleBox());
    expect(nameBox().value).toBe('');
    expect(screen.getAllByRole('button', { name: '2번 선수 배치' })).toHaveLength(2);
  });

  it('되돌리기하면 이름 칸에 방금 지운 글자가 남지 않는다 — 화면과 모델이 갈라지는 유일한 자리', async () => {
    const { user } = await openRoster();
    await user.type(nameBox(), '김민수');
    await user.click(roleBox());
    expect(nameBox().value).toBe('김민수');

    await user.click(screen.getByRole('button', { name: '되돌리기' }));
    // 비제어 입력이라 모델만 되돌아가고 DOM 은 그대로일 수 있다 — `key={def.name}` 가
    // 요소를 갈아 끼워 화면을 따라오게 만든다. 트레이도 같은 프레임에 돌아온다.
    expect(nameBox().value).toBe('');
    expect(screen.getAllByRole('button', { name: '2번 선수 배치' })).toHaveLength(2);
  });

  it('상한(24자)은 화면과 저장본 양쪽에서 지켜진다', async () => {
    const { user, drillId, view } = await openRoster();
    // 화면 쪽은 `maxLength` 가 애초에 24자를 넘겨 적지 못하게 막는다(그래서 이 단언 하나만으로는
    // blur 되쓰기를 반증하지 못한다 — 그 몫은 위 '공백만 적은 이름' 이 한다).
    await user.type(nameBox(), '가'.repeat(LIMITS.chairNameLen + 10));
    await user.click(roleBox());
    expect(nameBox().value).toBe('가'.repeat(LIMITS.chairNameLen));

    view.unmount();
    const { repo } = await resolveDrillRepo();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      const home2 = saved?.cast.chairs.find((c) => c.team === 'home' && c.number === '2');
      expect(home2?.name).toHaveLength(LIMITS.chairNameLen);
    });
  });
});

describe('3.4 validate — 이름은 길이만 접는다', () => {
  const drillWithName = (name: unknown) => ({
    schemaVersion: 2,
    id: 'dr_x',
    title: 't',
    category: '기타',
    level: '초급',
    durationMin: 10,
    tags: [],
    courtMode: 'full',
    formation: '1-2-1',
    teams: {
      home: { label: '우리 팀', color: '#d93a3a', gkColor: '#f2c811' },
      away: { label: '상대', color: '#1f6bb8', gkColor: '#22a95b' },
    },
    cast: { chairs: [{ id: 'ch_1', team: 'home', number: '2', isGk: false, name }], balls: [], cones: [] },
    steps: [{ id: 'st_1', name: 's', note: '', chairs: {}, balls: {}, cones: {}, arrows: [], notes: [] }],
    createdAt: 1,
    updatedAt: 1,
  });

  it('상한을 넘으면 절단하고 repair 를 남긴다', () => {
    const res = validateDrill(drillWithName('나'.repeat(200)));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.cast.chairs[0]?.name).toHaveLength(LIMITS.chairNameLen);
    expect(res.repairs.some((r) => r.path === 'cast.chairs.name')).toBe(true);
  });

  it('상한 안의 이름은 **한 글자도 건드리지 않고** repair 도 안 남긴다 — 열 때마다 보정 토스트가 뜨면 안 된다', () => {
    const res = validateDrill(drillWithName(' 김민수 '));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.cast.chairs[0]?.name).toBe(' 김민수 ');
    expect(res.repairs).toHaveLength(0);
  });
});
