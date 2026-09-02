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
    lowTail: string;
    okTitle: string;
    okVerdict: string;
    okTail: string;
    highTitle: string;
    highVerdict: string;
    highTail: string;
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
    sizeCardCaption: (max: string, min: string, std: string) => string;
    goodHead: string;
    goodTail: string;
    badHead: string;
    badTail: string;
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
    lowTail: '공이 눌려 굴러가지 않는다',
    okTitle: '알맞은 공기압',
    okVerdict: '가드에 걸려 굴러 나간다',
    okTail: '규칙이 요구하는 상태',
    highTitle: '공기압이 높으면',
    highVerdict: '지나치게 튄다',
    highTail: '굴리는 경기가 되지 않는다',
    sizeCardTitle: '크기 — 같은 축척 비교',
    sizeCardCaption: (b, s) =>
      `경기구는 지름 ${b}cm(13인치)로, 축구공 5호(약 ${s}cm)의 1.5배다. 이 치수는 Laws 본문이 아니라 FIPFA 장비 규격에서 온다 — 앱의 물리 상수 BALL.diameterM 도 같은 값이다.`,
    pressureCardTitle: '공기압 — 규칙이 정하는 유일한 조건',
    pressureCardCaption:
      '규칙 본문이 공에 대해 정하는 것은 지름이 아니라 압력 하나다 — 지나치게 튀지 않으면서, 파워체어가 타고 넘지 못할 만큼. 실물이 저반발·중량형인 이유가 이것이다. 체어는 경기 전용 체어의 옆모습 비례를 따랐고, 공과의 크기 비도 대략 실물이다 — 바닥 가까이 길게 뻗은 볼가드가 공 한가운데를 만난다.',
  },
  court: {
    sizeAria: (l) => `세 코트 규격을 같은 축척으로 겹쳐 그린 비교 그림. ${l.join(', ')}. 표준 규격은 농구 코트와 같은 크기다.`,
    basketballCallout: '농구 코트',
    surfaceAria: '바닥재 비교 그림. 목재·인조 마루는 미끄럼이 적고 부드러워 규정이 권장하고, 콘크리트·아스팔트는 거칠어 규정이 피하라고 한다.',
    goodSurface: '목재·인조 마루',
    badSurface: '콘크리트·아스팔트',
    sizeCardTitle: '코트 규격 — 3단 비교',
    sizeCardCaption: (max, min, std) =>
      `규정 범위는 ${max}부터 ${min}까지다. 그 사이 ${std} — 표준 농구 코트와 정확히 같은 크기라, 새 체육관을 구할 때 "농구 코트가 있는가"만 물으면 된다.`,
    goodHead: '미끄럼 적고 바퀴에 부드럽다',
    goodTail: '규정이 권장하는 표면',
    badHead: '거칠어 타이어가 마모된다',
    badTail: '규정이 피하라는 표면',
    surfaceCardTitle: '바닥재 — 권장 vs 지양',
    surfaceCardCaption:
      // 2026-09-03: field-tour 장면이 카드 1 로 옮겨 가서 이 카드에는 없다 — 같은 카드의 위 패널을 가리킨다.
      '위 코트 규격 도해의 도형(라인·마크)과 달리 표면 재질은 코트 규격에는 안 나온다 — 목재·인조 마루는 미끄럼이 적고 파워체어 바퀴에 부드럽지만, 콘크리트·아스팔트는 거칠어 타이어 마모가 빠르고 제어가 어렵다.',
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
    lowTail: 'flattened, it will not roll',
    okTitle: 'Correct pressure',
    okVerdict: 'it catches the guard and rolls',
    okTail: 'what the Laws ask for',
    highTitle: 'Over-inflated',
    highVerdict: 'it bounces too much',
    highTail: 'no longer a rolling game',
    sizeCardTitle: 'Size — drawn to the same scale',
    sizeCardCaption: (b, s) =>
      `The match ball is ${b}cm (13in) across — one and a half times a size 5 football (about ${s}cm). That figure comes from FIPFA equipment guidance, not from the Laws; the app's physics constant BALL.diameterM uses the same value.`,
    pressureCardTitle: 'Pressure — the only thing the Laws fix',
    pressureCardCaption:
      'The Laws say nothing about the ball’s size, only its pressure: low enough not to bounce much, high enough that a powerchair cannot ride over it. That is why the real ball is low-bounce and heavyweight. The chair here follows the side-view proportions of a real match chair, and its size against the ball is roughly true — the long low guard meets the ball at its middle.',
  },
  court: {
    sizeAria: (l) => `Three court sizes drawn over one another to the same scale: ${l.join(', ')}. The standard size is the same as a basketball court.`,
    basketballCallout: 'basketball court',
    surfaceAria:
      'Surface comparison. Wood and artificial flooring is smooth and easy on the wheels, which the Laws recommend; concrete and tarmac are rough, which the Laws say to avoid.',
    goodSurface: 'Wood · artificial',
    badSurface: 'Concrete · tarmac',
    sizeCardTitle: 'Court size — three sizes compared',
    sizeCardCaption: (max, min, std) =>
      `The permitted range runs from ${max} down to ${min}. Between them sits ${std} — exactly the size of a standard basketball court, so finding a venue comes down to one question: does it have a basketball court?`,
    goodHead: 'Low grip loss, easy on wheels',
    goodTail: 'the surface the Laws recommend',
    badHead: 'Rough — wears tyres',
    badTail: 'the surface the Laws say to avoid',
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

const JA: FigureText = {
  ball: {
    sizeAria: (b, s) => `電動車椅子サッカーのボール（直径${b}cm）とサッカーボール5号（直径およそ${s}cm）を同じ縮尺で並べた大きさ比較の図`,
    soccerName: 'サッカーボール',
    soccerSize: '5号',
    matchBallName: '電動車椅子サッカー',
    matchBallSub: '競技球 · 13インチ',
    approx: (cm) => `およそ${cm}cm`,
    pressureAria: '空気圧の3つの場合を比べた図。低いとつぶれたボールを車椅子が乗り越え、適正ならガードに当たって転がり出て、高いと過度に弾む。',
    lowTitle: '空気圧が低いと',
    lowVerdict: '車椅子が乗り越える',
    lowTail: 'つぶれて転がらない',
    okTitle: '適正な空気圧',
    okVerdict: 'ガードに当たって転がる',
    okTail: '規則が求める状態',
    highTitle: '空気圧が高いと',
    highVerdict: '過度に弾む',
    highTail: '転がす競技にならない',
    sizeCardTitle: '大きさ — 同じ縮尺での比較',
    sizeCardCaption: (b, s) =>
      `競技球は直径${b}cm（13インチ）で、サッカーボール5号（およそ${s}cm）の1.5倍です。この寸法は競技規則本文ではなくFIPFAの用具基準によるもので、アプリの物理定数 BALL.diameterM も同じ値です。`,
    pressureCardTitle: '空気圧 — 規則が定める唯一の条件',
    pressureCardCaption:
      '競技規則がボールについて定めるのは寸法ではなく空気圧だけです — 過度に弾まず、かつ電動車椅子が乗り越えられない程度。実物が低反発・重量型なのはそのためです。ここでの車椅子は競技用車椅子の側面比率に従い、ボールとの大きさの比もおおむね実物どおりです — 床近くまで伸びたボールガードがボールの中央に当たります。',
  },
  court: {
    sizeAria: (l) => `3つのコート規格を同じ縮尺で重ねた比較の図。${l.join('、')}。標準規格はバスケットボールコートと同じ大きさ。`,
    basketballCallout: 'バスケコート',
    surfaceAria: '床材の比較図。木材・人工素材の床は滑りにくく車輪にやさしいので規則が推奨し、コンクリート・アスファルトは粗いので規則が避けるよう求めている。',
    goodSurface: '木材・人工素材',
    badSurface: 'コンクリート・アスファルト',
    sizeCardTitle: 'コート規格 — 3段階の比較',
    sizeCardCaption: (max, min, std) =>
      `規定の範囲は${max}から${min}までです。その間の${std}は標準的なバスケットボールコートとまったく同じ大きさなので、新しい体育館を探すときは「バスケットボールコートがあるか」だけ確かめれば足ります。`,
    goodHead: '滑りにくく車輪にやさしい',
    goodTail: '規則が推奨する床',
    badHead: '粗くタイヤが摩耗する',
    badTail: '規則が避けるよう求める床',
    surfaceCardTitle: '床材 — 推奨と非推奨',
    surfaceCardCaption:
      'field-tour のシーンが示す図形（ラインやマーク）と違い、表面の材質はコート規格には含まれません — 木材・人工素材の床は滑りにくく電動車椅子の車輪にやさしいのに対し、コンクリートやアスファルトは粗くタイヤの摩耗が早く、操作も難しくなります。',
  },
  equipment: {
    chairAria: '競技用電動車椅子の側面ラベル図。フットガード・シートベルト・左右の側方サポート・転倒防止バー・後方転倒防止キャスター・ベース境界線を示す。',
    frontguard: 'フットガード',
    seatbelt: 'シートベルト',
    sideSupport: '側方サポート',
    antiTipBar: '転倒防止バー',
    rearCaster: '後方キャスター',
    baseLine: 'ベース境界線',
    baseLineExcept: '（ガードは例外）',
    speedAria: '速度の比較図。一般の電動車椅子やスクーターは後進が前進より遅いことが多いが、電動車椅子サッカーの規則は前進・後進とも最高速度を10km/hに揃えている。',
    ordinaryChair: ['一般の電動車椅子', '· スクーター'],
    ruleChair: ['電動車椅子サッカー', '規則（第4条）'],
    forward: '前進',
    reverseSlower: '後進 · より遅い',
    forwardLimit: '前進 10km/h',
    reverseLimit: '後進 10km/h',
    reverseNote: '通常は後進の上限を低く設定する（正確な比率は機種による）',
    same: '同じ',
    chairCardTitle: '規定の用具 — 側面ラベル図',
    chairCardCaption:
      'フットガードはFIPFA規格に合わせて位置が固定されます（調整不可）。転倒防止バーは第2条の空気圧条項が求める「車椅子がボールを乗り越えないこと」を車椅子側で実現する取り付け具で、後方キャスターは後ろへの転倒を防ぎます。ベース境界線の外にはシートもヘッドレストも身体も出てはいけません — ガードは別途必須の取り付け具なので例外です。',
    speedCardTitle: '速度 — 前進・後進が同じ',
    speedCardCaption:
      '多くの電動車椅子やスクーターは安全のため後進の上限を前進より低くします。電動車椅子サッカーは違います — ドリブルも接触も両方向で等しく起こる競技なので、規則も前進・後進を同じ10km/hひとつにまとめています。',
  },
  distance: {
    title: '再開時の距離 — 5m と 3m',
    caption: 'ほとんどの再開で相手は5m離れ、セットボールだけが3mです — その代わりセットボールに参加する2人はボールから30cm以内に近づきます。',
    aria: '再開時に相手が保つ距離 — ほとんどが5メートル、セットボールだけ3メートルの2つの円を重ねた比較図',
    fiveM: '5m — ほとんどの再開',
    threeM: '3m — セットボール',
    note: 'ボールを中心に、2つの再開で必要な距離を重ねて描いています',
  },
};

export function figureTextFor(locale: Locale): FigureText {
  if (locale === 'en') return EN;
  if (locale === 'ja') return JA;
  return KO;
}
