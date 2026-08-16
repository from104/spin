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

/** 개체 메뉴 마지막 항목의 글자. 토스트와 **같은 판정**에서 나온다(이 파일이 있는 이유).
 *
 *  하나일 때는 종전 그대로 '빼기'/'삭제' 다 — 개수를 붙이면 판 위의 개체 하나를 두고
 *  *"1개 빼기"* 라고 세는 꼴이 된다. 여럿일 때만 개수를 앞세우고, 섞였으면 **양쪽을 다 적는다**:
 *  누르기 전에 알아야 하는 것이 바로 "몇 개는 돌아오고 몇 개는 안 돌아온다" 이기 때문이다. */
export function removalLabel(ids: readonly string[]): string {
  const back = ids.filter(returnsToTray).length;
  const gone = ids.length - back;
  if (ids.length <= 1) return gone === 0 ? '빼기' : '삭제';
  if (gone === 0) return `${back}개 빼기`;
  if (back === 0) return `${gone}개 삭제`;
  return `${back}개 빼기 · ${gone}개 삭제`;
}
