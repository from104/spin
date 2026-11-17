// 편집기의 **휠체어 조정 모드 세션** — docs/PLAN-SIMPLE-DRIVE.md 결정 B1·B2·B5·B7·B8·B9 ④.
// 엔진(src/drive/*)은 판 위 물리만 안다. 이 훅은 편집기에 붙이는 일만 한다: 들어가기·나오기, 되돌리기 한 칸, 발표, 키보드 층.
// 게임 규칙·점수·시간은 이 층 밖이다(나중에 `game/`).
//
// ── 계약 ────────────────────────────────────────────────────────────────────────────────────────────
// · 발동 조건(B1): 심플 모드가 아니고 [물리·상호작용]이 켜져 있을 것. 잠긴·무시한·안 놓인 휠체어는 몰 수 없다(이유를 알린다).
// · 한 번 들어가서 나올 때까지 = 되돌리기 **한 칸**(B7). 첫 변화에서 PLACE_BEGIN, 0.5 s 마다·멈출 때 PLACE_COMMIT(past 불변),
//   나올 때 **먼저 동기 커밋**하고 정착 뒤 PLACE_SETTLE — 밀린 이웃도 같은 칸(stepPosesFromSnapshot 이 캐스트 전부를 덮는다).
//   ⚠️ 동기 커밋이 먼저인 이유: 스텝 전환이면 정착 통지가 올 때 이미 다른 스텝이라 덧쓰기가 버려지고, 스텝을 되짚으면 world.load 가
//      모델의(0.5 s 늦은) 자세로 휠체어를 되돌린다. 이 훅의 effect 는 EditorProvider(부모)의 world.load effect 보다 **먼저** 돈다
//      (React 는 자식 effect 를 먼저 부른다) — 그래서 커밋은 바디가 아직 그 자리에 있을 때 들어간다.
// · 나오는 길(B2): Esc · [끝] · 도구 바꿈 · 스텝 바꿈 · 재생 · 심플 켬 · 상호작용 끔 · 개체 메뉴 열기 · **조정 키가 아닌 아무 키**.
//   마지막 것이 되돌리기(Ctrl+Z)·스텝 키·도구 키를 한 길로 묶는다 — 먼저 커밋하고 나온 뒤 그 키가 제 일을 한다(Ctrl+Z 면 방금 몬 것
//   통째로 한 칸이 물러난다). 되돌리기 단추처럼 키가 아닌 시점 점프(epoch)는 커밋 없이 끝낸다 — 상태가 이미 다른 시점이다.
// · 키(B5): window **캡처** 단계에서 개체·전역 층보다 먼저 먹는다(keymap `drive.*`). 글 입력 칸·대화상자 안의 키는 안 건드린다.
//   창이 초점을 잃거나 숨으면 입력을 0 으로 — 눌린 채 붙은 키로 휠체어가 혼자 달아나지 않게.
// · 세션 동안 매 프레임 tick 한다(입력이 없어도) — 이 동안 물리 시간은 driveStep 하나가 쥔다(controller.ts 머리말).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import { DRIVE, PHYS } from '../../core/constants.ts';
import { isId } from '../../core/ids.ts';
import type { ChairId } from '../../core/ids.ts';
import { eventCode, lookupDef } from '../../core/keymap.ts';
import type { DictKey } from '../../i18n/ko.ts';
import { createDriveController, type DriveController } from '../../drive/controller.ts';
import { createKeyboardDriveSource } from '../../drive/input/keyboard.ts';
import { clampLevel } from '../../drive/model.ts';
import type { DrillStep } from '../../model/drill.ts';
import { raf } from '../../render/rafLoop.ts';
import type { EditorAction } from '../../store/editor/actions.ts';
import type { EditorWorldRef } from '../../store/editor/EditorProvider.tsx';
import { liveRegion } from '../../ui/LiveRegion.tsx';
import { isEditableTarget } from '../../ui/keyboard.ts';
import { useThrottledAnnounce } from '../../ui/useThrottledAnnounce.ts';
import { gatedLookup, type SingleKeyMode } from './useEditorKeyboard.ts';
import { stepPosesFromSnapshot } from './stepPosesFromSnapshot.ts';

export interface DriveSessionDeps {
  worldRef: EditorWorldRef;
  dispatch: Dispatch<EditorAction>;
  step: DrillStep;
  epoch: number;
  tool: string;
  playing: boolean;
  simple: boolean;
  /** 저장된 [물리·상호작용] 스위치(심플 모드로 접기 전의 값 — 접기는 `simple` 이 따로 말한다). */
  interact: boolean;
  locked: ReadonlySet<string>;
  ignored: ReadonlySet<string>;
  selection: ReadonlySet<string>;
  singleKeyMode: SingleKeyMode;
  reduceMotion: boolean;
  /** 저장된 속도 단계(prefs.drive.speed)와 그것을 바꾸는 길. */
  speed: number;
  onSpeedChange(level: number): void;
  /** 발표·띠에 쓰는 휠체어 이름(팀 + 번호). */
  chairName(id: string): string;
  t(key: DictKey, vars?: Record<string, string | number>): string;
  showToast(message: string): void;
}

export interface DriveSession {
  /** 지금 몰고 있는 휠체어. null 이면 모드 밖. */
  chairId: ChairId | null;
  level: number;
  /** 그 휠체어를 몰 수 없는 이유(i18n 키). null 이면 몰 수 있다 — 메뉴 칸을 죽이고 툴팁에 쓴다. */
  unavailable(id: string): DictKey | null;
  enter(id: string): void;
  exit(): void;
  /** 판을 눌렀다(useEditorPointer). 모드 안이면 **먹는다** — 휠체어면 갈아타고, 아니면 아무 일도 없다(끌기가 끼면 시간의 주인이 둘이 된다). */
  press(id: string | null): boolean;
}

const MODIFIER_CODES = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);
/** 주행 중 숫자줄의 남은 칸 — 속도가 아닌 숫자는 **아무 일도 안 한다**(평소의 obj.face 방향 바꾸기로 새면 몰던 차가 홱 돈다). */
const DIGITS_SWALLOWED = new Set(['Digit0', 'Digit6', 'Digit7', 'Digit8', 'Digit9']);

const inDialog = (t: EventTarget | null): boolean =>
  t instanceof Element && t.closest('[role="dialog"],[role="alertdialog"],[aria-modal="true"]') !== null;

export function useDriveSession(deps: DriveSessionDeps): DriveSession {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const [chairId, setChairId] = useState<ChairId | null>(null);
  const chairRef = useRef<ChairId | null>(null);
  const [level, setLevelState] = useState(() => clampLevel(deps.speed));
  const levelRef = useRef(level);
  const sourceRef = useRef(createKeyboardDriveSource());
  const ctlRef = useRef<DriveController | null>(null);
  /** 이번 세션이 되돌리기 경계(PLACE_BEGIN)를 열었는가 — 한 세션 = 한 칸. */
  const beganRef = useRef(false);
  /** 세션이 시작된 스텝. 스텝 전환으로 나갈 때 **옛 스텝**에 커밋해야 한다(그 순간 `step` 은 이미 새 스텝이다). */
  const driveStepRef = useRef<DrillStep | null>(null);
  const lastCommitRef = useRef(0);
  const wasActiveRef = useRef(false);
  const settleOffRef = useRef<(() => void) | null>(null);
  const announceSpeed = useThrottledAnnounce();

  // 세션의 스텝 사본은 같은 스텝일 때만 따라간다 — 커밋이 바꾼 자세를 다음 커밋의 '이전 값' 으로 써야 무변화 판정이 맞다.
  if (chairRef.current && driveStepRef.current && deps.step.id === driveStepRef.current.id) driveStepRef.current = deps.step;

  const unavailable = useCallback((id: string): DictKey | null => {
    const d = depsRef.current;
    if (d.simple) return 'drive.unavailable.simple';
    if (!d.interact) return 'drive.unavailable.interact';
    if (!isId(id, 'ch') || d.step.chairs[id as ChairId] === undefined) return 'drive.unavailable.noChair';
    if (d.locked.has(id)) return 'drive.unavailable.locked';
    if (d.ignored.has(id)) return 'drive.unavailable.ignored';
    return null;
  }, []);

  /** 지금 바디 자세를 모델에 넣는다(바뀐 것이 있을 때만). 첫 변화가 되돌리기 경계를 연다. */
  const commitNow = useCallback(() => {
    const d = depsRef.current;
    const w = d.worldRef.current;
    const st = driveStepRef.current;
    if (!w || !st) return;
    lastCommitRef.current = performance.now();
    const { chairs, balls, cones, changed } = stepPosesFromSnapshot(w.read(), st);
    if (!changed) return;
    if (!beganRef.current) {
      d.dispatch({ type: 'PLACE_BEGIN' });
      beganRef.current = true;
    }
    // 자동저장 억제 창(드래그와 같은 SETTLE_ARM) — 몰고 있는 동안 0.5 s 마다 IDB 에 쓰지 않게. 나올 때 정착 덧쓰기가 닫는다.
    d.dispatch({ type: 'SETTLE_ARM', until: Date.now() + PHYS.settleMaxMs });
    d.dispatch({ type: 'PLACE_COMMIT', stepId: st.id, chairs, balls, cones });
  }, []);

  const finish = useCallback(
    (commit: boolean) => {
      const id = chairRef.current;
      if (!id) return;
      const d = depsRef.current;
      if (commit) commitNow();
      sourceRef.current.reset();
      ctlRef.current?.end(); // 쥔 휠체어를 놓고 정착 구간을 연다
      ctlRef.current = null;
      chairRef.current = null;
      setChairId(null);
      const w = d.worldRef.current;
      const st = driveStepRef.current;
      settleOffRef.current?.();
      settleOffRef.current = null;
      if (commit && beganRef.current && w && st) {
        // 밀린 공이 다 서면 그 자리까지 같은 칸에 덧쓴다(PLACE_SETTLE — past 를 안 건드린다, 억제 창도 닫는다)
        const off = w.onSettled((snap) => {
          off();
          if (settleOffRef.current === off) settleOffRef.current = null;
          const cur = depsRef.current.step;
          if (cur.id !== st.id) {
            depsRef.current.dispatch({ type: 'SETTLE_ARM', until: 0 });
            return;
          }
          const { chairs, balls, cones } = stepPosesFromSnapshot(snap, cur);
          depsRef.current.dispatch({ type: 'PLACE_SETTLE', stepId: cur.id, chairs, balls, cones });
        });
        settleOffRef.current = off;
      } else if (beganRef.current) {
        d.dispatch({ type: 'SETTLE_ARM', until: 0 });
      }
      beganRef.current = false;
      driveStepRef.current = null;
      liveRegion.say(d.t('drive.announce.exit', { name: d.t('drive.name') }));
    },
    [commitNow],
  );
  const exit = useCallback(() => finish(true), [finish]);

  const enter = useCallback(
    (id: string) => {
      const d = depsRef.current;
      const why = unavailable(id);
      if (why) {
        const msg = d.t(why, { name: d.t('drive.name') });
        d.showToast(msg);
        liveRegion.say(msg);
        return;
      }
      const cid = id as ChairId;
      if (chairRef.current === cid) return;
      const switching = chairRef.current !== null;
      if (!ctlRef.current) {
        ctlRef.current = createDriveController(() => depsRef.current.worldRef.current, { reduceMotion: () => depsRef.current.reduceMotion });
      }
      const ctl = ctlRef.current;
      if (switching && chairRef.current) ctl.remove(chairRef.current);
      sourceRef.current.reset();
      if (!ctl.add(cid, sourceRef.current, levelRef.current)) {
        if (!switching) ctlRef.current = null;
        return;
      }
      if (!switching) {
        beganRef.current = false;
        driveStepRef.current = d.step;
        lastCommitRef.current = performance.now();
        wasActiveRef.current = false;
      }
      chairRef.current = cid;
      setChairId(cid);
      d.dispatch({ type: 'SELECT_SET', ids: [cid] });
      liveRegion.say(
        switching
          ? d.t('drive.announce.switch', { chair: d.chairName(cid) })
          : d.t('drive.announce.enter', { name: d.t('drive.name'), chair: d.chairName(cid), level: levelRef.current }),
      );
    },
    [unavailable],
  );

  const setLevel = useCallback(
    (n: number) => {
      const lv = clampLevel(n);
      levelRef.current = lv;
      setLevelState(lv);
      const ctl = ctlRef.current;
      if (ctl) for (const id of ctl.ids()) ctl.setLevel(id, lv);
      const d = depsRef.current;
      if (d.speed !== lv) d.onSpeedChange(lv);
      announceSpeed(d.t('drive.announce.speed', { level: lv }));
    },
    [announceSpeed],
  );

  // 저장된 단계가 다른 곳(다른 탭·설정 초기화)에서 바뀌면 따라간다.
  useEffect(() => {
    const lv = clampLevel(deps.speed);
    if (lv !== levelRef.current) {
      levelRef.current = lv;
      setLevelState(lv);
      const ctl = ctlRef.current;
      if (ctl) for (const id of ctl.ids()) ctl.setLevel(id, lv);
    }
  }, [deps.speed]);

  // ── 프레임 루프: 모드 안에서만 ──
  useEffect(() => {
    if (!chairId) return;
    return raf.add((dtMs) => {
      const ctl = ctlRef.current;
      if (!ctl) return;
      const r = ctl.tick(Math.min(dtMs / 1000, DRIVE.maxFrameS));
      const now = performance.now();
      // 멈춘 순간(움직이다 섰다) 한 번, 움직이는 동안 0.5 s 마다 — 밀린 공이 구르는 동안도 같은 주기로 따라 적는다.
      const stopped = wasActiveRef.current && !r.active;
      wasActiveRef.current = r.active;
      if (stopped || now - lastCommitRef.current >= DRIVE.commitEveryMs) commitNow();
    });
  }, [chairId, commitNow]);

  // ── 나오는 길: 도구·스텝·재생·심플·상호작용 ──
  const exitKey = `${deps.tool}|${deps.step.id}|${String(deps.playing)}|${String(deps.simple)}|${String(deps.interact)}`;
  const prevExitKey = useRef(exitKey);
  useEffect(() => {
    if (prevExitKey.current === exitKey) return;
    prevExitKey.current = exitKey;
    finish(true);
  }, [exitKey, finish]);
  // 시점 점프(되돌리기 단추 등) — 상태가 이미 다른 시점이라 커밋하지 않는다.
  const prevEpoch = useRef(deps.epoch);
  useEffect(() => {
    if (prevEpoch.current === deps.epoch) return;
    prevEpoch.current = deps.epoch;
    finish(false);
  }, [deps.epoch, finish]);
  // 휠체어가 잠기거나 무시되거나 판에서 빠지면 끝낸다.
  useEffect(() => {
    const id = chairRef.current;
    if (id && (deps.locked.has(id) || deps.ignored.has(id) || deps.step.chairs[id] === undefined)) finish(true);
  }, [deps.locked, deps.ignored, deps.step.chairs, finish]);
  // 화면을 떠나면(언마운트) 쥔 칩을 놓는다.
  useEffect(() => () => finish(true), [finish]);

  // ── 키보드 층(drive) ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const d = depsRef.current;
      if (isEditableTarget(e.target) || inDialog(e.target)) return;
      const code = eventCode(e);
      if (!chairRef.current) {
        // 들어가기 — 전역 문자키 게이트(WCAG 2.1.4)를 탄다. 고른 것이 휠체어 하나일 때만.
        if (gatedLookup(e, d.singleKeyMode)?.id !== 'drive.enter') return;
        e.preventDefault();
        const ids = [...d.selection];
        if (ids.length !== 1 || !isId(ids[0]!, 'ch')) {
          const msg = d.t('drive.unavailable.noChair');
          d.showToast(msg);
          liveRegion.say(msg);
          return;
        }
        enter(ids[0]!);
        return;
      }
      const def = lookupDef('drive', e);
      if (def) {
        e.preventDefault();
        e.stopPropagation();
        if (def.id === 'drive.exit') exit();
        else if (def.id === 'drive.speed') setLevel(Number(code.slice(-1)));
        else sourceRef.current.press(code);
        return;
      }
      if (MODIFIER_CODES.has(code)) return;
      if (DIGITS_SWALLOWED.has(code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // 조정 키가 아닌 아무 키 — 먼저 커밋하고 나온 뒤 그 키가 제 일을 하게 흘려보낸다(머리말 '나오는 길').
      exit();
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (!chairRef.current) return;
      if (sourceRef.current.release(eventCode(e))) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const clear = (): void => sourceRef.current.reset();
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') clear();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enter, exit, setLevel]);

  const press = useCallback(
    (id: string | null): boolean => {
      if (!chairRef.current) return false;
      if (id && isId(id, 'ch') && id !== chairRef.current && unavailable(id) === null) enter(id);
      return true;
    },
    [enter, unavailable],
  );

  return useMemo(() => ({ chairId, level, unavailable, enter, exit, press }), [chairId, level, unavailable, enter, exit, press]);
}
