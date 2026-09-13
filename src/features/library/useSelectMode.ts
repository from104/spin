// 목록의 **선택 모드**(2026-09-14 기현님 지시 — *"드릴, 세션 목록에서 선택해서 지우는 동작"*).
//
// 드릴 목록과 세션 목록이 같은 상태를 쓴다. 두 화면은 컴포넌트를 하나도 공유하지 않지만(카드와
// 행이 각자 구현이다) **모드의 의미론**까지 두 벌이면 한쪽만 고쳐지는 날이 온다.
//
// 왜 상시 체크박스가 아니라 모드인가: 목록은 매일 보는 화면이고 삭제는 드문 조작이다. 항목마다
// 표적을 하나씩 영구히 더하면 좁은 폭에서 줄이 넘치고(세션 행은 지금도 360px 에서 넘친다) 화면
// 표적 예산(AGENTS §표적)을 상시로 더 쓴다. 대신 «모드에 들어간 줄 모르고 눌렀다» 를 막는 것은
// 부르는 쪽 몫이다 — 툴바 줄 교체·체크 표시·모드 중 다른 버튼 잠금 셋이 그 일을 한다.
//
// 편집기 사이드바(`StepSidebar` §C-1)가 이미 같은 규약을 쓴다: 명시적 진입, 모드를 끄면 전부
// 해제, 상태는 **컴포넌트 로컬**(리듀서·되돌리기에 안 들어간다 — 지금 화면을 보는 사람의 작업
// 맥락이라 새로고침하면 사라지는 것이 맞다).
import { useCallback, useMemo, useState } from 'react';

export interface SelectModeApi<Id extends string> {
  mode: boolean;
  /** 지금 체크된 것. **보이지 않는 것이 섞일 수 있다** — 필터를 바꾸면 화면에서 사라지지만
   *  체크는 남는다. 지우기 직전에 부르는 쪽이 «보이는 것» 과 교집합을 잡을지 정한다. */
  checked: ReadonlySet<Id>;
  count: number;
  enter(first?: Id): void;
  exit(): void;
  toggle(id: Id): void;
  /** 지금 화면에 보이는 것 전부를 체크한다(필터가 걸려 있으면 그 결과만). 이미 전부 체크돼
   *  있으면 **푼다** — 같은 버튼이 켜고 끄는 것이 목록 UI 의 통상이다. */
  toggleAll(visible: readonly Id[]): void;
  /** 지운 뒤처럼 «이제 없는 id» 를 털어 낸다. */
  remove(ids: readonly Id[]): void;
}

export function useSelectMode<Id extends string>(): SelectModeApi<Id> {
  const [mode, setMode] = useState(false);
  const [checked, setChecked] = useState<ReadonlySet<Id>>(() => new Set());

  const enter = useCallback((first?: Id) => {
    setMode(true);
    // 카드 메뉴의 [여기부터 선택] 로 들어오면 그 하나가 이미 체크돼 있어야 한다 — 안 그러면
    // 모드에 들어온 뒤 같은 항목을 한 번 더 눌러야 한다.
    setChecked(first === undefined ? new Set() : new Set([first]));
  }, []);

  const exit = useCallback(() => {
    setMode(false);
    setChecked(new Set());
  }, []);

  const toggle = useCallback((id: Id) => {
    setChecked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((visible: readonly Id[]) => {
    setChecked((cur) => {
      const allOn = visible.length > 0 && visible.every((id) => cur.has(id));
      if (allOn) {
        const next = new Set(cur);
        for (const id of visible) next.delete(id);
        return next;
      }
      const next = new Set(cur);
      for (const id of visible) next.add(id);
      return next;
    });
  }, []);

  const remove = useCallback((ids: readonly Id[]) => {
    setChecked((cur) => {
      const next = new Set(cur);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  return useMemo(
    () => ({ mode, checked, count: checked.size, enter, exit, toggle, toggleAll, remove }),
    [mode, checked, enter, exit, toggle, toggleAll, remove],
  );
}
