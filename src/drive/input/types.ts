// 조정 모드의 **입력원 추상화** — docs/PLAN-SIMPLE-DRIVE.md 결정 B9 ②. 무엇이 손잡이를 쥐든(키보드·화면 조이스틱·게임패드·원격)
// 컨트롤러는 `read()` 가 주는 두 축만 안다. 새 입력 장치는 이 꼴 하나를 만들어 꽂는다 — 컨트롤러·운동학은 그대로다.
import type { DriveInput } from '../model.ts';

export interface DriveInputSource {
  /** 지금 이 순간의 두 축. 매 프레임 불린다 — 값을 계산만 하고 상태를 바꾸지 않는다. */
  read(): DriveInput;
  /** 모든 입력을 0 으로(창이 초점을 잃음·화면 숨김·모드 끝). 키가 눌린 채 "붙어" 달아나지 않게 하는 유일한 문이다. */
  reset(): void;
}
