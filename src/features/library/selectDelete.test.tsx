// 목록 다중 삭제의 **화면 계약**(2026-09-14 기현님 지시 *"드릴, 세션 목록에서 선택해서 지우는 동작"*).
//
// 훅의 의미론은 useSelectMode.test 가, 저장소의 원자성은 bulkDelete.test 가 잰다. 여기서 재는
// 것은 그 사이 — **모드에 들어가면 다른 길이 잠기는가**. 지우면 새는 것:
// 모드에 들어간 줄 모르고 [시연]을 눌러 시연이 시작되거나, 케밥이 열려 단건 삭제가 섞인다.
// 그 둘은 파괴 방향의 사고이고, 화면을 보면 알 수 있는 종류가 아니다(모드 표시는 줄 하나뿐이다).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { DrillCard, DrillRow } from './DrillCard.tsx';
import type { DrillSummary } from '../../model/summary.ts';
import { buildSummary } from '../../model/summary.ts';
import { createDrill } from '../../model/defaults.ts';

// 요약은 **모델이 만든다** — 손으로 적으면 필드가 하나 늘 때마다 이 파일이 조용히 낡는다
// (실제로 `teams` 를 빼먹어 카드가 렌더 중에 터졌다).
const drill: DrillSummary = buildSummary(createDrill({ courtMode: 'full', title: '드릴 하나' }));

const noop = () => {};
const wrap = (node: React.ReactNode) => render(<SettingsProvider>{node}</SettingsProvider>);
const props = {
  drill,
  onOpen: noop,
  onPresent: noop,
  onDuplicate: noop,
  onDelete: noop,
  onExport: noop,
};

describe('선택 모드 — 다른 길이 잠긴다', () => {
  it.each([
    ['카드', DrillCard],
    ['행', DrillRow],
  ])('%s: 모드 밖에서는 [시연]·케밥이 살아 있다 — 대조군', (_name, Item) => {
    wrap(<Item {...props} />);
    expect(screen.getByRole('button', { name: /시연/ })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /더보기/ }), '케밥이 있다').toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it.each([
    ['카드', DrillCard],
    ['행', DrillRow],
  ])('%s: 모드 안에서는 체크박스가 생기고 [시연]은 잠기고 케밥은 사라진다', (_name, Item) => {
    wrap(<Item {...props} selection={{ mode: true, checked: false, onToggle: noop }} />);
    const box = screen.getByRole('checkbox', { name: /드릴 하나/ });
    expect(box).not.toBeChecked();
    expect(screen.getByRole('button', { name: /시연/ }), '눌러도 시연이 시작되면 안 된다').toBeDisabled();
    expect(screen.queryByRole('button', { name: /더보기/ }), '케밥이 열리면 단건 삭제가 섞인다').toBeNull();
  });

  it('체크된 상태가 화면에 실제로 반영된다 — 낭독기가 «선택됨» 으로 읽는 근거다', () => {
    wrap(<DrillCard {...props} selection={{ mode: true, checked: true, onToggle: noop }} />);
    expect(screen.getByRole('checkbox', { name: /드릴 하나/ })).toBeChecked();
  });
});
