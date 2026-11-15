// 드라이버 중립 시나리오(e2e/scenarios)를 실제 Tauri 앱 위에서 — 이 드라이버가 정직하게 줄 수 있는 것만. docs/PLAN-TEST-SUITE.md §11.
//
// 고른 것: 웹 빌드와 데스크톱 웹뷰(WebKitGTK·WebView2 + tauri:// 사용자 정의 프로토콜)가 실제로 갈리는 자리 —
//   S1  여섯 주소 직접 진입·새로고침(tauri:// 의 파일 해석·프리렌더 착지·fallback)
//   S4·S5·S5b  트레이에서 놓기·끌기·되돌리기(진짜 GTK 포인터 이벤트 → 웹뷰)
//   S7  2스텝 재생(드릴 = IndexedDB, 키 입력)
//   S8a·S8b  새로고침 너머 보존(앱 프로필의 localStorage·IndexedDB)
// 뺀 것과 까닭 — needs 로 걸러지는 것 말고, 기본 창 모양이 시나리오의 전제와 다른 것:
//   S6·S7b  resize 가 없으면 "좁은 터치 기기" 라고 보고 코트 회전·접힌 스텝 목록을 기대한다 — 데스크톱 창(1280×800,
//           최소 900×600)은 그 모양이 될 수 없다. 나머지(S9–S17)는 웹 층이 이미 재고, 앱에서 갈릴 자리가 없다.
// needs 로 걸러지는 것(touch·resize·download·prerender·netMock)과 대화 상자 첫 방문 기록(addInitScript 가 없다)은 고르지 않는다.
import boot from '../scenarios/boot.ts';
import court from '../scenarios/court.ts';
import persist from '../scenarios/persist.ts';
import steps from '../scenarios/steps.ts';
import { runGroup } from './run.ts';

runGroup(boot);
runGroup(court, { only: ['S4', 'S5', 'S5b'] });
runGroup(steps, { only: ['S7'] });
runGroup(persist);
