// 2.2 완료 판정 (a)(c) 의 순수 계약. jsdom 은 레이아웃을 계산하지 않으므로 "코트 상자 폭이
// 인스펙터 유무와 무관하다" 를 DOM 으로 끝까지 확인할 수 없다 — 폭을 먹는 유일한 자리를
// 함수로 좁혀 두고 여기서 값으로 못박는다. DOM 쪽 확인(오버레이가 흐름 밖이라 형제가 늘지
// 않는다)은 BoardScreen.test.tsx · EditorWorkspace.inspector.test.tsx 가 맡는다.
import { describe, expect, it } from 'vitest';
import {
  INSPECTOR_BORDER_PX,
  INSPECTOR_PIN_MIN_PX,
  INSPECTOR_WIDTH_PX,
  canPinInspector,
  inspectorChromeWidthPx,
  inspectorMode,
} from './inspectorLayout.ts';

describe('인스펙터 자리 계약 (결정 ③A)', () => {
  it('닫혀 있으면 hidden, 열리면 기본은 오버레이다', () => {
    expect(inspectorMode({ open: false, pinned: false, containerWidthPx: 1280 })).toBe('hidden');
    expect(inspectorMode({ open: true, pinned: false, containerWidthPx: 1280 })).toBe('overlay');
  });

  it('핀은 오버레이를 붙박이로 바꾼다 — 넉넉한 컨테이너에서만', () => {
    expect(inspectorMode({ open: true, pinned: true, containerWidthPx: 1280 })).toBe('pinned');
    // 27인치에서 핀을 켠 prefs 를 그대로 들고 태블릿에 오면, 붙박이가 1024 중 313 을 떼어
    // 판이 남지 않는다. 핀 값은 두고 **모양만** 오버레이로 물러난다.
    expect(inspectorMode({ open: true, pinned: true, containerWidthPx: 1024 })).toBe('overlay');
  });

  it('닫힘은 핀보다 세다 — 핀을 켠 채 닫으면 아무것도 안 뜬다', () => {
    expect(inspectorMode({ open: false, pinned: true, containerWidthPx: 1920 })).toBe('hidden');
  });

  it('폭을 먹는 것은 붙박이뿐이다 — 완료 판정 (a) 의 본체', () => {
    expect(inspectorChromeWidthPx('overlay')).toBe(0);
    expect(inspectorChromeWidthPx('hidden')).toBe(0);
    // 대조군: 붙박이는 실제로 312+1 을 떼어 간다. 이 줄이 없으면 "늘 0 을 돌려주는 함수"
    // 로도 위 두 단언이 통과한다.
    expect(inspectorChromeWidthPx('pinned')).toBe(INSPECTOR_WIDTH_PX + INSPECTOR_BORDER_PX);
    expect(INSPECTOR_WIDTH_PX + INSPECTOR_BORDER_PX).toBe(313); // §5.2 크롬 예산 표의 "312+1"
  });

  it('핀 문턱은 컨테이너 1100 이고 경계는 포함이다 (완료 판정 (c))', () => {
    expect(INSPECTOR_PIN_MIN_PX).toBe(1100);
    expect(canPinInspector(1099)).toBe(false);
    expect(canPinInspector(1100)).toBe(true);
    expect(canPinInspector(1101)).toBe(true);
    // 측정 전(0)은 좁은 쪽으로 본다 — 첫 프레임에 핀 버튼이 깜빡이고 사라지면 안 된다.
    expect(canPinInspector(0)).toBe(false);
  });
});
