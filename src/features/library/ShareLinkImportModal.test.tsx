// [링크로 가져오기] 모달의 회귀 둘(PLAN-SHARE-LINK §8 L8).
//
// 지우면 새는 것 둘:
//  ① 붙여넣은 링크에서 뽑는 `{id, keyB64}` 가 틀리면 시트가 늘 '링크가 없습니다' 를 띄운다.
//     특히 **열쇠는 `#` 뒤 43자 그대로**여야 한다 — `#` 을 같이 넘기거나 앞뒤가 잘리면
//     복호에 실패하고, 그 실패는 서버 왕복 **뒤에야** 보인다.
//  ② 열쇠 없는 링크를 통과시키면 못 여는 암호문을 받으러 남의 서버에 헛짐을 진다(L1). 막는
//     자리가 여기라는 것이 결정이고, 그 근거는 사용자가 할 일(링크 전체를 다시 받는다)이 이미
//     정해져 있다는 것이다 — 서버가 답해 줄 것이 없다.
//
// 목은 없다. 판정하는 것이 `parseShareLink` 한 함수뿐이라(share/link.ts) 그것을 실제로 돌린다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { ShareLinkImportModal } from './ShareLinkImportModal.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

/** 43자 base64url — 32바이트 열쇠의 길이(SHARE_KEY_B64_LEN). 한 자만 모자라도 잘린 링크다. */
const KEY = 'A'.repeat(43);

describe('ShareLinkImportModal', () => {
  it('올바른 링크를 붙여넣으면 id 와 열쇠를 갈라 넘긴다', async () => {
    const onOpen = vi.fn();
    render(<ShareLinkImportModal open onClose={() => {}} onOpen={onOpen} />, { wrapper });

    const box = screen.getByRole('textbox', { name: '공유 링크' });
    await userEvent.type(box, `https://spin.atit.app/s/Ab3dEf9hIj#${KEY}`);
    await userEvent.click(screen.getByRole('button', { name: '열기' }));

    expect(onOpen).toHaveBeenCalledWith({ id: 'Ab3dEf9hIj', keyB64: KEY });
  });

  it('열쇠 없는 링크는 문구로 막고 열지 않는다', async () => {
    const onOpen = vi.fn();
    render(<ShareLinkImportModal open onClose={() => {}} onOpen={onOpen} />, { wrapper });

    await userEvent.type(screen.getByRole('textbox', { name: '공유 링크' }), 'https://spin.atit.app/s/Ab3dEf9hIj');

    expect(screen.getByRole('alert')).toHaveTextContent('링크 꼴이 아닙니다');
    // [열기]는 비활성이고, 눌러도 아무 일이 없어야 한다 — 비활성 표시만 하고 손으로 부를 수
    // 있는 경로가 남아 있으면 그 경로로 서버가 불린다.
    expect(screen.getByRole('button', { name: '열기' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '열기' }));
    expect(onOpen).not.toHaveBeenCalled();
  });
});
