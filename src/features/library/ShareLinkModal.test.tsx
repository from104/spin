// 공유 링크 **만들기** 모달의 회귀 셋(PLAN-SHARE-LINK 결정 10·11).
//
// 목은 `src/share/api.ts` 의 서버 왕복 두 함수뿐이다 — 접기(deflate)·잠그기(AES-GCM)·링크 조립은
// **진짜로 돈다.** 그래야 "모달이 만든 문자열이 정말 열 수 있는 링크인가" 가 검사 대상이 된다
// (api 까지 다 목으로 세우면 이 파일은 자기가 정한 문자열을 자기가 확인하는 자기증명이 된다).
//
// 지우면 새는 것 셋:
//  ① deleteToken 을 `spin.shareLinks` 에 안 남기면 그 링크는 만료(180일)까지 아무도 못 지운다.
//     서버는 sha256 만 갖고 원문을 한 번만 준다 — 화면이 흘리면 복구가 **불가능**하다.
//  ② 만들기 경로의 `too-large` 를 가져오기용 접기표(SHARE_NOTICE_BY_KIND)로 흘리면 "드릴이 너무
//     큽니다" 대신 "열쇠가 맞지 않습니다" 가 뜬다 — 사용자가 할 일이 정반대로 안내된다.
//  ③ 클립보드가 거절해도 성공처럼 보이면(문구 없음) 사람은 붙여넣기가 왜 안 되는지 모른 채 다시 누른다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { ShareLinkModal } from './ShareLinkModal.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { createDrill } from '../../model/defaults.ts';
import { CURRENT_SESSION_SCHEMA } from '../../model/session.ts';
import type { TrainingSession } from '../../model/session.ts';
import type { Drill } from '../../model/drill.ts';
import { loadShareLinks, SHARE_LINKS_KEY } from '../../storage/shareLinks.ts';
import { SHARE_ID_RE, SHARE_KEY_RE } from '../../share/link.ts';

const upload = vi.fn();

vi.mock('../../share/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../share/api.ts')>();
  return { ...actual, uploadCiphertext: (bytes: Uint8Array) => upload(bytes) };
});

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

const drill = () => createDrill({ courtMode: 'full', title: '공유할 드릴' });

/** 장소·메모를 **실제로 가진** 세션. 이 둘이 봉투에 실려 나간다는 것이 S2 의 고지 대상이다. */
function session(drills: Drill[]): TrainingSession {
  return {
    schemaVersion: CURRENT_SESSION_SCHEMA,
    id: 'se_share_x' as TrainingSession['id'],
    title: '금요 훈련',
    location: '시립체육관',
    note: '골키퍼 없이 시작',
    phases: [
      {
        id: 'ph_1' as TrainingSession['phases'][number]['id'],
        kind: 'custom',
        title: '훈련',
        items: drills.map((d, i) => ({ id: `it_${i}` as never, drillId: d.id, titleCache: d.title, durationMinCache: d.durationMin, categoryCache: d.drillType })),
      },
    ],
    drillIds: drills.map((d) => d.id),
    createdAt: 0,
    updatedAt: 0,
  };
}

beforeEach(() => {
  localStorage.removeItem(SHARE_LINKS_KEY);
  upload.mockReset();
  upload.mockResolvedValue({ id: 'Ab3dEf9hIj', deleteToken: 'tok-43', expiresAt: 1_800_000 });
});

describe('ShareLinkModal — 만들기', () => {
  it('링크를 만들어 보여주고 삭제 토큰을 spin.shareLinks 에 남긴다', async () => {
    const d = drill();
    render(<ShareLinkModal open doc={{ kind: 'drill', drill: d }} onClose={() => {}} />, { wrapper });

    const input = await screen.findByRole('textbox', { name: '공유 링크' });
    const link = (input as HTMLInputElement).value;
    // 링크 꼴: `<origin>/s/<id 10자>#<키 43자>`. id·키를 정규식으로 재는 이유는, 문자열을
    // 통째로 베껴 비교하면 키가 무작위라 검사표가 구현을 베끼는 자기증명이 되기 때문이다.
    const [path, keyB64] = link.slice(window.location.origin.length).split('#');
    expect(path).toBe('/s/Ab3dEf9hIj');
    expect(SHARE_ID_RE.test('Ab3dEf9hIj')).toBe(true);
    expect(SHARE_KEY_RE.test(keyB64 ?? '')).toBe(true);

    // ① 서버가 한 번만 주는 토큰이 남았는가 — 이 줄이 없으면 회수 불가능한 링크가 된다.
    expect(loadShareLinks()['Ab3dEf9hIj']).toMatchObject({ deleteToken: 'tok-43', drillId: d.id });
    // 올라간 것은 iv(12) ‖ 암호문이지 평문이 아니다 — 봉투 JSON 의 첫 글자가 그대로 나가면 안 된다.
    const sent = upload.mock.calls[0]?.[0] as Uint8Array;
    expect(sent.byteLength).toBeGreaterThan(12);
    expect(new TextDecoder().decode(sent).startsWith('{')).toBe(false);
  });

  it('[복사]가 클립보드를 부르고, 거절당하면 직접 복사하라고 말한다', async () => {
    // ⚠️ `userEvent.setup()` 이 스스로 navigator.clipboard 를 자기 스텁으로 갈아 끼운다 —
    //    목은 그 **뒤에** 꽂아야 한다(먼저 꽂으면 조용히 덮여, 이 테스트가 남의 스텁을 재게 된다).
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<ShareLinkModal open doc={{ kind: 'drill', drill: drill() }} onClose={() => {}} />, { wrapper });
    const input = (await screen.findByRole('textbox', { name: '공유 링크' })) as HTMLInputElement;

    await user.click(screen.getByRole('button', { name: '복사' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(input.value));
    expect(await screen.findByText('링크를 복사했습니다.')).toBeInTheDocument();

    // ③ 거절 — 성공 문구가 아니라 "직접 골라 복사하라" 가 떠야 한다.
    writeText.mockRejectedValue(new Error('denied'));
    await user.click(screen.getByRole('button', { name: '복사' }));
    expect(await screen.findByText(/직접 선택해 복사하세요/)).toBeInTheDocument();
  });
});

describe('ShareLinkModal — 오류 문구는 kind 로 갈린다', () => {
  // ② 만들기 경로에만 있는 둘(too-large·rate-limited)이 가져오기용 접기표로 새면 여기가 운다.
  const cases: Array<[string, RegExp]> = [
    ['too-large', /링크로 보내기엔 큽니다/],
    ['rate-limited', /요청이 너무 잦습니다/],
    ['network', /서버에 닿지 못했습니다/],
    ['not-found', /없거나 만료됐습니다/],
  ];

  for (const [kind, text] of cases) {
    it(`${kind} → 그 종류의 문구만 뜬다`, async () => {
      const { ShareError } = await import('../../share/api.ts');
      upload.mockRejectedValue(new ShareError(kind as 'network'));
      render(<ShareLinkModal open doc={{ kind: 'drill', drill: drill() }} onClose={() => {}} />, { wrapper });
      const alert = await screen.findByRole('alert');
      expect(alert.textContent ?? '').toMatch(text);
    });
  }

  it('오류일 때는 복사할 링크 칸을 아예 안 그린다', async () => {
    const { ShareError } = await import('../../share/api.ts');
    upload.mockRejectedValue(new ShareError('network'));
    render(<ShareLinkModal open doc={{ kind: 'drill', drill: drill() }} onClose={() => {}} />, { wrapper });
    await screen.findByRole('alert');
    expect(screen.queryByRole('textbox', { name: '공유 링크' })).toBeNull();
  });
});


// PLAN-SHARE-LINK §6 S2(2026-09-08) — 세션 링크에만 붙는 고지 한 줄.
//
// 지우면 새는 것: 세션 봉투는 드릴과 달리 **코치가 쓴 글**(장소·메모)을 그대로 싣고 나간다.
// 그 사실을 보내기 전에 말하지 않으면, 사람은 "패턴만 간다" 고 믿고 체육관 이름과 팀 사정이
// 적힌 메모를 남에게 넘긴다 — 회수가 불가능한 링크다. 반대편(드릴 링크에 이 줄이 뜨는 것)도
// 잘못이다: 드릴 봉투에는 장소도 메모도 없어 없는 사실을 알리는 것이 된다.
describe('ShareLinkModal — 세션 링크의 고지(S2)', () => {
  it('세션이면 "장소·메모가 포함됩니다" 가 붙고, 드릴이면 안 붙는다', async () => {
    const d = drill();
    const view = render(<ShareLinkModal open doc={{ kind: 'session', session: session([d]), drills: [d] }} onClose={() => {}} />, { wrapper });
    await screen.findByRole('textbox', { name: '공유 링크' });
    expect(screen.getByText(/장소·메모가 포함됩니다/)).toBeInTheDocument();
    // 링크 자체에 대한 고지(서버·만료)는 두 갈래 공통이다 — 세션 줄이 그것을 밀어내지 않았다.
    expect(screen.getByText(/180일 뒤 만료/)).toBeInTheDocument();
    view.unmount();

    render(<ShareLinkModal open doc={{ kind: 'drill', drill: d }} onClose={() => {}} />, { wrapper });
    await screen.findByRole('textbox', { name: '공유 링크' });
    expect(screen.queryByText(/장소·메모가 포함됩니다/)).toBeNull();
  });

  it('세션 링크의 삭제 토큰은 sessionId 칸에 남는다 — 드릴 칸에 밀어 넣지 않는다', async () => {
    // 2026-09-08 검수: U 가 «칸이 없어 못 남긴다» 로 못박았던 자리다. 칸(`ShareLinkRecord.sessionId`)을
    // 넓혀 뒤집었다 — 장소·메모가 실리는 쪽(세션)이야말로 만료 전에 지울 권리가 필요하다.
    // 지우면 새는 것: 세션 id 가 drillId 칸에 들어가면 회수 UI 가 없는 드릴을 답하고, 아무 칸에도
    // 안 남으면 그 링크는 180일 동안 아무도 못 지운다.
    const d = drill();
    const s = session([d]);
    render(<ShareLinkModal open doc={{ kind: 'session', session: s, drills: [d] }} onClose={() => {}} />, { wrapper });
    await screen.findByRole('textbox', { name: '공유 링크' });
    const rec = loadShareLinks()['Ab3dEf9hIj'];
    expect(rec).toMatchObject({ deleteToken: 'tok-43', sessionId: s.id });
    expect(rec?.drillId).toBeUndefined();
  });
});
