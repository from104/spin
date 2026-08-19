// 2026-08-20 §D — 편집·시연 공용 재생 묶음의 컴포넌트 계약. 두 화면(EditorWorkspace·
// PresentRunner)이 실제로 이 컴포넌트 하나를 쓴다는 것은 그 화면들의 통합 테스트가 이미
// 본다(EditorScreen.test.tsx·PresentRunner.test.tsx) — 여기서는 **컴포넌트 자체의 계약**만
// 순수하게 본다: 버튼 5개·이름·상태별 라벨·콜백 배선.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { PlaybackControls } from './PlaybackControls.tsx';
import type { PlaybackControlsProps } from './PlaybackControls.tsx';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';

// useT()(→ useLocale → SettingsProvider)를 쓴다 — StepSidebar 테스트들과 같은 이유로 감싼다.
const render2 = (ui: ReactElement) => render(ui, { wrapper: SettingsProvider });

function renderControls(over: Partial<PlaybackControlsProps> = {}) {
  const props: PlaybackControlsProps = {
    playing: false,
    canPlay: true,
    onTogglePlay: () => {},
    loop: false,
    onToggleLoop: () => {},
    onPrev: () => {},
    onNext: () => {},
    speed: 1,
    onCycleSpeed: () => {},
    ...over,
  };
  return render2(<PlaybackControls {...props} />);
}

describe('PlaybackControls — 편집·시연 공용 재생 묶음(2026-08-20 §D)', () => {
  it('버튼이 정확히 5개다 — 반복·이전·재생·다음·배속', () => {
    renderControls();
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.getByRole('button', { name: '반복 켜기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이전 스텝' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '재생' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음 스텝' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '재생 속도 1배. 눌러서 2배로 변경' })).toBeInTheDocument();
  });

  it('playing 이면 재생 버튼 이름이 [일시정지]로 바뀐다', () => {
    renderControls({ playing: true });
    expect(screen.getByRole('button', { name: '일시정지' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '재생' })).toBeNull();
  });

  it('canPlay=false 면 재생이 잠긴다 — 눌렀는데 아무 일도 안 나는 헛손질 방지', () => {
    renderControls({ canPlay: false });
    expect(screen.getByRole('button', { name: '재생' })).toBeDisabled();
  });

  it('loop=true 면 반복 버튼의 이름·aria-pressed 가 함께 뒤집힌다', () => {
    renderControls({ loop: true });
    const btn = screen.getByRole('button', { name: '반복 끄기' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: '반복 켜기' })).toBeNull();
  });

  it('다섯 버튼 각각이 자기 콜백을 정확히 한 번 부른다', async () => {
    const onTogglePlay = vi.fn();
    const onToggleLoop = vi.fn();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onCycleSpeed = vi.fn();
    renderControls({ onTogglePlay, onToggleLoop, onPrev, onNext, onCycleSpeed });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '반복 켜기' }));
    expect(onToggleLoop).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: '이전 스텝' }));
    expect(onPrev).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: '재생' }));
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: '다음 스텝' }));
    expect(onNext).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /^재생 속도/ }));
    expect(onCycleSpeed).toHaveBeenCalledTimes(1);
  });

  it.each([
    [0.5, 1],
    [1, 2],
    [2, 0.5],
  ] as const)('배속 %s배 버튼은 "눌러서 %s배로 변경" 을 말한다 — 순환은 0.5→1→2→0.5', (speed, next) => {
    renderControls({ speed });
    expect(screen.getByRole('button', { name: `재생 속도 ${speed}배. 눌러서 ${next}배로 변경` })).toBeInTheDocument();
  });
});
