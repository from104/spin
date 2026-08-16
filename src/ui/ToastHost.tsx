import type { CSSProperties } from 'react';
import { Toast, type ToastItem } from './Toast.tsx';

export interface ToastHostProps {
  toasts: ReadonlyArray<ToastItem>;
  onDismiss: (id: string) => void;
}

// 2026-08-16 — 아래에서 **위로** 옮겼다(기현 지시). 화면 아래는 편집기의 기능 바·트랜스포트·
// 트레이가 차지하는 자리라, 토스트가 **방금 쓴 그 단추들 위에** 떴다. [되돌리기] 액션이 특히
// 나빴다 — 실수를 물리려고 손을 뻗는 곳이 곧 다음 조작을 하려는 곳이었다.
//
// 위쪽은 헤더(min 62px) 하나뿐이고 가운데가 비어 있다(제목은 왼쪽, 액션은 오른쪽). 토스트는
// 폭 420px 로 가운데 뜨므로 헤더와 겹쳐도 가리는 것이 거의 없고, 3초 뒤 사라진다.
// `position: fixed` 라 `#root` 의 safe-area 패딩(appShell.css)이 안 먹으므로 노치는 여기서
// 직접 피한다 — 아래에 있을 때는 없던 문제다.
const HOST_STYLE: CSSProperties = {
  position: 'fixed',
  left: '50%',
  top: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  width: 'min(420px, calc(100vw - 2rem))',
  zIndex: 150,
  pointerEvents: 'none',
};

/** 앱 전역 토스트 큐를 렌더링한다. 큐 상태(`ToastProvider`)는 store 모듈 소유이고
 *  이 컴포넌트는 props 로만 받는다(ui-kit → core 외 의존 금지, §8). */
export function ToastHost({ toasts, onDismiss }: ToastHostProps) {
  if (toasts.length === 0) return null;
  return (
    <div style={HOST_STYLE}>
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <Toast toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
