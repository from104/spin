// C4(react-router 도입) — useAppHistory 는 이제 라우터 위의 **어댑터**다. 지키는 계약 셋:
//  (1) go/back/screen/target 시그니처가 그대로다(EditorWorkspace 계약 — 개명 금지)
//  (2) depth 규율: in-app 이력이 있으면 진짜 뒤로, 없으면 fallback 으로 **교체**(replace) —
//      시연 종료가 브라우저 뒤로가기 토글이 되지 않게 하는 안전판(옛 구현의 그 계약)
//  (3) 경로 접기/펴기(routes.ts)가 왕복 항등이다 — go 가 만든 주소를 새로고침이 그대로 읽는다
import { StrictMode, createElement } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { useAppHistory } from './useAppHistory.ts';
import type { AppHistoryApi, NavTarget } from './useAppHistory.ts';
import { parsePath, pathFor } from './routes.ts';
import { SCREEN_ORDER } from './screens.ts';
import type { Screen } from './screens.ts';

afterEach(cleanup);

let captured: AppHistoryApi | null = null;
function Probe() {
  captured = useAppHistory();
  return createElement('div', { 'data-testid': 'screen' }, `${captured.screen}:${JSON.stringify(captured.target ?? null)}`);
}

function mount(initialPath = '/') {
  const router = createMemoryRouter([{ path: '*', element: createElement(Probe) }], { initialEntries: [initialPath] });
  render(createElement(StrictMode, null, createElement(RouterProvider, { router })));
  return router;
}

describe('routes — pathFor/parsePath 왕복 항등', () => {
  const cases: Array<[Screen, NavTarget | undefined]> = [
    ['board', { kind: 'board' }],
    ['board', { kind: 'drill', id: 'dr_x1' }],
    ['drills', undefined],
    ['drills', { kind: 'tab', tab: 'sessions' }],
    ['drills', { kind: 'session', id: 'se_x1' }],
    ['present', { kind: 'drill', id: 'dr_x1' }],
    ['present', { kind: 'session', id: 'se_x1' }],
    ['present', undefined],
    ['settings', undefined],
  ];
  it.each(cases)('%s + %j 가 경로 왕복에서 살아남는다', (scr, target) => {
    const path = pathFor(scr, target);
    const [pathname, search = ''] = path.split('?');
    const back = parsePath(pathname!, search);
    expect(back.screen).toBe(scr);
    if (target === undefined) {
      // 대상 없는 board 는 없다(루트가 곧 자유 판) — 그 외는 대상도 없이 돌아온다.
      if (scr === 'board') expect(back.target).toEqual({ kind: 'board' });
      else expect(back.target).toBeUndefined();
    } else if (scr === 'drills' && target.kind === 'tab' && target.tab === 'drills') {
      expect(back.target).toBeUndefined();
    } else {
      expect(back.target).toEqual(target);
    }
  });

  it('모르는 경로는 전술판이다 — 대문이 안 뜨는 것이 최악이라 404 를 만들지 않는다', () => {
    expect(parsePath('/whatever/else')).toEqual({ screen: 'board', target: { kind: 'board' } });
    expect(parsePath('/')).toEqual({ screen: 'board', target: { kind: 'board' } });
  });

  it('화면 키 전수에 pathFor 가 경로를 준다 (SCREEN_ORDER 대조군)', () => {
    for (const scr of SCREEN_ORDER) expect(pathFor(scr).startsWith('/')).toBe(true);
  });
});

describe('useAppHistory — 어댑터 계약', () => {
  it('루트 진입은 board + {kind:board} 다', () => {
    mount('/');
    expect(captured!.screen).toBe('board');
    expect(captured!.target).toEqual({ kind: 'board' });
  });

  it('주소로 직접 진입해도 화면·대상이 복원된다(새로고침 생존 — URL 이 저장소다)', () => {
    mount('/present/drill/dr_abc');
    expect(captured!.screen).toBe('present');
    expect(captured!.target).toEqual({ kind: 'drill', id: 'dr_abc' });
  });

  it('go(next, target) 가 화면·대상·주소를 함께 바꾼다', async () => {
    const router = mount('/');
    captured!.go('board', { kind: 'drill', id: 'dr_9' });
    await waitFor(() => expect(screen.getByTestId('screen').textContent).toContain('dr_9'));
    expect(captured!.screen).toBe('board');
    expect(router.state.location.pathname).toBe('/drills/dr_9');
  });

  it('back(fallback): in-app 이력이 있으면 진짜 뒤로 간다', async () => {
    const router = mount('/');
    captured!.go('drills');
    await waitFor(() => expect(captured!.screen).toBe('drills'));
    captured!.go('present', { kind: 'drill', id: 'dr_1' });
    await waitFor(() => expect(captured!.screen).toBe('present'));
    captured!.back('board');
    await waitFor(() => expect(captured!.screen).toBe('drills')); // fallback 이 아니라 직전 화면
    expect(router.state.location.pathname).toBe('/drills');
  });

  it('back(fallback): 직접 진입(depth 0)이면 fallback 으로 **교체**한다 — 이력을 쌓지 않는다', async () => {
    const router = mount('/present/drill/dr_z');
    expect(captured!.screen).toBe('present');
    captured!.back('board');
    await waitFor(() => expect(captured!.screen).toBe('board'));
    expect(router.state.location.pathname).toBe('/');
    // replace 라 히스토리 스택 길이가 그대로 1 이다 — 브라우저 뒤로가기가 시연 재진입 토글이
    // 되지 않는다(옛 구현은 여기서 push 를 해 그 토글 위험을 안고 있었다).
    expect(router.state.location.state).toEqual({ depth: 0 });
  });

  it('depth 가 location.state 로 이어진다 — go 마다 +1', async () => {
    const router = mount('/');
    captured!.go('drills');
    await waitFor(() => expect(captured!.screen).toBe('drills'));
    captured!.go('settings');
    await waitFor(() => expect(captured!.screen).toBe('settings'));
    expect(router.state.location.state).toEqual({ depth: 2 });
  });
});
