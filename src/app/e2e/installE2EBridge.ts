// 읽기 전용 시험 다리 `window.__spinE2E` — docs/PLAN-TEST-SUITE.md §3·§4.
//
// `?e2e=1`(src/core/e2eMode.ts)일 때만 E2EBridge.tsx 가 **동적 import** 로 이 모듈을 불러 설치한다 —
// 판정이 import 앞에 있으므로 플래그가 없으면 이 코드는 내려받지도 실행되지도 않는다(App.tsx 의
// NativeBridge 와 같은 꼴). 그것을 `E2EBridge.test.tsx` 가 못박는다.
//
// ⚠️ **읽기만 한다.** dispatch·저장소·월드를 건드리는 함수를 여기 더하지 마라 — 시험이 앱을 대신 조작하기
//    시작하면 "이용자의 손이 닿는 길" 을 아무도 안 본다. 조작은 드라이버가 진짜 포인터·키로 한다.
//
// 내는 것
// - objects()  지금 스텝의 휠체어·공·콘 **모델** 자세(저장·되돌리기·복원 판정용). 화면 자세는 드라이버가
//              `#obj-<id>` 의 실제 bbox 로 따로 잰다 — 두 경로를 맞대야 판정이 자기증명이 안 된다(§4)
// - stepIndex · stepCount · playing
// - busy       화면이 아직 움직이는 중인가. 둘 중 하나라도 참이면 참:
//                ① 손을 뗀 뒤 정착 재커밋을 기다리는 중(`settleHoldUntil`, useEditorPointer 의 SETTLE_ARM)
//                ② 그려진 자세(TransformWriter 의 마지막 프레임)가 모델 자세와 다르다 — 끌고 있는 중·
//                   물리 체이스·스텝 전환 트윈이 전부 이 모양이다
// - autosave   'saved'(저장소가 지금 모델을 들고 있다) · 'pending'(커밋했는데 아직 안 씀) · 'saving' ·
//              'conflict' · 'error'. 드릴은 useAutosave(IDB), 전술판은 localStorage 스냅샷을 본다
import { isId } from '../../core/ids.ts';
import { serializeBoard, BOARD_KEY } from '../../storage/board.ts';
import type { EditorState } from '../../store/editor/reducer.ts';
import { selectStepIndex } from '../../store/editor/reducer.ts';
import { poseFrame } from '../../store/editor/tween.ts';
import type { TransformWriter } from '../../render/transformWriter.ts';
import type { AutosaveStatus } from '../useAutosave.ts';
import type { E2EAutosave, E2EObject, SpinE2EBridge } from './bridgeContract.ts';

/** E2EBridge.tsx 가 매 커밋마다 갈아 끼우는 최신 재료 */
export interface E2EBridgeSource {
  state: EditorState;
  writer: TransformWriter;
  playing: boolean;
  /** null = 자유 전술판(자동저장이 꺼져 있고 localStorage 스냅샷이 대신한다) */
  autosave: { status: AutosaveStatus; pending: boolean } | null;
}

// 모델은 좌표를 0.1 px·각도를 저장 단위로 반올림해 쓰고(useEditorPointer commitPoses) 그려진 자세는
// 실수 그대로라, 같은 자리라도 이만큼은 어긋난다. 움직이는 중이면 한 프레임에 이보다 크게 움직인다.
const SAME_PX = 0.5;
const SAME_RAD = 0.02;

function angleGap(a: number, b: number): number {
  const d = (((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI);
  return Math.abs(d - Math.PI);
}

function currentStep(state: EditorState) {
  return state.present.steps[selectStepIndex(state)];
}

function objects(state: EditorState): E2EObject[] {
  const step = currentStep(state);
  if (!step) return [];
  const teamOf = new Map(state.present.cast.chairs.map((c) => [c.id as string, c.team]));
  const out: E2EObject[] = [];
  for (const [id, p] of Object.entries(step.chairs)) {
    if (p) out.push({ id, kind: 'chair', team: teamOf.get(id), x: p.x, y: p.y, angleDeg: p.angleDeg });
  }
  for (const [id, p] of Object.entries(step.balls)) if (p) out.push({ id, kind: 'ball', x: p.x, y: p.y, angleDeg: 0 });
  for (const [id, p] of Object.entries(step.cones)) if (p) out.push({ id, kind: 'cone', x: p.x, y: p.y, angleDeg: 0 });
  return out;
}

function busy({ state, writer }: E2EBridgeSource): boolean {
  if (state.settleHoldUntil > Date.now()) return true;
  const step = currentStep(state);
  if (!step) return false;
  const drawn = writer.snapshot();
  // 모델 각도(도)→화면 각도(rad) 변환은 트윈이 쓰는 poseFrame 을 그대로 빌린다 — 따로 계산하지 않는다(두 벌 금지)
  for (const [id, want] of Object.entries(poseFrame(step))) {
    const got = drawn[id];
    if (!got) continue; // 아직 마운트 전이라 자리를 받은 적이 없다 — 움직임이 아니다
    if (Math.abs(got.x - want.x) > SAME_PX || Math.abs(got.y - want.y) > SAME_PX) return true;
    if (isId(id, 'ch') && angleGap(got.theta, want.theta) > SAME_RAD) return true;
  }
  return false;
}

function autosave({ state, autosave: a }: E2EBridgeSource): E2EAutosave {
  if (a === null) {
    // 전술판: BoardHost 가 디바운스 뒤 쓰는 그 문자열과 같으면 저장된 것이다(직렬화는 board.ts 한 곳)
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(BOARD_KEY);
    } catch {
      return 'error';
    }
    return stored === serializeBoard(state.present) ? 'saved' : 'pending';
  }
  if (a.status === 'conflict' || a.status === 'error' || a.status === 'saving') return a.status;
  return a.pending ? 'pending' : 'saved';
}

/** 다리를 세우고 걷는 함수를 돌려준다. read 는 언제 불려도 **지금** 재료를 준다 */
export function installE2EBridge(read: () => E2EBridgeSource): () => void {
  const api: SpinE2EBridge = {
    get surface() {
      return read().autosave === null ? 'board' : 'drill';
    },
    objects: () => objects(read().state),
    get stepIndex() {
      return selectStepIndex(read().state);
    },
    get stepCount() {
      return read().state.present.steps.length;
    },
    get playing() {
      return read().playing;
    },
    get busy() {
      return busy(read());
    },
    get autosave() {
      return autosave(read());
    },
  };
  window.__spinE2E = api;
  return () => {
    if (window.__spinE2E === api) delete window.__spinE2E;
  };
}
