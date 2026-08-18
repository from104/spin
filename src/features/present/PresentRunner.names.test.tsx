// 3.4 — 시연 자막의 **선수 명단(번호 ↔ 사람) 범례**.
//
// 코트의 칩은 등번호만 찍고(2026-08-11 등번호 2/3 크기 결정) 개체 층은 통째로 `aria-hidden`
// 이다(PresentStage) — 이름을 적어 둔 코치에게 그 이름이 시연에서 **한 번도 나오지 않았다.**
// 여기서 보는 것은 두 가지다: 적은 이름이 자막에 실리는가, 그리고 **안 적었으면 아무것도 늘지
// 않는가**(번호뿐인 항목을 나열하면 코트에 이미 있는 정보를 옮겨 적는 것이라 자막만 길어진다).
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PresentRunner } from './PresentRunner.tsx';
import type { PresentNav } from './PresentRunner.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { HeaderProvider, AppHeader } from '../../app/AppHeader.tsx';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import type { Drill } from '../../model/drill.ts';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <ToastProvider>
      <HeaderProvider>
        <AppHeader />
        {children}
      </HeaderProvider>
    </ToastProvider>
  </SettingsProvider>
);

const nav: PresentNav = { back: () => {}, go: () => {} };

/** 이름을 몇 명에게만 붙인 드릴. 나머지는 이름 없이 남긴다 — '절반만 적은' 실제 상황이다. */
async function makeDrill(names: Record<string, string>): Promise<Drill> {
  const base = await idbDrillRepo.createDrill({ courtMode: 'full', title: `명단 ${Math.random()}` });
  const chairs = base.cast.chairs.map((c) => {
    const key = `${c.team}:${c.number}`;
    return names[key] !== undefined ? { ...c, name: names[key] } : c;
  });
  return idbDrillRepo.putDrill({ ...base, cast: { ...base.cast, chairs } }, { touch: false });
}

const legend = () => screen.queryByLabelText('선수 명단');

describe('3.4 시연 자막 — 번호와 사람을 잇는 범례', () => {
  it('이름을 적은 선수만 번호와 함께 실린다', async () => {
    const drill = await makeDrill({ 'home:2': '김민수', 'home:G': '이수현' });
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });
    const el = await screen.findByLabelText('선수 명단');

    expect(el.textContent).toContain('G번 이수현');
    expect(el.textContent).toContain('2번 김민수');
    // 이름을 안 적은 선수는 나오지 않는다 — 원정 2번도 코트에 있지만 범례에는 없다.
    expect(el.textContent).not.toContain('3번');
    expect(el.textContent).not.toContain('4번');
  });

  it('아무도 이름이 없으면 그 줄 자체가 없다 — 없는 정보로 자막을 늘리지 않는다', async () => {
    const drill = await makeDrill({});
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });
    // 대조군: 자막 자체는 떠 있다(드릴이 안 열려서 통과한 게 아니다). 스텝 이름은
    // 과제⑦(2026-08-17)로 폐기됐으니 STEP 배지로 확인한다.
    expect(await screen.findByText('STEP 1/1')).toBeInTheDocument();
    expect(legend()).toBeNull();
    // 음의 대조군(검증 결함 수정, 2026-08-17): 이름 없는 드릴은 과제⑦ 이전엔 헤드라인이
    // `이름 없음` 자리표시자를 그대로 보여줬다 — 헤드라인이 폐기됐다는 것을 이 자리표시자의
    // 부재로 확인한다(그냥 사라진 게 아니라 다른 문구로 옮겨간 게 아님을 잡는다).
    expect(screen.queryByText('이름 없음')).toBeNull();
  });

  it('공백만 적힌 이름은 이름이 아니다 — 빈 항목이 자막에 끼지 않는다', async () => {
    const drill = await makeDrill({ 'home:2': '   ', 'away:3': '박지훈' });
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });
    const el = await screen.findByLabelText('선수 명단');
    expect(el.textContent).toBe('3번 박지훈');
  });

  it('범례는 시연 자막 블록 안에 있다 — 스텝 진행 표시와 같은 자리에서 읽힌다', async () => {
    const drill = await makeDrill({ 'home:4': '정하늘' });
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });
    const el = await screen.findByLabelText('선수 명단');
    const block = el.parentElement!;
    // 스텝 이름은 과제⑦(2026-08-17)로 폐기됐다 — 같은 블록의 STEP 배지로 확인한다.
    expect(within(block).getByText('STEP 1/1')).toBeInTheDocument();
  });
});
