// 판에서 개체를 치울 때 **뭐라고 부를 것인가**. 근거는 하나뿐이다 —
// **사용자가 다시 꺼낼 수 있는가**.
//
// 칩·공·콘은 트레이(§6.10)에 자리가 남아 있어 판에서 치워도 다시 끌어다 놓을 수 있다.
// 화살표·메모·도형은 그 자리가 없어 치우면 되돌리기 말고는 되살릴 길이 없다.
// 앞은 '빼기', 뒤는 '삭제'다.
//
// 이 판정이 **한 군데서만** 나와야 하는 이유: 같은 한 번의 조작이 사용자에게 세 곳으로
// 나타난다 — 개체 메뉴의 라벨, 트레이 복귀 소리(`trayReturn`), 그리고 끝나고 뜨는 토스트.
// 셋이 따로 판정하면 "글자는 빼기인데 소리는 안 나고 토스트는 삭제라 하는" 식으로 어긋난다.
import { isId } from '../../core/ids.ts';

/** 판에서 빼면 트레이에 **다시 꺼낼 자리가 있는가**. 곧 출연진(`CastId` = 칩·공·콘)인가. */
export const returnsToTray = (id: string): boolean =>
  isId(id, 'ch') || isId(id, 'bl') || isId(id, 'cn');

/** 치운 뒤 뜨는 토스트 문구. 러버밴드로 칩과 화살표를 함께 잡아 한 번에 치울 수 있으므로
 *  **섞인 경우가 실제로 생긴다** — 그때 한쪽 말로 뭉뚱그리면 둘 중 하나는 거짓말이 된다.
 *  (칩을 함께 지웠는데 "삭제했습니다" 라고 하면 트레이를 다시 볼 이유가 사라진다.) */
export function removalToast(ids: readonly string[]): string {
  const back = ids.filter(returnsToTray).length;
  const gone = ids.length - back;
  if (gone === 0) return `${back}개 뺐습니다.`;
  if (back === 0) return `${gone}개 삭제했습니다.`;
  return `${back}개 빼고 ${gone}개 삭제했습니다.`;
}
