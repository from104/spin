// §5.4 — 배치 프리셋의 **배선**. 순수층(model/fillPreset.test.ts · model/setPiece.test.ts)이
// 재는 것은 "좌표가 옳은가" 이고, 여기서 재는 것은 "버튼이 그 좌표까지 닿는가" 다.
// 배선이 끊어져 있으면 순수 테스트는 전건 초록인 채 판 위에서는 아무 일도 안 일어난다.
//
// ⚠️ 그리고 **첫 화면 표적 예산(규칙 9)** — 프리셋 4개가 초기 상태 DOM 에 없다는 것을 여기서도
//    직접 확인한다. src/test/boardTargetBudget.test.tsx 가 총량 게이트라면 이쪽은 "왜 그 총량이
//    안 늘었는가"(오버레이 안에 있다)를 지목한다.
//
// InspectorPanel.tags.test.tsx 와 같은 이유로 `../../app/AppShell.tsx` 를 vi.mock 한다.
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
import { createDrill } from '../../model/defaults.ts';
import { courtDefFor, type CourtMode } from '../../model/court.ts';
import { editorRootReducer, initEditorState } from '../../store/editor/reducer.ts';
import { applyPlacement, fillSummary, formationPlan } from '../../model/fillPreset.ts';
import { setPieceGeometry, setPiecePlan, SET_PIECE_DEFS } from '../../model/setPiece.ts';
import type { DrillId, StepId } from '../../core/ids.ts';
import type { Drill } from '../../model/drill.ts';
import { InspectorPanel } from './InspectorPanel.tsx';

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
  const { repo } = await resolveDrillRepo();
  for (const s of await repo.listDrillSummaries()) await repo.deleteDrill(s.id);
});

/** 빈 코트(empty)로 드릴 하나를 만들어 편집기를 연다. 인스펙터는 **열지 않는다**. */
async function openEditor(mode: CourtMode) {
  const { repo } = await resolveDrillRepo();
  const created = await repo.createDrill({ courtMode: mode, empty: true });
  stageTarget = { kind: 'drill', drillId: created.id };
  const user = userEvent.setup();
  const view = render(<EditorScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return { user, drillId: created.id, view };
}

const presetGroup = () => within(screen.getByRole('complementary', { name: '드릴 속성' }));

describe('§5.4 프리셋 진입점 — 규칙 9(표적 예산) 를 지키는 자리', () => {
  it('초기 화면에는 프리셋 버튼이 **하나도 없다**(오버레이 안이다) · 속성을 열면 나온다', async () => {
    const { user } = await openEditor('full');
    // ① 닫혀 있는 동안은 DOM 에 없다 — 예산에 잡히지 않는 근거가 이것이다.
    expect(screen.queryByRole('button', { name: '포메이션으로 채우기' })).toBeNull();
    for (const k of ['킥인', '코너킥', '골 클리어런스']) {
      expect(screen.queryByRole('button', { name: k }), k).toBeNull();
    }
    // ② 열면 4개가 전부 나온다(대조군 — "언제나 없다" 로도 위 단언은 통과한다).
    await user.click(screen.getByRole('button', { name: '속성' }));
    await screen.findByRole('complementary', { name: '드릴 속성' });
    expect(presetGroup().getByRole('button', { name: '포메이션으로 채우기' })).toBeInTheDocument();
    for (const k of ['킥인', '코너킥', '골 클리어런스']) {
      expect(presetGroup().getByRole('button', { name: k }), k).toBeInTheDocument();
    }
    // 채우기 버튼의 설명은 표(COURT_FILL_SPECS)에서 온다 — 화면과 표가 갈라지지 않는다.
    expect(presetGroup().getByRole('button', { name: '포메이션으로 채우기' })).toHaveAttribute('title', fillSummary('full'));
  });

  it('플랫 코트에는 세트피스 버튼이 없고 이유가 화면에 적힌다 — 채우기는 그대로 있다', async () => {
    const { user } = await openEditor('flat');
    await user.click(screen.getByRole('button', { name: '속성' }));
    await screen.findByRole('complementary', { name: '드릴 속성' });
    // 뒷문장에도 단언한다: 세트피스는 없고, 채우기는 있고, 이유가 보인다.
    expect(presetGroup().getByRole('button', { name: '포메이션으로 채우기' })).toBeInTheDocument();
    for (const k of ['킥인', '코너킥', '골 클리어런스']) {
      expect(presetGroup().queryByRole('button', { name: k }), k).toBeNull();
    }
    expect(presetGroup().getByText(/플랫 코트에는 라인이 없어/)).toBeInTheDocument();
  });
});

describe('§5.4 프리셋 배선 — 눌렀을 때 판이 실제로 바뀐다', () => {
  it('[포메이션으로 채우기] 한 번이 빈 판에 8대 + 공 1개를 세우고 IDB 까지 간다', async () => {
    const { user, drillId, view } = await openEditor('full');
    const { repo } = await resolveDrillRepo();
    // 전제 — 빈 판이다(대조군: 이미 차 있으면 아래 단언은 아무것도 재지 않는다).
    const before = await repo.getDrill(drillId);
    expect(Object.keys(before!.steps[0]!.chairs)).toHaveLength(0);
    expect(before!.cast.balls).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '속성' }));
    await screen.findByRole('complementary', { name: '드릴 속성' });
    // 대조군 — 누르기 전 판에는 칩이 하나도 없다.
    expect(document.querySelectorAll('.stage-svg [aria-pressed]')).toHaveLength(0);
    await user.click(presetGroup().getByRole('button', { name: '포메이션으로 채우기' }));
    // **화면에도** 8대 + 공 1개가 섰다(모델만 바뀌고 판은 빈 채인 상태를 잡는다).
    const chips = () => [...document.querySelectorAll('.stage-svg [aria-pressed]')];
    await waitFor(() => expect(chips()).toHaveLength(9));
    expect(chips().filter((el) => /번$/.test(el.getAttribute('aria-label') ?? '')), '휠체어').toHaveLength(8);
    expect(screen.getByLabelText('우리 팀 2번')).toBeInTheDocument();

    view.unmount();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      expect(Object.keys(saved!.steps[0]!.chairs)).toHaveLength(8);
      expect(saved!.cast.balls).toHaveLength(1);
      expect(saved!.steps[0]!.balls[saved!.cast.balls[0]!.id]).toEqual({ x: 412.5, y: 262.5 });
    });
  });

  it('[코너킥] 한 번이 공을 코너 삼각형에 놓고 상대를 5 m 밖에 세운다', async () => {
    const { user, drillId, view } = await openEditor('full');
    const { repo } = await resolveDrillRepo();

    await user.click(screen.getByRole('button', { name: '속성' }));
    await screen.findByRole('complementary', { name: '드릴 속성' });
    await user.click(presetGroup().getByRole('button', { name: '코너킥' }));

    view.unmount();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      expect(Object.keys(saved!.steps[0]!.chairs)).toHaveLength(8);
      const geom = setPieceGeometry(saved!, 'corner')!;
      const ballPos = saved!.steps[0]!.balls[saved!.cast.balls[0]!.id]!;
      // 공이 코너 삼각형 안이다(꼭짓점에서 1 m 이내, 그러나 꼭짓점은 아니다).
      const dv = Math.hypot(ballPos.x - geom.ref.x, ballPos.y - geom.ref.y);
      expect(dv).toBeGreaterThan(0);
      expect(dv).toBeLessThanOrEqual(25);
      // 상대 전원이 **코너에서** 5 m 밖이다 — 저장·검증(validate) 왕복 뒤에도 그렇다.
      for (const c of saved!.cast.chairs.filter((ch) => ch.team === geom.guard)) {
        const p = saved!.steps[0]!.chairs[c.id]!;
        expect(Math.hypot(p.x - geom.ref.x, p.y - geom.ref.y), `${c.team}/${c.number}`).toBeGreaterThanOrEqual(125);
      }
    });
  });

  it('프리셋 한 번 = 되돌리기 한 번', async () => {
    const { user, drillId, view } = await openEditor('full');
    const { repo } = await resolveDrillRepo();
    await user.click(screen.getByRole('button', { name: '속성' }));
    await screen.findByRole('complementary', { name: '드릴 속성' });
    // 대조군 — 누르기 전에는 되돌릴 과거가 없다(버튼이 꺼져 있다).
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeDisabled();
    await user.click(presetGroup().getByRole('button', { name: '포메이션으로 채우기' }));
    // 누른 **직후** 되돌릴 과거가 정확히 한 칸 생겼다. 이 두 줄이 없으면 dispatch 를 통째로
    // 끊어도(=아무 일도 안 일어나도) 아래 '0대' 단언이 그대로 통과한다.
    await waitFor(() => expect(screen.getByRole('button', { name: '되돌리기' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(screen.getByRole('button', { name: '되돌리기' }), '한 번에 다 되돌아갔다').toBeDisabled();

    view.unmount();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      expect(Object.keys(saved!.steps[0]!.chairs)).toHaveLength(0);
    });
  });
});

// ── 리듀서 계약 — PRESET_APPLY 가 DRILL_LOAD 와 다른 이유 ────────────────────────────────
describe('§5.4 PRESET_APPLY — 시점(스텝·선택)을 건드리지 않는다', () => {
  const twoStep = (): Drill => {
    const d = createDrill({ courtMode: 'full' });
    const second = { ...d.steps[0]!, id: 'st_second' as StepId, chairs: {}, balls: {} };
    return { ...d, steps: [d.steps[0]!, second] };
  };

  it('2번 스텝에서 눌러도 2번 스텝에 남는다 (DRILL_LOAD 였다면 1번으로 끌려간다)', () => {
    const d = twoStep();
    let s = initEditorState(d);
    s = editorRootReducer(s, { type: 'STEP_SELECT', id: d.steps[1]!.id });
    s = editorRootReducer(s, { type: 'SELECT_SET', ids: [d.cast.chairs[0]!.id] });
    expect(s.stepId).toBe('st_second');

    const next = applyPlacement(s.present, 1, formationPlan(s.present));
    s = editorRootReducer(s, { type: 'PRESET_APPLY', drill: next });

    expect(s.stepId, '스텝이 그대로다').toBe('st_second');
    expect([...s.selection], '선택이 그대로다').toEqual([d.cast.chairs[0]!.id]);
    expect(Object.keys(s.present.steps[1]!.chairs)).toHaveLength(8);
    // 대조군 — 1번 스텝은 안 바뀌었다(그 스텝은 그 장면이다).
    expect(s.present.steps[0]!.chairs).toEqual(d.steps[0]!.chairs);

    // 대조군(뒷문장): 같은 판을 DRILL_LOAD 로 앉히면 실제로 1번 스텝으로 끌려간다 —
    // 그래서 새 액션이 필요했다는 것이 이 두 줄의 뜻이다.
    const viaLoad = editorRootReducer(initEditorState(d), { type: 'DRILL_LOAD', drill: next });
    expect(viaLoad.stepId).toBe(d.steps[0]!.id);
  });

  it('되돌리기 한 칸 · epoch 한 칸(물리 월드 재적재 신호)', () => {
    const d = createDrill({ courtMode: 'full', empty: true });
    const s0 = initEditorState(d);
    const s1 = editorRootReducer(s0, { type: 'PRESET_APPLY', drill: applyPlacement(d, 0, formationPlan(d)) });
    expect(s1.past).toHaveLength(1);
    expect(s1.epoch, 'epoch 이 올라야 world.load 가 돈다').toBe(s0.epoch + 1);
    const s2 = editorRootReducer(s1, { type: 'UNDO' });
    expect(s2.present).toBe(d);
    // 연속 두 번은 두 칸이다(coalesce 대상이 아니다 — 프리셋은 타이핑이 아니라 결정이다).
    const s3 = editorRootReducer(s1, { type: 'PRESET_APPLY', drill: applyPlacement(s1.present, 0, setPiecePlan(s1.present, 'kickIn')!) });
    expect(s3.past).toHaveLength(2);
  });

  it('자유 전술판(showSteps=false)에서도 프리셋이 나온다 — 빈 판을 세우는 곳이 거기다', () => {
    // ⚠️ 프리셋 구역이 `showSteps &&` 안으로 들어가면 **전술판에서만 사라진다** — 정작 판을
    //    처음 세우는 화면이 거기다. 그 갈래를 직접 찌른다(드릴 편집 쪽은 위 DOM 테스트가 본다).
    const d = createDrill({ courtMode: 'full', empty: true });
    render(
      <InspectorPanel
        drill={d}
        step={d.steps[0]!}
        stepIndex={0}
        dispatch={() => {}}
        selection={new Set()}
        pendingPlayerId={null}
        onArmPlayer={() => {}}
        onEraseIds={() => {}}
        onResetGoals={() => {}}
        showSteps={false}
      />,
    );
    expect(screen.getByRole('button', { name: '포메이션으로 채우기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '코너킥' })).toBeInTheDocument();
    // 대조군 — showSteps=false 는 실제로 스텝 구역을 지운다(깃발이 무의미한 것이 아니다).
    expect(screen.queryByText('스텝 1 / 1')).toBeNull();
  });

  it('세트피스 라벨·조항이 화면 문구와 같은 출처에서 나온다', () => {
    // 문구를 컴포넌트에 손으로 적으면 규정이 바뀌었을 때 화면만 옛말이 된다.
    expect(SET_PIECE_DEFS.corner.label).toBe('코너킥');
    expect(SET_PIECE_DEFS.kickIn.law).toBe('Law 15');
    expect(courtDefFor('flat').cornerCuts).toHaveLength(0); // 플랫에 세트피스가 없는 근거
  });
});
