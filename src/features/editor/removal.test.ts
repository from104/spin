// 판에서 치울 때 쓰는 말('빼기'/'삭제')의 계약. 이 파일이 지키는 것은 문구 자체가 아니라
// **한 조작이 세 곳(메뉴 라벨·트레이 복귀 소리·토스트)에서 같은 말을 하는가** 다.
import { describe, expect, it } from 'vitest';
import { newId } from '../../core/ids.ts';
import { removalToast, returnsToTray } from './removal.ts';

const ch = () => newId('ch');
const bl = () => newId('bl');
const cn = () => newId('cn');
const ar = () => newId('ar');
const nt = () => newId('nt');
const sh = () => newId('sh');

describe('returnsToTray', () => {
  it('출연진(칩·공·콘)만 트레이로 돌아온다', () => {
    for (const id of [ch(), bl(), cn()]) expect(returnsToTray(id), id).toBe(true);
  });

  it('화살표·메모·도형은 돌아갈 자리가 없다', () => {
    for (const id of [ar(), nt(), sh()]) expect(returnsToTray(id), id).toBe(false);
  });

  it('모르는 문자열은 돌아오지 않는 쪽으로 센다', () => {
    // 판정이 애매할 때 '빼기'라 말해 놓고 트레이에 없으면 사용자는 없는 것을 찾는다.
    // 반대 실수('삭제'라 했는데 트레이에 있다)는 찾으면 나온다 — 덜 나쁜 쪽으로 기운다.
    for (const id of ['', 'ch', 'xx_abc', 'chair']) expect(returnsToTray(id), id).toBe(false);
  });
});

describe('removalToast', () => {
  it('트레이로 돌아가는 것만 치우면 "뺐습니다"', () => {
    expect(removalToast([ch()], 'ko')).toBe('1개 뺐습니다.');
    expect(removalToast([ch(), bl(), cn()], 'ko')).toBe('3개 뺐습니다.');
  });

  it('돌아갈 자리가 없는 것만 치우면 "삭제했습니다"', () => {
    expect(removalToast([ar()], 'ko')).toBe('1개 삭제했습니다.');
    expect(removalToast([ar(), nt()], 'ko')).toBe('2개 삭제했습니다.');
  });

  it('섞이면 둘 다 말한다 — 한쪽 말로 뭉뚱그리면 나머지 절반이 거짓이 된다', () => {
    // 러버밴드로 칩과 화살표를 함께 잡는 것은 흔한 조작이다. "3개 삭제했습니다" 라고 하면
    // 트레이에 돌아온 칩 둘을 다시 볼 이유가 사라진다.
    expect(removalToast([ch(), bl(), ar()], 'ko')).toBe('2개 빼고 1개 삭제했습니다.');
  });
});
