// 코트에서 끌어온 개체를 트레이에 놓으면 빼내는 판정. 드래그 중에는 코트 SVG 가 포인터를
// 캡처하므로 이벤트 대상으로는 판정할 수 없다 — 기하(elementFromPoint)로만 답이 나온다.
//
// ── 2026-08-14 P3 (설계서 위험 2) ────────────────────────────────────────────────────
// 이 판정이 **더 아슬아슬해졌다.** 트레이가 코트에 **맞닿고**(옛 86px 죽은 띠가 사라졌다)
// 93 → 240 으로 커졌기 때문이다. 실측 여유는 1024×600 full 에서 우측 터치라인~트레이 =
// 코트 마진 1.5 m × 0.8914 = **33px** 뿐이다. 반대 방향의 위험도 함께 생겼다: 판 덩어리에
// `overflow:hidden` + `borderRadius:16` 이 붙어서, 트레이 **바깥 모서리 약 5px 호**에서는
// `elementFromPoint` 가 트레이가 아니라 **판 덩어리(또는 그 밖)** 를 돌려줄 수 있다.
//
// 그래서 두 방향을 다 찌른다. jsdom 은 레이아웃이 없으므로 좌표→요소 사상은 스텁으로 세우고,
// **판정 함수가 그 사상을 어떻게 읽는가**를 본다. 실제 사상이 맞는지는 실기 확인 항목이다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOverTray } from './useEditorPointer.ts';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

/** jsdom 은 레이아웃이 없어 elementFromPoint 가 답할 수 없다(setup.ts 가 null 스텁을 깐다).
 *  여기서는 "그 좌표에 이 요소가 있다" 를 직접 세운다. */
function stubHitAt(el: Element | null) {
  vi.spyOn(document, 'elementFromPoint').mockImplementation(() => el);
}

/** 좌표 → 요소 사상을 **구간으로** 세운다. 실제 브라우저의 히트 테스트를 흉내내는 최소 모형이다. */
function stubHitMap(map: (x: number, y: number) => Element | null) {
  vi.spyOn(document, 'elementFromPoint').mockImplementation((x: number, y: number) => map(x, y));
}

describe('isOverTray', () => {
  it('트레이 안쪽 요소 위면 참 — 자식 깊이와 무관하다', () => {
    document.body.innerHTML = '<nav data-tray><div><button id="deep">공</button></div></nav>';
    stubHitAt(document.getElementById('deep'));
    expect(isOverTray({ x: 10, y: 10 })).toBe(true);
  });

  it('트레이 밖이면 거짓', () => {
    document.body.innerHTML = '<nav data-tray></nav><svg id="court"></svg>';
    stubHitAt(document.getElementById('court'));
    expect(isOverTray({ x: 10, y: 10 })).toBe(false);
  });

  it('좌표가 없으면(pointercancel) 거짓 — 시스템 제스처에 가로채였다고 개체가 사라지면 안 된다', () => {
    document.body.innerHTML = '<nav data-tray></nav>';
    const spy = vi.spyOn(document, 'elementFromPoint');
    expect(isOverTray(null)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('아무 요소도 없으면 거짓', () => {
    stubHitAt(null);
    expect(isOverTray({ x: 0, y: 0 })).toBe(false);
  });
});

// ── 위험 2 ①: 코트와 트레이가 **맞닿는** 경계 ─────────────────────────────────────────
describe('위험 2 — 우측 터치라인 안쪽 1px 은 배치, 바깥 1px 은 반환', () => {
  // 1024×600 full narrow 의 실측 좌표계를 그대로 쓴다: 정렬 상자 1000 폭 안에서 코트 칸이
  // 0..735.4, 트레이가 735.4..975.4. 코트 마진 1.5 m × 0.8914 = 33px 이 터치라인과 트레이
  // 사이의 전부다 — "여유가 33px 뿐" 이라는 것이 이 절이 기록하는 숫자다.
  const COURT_RIGHT = 735;
  const TOUCHLINE = COURT_RIGHT - 33;

  function mount() {
    document.body.innerHTML =
      '<div id="board"><div id="cell"><svg id="court"></svg></div><nav data-tray=""><button id="chip">2번</button></nav></div>';
    const court = document.getElementById('court')!;
    const tray = document.querySelector('nav[data-tray]')!;
    // 코트 칸은 오른쪽 끝까지 코트 <svg> 다(레터박스가 0 이므로). 그 오른쪽이 곧 트레이다.
    stubHitMap((x) => (x < COURT_RIGHT ? court : tray));
    return { court, tray };
  }

  it('터치라인 **안쪽** 1px — 아직 코트다(배치)', () => {
    mount();
    expect(isOverTray({ x: TOUCHLINE - 1, y: 200 })).toBe(false);
    expect(isOverTray({ x: TOUCHLINE + 1, y: 200 })).toBe(false);
  });

  it('코트 칸 **바깥** 1px — 트레이다(반환)', () => {
    mount();
    expect(isOverTray({ x: COURT_RIGHT, y: 200 })).toBe(true);
    expect(isOverTray({ x: COURT_RIGHT + 1, y: 200 })).toBe(true);
  });

  it('경계가 정확히 코트 칸의 오른쪽 변이다 — 한 픽셀도 겹치지 않는다', () => {
    mount();
    expect(isOverTray({ x: COURT_RIGHT - 1, y: 200 })).toBe(false);
    expect(isOverTray({ x: COURT_RIGHT, y: 200 })).toBe(true);
  });

  it('마진 33px 안(터치라인 밖·코트 칸 안)은 여전히 코트다 — 라인 밖 배치(킥인)가 살아 있다', () => {
    // 여기가 참이 되면 코너킥·킥인 배치를 하려다 개체가 벤치로 돌아간다.
    mount();
    for (const x of [TOUCHLINE + 5, TOUCHLINE + 16, COURT_RIGHT - 2]) {
      expect(isOverTray({ x, y: 200 }), `x=${x}`).toBe(false);
    }
  });
});

// ── 위험 2 ②: 라운드 모서리에서 판 덩어리가 답으로 나올 때 ────────────────────────────
describe('위험 2 — borderRadius:16 + overflow:hidden 의 바깥 모서리 호', () => {
  // 판 덩어리는 `[data-board]` 이고 `[data-tray]` 가 **아니다.** 모서리 호에서 히트 테스트가
  // 트레이 대신 판 덩어리(또는 정렬 상자)를 돌려주면 `closest('[data-tray]')` 가 null 이 되어
  // **반환이 안 된다** — 개체를 벤치 모서리에 놓은 사람에게는 "안 돌아간다" 로 보인다.
  function mountRounded() {
    document.body.innerHTML =
      '<div id="board" data-board=""><div id="cell"></div><nav data-tray=""><button id="chip">2번</button></nav></div>';
    return {
      board: document.getElementById('board')!,
      tray: document.querySelector('nav[data-tray]')!,
    };
  }

  it('모서리 호에서 판 덩어리가 잡히면 반환이 **안 된다** — 이 사실을 기록으로 못박는다', () => {
    const { board } = mountRounded();
    stubHitAt(board);
    expect(isOverTray({ x: 970, y: 3 })).toBe(false);
  });

  it('판 덩어리 안이라도 트레이 안쪽이면 반환된다 — 호 바깥의 나머지 전부', () => {
    const { tray } = mountRounded();
    stubHitAt(tray);
    expect(isOverTray({ x: 900, y: 200 })).toBe(true);
  });

  it('완충을 넣는다면 이 모양이다 — 트레이 자신이 그 띠를 소유해야 판정이 참이 된다', () => {
    // 예비안(설계서 위험 2): 트레이 왼쪽 변에 `borderLeft: 8px solid transparent`.
    // 투명 테두리는 **트레이 자신의 상자**라 그 위의 히트도 트레이로 잡힌다 — 아래가 그 증명이다.
    // ⚠️ 지금은 **안 넣었다.** 넣으면 코트 칸이 8px 좁아져 §4.6 축척표의 '변화 0.00%' 가 깨지고,
    //    모서리 호는 판 덩어리의 **바깥** 모서리(위/아래·오른쪽)라 왼쪽 완충으로는 안 덮인다.
    //    실기에서 "벤치 모서리에 놓으면 안 돌아간다" 가 나오면 그때 넣는다(기현님 확인 항목).
    document.body.innerHTML = '<div data-board=""><nav data-tray="" style="border-left:8px solid transparent"></nav></div>';
    const tray = document.querySelector('nav[data-tray]')!;
    stubHitAt(tray);
    expect(isOverTray({ x: 736, y: 200 })).toBe(true);
  });
});
