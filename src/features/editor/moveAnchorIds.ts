// 이동 앵커가 **무엇을 감싸고 무엇을 옮기는가**. 순수 함수 하나(§6.10d, 2026-09-13).
//
// 왜 따로 두나: 이 명단이 두 곳에서 쓰인다 — 앵커가 뜰 상자를 재는 곳(EditorStage)과, 앵커를
// 눌렀을 때 실제로 미는 곳(useEditorPointer). 두 곳이 각자 명단을 만들면 언젠가 갈라지고,
// 갈라지는 순간 **앵커가 감싼 것과 옮겨지는 것이 달라진다** — 화면이 거짓말하는 부류의 사고다.
import { isId } from '../../core/ids.ts';

/**
 * 지금 선택에서 앵커가 다룰 id 들. 앵커를 띄우지 않을 자리에서는 **빈 배열**이다.
 *
 * 규칙 둘:
 * ① 잠긴 것·무시된 것은 뺀다 — 눌러도 안 움직이는 것을 감싼 앵커는 고장 난 버튼이다.
 * ② 거르고 **하나만 남았다면** 그것이 도형(`sh`)이나 메모(`nt`)일 때만 낸다.
 *
 * ②가 기현님 지시(*"도형, 메모, 다중 선택에서…"*)의 전부다. 휠체어·공·콘 하나가 빠지는 이유는
 * 크기가 아니라 **회로**다: 그 셋은 몸통을 잡으면 물리 드래그(견인·회전·충돌·리시)가 열리는데,
 * 앵커는 모델을 직접 미는 길이라 같은 손짓이 다른 이동이 된다. 겹쳐서 못 집는 문제도 그 셋에는
 * 거의 없다 — 몸통이 넓고, 가리면 표시순서로 꺼낸다.
 *
 * 화살표·획이 하나일 때도 빠진다: 그쪽은 몸통 어디를 잡아도 끌리고, 이미 제 손잡이가 있다.
 */
export function moveAnchorIds(
  selection: ReadonlySet<string>,
  locked?: ReadonlySet<string>,
  ignored?: ReadonlySet<string>,
): string[] {
  const ids = Array.from(selection).filter((id) => !locked?.has(id) && !ignored?.has(id));
  if (ids.length === 0) return [];
  if (ids.length === 1) {
    const only = ids[0]!;
    if (!isId(only, 'sh') && !isId(only, 'nt')) return [];
  }
  return ids;
}
