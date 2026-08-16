// 서랍 = **플라이아웃**. 손잡이에 손이 닿으면 떠서 하위 항목을 내놓고, 손이 떠나면 닫힌다.
//
// 2026-08-14 기현님 지시로 트레이가 이 모양을 갖췄고(*"마우스가 오버 또는 손으로 터치할 때 —
// 트레이가 가로일 때는 위로, 세로일 때는 왼쪽으로 펼쳐졌다가, 하위 아이콘이 선택되면 딜레이
// 갖고 닫히는 것으로"*), 2026-08-16 지시로 오른쪽 기능 바의 [보기]도 같은 모양이 됐다.
// **그래서 배선을 여기로 뺐다** — 두 벌을 각자 적으면 여는 조건(마우스만 hover)·닫는 유예
// (400/260ms)·포털·Esc 가 조용히 갈라진다. 갈라진 서랍은 같은 서랍이 아니다.
//
// ── 왜 인라인이 아니라 떠 있는가 ─────────────────────────────────────────────────────
// 옛 서랍은 자리를 차지하며 펼쳐졌고, 그래서 §3 불변식 1(조준 대상이 사용 중에 이동하지
// 않는다)을 지키려고 손잡이를 구역 맨 끝에 못박고, 한 번 열린 서랍은 다시 안 닫는 규칙까지
// 세워야 했다. 플라이아웃은 그 대가를 **원인째** 없앤다 — 떠 있는 동안 흐름을 한 픽셀도 안
// 먹으므로 어떤 표적도 안 움직인다.
//
// ── 왜 포털이 필요한가 ───────────────────────────────────────────────────────────────
// 2026-08-14 기현님 신고(*"작도 및 메모 서랍이 안 펼쳐진다"*)의 원인은 조상의 `overflow` 였다:
// CSS 는 한 축이 visible 이 아니면 **다른 축도 clip** 이 된다. 그래서 패널은 `document.body` 에
// 붙이고 위치는 손잡이를 **재서** 정한다. 잰 좌표가 낡으면(창 크기 변경·스크롤) 따라다니게
// 하는 대신 **닫는다** — 떠 있는 동안 손은 패널 위에 있으므로 그 사이 창을 만지는 것은
// "그만두겠다" 다.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';

/** 하위 항목을 고른 뒤 서랍이 닫히기까지. 0 이면 방금 고른 것이 눈에 안 남고, 연달아 둘을
 *  고르려던 손이 허공을 짚는다. */
export const FLYOUT_PICK_CLOSE_MS = 400;
/** 포인터가 손잡이·패널 밖으로 나간 뒤 닫히기까지. 손잡이와 패널은 DOM 상 떨어져 있어
 *  (패널은 포털) 사이를 지날 때 잠깐 '밖'이 되는 구간이 있다 — 0 이면 지나가다 닫힌다. */
export const FLYOUT_LEAVE_CLOSE_MS = 260;

/** 손잡이에 그대로 펼쳐 넣는 배선. */
export interface FlyoutHandleProps {
  onPointerEnter(e: ReactPointerEvent): void;
  onPointerLeave(e: ReactPointerEvent): void;
  onPointerDown(e: ReactPointerEvent): void;
  onClick(e: ReactMouseEvent): void;
}

export interface FlyoutApi<K> {
  /** 열려 있는 서랍과 **열던 순간** 잰 손잡이 좌표. */
  open: { key: K; rect: DOMRect } | null;
  isOpen(key: K): boolean;
  close(): void;
  cancelClose(): void;
  closeSoon(ms: number): void;
  /** `getEl` 은 손잡이 요소를 돌려준다 — 여는 순간에만 불린다(그때 좌표를 잰다). */
  handleProps(key: K, getEl: () => HTMLElement | null | undefined): FlyoutHandleProps;
  /** 패널에 그대로 펼쳐 넣는 배선 — 패널 위에 있는 동안은 안 닫힌다. */
  panelProps: Pick<FlyoutHandleProps, 'onPointerEnter' | 'onPointerLeave'>;
}

/** 손잡이 기준 패널 위치. **판 안쪽으로만** 편다 — 가로 띠는 위로, 세로 기둥은 왼쪽으로.
 *  둘 다 코트를 잠깐 가리되 화면 밖으로는 안 나간다. */
export function flyoutPosition(rect: DOMRect, dir: 'up' | 'left', gap = 6): CSSProperties {
  return dir === 'up'
    ? { left: rect.left, bottom: window.innerHeight - rect.top + gap }
    : { right: window.innerWidth - rect.left + gap, top: rect.top };
}

export function useFlyout<K>(): FlyoutApi<K> {
  const [open, setOpen] = useState<{ key: K; rect: DOMRect } | null>(null);
  // ⚠️ 마우스는 **hover 로 이미 연 뒤에 click 이 온다.** click 을 단순 토글로 두면 마우스로
  // 손잡이를 누르는 순간 방금 열린 패널이 도로 닫힌다(2026-08-14 테스트로 재현). 그래서
  // 클릭의 뜻을 포인터 종류로 가른다: **마우스면 언제나 '열기'**(닫기는 벗어나면 저절로),
  // 터치·키보드면 토글(그쪽에는 '벗어남' 이 없으므로 다시 눌러 닫을 길이 있어야 한다).
  const lastPointerType = useRef<string>('');
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const closeSoon = useCallback(
    (ms: number) => {
      cancelClose();
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
        setOpen(null);
      }, ms);
    },
    [cancelClose],
  );

  const close = useCallback(() => {
    cancelClose();
    setOpen(null);
  }, [cancelClose]);

  // 언마운트에 타이머를 남기면 사라진 컴포넌트에 setState 가 간다(useTrayDrag 가 남긴 교훈).
  useEffect(() => cancelClose, [cancelClose]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(null);
    };
    const onGone = (): void => setOpen(null);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onGone);
    window.addEventListener('scroll', onGone, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onGone);
      window.removeEventListener('scroll', onGone, true);
    };
  }, [open]);

  const openAt = useCallback(
    (key: K, el: HTMLElement | null | undefined) => {
      if (!el) return;
      cancelClose();
      setOpen({ key, rect: el.getBoundingClientRect() });
    },
    [cancelClose],
  );

  const handleProps = useCallback(
    (key: K, getEl: () => HTMLElement | null | undefined): FlyoutHandleProps => ({
      onPointerEnter: (e) => {
        // 마우스만 hover 로 연다. 터치는 pointerenter 도 함께 쏘는데, 그것까지 받으면
        // 손가락이 닿는 순간 열리고 곧이어 click 이 토글해 **바로 닫힌다.**
        if (e.pointerType !== 'mouse') return;
        openAt(key, getEl());
      },
      onPointerLeave: (e) => {
        if (e.pointerType !== 'mouse') return;
        closeSoon(FLYOUT_LEAVE_CLOSE_MS);
      },
      onPointerDown: (e) => {
        lastPointerType.current = e.pointerType;
      },
      onClick: (e) => {
        cancelClose();
        const byMouse = e.detail > 0 && lastPointerType.current === 'mouse';
        setOpen((cur) => {
          const isOpen = cur !== null && cur.key === key;
          if (!byMouse && isOpen) return null;
          const el = getEl();
          return el ? { key, rect: el.getBoundingClientRect() } : cur;
        });
      },
    }),
    [cancelClose, closeSoon, openAt],
  );

  const panelProps = {
    onPointerEnter: cancelClose,
    onPointerLeave: (e: ReactPointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      closeSoon(FLYOUT_LEAVE_CLOSE_MS);
    },
  };

  return {
    open,
    isOpen: (key: K) => open !== null && open.key === key,
    close,
    cancelClose,
    closeSoon,
    handleProps,
    panelProps,
  };
}
