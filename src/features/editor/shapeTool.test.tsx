// 작도 도형이 **화면 끝까지** 통하는가 (2026-08-14 기현 지시).
//
// model/shape.test.ts 가 규칙을 잰다면 여기는 **배선**을 잰다: 도구를 고르고 코트를 찍으면
// 실제로 도형이 서는가, 그 도형이 요구된 **층**에 있는가, 겹침이 진해지는가.
// 순수 함수만 초록이고 배선이 끊긴 경우가 이 저장소가 실제로 겪은 실패라(줌·트레이 배선),
// 두 층을 따로 둔다.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';
import { BoardScreen } from '../board/BoardScreen.tsx';
import { SHAPE_FILL_OPACITY } from '../../model/shape.ts';

function Wrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'board', go: () => {}, back: () => {} };
  return (
    <SettingsProvider>
      <LibraryProvider>
        <ToastProvider>
          <HeaderProvider>
            <AppNavProvider value={nav}>{children}</AppNavProvider>
          </HeaderProvider>
          <LiveRegion />
        </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}

async function openBoard() {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), defaultCourtMode: 'full' }));
  const user = userEvent.setup();
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return { user, stage: screen.getByRole('application', { name: '코트 편집 영역' }) };
}

/** 작도 서랍을 열고 도형 도구를 고른다. 서랍은 플라이아웃이라 손이 닿아야 열린다. */
async function pickShapeTool(user: ReturnType<typeof userEvent.setup>, label: '원' | '삼각' | '사각') {
  await user.click(screen.getByRole('button', { name: /^작도/ }));
  await user.click(screen.getByRole('button', { name: label }));
}

/** 코트 위 한 점을 찍는다. jsdom 에는 레이아웃이 없어 좌표가 전부 0 이므로, 실제 좌표가
 *  아니라 **놓였는가**만 본다(좌표 규칙은 model/shape.test 가 순수 함수로 잰다). */
const tapCourt = async (user: ReturnType<typeof userEvent.setup>, stage: HTMLElement) => {
  await user.pointer([{ target: stage, keys: '[MouseLeft]', coords: { clientX: 40, clientY: 40 } }]);
};

const shapeNodes = () => [...document.querySelectorAll('[data-shape-layer] > g[data-shape-id]')];

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('작도 서랍 — 도형 3종이 산다', () => {
  it('서랍 안에 원·삼각·사각이 **선**과 함께 있다 (2026-08-16 이동·패스 → 선)', async () => {
    const { user } = await openBoard();
    await user.click(screen.getByRole('button', { name: /^작도/ }));
    const panel = screen.getByRole('group', { name: '작도 도구' });
    const names = [...panel.querySelectorAll('button')].map((b) => b.textContent?.replace(/\s/g, ''));
    expect(names).toEqual(['선', '원', '삼각', '사각']);
  });

  it('닫혀 있으면 도형 도구도 DOM 에 없다 — 첫 화면 표적 예산 밖이다', async () => {
    await openBoard();
    expect(screen.queryByRole('button', { name: '원' })).toBeNull();
  });
});

describe('놓기 — 도구를 고르고 코트를 찍으면 도형이 선다', () => {
  it.each(['원', '삼각', '사각'] as const)('%s 도구로 찍으면 도형이 하나 는다', async (label) => {
    const { user, stage } = await openBoard();
    expect(shapeNodes()).toHaveLength(0); // 대조군 — 처음엔 없다
    await pickShapeTool(user, label);
    await tapCourt(user, stage);
    await waitFor(() => expect(shapeNodes()).toHaveLength(1));
  });

  it('놓자마자 선택된다 — 면이 옅어서 선택 링이 없으면 "아무 반응 없다" 로 읽힌다', async () => {
    const { user, stage } = await openBoard();
    await pickShapeTool(user, '사각');
    await tapCourt(user, stage);
    // 선택된 도형에만 손잡이 셋이 뜬다.
    await waitFor(() => expect(document.querySelector('[data-shape-handles]')).not.toBeNull());
  });

  it('연달아 찍으면 여러 개가 쌓인다 — 한 번 놓고 도구가 죽지 않는다', async () => {
    const { user, stage } = await openBoard();
    await pickShapeTool(user, '원');
    await tapCourt(user, stage);
    await waitFor(() => expect(shapeNodes()).toHaveLength(1));
    await tapCourt(user, stage);
    await waitFor(() => expect(shapeNodes()).toHaveLength(2));
  });
});

describe('★ 층 — 코트보다 높고 칩·화살표보다 낮다 (기현 지시의 본문)', () => {
  it('도형 층이 코트 라인 **뒤**, 개체 층 **앞**에 있다', async () => {
    const { user, stage } = await openBoard();
    await pickShapeTool(user, '사각');
    await tapCourt(user, stage);
    await waitFor(() => expect(document.querySelector('[data-shape-layer]')).not.toBeNull());

    const svg = stage.closest('svg') ?? stage;
    const nodes = [...svg.querySelectorAll('*')];
    const shapeLayer = svg.querySelector('[data-shape-layer]')!;
    // 개체 하나(골대 포스트)를 기준으로 삼는다 — 빈 판에도 반드시 있다.
    const anObject = svg.querySelector('.goal-post')!;
    const courtSurface = svg.querySelector('.court-line, .court-surface, rect')!;

    expect(nodes.indexOf(courtSurface), '도형이 코트보다 아래다').toBeLessThan(nodes.indexOf(shapeLayer));
    expect(nodes.indexOf(shapeLayer), '도형이 개체보다 위다').toBeLessThan(nodes.indexOf(anObject));
  });
});

describe('★ 겹치면 진해진다 — 알파 합성을 깨뜨리지 않는다', () => {
  it('도형마다 **자기** fill-opacity 를 갖는다 — 그룹 opacity 로 납작해지지 않았다', async () => {
    const { user, stage } = await openBoard();
    await pickShapeTool(user, '사각');
    await tapCourt(user, stage);
    await tapCourt(user, stage);
    await waitFor(() => expect(shapeNodes()).toHaveLength(2));

    const layer = document.querySelector<SVGGElement>('[data-shape-layer]')!;
    // ⚠️ 이 셋 중 하나라도 걸리면 겹침이 사라진다(ShapeLayer.tsx 머리말의 ①②③).
    expect(layer.getAttribute('opacity'), '층에 opacity 가 걸려 겹침이 한 겹으로 납작해진다').toBeNull();
    expect(layer.style.opacity).toBe('');
    expect(layer.style.mixBlendMode).toBe('');

    for (const g of shapeNodes()) {
      const face = g.querySelector('rect, ellipse, polygon')!;
      expect(Number(face.getAttribute('fill-opacity'))).toBeCloseTo(SHAPE_FILL_OPACITY, 6);
    }
  });

  it('면은 연하다 — 한 겹이 진하면 두 겹이 그냥 흰 판이 된다', () => {
    expect(SHAPE_FILL_OPACITY).toBeLessThan(0.2);
    // 세 겹까지도 코트가 비쳐야 한다: 1 − (1−a)³ 가 0.5 를 안 넘는다.
    expect(1 - (1 - SHAPE_FILL_OPACITY) ** 3).toBeLessThan(0.5);
  });
});

describe('지우개 — 도형에도 듣는다', () => {
  it('지우개로 도형을 누르면 사라진다', async () => {
    const { user, stage } = await openBoard();
    await pickShapeTool(user, '사각');
    await tapCourt(user, stage);
    await waitFor(() => expect(shapeNodes()).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: '지우개' }));
    await user.click(shapeNodes()[0] as unknown as Element);

    await waitFor(() => expect(shapeNodes()).toHaveLength(0));
  });
});
