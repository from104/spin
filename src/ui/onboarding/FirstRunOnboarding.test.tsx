// 온보딩 석 장의 **넘기기**(2026-09-16, T7).
//
// 지우면 새는 것 셋 — 셋 다 «앱이 멀쩡히 도는 채로» 나는 고장이라 다른 테스트가 못 잡는다:
// ① [다음]이 안 먹으면 첫 방문자가 첫 장에 갇힌다. 모달은 떠 있고 에러도 없다.
// ② 마지막 장의 단추가 **닫지** 않으면 앱을 못 쓴다 — 이 모달에는 «다음»이 더 없다.
// ③ 다시 열었을 때 첫 장으로 안 돌아가면([설정]의 [모두 다시 보기] 경로) 3장부터 보인다.
//    부모가 이 컴포넌트를 `open` 과 무관하게 **상시 렌더**하므로 언마운트로 안 씻긴다.
//
// 첫 장이 «놓기» 라는 것(제보가 걸린 자리가 맨 앞)은 `loader/appLoader.test.tsx` 가 첫 방문
// 순서와 함께 잰다 — 여기서 또 재지 않는다.
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { FirstRunOnboarding } from './FirstRunOnboarding.tsx';

// `useT()` 가 설정(언어)을 읽는다 — SmallScreenNotice.test 와 같은 최소 감싸개다.
const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

const next = (): HTMLElement => screen.getByRole('button', { name: '다음' });
/** 지금 보이는 장의 제목. Modal 은 `aria-labelledby` 로 이름을 주므로 **속성이 아니라 그 요소의
 *  글**을 읽는다 — `aria-label` 을 읽으면 언제나 빈 문자열이라 «안 넘어갔다» 를 못 잡는다. */
const heading = (): string => document.getElementById('first-run-onboarding-title')?.textContent ?? '';

describe('첫 실행 온보딩', () => {
  it('[다음] 로 석 장을 넘기고, 마지막 장의 단추는 [다음]이 아니라 닫는 단추다', () => {
    const onClose = vi.fn();
    render(<FirstRunOnboarding open onClose={onClose} />, { wrapper });

    const first = heading();
    fireEvent.click(next());
    const second = heading();
    expect(second, '두 번째 장이 첫 장과 같다 — 넘어가지 않았다').not.toBe(first);

    fireEvent.click(next());
    const third = heading();
    expect(third).not.toBe(second);

    // 마지막 장에는 [다음]이 없다. 있으면 넷째 장을 찾다 아무 일도 안 일어난다.
    expect(screen.queryByRole('button', { name: '다음' })).toBeNull();
    expect(onClose, '아직 닫으면 안 된다').not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('[건너뛰기] 는 중간 장에서도 바로 닫는다 — 급한 사람을 가두지 않는다', () => {
    const onClose = vi.fn();
    render(<FirstRunOnboarding open onClose={onClose} />, { wrapper });
    fireEvent.click(next());
    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('다시 열면 첫 장부터다 — 닫을 때 페이지를 안 되돌리면 3장부터 보인다', () => {
    const view = render(<FirstRunOnboarding open={false} onClose={vi.fn()} />, { wrapper });
    view.rerender(<FirstRunOnboarding open onClose={vi.fn()} />);
    const first = heading();
    fireEvent.click(next());
    fireEvent.click(next());
    expect(heading()).not.toBe(first);

    view.rerender(<FirstRunOnboarding open={false} onClose={vi.fn()} />);
    view.rerender(<FirstRunOnboarding open onClose={vi.fn()} />);
    expect(heading(), '앞 회차의 마지막 장이 그대로 남았다').toBe(first);
  });
});
