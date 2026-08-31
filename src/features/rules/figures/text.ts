// 조항 도해의 화면 문자열 — 로케일별 표.
//
// 왜 전역 i18n 사전(`src/i18n/*.ts`)이 아니라 여기인가: 이 문자열들은 **그림의 부품**이다.
// 라벨 길이가 바뀌면 그림이 넘치거나 겹치므로, 옮기는 사람이 그림 코드 옆에서 함께 봐야 한다.
// 규칙 콘텐츠(`ruleTopics.en.ts`·`ruleContent.en.ts`)와 같은 방식이다.
//
// ⚠️ `aria-label` 을 빠뜨리지 말 것 — 도해는 SVG 라 스크린리더에게는 이 문장이 **그림 전체**다.
// 눈에 보이는 라벨만 옮기고 aria-label 을 한국어로 두면, 화면은 영어인데 읽어 주는 말은
// 한국어가 된다(가장 티가 안 나면서 가장 나쁜 종류의 누락이다).
//
// 수치는 여기 적지 않는다 — `BALL.diameterM` 등에서 파생시켜 넣는다(치수 하드코딩 금지 규율).
import type { Locale } from '../../../i18n/locale.ts';

export interface FigureText {
  ball: {
    sizeAria: (ballCm: number, soccerCm: number) => string;
    soccerName: string;
    soccerSize: string;
    matchBallName: string;
    matchBallSub: string;
    approx: (cm: number) => string;
    pressureAria: string;
    lowTitle: string;
    lowVerdict: string;
    okTitle: string;
    okVerdict: string;
    highTitle: string;
    highVerdict: string;
    sizeCardTitle: string;
    sizeCardCaption: (ballCm: number, soccerCm: number) => string;
    pressureCardTitle: string;
    pressureCardCaption: string;
  };
  court: {
    sizeAria: (labels: readonly string[]) => string;
    basketballCallout: string;
    surfaceAria: string;
    goodSurface: string;
    badSurface: string;
    sizeCardTitle: string;
    sizeCardCaption: (min: string, max: string, std: string) => string;
    surfaceCardTitle: string;
    surfaceCardCaption: string;
  };
  equipment: {
    chairAria: string;
    frontguard: string;
    seatbelt: string;
    sideSupport: string;
    antiTipBar: string;
    rearCaster: string;
    baseLine: string;
    baseLineExcept: string;
    speedAria: string;
    ordinaryChair: readonly string[];
    ruleChair: readonly string[];
    forward: string;
    reverseSlower: string;
    forwardLimit: string;
    reverseLimit: string;
    reverseNote: string;
    same: string;
    chairCardTitle: string;
    chairCardCaption: string;
    speedCardTitle: string;
    speedCardCaption: string;
  };
  distance: {
    title: string;
    caption: string;
    aria: string;
    fiveM: string;
    threeM: string;
    note: string;
  };
}

const KO: FigureText = {
  ball: {
    sizeAria: (b, s) => `파워체어풋볼 공(지름 ${b}cm)과 축구공 5호(지름 약 ${s}cm)를 같은 축척으로 나란히 놓은 크기 비교 그림`,
    soccerName: '축구공',
    soccerSize: '5호',
    matchBallName: '파워체어풋볼',
    matchBallSub: '경기구 · 13인치',
    approx: (cm) => `약 ${cm}cm`,
    pressureAria: '공기압 세 경우 비교 그림. 낮으면 눌린 공을 체어가 타고 넘고, 알맞으면 볼가드에 걸려 굴러 나가며, 높으면 공이 지나치게 튄다.',
    lowTitle: '공기압이 낮으면',
    lowVerdict: '체어가 타고 넘는다',
    okTitle: '알맞은 공기압',
    okVerdict: '가드에 걸려 굴러 나간다',
    highTitle: '공기압이 높으면',
    highVerdict: '지나치게 튄다',
    sizeCardTitle: '크기 — 같은 축척 비교',
    sizeCardCaption: (b, s) =>
      `경기구는 지름 ${b}cm(13인치)로, 축구공 5호(약 ${s}cm)의 1.5배다. 이 치수는 Laws 본문이 아니라 FIPFA 장비 규격에서 온다 — 앱의 물리 상수 BALL.diameterM 도 같은 값이다.`,
    pressureCardTitle: '공기압 — 규칙이 정하는 유일한 조건',
    pressureCardCaption:
      '규칙 본문이 공에 대해 정하는 것은 지름이 아니라 압력 하나다 — 지나치게 튀지 않으면서, 파워체어가 타고 넘지 못할 만큼. 실물이 저반발·중량형인 이유가 이것이다.',
  },
  court: {
    sizeAria: (l) => `세 코트 규격을 같은 축척으로 겹쳐 그린 비교 그림. ${l.join(', ')}.`,
    basketballCallout: '농구 코트',
    surfaceAria: '바닥재 비교 그림. 목재·인조 마루는 미끄럼이 적고 부드러워 규정이 권장하고, 콘크리트·아스팔트는 거칠어 규정이 피하라고 한다.',
    goodSurface: '목재·인조 마루',
    badSurface: '콘크리트·아스팔트',
    sizeCardTitle: '코트 규격 — 3단 비교',
    sizeCardCaption: (min, max, std) => `규정 범위는 ${min}부터 ${max}까지다. 그 사이 ${std}가 국제경기 표준이다.`,
    surfaceCardTitle: '바닥재 — 권장 vs 지양',
    surfaceCardCaption:
      'field-tour 장면이 보여주는 도형(라인·마크)과 달리 표면 재질은 코트 규격에는 안 나온다 — 목재·인조 마루는 미끄럼이 적고 파워체어 바퀴에 부드럽지만, 콘크리트·아스팔트는 거칠어 타이어 마모가 빠르고 제어가 어렵다.',
  },
  equipment: {
    chairAria: '경기용 파워체어 옆모습 라벨 도해. 프런트가드·시트벨트·좌우 측면지지대·전도방지 바·후방 전도방지 캐스터·밑판 경계선을 표시한다.',
    frontguard: '프런트가드',
    seatbelt: '시트벨트',
    sideSupport: '측면지지대',
    antiTipBar: '전도방지바',
    rearCaster: '후방캐스터',
    baseLine: '밑판 경계선',
    baseLineExcept: '(가드는 예외)',
    speedAria: '속도 비교 그림. 일반 전동휠체어·스쿠터는 후진이 전진보다 느린 경우가 많지만, 파워체어풋볼 규정은 전진과 후진 최고 속도를 10km/h로 동일하게 제한한다.',
    ordinaryChair: ['일반 전동휠체어', '· 스쿠터'],
    ruleChair: ['파워체어풋볼', '규정(Law 4)'],
    forward: '전진',
    reverseSlower: '후진 · 더 느림',
    forwardLimit: '전진 10km/h',
    reverseLimit: '후진 10km/h',
    reverseNote: '보통 후진 상한을 더 낮게 둔다(정확한 비율은 기종마다 다르다)',
    same: '동일',
    chairCardTitle: '규정 장비 — 옆모습 라벨 도해',
    chairCardCaption:
      "프런트가드는 FIPFA 규격에 맞춰 위치가 고정된다(조정 불가). 전도방지 바는 제2조 공기압 조항이 요구하는 '체어가 공을 타고 넘지 못하게'를 체어 쪽에서 구현한 부착물이고, 후방 캐스터는 뒤로 넘어지는 것을 막는다. 밑판 경계선 밖으로는 시트·머리받침·몸 어느 것도 나갈 수 없다 — 가드는 별도 필수 부착물이라 예외다.",
    speedCardTitle: '속도 — 전진·후진 대칭',
    speedCardCaption:
      '많은 전동휠체어·스쿠터는 안전을 위해 후진 상한을 전진보다 낮게 둔다. 파워체어풋볼은 다르다 — 드리블도 몸싸움도 양방향으로 똑같이 벌어지는 경기라, 규정도 전진·후진을 같은 10km/h 하나로 묶는다.',
  },
  distance: {
    title: '재개 거리 — 5m vs 3m',
    caption: '대부분의 재개는 상대와 5m, 세트볼만 3m입니다 — 대신 세트볼 참여 2명은 공에서 30cm 이내로 붙습니다.',
    aria: '재개 시 상대와의 거리 — 대부분 5미터, 세트볼만 3미터인 두 원을 겹쳐 비교한 그림',
    fiveM: '5m — 대부분의 재개',
    threeM: '3m — 세트볼',
    note: '공을 중심으로 두 재개의 필요 거리를 겹쳐 그렸습니다',
  },
};

const EN: FigureText = {
  ball: {
    sizeAria: (b, s) => `Size comparison: a powerchair football ball (${b}cm across) beside a size 5 football (about ${s}cm), drawn to the same scale.`,
    soccerName: 'Football',
    soccerSize: 'size 5',
    matchBallName: 'Powerchair football',
    matchBallSub: 'match ball · 13in',
    approx: (cm) => `about ${cm}cm`,
    pressureAria:
      'Three inflation cases compared. Under-inflated, a chair rides over the flattened ball; correctly inflated, it catches on the guard and rolls away; over-inflated, it bounces too much.',
    lowTitle: 'Under-inflated',
    lowVerdict: 'the chair rides over it',
    okTitle: 'Correct pressure',
    okVerdict: 'it catches the guard and rolls',
    highTitle: 'Over-inflated',
    highVerdict: 'it bounces too much',
    sizeCardTitle: 'Size — drawn to the same scale',
    sizeCardCaption: (b, s) =>
      `The match ball is ${b}cm (13in) across — one and a half times a size 5 football (about ${s}cm). That figure comes from FIPFA equipment guidance, not from the Laws; the app's physics constant BALL.diameterM uses the same value.`,
    pressureCardTitle: 'Pressure — the only thing the Laws fix',
    pressureCardCaption:
      'The Laws say nothing about the ball’s size, only its pressure: low enough not to bounce much, high enough that a powerchair cannot ride over it. That is why the real ball is low-bounce and heavyweight.',
  },
  court: {
    sizeAria: (l) => `Three court sizes drawn over one another to the same scale: ${l.join(', ')}.`,
    basketballCallout: 'basketball court',
    surfaceAria:
      'Surface comparison. Wood and artificial flooring is smooth and easy on the wheels, which the Laws recommend; concrete and tarmac are rough, which the Laws say to avoid.',
    goodSurface: 'Wood · artificial',
    badSurface: 'Concrete · tarmac',
    sizeCardTitle: 'Court size — three sizes compared',
    sizeCardCaption: (min, max, std) => `The permitted range runs from ${min} to ${max}. Between them, ${std} is the international standard.`,
    surfaceCardTitle: 'Surface — recommended vs avoided',
    surfaceCardCaption:
      'Unlike the lines and marks the field-tour scene shows, the surface material is not part of the court dimensions. Wood and artificial flooring is smooth and kind to powerchair wheels; concrete and tarmac are rough, wear tyres quickly and make control harder.',
  },
  equipment: {
    chairAria:
      'Labelled side view of a match powerchair, marking the frontguard, seatbelt, lateral supports on each side, anti-tip bar, rear anti-tip casters and the chair base line.',
    frontguard: 'Frontguard',
    seatbelt: 'Seatbelt',
    sideSupport: 'Lateral support',
    antiTipBar: 'Anti-tip bar',
    rearCaster: 'Rear caster',
    baseLine: 'Chair base line',
    baseLineExcept: '(guard excepted)',
    speedAria:
      'Speed comparison. Ordinary powered wheelchairs and scooters are often slower in reverse than forward, but the Laws cap powerchair football at 10 kph in both directions alike.',
    ordinaryChair: ['Ordinary powerchair', '· scooter'],
    ruleChair: ['Powerchair football', 'Law 4'],
    forward: 'Forward',
    reverseSlower: 'Reverse · slower',
    forwardLimit: 'Forward 10 kph',
    reverseLimit: 'Reverse 10 kph',
    reverseNote: 'Reverse is usually capped lower (the exact ratio varies by model)',
    same: 'equal',
    chairCardTitle: 'Required equipment — labelled side view',
    chairCardCaption:
      'The frontguard is fixed in position to the FIPFA standard and cannot be adjusted. The anti-tip bar is the chair-side answer to Law 2’s pressure rule — it stops the chair riding over the ball — and the rear casters stop it tipping backwards. Nothing may pass the chair base line: not the seat, not the headrest, not the player. The guard is the one exception, being required equipment in its own right.',
    speedCardTitle: 'Speed — the same in both directions',
    speedCardCaption:
      'Many powered wheelchairs and scooters cap reverse below forward for safety. Powerchair football does not: dribbling and contact happen in both directions alike, so the Laws set one limit, 10 kph, for forward and reverse.',
  },
  distance: {
    title: 'Restart distance — 5m vs 3m',
    caption:
      'Most restarts keep opponents 5m away; only the set ball uses 3m — and there the two players taking it come within 30cm of the ball.',
    aria: 'The distance opponents must keep at a restart — two overlaid circles, 5 metres for most restarts and 3 metres for the set ball.',
    fiveM: '5m — most restarts',
    threeM: '3m — set ball',
    note: 'The two required distances drawn over one another, centred on the ball',
  },
};

export function figureTextFor(locale: Locale): FigureText {
  return locale === 'en' ? EN : KO;
}
