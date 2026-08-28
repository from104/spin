// [드릴 정보] 아이콘 한 벌 — 2026-08-28 기현 지시: *"편집화면은 고칠 수 있다는 아이콘, 시연은
// 정보를 볼수만 있다는것 아이콘으로 구분하게 해줘."*
//
// 그전에는 두 화면이 헤더의 **같은 ⓘ 하나**를 나눠 썼다. 눌러서 모달이 뜨고 입력 칸이 없는 것을
// 보고서야 읽기 전용임을 알았는데, 그건 알려 준 것이 아니다.
//
// 이 파일이 지키는 것은 두 가지고, **둘 다 필요하다**:
//   ① 다르다 — 하나만 지키면 "구분해 달라" 는 지시가 안 지켜진다.
//   ② 한 벌이다(밑판 공유) — 이것만 빠지면 두 화면이 서로 무관한 그림 둘이 되고, 오가는 사람이
//      "같은 것의 두 모드" 로 못 읽는다. 밑판이 흔들리면 아이콘이 통째로 바뀐 것처럼 보인다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { IconDrillInfoEdit, IconDrillInfoRead } from './icons.tsx';

/** 아이콘의 `<path d>`·`<circle>` 을 순서대로 모은 문자열 — 그림의 지문이다. */
function shape(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll('path, circle')).map((n) =>
    n.tagName === 'circle' ? `circle:${n.getAttribute('cx')},${n.getAttribute('cy')},${n.getAttribute('r')}` : `path:${n.getAttribute('d')}`,
  );
}

const edit = () => shape(render(<IconDrillInfoEdit />).container);
const read = () => shape(render(<IconDrillInfoRead />).container);

describe('[드릴 정보] 아이콘 — 한 벌이되 구분된다', () => {
  it('밑판(정보 카드 + 글줄)이 같다 — 같은 것의 두 모드로 읽혀야 한다', () => {
    const [aCard, aLines] = edit();
    const [bCard, bLines] = read();
    expect(aCard).toBe(bCard);
    expect(aLines).toBe(bLines);
    // 대조군: 밑판이 실제로 무언가를 그리고 있다(빈 문자열 둘이 같아서 통과한 것이 아니다).
    expect(aCard).toMatch(/^path:M/);
  });

  it('수정자가 다르다 — 편집은 연필, 시연은 눈', () => {
    const a = edit();
    const b = read();
    expect(a.slice(2)).not.toEqual(b.slice(2));
    // 눈은 동공(circle)이 있고 연필은 없다 — 실루엣이 갈리는 지점이다.
    expect(b.some((p) => p.startsWith('circle:'))).toBe(true);
    expect(a.some((p) => p.startsWith('circle:'))).toBe(false);
  });

  it('두 아이콘이 통째로 같지 않다 — 지시의 요점이 구분이다', () => {
    expect(edit()).not.toEqual(read());
  });

  it('ⓘ(IconInfo)를 쓰지 않는다 — 그 글리프에는 "고칠 수 있다" 를 얹을 자리가 없다', async () => {
    const { IconInfo } = await import('./icons.tsx');
    const info = shape(render(<IconInfo />).container);
    expect(edit()).not.toEqual(info);
    expect(read()).not.toEqual(info);
  });
});
