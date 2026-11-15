// 덮개(백드롭)를 눌러 닫기 — **누르고 뗀 것이 둘 다 덮개일 때, click 에서** 닫는다.
//
// ⚠️ 2026-11-15 — 옛 판정은 `onPointerDown` 에서 바로 닫았다(ui/Modal · StepSidebar 접힘 덮개).
//   터치에서는 손을 뗀 뒤 브라우저가 click 을 만드는데, 그때는 덮개가 이미 사라져 click 이
//   **아래 단추**에 떨어졌다 — E2E S7c 실측으로 스텝 목록 바깥 탭이 [보드 설정]을 열었다.
//   메모를 놓자마자 더블클릭할 때 둘째 누름이 글 칸 덮개를 닫아 "아무것도 안 열림" 으로
//   보이던 것도 같은 판정의 결과였다(그쪽 뿌리는 CourtStage 더블 판정으로 따로 고쳤다).
//
// 누름이 덮개에서 시작했는지도 본다: 대화 상자 안에서 글자를 끌어 고르다 덮개 위에서 손을 떼면
// click 의 대상이 공통 조상(덮개)이 되는데, 그걸로 닫히면 쓰던 내용이 날아간다.
import { useRef, type MouseEvent, type PointerEvent } from 'react';

export function useBackdropDismiss(onClose: () => void): {
  onPointerDown(e: PointerEvent<HTMLElement>): void;
  onClick(e: MouseEvent<HTMLElement>): void;
} {
  const downOnBackdrop = useRef(false);
  return {
    onPointerDown: (e) => {
      downOnBackdrop.current = e.target === e.currentTarget;
    },
    onClick: (e) => {
      const ok = downOnBackdrop.current && e.target === e.currentTarget;
      downOnBackdrop.current = false;
      if (ok) onClose();
    },
  };
}
