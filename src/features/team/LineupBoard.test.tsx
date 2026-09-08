// 라인업 위젯 — **판정이 아니라 배선**을 잰다. 규정 판정(R1·R2·R5·R8) 자체는 `model/team.test.ts`
// 의 `lineupWarnings` 스위트가 이미 수치로 잰다. 여기서 다시 재면 같은 시나리오가 두 번 돈다.
//
// 이 파일을 지우면 새는 실기 버그 셋:
//  ① 판정이 나와도 **화면에 안 뜬다** — 경고 목록을 렌더에서 빠뜨리거나 `role="status"` 를 잃으면
//     보조기술 사용자에게는 아무 일도 안 일어난 것과 같다. 노란색은 그 자체로 정보가 아니다.
//  ② 화면이 규칙을 **다시 구현한다** — 미분류를 PF2 로 세는 식. 그러면 아직 분류 심사를 못 받은
//     팀이 영구히 노란 경고를 달고 산다(R8 이 막으려던 바로 그것).
//  ③ **입력이 막힌다**(결정 8 의 반대). 경고가 뜨는 순간 버튼이 잠기면 훈련용 편성이 불가능해지고,
//     도구가 심판이 된다. 이건 컴파일러도 순수 함수 테스트도 못 잡는다 — 위젯만의 계약이다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { LineupBoard } from './LineupBoard.tsx';
import { addPlayer, emptyTeam, setLineup } from '../../model/team.ts';
import type { Team } from '../../model/team.ts';
import type { PFClass } from '../../model/roster.ts';

function teamWith(classes: readonly (PFClass | undefined)[]): Team {
  return classes.reduce<Team>((t, k, i) => addPlayer(t, `선수${i + 1}`, k), emptyTeam('ko'));
}
const idsOf = (t: Team) => t.players.map((p) => p.id);

// useT → useLocale → useSettingsState. 문구를 사전에서 꺼내 쓰는 컴포넌트는 전부 이 껍데기가 필요하다.
const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

describe('LineupBoard — 경고 배선', () => {
  it('PF2 3명째의 경고가 role="status" 라이브 리전 안에 문장으로 뜬다', async () => {
    const base = teamWith(['PF2', 'PF2', 'PF2', 'PF1']);
    const [a, b, c, d] = idsOf(base);
    const team = setLineup(base, { court: [a!, b!, c!, d!], gk: d!, bench: [] });
    render(<LineupBoard team={team} onChange={vi.fn()} />, { wrapper });

    const status = screen.getByRole('status', { name: '라인업 경고' });
    expect(status).toHaveTextContent('PF2 가 3명입니다');
    // R7 — 제재 문구가 함께 읽힌다. 경고만 있고 결과를 안 말하면 "왜 안 되는지" 를 못 배운다.
    expect(status).toHaveTextContent('간접 프리킥');
  });

  it('코트 2명 미만·GK 없음도 같은 리전에 함께 실린다 — 하나만 그리고 나머지를 버리지 않는다', () => {
    const base = teamWith(['PF1', 'PF1', 'PF1']);
    const [a] = idsOf(base);
    const team = setLineup(base, { court: [a!], bench: [] }); // 1명 · GK 미지정
    render(<LineupBoard team={team} onChange={vi.fn()} />, { wrapper });

    const status = screen.getByRole('status', { name: '라인업 경고' });
    expect(status).toHaveTextContent('코트 위가 1명입니다');
    expect(status).toHaveTextContent('골키퍼 지정이 없습니다');
  });

  it('미분류 선수는 PF2 로 세지 않는다 — 화면이 규칙을 다시 구현하지 않는다(R8)', () => {
    // 미분류 2명을 PF2 로 쳤다면 4명이 되어 경고가 떴을 것이다.
    const base = teamWith(['PF2', 'PF2', undefined, undefined]);
    const [a, b, c, d] = idsOf(base);
    const team = setLineup(base, { court: [a!, b!, c!, d!], gk: a!, bench: [] });
    render(<LineupBoard team={team} onChange={vi.fn()} />, { wrapper });

    const status = screen.getByRole('status', { name: '라인업 경고' });
    expect(status).toHaveTextContent('규정과 어긋나는 자리가 없습니다');
    expect(status.textContent).not.toContain('PF2 가');
  });
});

describe('LineupBoard — 경고는 알릴 뿐 막지 않는다 (결정 8)', () => {
  it('PF2 가 이미 3명이어도 4번째 PF2 를 코트에 더 올릴 수 있다', async () => {
    const base = teamWith(['PF2', 'PF2', 'PF2', 'PF1', 'PF2']);
    const [a, b, c, d, e] = idsOf(base);
    const team = setLineup(base, { court: [a!, b!, c!, d!], gk: d!, bench: [] });
    const onChange = vi.fn();
    render(<LineupBoard team={team} onChange={onChange} />, { wrapper });

    // 대조군 — 경고는 실제로 떠 있다(막지 "않는다" 를 재려면 막을 이유가 있어야 한다).
    expect(screen.getByRole('status', { name: '라인업 경고' })).toHaveTextContent('PF2 가 3명입니다');

    const put = screen.getByRole('button', { name: '선수5 코트로' });
    expect(put).not.toBeDisabled();
    await userEvent.setup().click(put);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0]![0] as Team).lineup!.court).toContain(e!);
  });
});

describe('LineupBoard — 조작이 실제로 라인업을 바꾼다', () => {
  it('[골키퍼로 지정]은 그 선수를 gk 로 세우고, 다시 누르면 해제한다', async () => {
    const base = teamWith(['PF1', 'PF1']);
    const [a, b] = idsOf(base);
    const team = setLineup(base, { court: [a!, b!], bench: [] });
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<LineupBoard team={team} onChange={onChange} />, { wrapper });

    await user.click(screen.getByRole('button', { name: '선수1 골키퍼로 지정' }));
    const next = onChange.mock.calls[0]![0] as Team;
    expect(next.lineup!.gk).toBe(a!);

    rerender(<LineupBoard team={next} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '선수1 골키퍼 지정 해제' }));
    expect((onChange.mock.calls[1]![0] as Team).lineup!.gk).toBeUndefined();
  });
});
