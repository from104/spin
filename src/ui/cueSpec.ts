// §4.3 P1-4 "놓으면 소리가 나고 손끝이 울린다" — **신호의 모양만** 정하는 순수 층.
//
// 무릎 위 태블릿 + 시선은 선수. 놓임 확인이 시각뿐이면 코치는 개체를 놓을 때마다 화면을
// 다시 봐야 한다. 그래서 **되돌릴 수 없거나 되돌리기 번거로운 사건에만** 소리·진동을 붙인다 —
// 더 붙이면 체육관에서 그냥 소음이다.
//
// 2026-08-16 — 셋에서 다섯이 됐다(§6.10c 트레이 드롭). 는 이유는 트레이로 끌어 치우는 길이
// 그때까지 **결과를 미리 말하지 않았기** 때문이다: 손을 떼기 전에는 아무 신호도 없고, 떼고
// 나서야 소리가 났다. 예고가 없는 파괴적 조작은 확인 대화상자를 부르게 되는데, 그것은
// 무릎 위에서 가장 비싼 물건이다. 그래서 예고(`trayArm`)를 붙이고, 결과가 갈리는
// 자리(빼기/삭제)를 **소리로도** 갈랐다(`trayReturn`/`erase`) — 글자를 못 보는 순간에도
// "돌아온다"와 "사라진다"가 구별돼야 한다.
//
// 왜 파일이 둘인가: jsdom 에 WebAudio 가 없어 합성 자체는 단위 테스트가 불가능하다. 그래서
// **무엇을 낼 것인가**(이 파일 — 전부 순수, 전부 테스트)와 **어떻게 내는가**(cues.ts 의
// `renderCue` — WebAudio 호출만)를 갈라 둔다. 테스트 불가능한 부분을 한 함수로 몰아 두는 것이
// "어댑터 격리" 의 실제 내용이다.
//
// 오디오 파일·CDN 금지(§8 런타임 의존성 규칙) — 전부 합성이다.

export type CueKind = 'drop' | 'blocked' | 'trayReturn' | 'trayArm' | 'erase';

/** 합성 소스. `noise` 는 화이트노이즈 버스트(타격음), `sweep` 은 음정이 미끄러지는 톤. */
export type CueSource = 'noise' | 'sweep';

export interface CueSpec {
  source: CueSource;
  durationMs: number;
  /** 로우패스 컷오프(Hz). 높을수록 밝고 날카롭다. */
  cutoffHz: number;
  /** 피크 게인(0..1). */
  gain: number;
  /** `sweep` 의 시작·끝 주파수(Hz). `noise` 면 둘 다 0 이다. */
  fromHz: number;
  toHz: number;
  /** `navigator.vibrate` 인자(ms). 0 이면 진동하지 않는다. */
  vibrateMs: number;
}

/** NaN 만 따로 접는다(가장 약한 쪽으로) — 세기는 나눗셈에서 오므로 0/0 이 반드시 온다.
 *  ±Infinity 는 그냥 잘리면 된다: 그 값이 뜻하는 방향(무한히 세다 / 무한히 약하다)과
 *  잘린 결과(1 / 0)가 어긋나지 않는다. */
const clamp01 = (n: number): number => (Number.isNaN(n) ? 0 : Math.min(1, Math.max(0, n)));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 놓임 '탁'. 계획서(§4.3 P1-4)가 못박은 값이다 — **20ms 노이즈 버스트 + 로우패스**,
 *  그리고 `navigator.vibrate(10)`. 자석 칩이 철판에 붙는 소리라 짧고 건조해야 한다. */
const DROP: CueSpec = { source: 'noise', durationMs: 20, cutoffHz: 1400, gain: 0.3, fromHz: 0, toHz: 0, vibrateMs: 10 };

/** 막힘 '툭' 의 양끝. 세기는 **상대속도**(손이 개체를 두고 떠나는 속도)에 비례한다 —
 *  살짝 걸린 것과 벽에 정면으로 박은 것이 같은 소리를 내면 그 신호는 아무것도 알려주지 않는다.
 *  놓임보다 어둡고(컷오프 낮고) 길다: '탁' 과 '툭' 이 귀로 구별돼야 눈을 안 쓴다. */
const BLOCKED_SOFT: CueSpec = { source: 'noise', durationMs: 22, cutoffHz: 260, gain: 0.06, fromHz: 0, toHz: 0, vibrateMs: 6 };
const BLOCKED_HARD: CueSpec = { source: 'noise', durationMs: 30, cutoffHz: 900, gain: 0.4, fromHz: 0, toHz: 0, vibrateMs: 18 };

/** 상자 빔 — 개체가 트레이(상자)로 빨려 들어간다. 셋 중 **유일하게 음정이 있는** 신호다:
 *  '탁'·'툭' 과 소리의 종류 자체가 달라야 "판에 놓았다" 와 "판에서 뺐다" 를 눈 없이 가른다.
 *  내려가는 스윕인 이유는 방향 은유다 — 개체가 판을 떠나 상자로 내려간다. */
const TRAY_RETURN: CueSpec = { source: 'sweep', durationMs: 120, cutoffHz: 2400, gain: 0.2, fromHz: 660, toHz: 180, vibrateMs: 14 };

/** 상자 **예고** — 손이 트레이 위로 들어섰다(아직 아무 일도 안 났다). 세 값이 전부 약하다:
 *  짧고(45ms), 조용하고(0.09), 위로 오른다. 방향이 위인 것이 요점이다 — 실제로 치워지는 두
 *  소리(`trayReturn`·`erase`)는 **내려가므로**, 이 신호가 결과와 헷갈릴 수 없다. 손을 그대로
 *  빼면 아무 일도 안 나는 사건이라 세기도 여기가 가장 약해야 한다. */
const TRAY_ARM: CueSpec = { source: 'sweep', durationMs: 45, cutoffHz: 2600, gain: 0.09, fromHz: 320, toHz: 540, vibrateMs: 6 };

/** 삭제 — 트레이에 자리가 **없는** 것(화살표·메모·도형)이 판을 떠난다(removal.ts 의 그 판정).
 *  `trayReturn` 과 같은 하강 스윕이되 더 낮게·더 길게 떨어지고 진동도 세다: 되돌리기 말고는
 *  되살릴 길이 없는 조작이 상자에 도로 넣는 것과 같은 소리를 내면, 그 소리는 거짓말이다. */
const ERASE: CueSpec = { source: 'sweep', durationMs: 200, cutoffHz: 900, gain: 0.22, fromHz: 420, toHz: 90, vibrateMs: 24 };

/** 사건 → 신호. `intensity` 는 0..1 로 잘리며(NaN 은 0), **막힘만** 그것을 읽는다 —
 *  놓임·상자 빔·예고·삭제는 세기가 없는 사건이라 세기를 받으면 거짓말이 된다(개체를 살살
 *  지운다는 것은 없다).
 *
 *  매번 새 객체를 만든다: 호출자가 반환값을 변형해도 다음 호출이 오염되지 않는다
 *  (`makeDefaultPrefs` 와 같은 이유). */
export function cueSpec(kind: CueKind, intensity: number = 1): CueSpec {
  if (kind === 'drop') return { ...DROP };
  if (kind === 'trayReturn') return { ...TRAY_RETURN };
  if (kind === 'trayArm') return { ...TRAY_ARM };
  if (kind === 'erase') return { ...ERASE };
  const t = clamp01(intensity);
  return {
    source: BLOCKED_SOFT.source,
    durationMs: lerp(BLOCKED_SOFT.durationMs, BLOCKED_HARD.durationMs, t),
    cutoffHz: lerp(BLOCKED_SOFT.cutoffHz, BLOCKED_HARD.cutoffHz, t),
    gain: lerp(BLOCKED_SOFT.gain, BLOCKED_HARD.gain, t),
    fromHz: 0,
    toHz: 0,
    // 진동은 ms 단위 정수만 의미가 있다(하드웨어가 그보다 잘게 못 떤다).
    vibrateMs: Math.round(lerp(BLOCKED_SOFT.vibrateMs, BLOCKED_HARD.vibrateMs, t)),
  };
}
