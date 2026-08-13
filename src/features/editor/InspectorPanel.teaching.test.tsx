// 3.2/3.3 — 인스펙터 [교육] 구역: 목적 · 코칭 포인트 · 필요 인원 · 필요 장비 + 반복/세트/인터벌
// (결정 ⑦ = (B) 중간). 3.1 과 같은 이유로 **화면 끝에서 끝까지 한 줄로** 본다 —
//   인스펙터에 적는다 → META_SET 이 나간다 → 자동저장이 IDB 에 쓴다 → 다시 읽어도 값이 있다.
// 조각내면 validate.ts 화이트리스트 조립부에서 한 줄이 빠져도(= 저장은 되는데 다시 읽으면
// 사라진다) 전부 초록불이다. 그게 이 항목의 대표적인 실패 방식이다.
//
// 뒤쪽 두 describe 는 **InspectorPanel 단독 렌더**다: '전술판에는 이 구역이 없다' 와 '안 바뀌면
// 안 쏜다' 는 저장까지 갈 필요가 없고, dispatch 스파이로 봐야 정확히 보인다.
//
// EditorScreen.test.tsx 와 같은 이유로 `../../app/AppShell.tsx` 를 vi.mock 한다 — EditorScreen 이
// 쓰는 것은 useStageTarget 하나인데 실제 파일은 화면 5개를 전부 import 하므로 힙이 터진다.
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
import { createDrill } from '../../model/defaults.ts';
import { InspectorPanel } from './InspectorPanel.tsx';
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

async function openDrillWithInspector() {
  const { repo } = await resolveDrillRepo();
  const created = await repo.createDrill({ courtMode: 'full', formation: '1-2-1' });
  stageTarget = { kind: 'drill', drillId: created.id };
  const user = userEvent.setup();
  const view = render(<EditorScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: '속성' }));
  await screen.findByRole('complementary', { name: '드릴 속성' });
  return { user, drillId: created.id, view };
}

const objective = () => screen.getByLabelText('목적') as HTMLTextAreaElement;
const points = () => screen.getByLabelText('코칭 포인트') as HTMLTextAreaElement;
const people = () => screen.getByLabelText('필요 인원(명)') as HTMLInputElement;
const gear = () => screen.getByLabelText('필요 장비') as HTMLInputElement;
const reps = () => screen.getByLabelText('반복(회)') as HTMLInputElement;
const sets = () => screen.getByLabelText('세트') as HTMLInputElement;
const interval = () => screen.getByLabelText('인터벌(초)') as HTMLInputElement;

describe('3.2/3.3 교육 필드 — 적은 값이 IDB 를 왕복해도 남는다', () => {
  it('일곱 칸 전부가 저장 → 다시 읽기에서 살아 있다', async () => {
    const { user, drillId, view } = await openDrillWithInspector();

    await user.type(objective(), '측면에서 받아 방향을 튼다');
    await user.type(points(), '받기 전에 몸을 연다\n패스는 낮게');
    await user.type(people(), '6');
    await user.type(gear(), '공 2 · 콘 6');
    await user.type(reps(), '3');
    await user.type(sets(), '2');
    await user.type(interval(), '60');
    await user.click(objective()); // 마지막 칸에서 포커스를 뗀다(= blur 커밋)

    view.unmount(); // 화면 전환 = useAutosave 의 동기 플러시

    const { repo } = await resolveDrillRepo();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      // 일곱을 **따로** 단언한다 — validate.ts 조립부에서 한 줄만 빠져도 나머지 여섯은 초록불이다.
      expect(saved?.objective).toBe('측면에서 받아 방향을 튼다');
      expect(saved?.coachingPoints).toEqual(['받기 전에 몸을 연다', '패스는 낮게']);
      expect(saved?.playersNeeded).toBe(6);
      expect(saved?.equipment).toBe('공 2 · 콘 6');
      expect(saved?.reps).toBe(3);
      expect(saved?.sets).toBe(2);
      expect(saved?.intervalSec).toBe(60);
    });
  });

  it('개수 칸은 상한을 넘겨 적으면 손을 뗄 때 실제 저장값으로 되비친다', async () => {
    const { user } = await openDrillWithInspector();

    await user.type(people(), '999');
    await user.click(gear()); // blur
    // 비제어라 화면과 모델이 갈라질 수 있는 자리가 클램프다. 되비치지 않으면 화면은 "999명" 인데
    // 계획서에는 30 이 찍힌다.
    expect(people().value).toBe('30');

    // ★ 여기가 진짜 되비침이 필요한 자리다. 위 한 번만 보면 **헛통과한다** — 0 → 30 은 모델이
    //   바뀌므로 `key={value}` 가 요소를 갈아 끼워 화면이 따라온다. 이미 30 인 칸에 다시 999 를
    //   적으면 커밋값이 그대로라 dispatch 도 remount 도 없고, blur 의 되쓰기만이 유일한 수단이다.
    await user.clear(people());
    await user.type(people(), '999');
    await user.click(gear());
    expect(people().value).toBe('30');

    await user.type(interval(), '9999');
    await user.click(gear());
    expect(interval().value).toBe('600');

    // 대조군 — 범위 안의 값은 손대지 않는다(무조건 되쓰는 것이 아니다).
    await user.type(reps(), '3');
    await user.click(gear());
    expect(reps().value).toBe('3');
  });

  it('개수 칸을 비우면 0(미지정)으로 돌아간다 — 계획서에 "0회" 를 찍지 않기 위한 상태다', async () => {
    const { user, drillId, view } = await openDrillWithInspector();
    await user.type(reps(), '5');
    await user.click(gear());
    expect(reps().value).toBe('5');

    await user.clear(reps());
    await user.click(gear());
    expect(reps().value).toBe('');

    view.unmount();
    const { repo } = await resolveDrillRepo();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      expect(saved?.reps).toBe(0);
    });
  });

  it('코칭 포인트는 줄마다 하나다 — 빈 줄은 버리고 화면도 정규화된 모습으로 되비친다', async () => {
    const { user, drillId, view } = await openDrillWithInspector();

    await user.type(points(), '몸을 연다\n\n  \n패스는 낮게\n');
    await user.click(objective()); // blur

    // 화면과 모델이 같은 규칙을 쓴다 — 다시 열었을 때와 지금의 글자가 달라지면 안 된다.
    expect(points().value).toBe('몸을 연다\n패스는 낮게');

    // ★ F7b 와 같은 함정: 위 한 줄만 보면 헛통과한다(목록이 바뀌었으니 `key` 가 갈아 끼운다).
    //   이미 같은 목록인데 빈 줄만 덧붙인 경우는 커밋값이 그대로라 dispatch 도 remount 도 없고,
    //   blur 의 되쓰기만이 화면을 모델과 같은 모습으로 되돌린다.
    await user.type(points(), '\n\n');
    await user.click(objective());
    expect(points().value).toBe('몸을 연다\n패스는 낮게');

    view.unmount();
    const { repo } = await resolveDrillRepo();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      expect(saved?.coachingPoints).toEqual(['몸을 연다', '패스는 낮게']);
    });
  });
});

describe('3.2/3.3 이 구역이 있는 곳과 없는 곳', () => {
  const panel = (showSteps: boolean, dispatch = vi.fn()) => {
    const drill = createDrill({ courtMode: 'full', formation: '1-2-1' });
    render(
      <InspectorPanel
        drill={drill}
        step={drill.steps[0]!}
        stepIndex={0}
        dispatch={dispatch}
        selection={new Set()}
        pendingPlayerId={null}
        onArmPlayer={() => {}}
        onEraseIds={() => {}}
        onResetGoals={() => {}}
        showSteps={showSteps}
      />,
    );
    return { drill, dispatch };
  };

  it('자유 전술판(showSteps=false)에는 교육 구역이 없다 — 그 판의 드릴은 목록에도 계획서에도 안 간다', () => {
    panel(false);
    expect(screen.queryByLabelText('목적')).toBeNull();
    expect(screen.queryByLabelText('반복(회)')).toBeNull();
    // 대조군 — 드릴 정보(제목)는 전술판에도 그대로 있다. '아무것도 안 그려져서' 통과한 게 아니다.
    expect(screen.getByLabelText('제목')).toBeInTheDocument();
  });

  it('드릴 편집기(showSteps=true)에는 일곱 칸이 전부 있다', () => {
    panel(true);
    for (const label of ['목적', '코칭 포인트', '필요 인원(명)', '필요 장비', '반복(회)', '세트', '인터벌(초)']) {
      expect(screen.getByLabelText(label), `'${label}' 칸이 없다`).toBeInTheDocument();
    }
  });
});

describe('3.2/3.3 값이 안 바뀌면 커밋하지 않는다', () => {
  it('그냥 지나간 칸은 META_SET 을 쏘지 않는다 (되돌리기가 빈 칸으로 채워지지 않게)', async () => {
    const user = userEvent.setup();
    const dispatch = vi.fn();
    const drill = createDrill({ courtMode: 'full', formation: '1-2-1' });
    render(
      <InspectorPanel
        drill={drill}
        step={drill.steps[0]!}
        stepIndex={0}
        dispatch={dispatch}
        selection={new Set()}
        pendingPlayerId={null}
        onArmPlayer={() => {}}
        onEraseIds={() => {}}
        onResetGoals={() => {}}
      />,
    );

    await user.click(objective());
    await user.click(reps());
    await user.click(gear());
    expect(dispatch).not.toHaveBeenCalled();

    // 대조군 — 스파이가 안 걸린 게 아니라는 증거. 한 글자만 적어도 곧바로 나간다.
    await user.type(gear(), '조끼');
    await user.click(objective());
    expect(dispatch).toHaveBeenCalledWith({ type: 'META_SET', patch: { equipment: '조끼' } });
  });
});
