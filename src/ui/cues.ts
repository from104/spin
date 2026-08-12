// §4.3 P1-4 — 어댑터. WebAudio 와 `navigator.vibrate` 를 실제로 부르는 **유일한** 곳이다.
//
// 계약 셋:
//   ① `prefs.a11y.sound` 가 꺼져 있으면 **AudioContext 를 아예 열지 않는다.** 껐는데 열리면
//      그건 거짓말이다(자동재생 정책 경고·배터리·오디오 포커스가 전부 따라온다).
//   ② **첫 사용자 제스처에서 연다.** 컨텍스트를 문서 로드 시점에 만들면 'suspended' 로
//      태어나 첫 소리가 통째로 삼켜진다. `arm()` 을 pointerdown 에 걸고, 그걸 놓친 경로는
//      `play()` 가 스스로 연다(놓임·배치도 전부 제스처 안이다).
//   ③ 소리와 진동은 **한 스위치**다. 스피커가 없거나 WebAudio 가 없는 기기에서도 진동은
//      독립적으로 나간다 — 둘을 같은 if 에 묶으면 태블릿 무음 모드에서 신호가 통째로 사라진다.
//
// 합성 자체(`renderCue`)에는 단위 테스트가 없다 — jsdom 에 WebAudio 가 없다. 그래서 그 함수는
// **WebAudio 호출만** 담고, 게이트·수명 판단은 전부 이 파일의 나머지(주입 가능한 deps)에 둔다.
import type { CueKind, CueSpec } from './cueSpec.ts';
import { cueSpec } from './cueSpec.ts';

export interface CueDeps {
  /** AudioContext 를 연다. 브라우저가 지원하지 않으면 null. */
  makeContext(): AudioContext | null;
  /** 실제 합성. 테스트는 여기를 스텁으로 갈아 끼워 "무엇을 낼 뻔했는가" 만 본다. */
  render(spec: CueSpec, ctx: AudioContext): void;
  /** 햅틱. 지원하지 않으면 아무 일도 하지 않는다. */
  vibrate(ms: number): void;
}

export interface CuePlayer {
  /** `prefs.a11y.sound`. 끄면 열려 있던 컨텍스트도 닫는다. */
  setEnabled(on: boolean): void;
  /** 첫 사용자 제스처(pointerdown 등)에서 부른다 — 여기서 컨텍스트를 연다. */
  arm(): void;
  play(kind: CueKind, intensity?: number): void;
  /** 지금 컨텍스트가 열려 있는가. 진단·테스트용. */
  isOpen(): boolean;
  /** 전부 초기 상태로. 끄고, 닫고, 미지원 기억도 지운다. */
  reset(): void;
}

interface WindowWithAudio {
  AudioContext?: new () => AudioContext;
  webkitAudioContext?: new () => AudioContext;
}

function defaultMakeContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as WindowWithAudio;
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    // 오디오 장치가 없는 환경(헤드리스·일부 키오스크)은 생성자 자체가 던진다.
    return null;
  }
}

function defaultVibrate(ms: number): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(ms);
  } catch {
    // 사용자 제스처 밖 호출을 예외로 막는 브라우저가 있다. 진동이 실패해도 앱은 계속 간다.
  }
}

/** ★ 이 함수만 테스트가 없다(jsdom 에 WebAudio 가 없다). 그러니 여기에는 **판단을 두지 않는다** —
 *  무엇을 낼지는 이미 `cueSpec` 이 정했고, 여기는 그 값을 노드 그래프로 옮기기만 한다. */
function renderCue(spec: CueSpec, ctx: AudioContext): void {
  const t0 = ctx.currentTime;
  const dur = spec.durationMs / 1000;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(spec.cutoffHz, t0);

  const amp = ctx.createGain();
  // 어택 2ms 로 자음을 세우고 나머지는 꼬리다. 0 에서 시작하지 않는 이유는
  // exponentialRamp 가 0 을 받으면 던지기 때문이다.
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, spec.gain), t0 + 0.002);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  lp.connect(amp);
  amp.connect(ctx.destination);

  if (spec.source === 'noise') {
    const frames = Math.max(1, Math.round(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(lp);
    src.start(t0);
    src.stop(t0 + dur);
    return;
  }

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(Math.max(1, spec.fromHz), t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.toHz), t0 + dur);
  osc.connect(lp);
  osc.start(t0);
  osc.stop(t0 + dur);
}

export function createCuePlayer(overrides: Partial<CueDeps> = {}): CuePlayer {
  const deps: CueDeps = {
    makeContext: overrides.makeContext ?? defaultMakeContext,
    render: overrides.render ?? renderCue,
    vibrate: overrides.vibrate ?? defaultVibrate,
  };

  // 기본은 **꺼짐**이다. 켜는 것은 prefs 를 읽는 쪽(app-shell)의 책임 — 아무도 안 켰는데
  // 소리가 나는 상태를 만들지 않는다.
  let enabled = false;
  let ctx: AudioContext | null = null;
  // 한 번 미지원으로 판명되면 다시 묻지 않는다. 놓을 때마다 생성자를 두드리는 것도 낭비지만,
  // 그보다 "몇 번 열었나" 라는 계약이 흐려지는 것이 더 나쁘다.
  let unsupported = false;

  function arm(): void {
    if (!enabled) return; // ★ 완료 판정 — 껐으면 makeContext 를 부르지 않는다
    if (ctx) {
      // 자동재생 정책으로 'suspended' 로 태어났거나, 탭이 백그라운드로 갔다 온 뒤 멎어 있다.
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      return;
    }
    if (unsupported) return;
    const made = deps.makeContext();
    if (!made) {
      unsupported = true;
      return;
    }
    ctx = made;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  }

  function closeContext(): void {
    if (!ctx) return;
    const dying = ctx;
    ctx = null;
    void dying.close().catch(() => {});
  }

  function setEnabled(on: boolean): void {
    if (on === enabled) return;
    enabled = on;
    if (!on) closeContext();
  }

  function play(kind: CueKind, intensity: number = 1): void {
    if (!enabled) return;
    const spec = cueSpec(kind, intensity);
    arm(); // pointerdown 을 못 본 경로(키보드 배치 등)에서는 이 호출이 곧 첫 제스처다
    if (ctx) deps.render(spec, ctx);
    // 진동은 오디오와 독립이다 — 무음 모드·스피커 없음에서도 손끝은 울려야 한다.
    if (spec.vibrateMs > 0) deps.vibrate(spec.vibrateMs);
  }

  function reset(): void {
    enabled = false;
    unsupported = false;
    closeContext();
  }

  return { setEnabled, arm, play, isOpen: () => ctx !== null, reset };
}

/** 앱 전역 단일 플레이어. `liveRegion` 과 같은 명령형 싱글턴이다 — 60fps 드래그 경로에서
 *  불리므로 React state 를 거칠 수 없다(§6.1 규칙 1). */
export const cues: CuePlayer = createCuePlayer();
