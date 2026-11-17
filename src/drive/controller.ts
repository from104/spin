// 조정 모드 컨트롤러 — docs/PLAN-SIMPLE-DRIVE.md 결정 B9 ③. **휠체어 여러 대**(`Map<chairId, …>`)를 한 프레임 루프에서 굴려 물리에
// 넘긴다. 편집기는 한 대만 쓰지만 API 는 N 대다(게임 모드: 두 팀·여러 조종자). React·DOM 을 모른다 — rAF 는 부르는 쪽이 돌린다.
//
// 한 프레임(`tick`): 입력원마다 두 축을 읽고 → 운동학(model.ts)으로 목표 자세 → `applyToWorld` 로 물리에 → **바디 자세를 되읽어**
// 상태에 되먹인다. 마지막 단계가 빠지면 벽·잠긴 개체에 막힌 휠체어의 상태가 혼자 장애물 너머로 달려 나가고, 후진할 때 그
// 유령 거리를 되감느라 한참 안 움직인다.
//
// ⚠️ 물리와 닿는 곳은 `applyToWorld` **하나**다. 지금은 조종하는 휠체어가 손의 권위(static, `driveStep`)라 조종되는 두 대끼리는
//    서로 안 부딪힌다 — 게임 모드에서 이 한 곳을 동역학(속도 구동)으로 바꾼다.
// ⚠️ 입력이 없어도 세션 동안 **매 프레임** tick 해야 한다 — 이 동안 정착 루프는 서 있고(driveStep 이 시간의 주인), 멈추면
//    밀려 구르던 공이 허공에서 언다.
import { DRIVE } from '../core/constants.ts';
import type { ChairId } from '../core/ids.ts';
import type { ChairPose } from '../model/chair.ts';
import type { DriveInputSource } from './input/types.ts';
import { clampLevel, initialDriveState, isStill, stepDrive, withPose, type DriveState } from './model.ts';

/** 컨트롤러가 물리에 바라는 것 — `PhysicsWorldApi` 의 부분집합. 시험은 이 꼴만 흉내 내면 된다. */
export interface DriveWorld {
  driveStep(moves: ReadonlyArray<{ id: ChairId; pose: ChairPose }>, dtS: number): boolean;
  driveEnd(): void;
  read(): Readonly<Record<string, { x: number; y: number; theta: number }>>;
}

export interface DriveTickResult {
  /** 물리가 이 프레임을 받았는가(상호작용 꺼짐·손이 판 위면 false — 아무것도 안 움직였다). */
  applied: boolean;
  /** 조종하는 휠체어 중 하나라도 속도가 있거나 손이 입력을 쥐고 있는가 — 세션이 커밋 시점을 잡는다. */
  active: boolean;
}

interface Driven {
  state: DriveState;
  source: DriveInputSource;
  level: number;
}

export interface DriveController {
  /** 휠체어를 조종 목록에 넣는다. 자세는 지금 바디에서 읽는다 — 바디가 없으면(무시·미배치) false. */
  add(id: ChairId, source: DriveInputSource, level: number): boolean;
  remove(id: ChairId): void;
  ids(): ChairId[];
  setLevel(id: ChairId, level: number): void;
  tick(dtS: number): DriveTickResult;
  /** 모두 빼고 물리에 끝을 알린다(쥔 칩을 놓고 정착 구간을 연다). */
  end(): void;
}

export function createDriveController(getWorld: () => DriveWorld | null, opts: { reduceMotion?: () => boolean } = {}): DriveController {
  const driven = new Map<ChairId, Driven>();

  /** 물리 연결은 이 함수 하나(B9) — 게임 모드에서 동역학으로 바꿀 자리. */
  function applyToWorld(w: DriveWorld, moves: ReadonlyArray<{ id: ChairId; pose: ChairPose }>, dtS: number): boolean {
    return w.driveStep(moves, dtS);
  }

  return {
    add(id, source, level) {
      const pose = getWorld()?.read()[id];
      if (!pose) return false;
      driven.set(id, { state: initialDriveState(pose), source, level: clampLevel(level) });
      return true;
    },
    remove(id) {
      const d = driven.get(id);
      d?.source.reset();
      driven.delete(id);
    },
    ids() {
      return [...driven.keys()];
    },
    setLevel(id, level) {
      const d = driven.get(id);
      if (d) d.level = clampLevel(level);
    },
    tick(rawDtS) {
      const w = getWorld();
      if (!w || driven.size === 0) return { applied: false, active: false };
      const dt = Math.max(0, Math.min(DRIVE.maxFrameS, rawDtS));
      const reduce = opts.reduceMotion?.() ?? false;
      const moves: Array<{ id: ChairId; pose: ChairPose }> = [];
      let active = false;
      for (const [id, d] of driven) {
        const input = d.source.read();
        if (input.fwd !== 0 || input.turn !== 0) active = true;
        d.state = stepDrive(d.state, input, d.level, dt, { reduceMotion: reduce });
        if (!isStill(d.state)) active = true;
        moves.push({ id, pose: { x: d.state.x, y: d.state.y, theta: d.state.theta } });
      }
      const applied = applyToWorld(w, moves, dt);
      const snap = w.read();
      for (const [id, d] of driven) {
        const p = snap[id];
        if (!p) continue;
        // 물리가 프레임을 거절했으면(손이 판 위·상호작용 꺼짐) 차는 서 있는 것이다 — 속도까지 0 으로, 돌아오면 다시 램프한다.
        d.state = applied ? withPose(d.state, p) : initialDriveState(p);
      }
      return { applied, active };
    },
    end() {
      for (const d of driven.values()) d.source.reset();
      driven.clear();
      getWorld()?.driveEnd();
    },
  };
}
