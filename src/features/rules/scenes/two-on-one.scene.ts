// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "5-1 2-on- 1  반칙 1"(schemaVersion 10(2026-09-03 v10 도장; 원본은 9), 1스텝,
// half/30x18). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/two-on-one.scene.ts --title '5-1 2-on- 1  반칙 1'
//   드리프트 검사: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/two-on-one.scene.ts --title '5-1 2-on- 1  반칙 1' --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 10,
  "id": "dr_mtei3rr600a6er",
  "title": "5-1 2-on- 1  반칙 1",
  "drillType": "game-scenario",
  "situation": "open-play",
  "level": "초급",
  "durationMin": 10,
  "tags": [],
  "objective": "",
  "coachingPoints": [],
  "playersNeeded": 0,
  "equipment": "",
  "courtMode": "half",
  "courtSize": "30x18",
  "defense": "away",
  "formation": "1-2-1",
  "teams": { home: { ...DEFAULT_TEAMS.home }, away: { ...DEFAULT_TEAMS.away } },
  "cast": {
    "chairs": [
      {
        "id": "ch_mtdsdvr900uj4m",
        "team": "home",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mtdsdvr901ptqs",
        "team": "home",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mtdsdvr9025ey6",
        "team": "home",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mtdsdvr903k32b",
        "team": "home",
        "number": "4",
        "isGk": false
      },
      {
        "id": "ch_mtdsdvr904v2qy",
        "team": "away",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mtdsdvr905vlrh",
        "team": "away",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mtdsdvr906eggd",
        "team": "away",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mtdsdvr907po65",
        "team": "away",
        "number": "4",
        "isGk": false
      }
    ],
    "balls": [
      {
        "id": "bl_mtdsf7f0005j1p"
      },
      {
        "id": "bl_mtei9oqd00bhi5"
      }
    ],
    "cones": []
  },
  "steps": [
    {
      "id": "st_mtdsdvr9092s0i",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtdsdvr905vlrh": {
          "x": 339.2600237204642,
          "y": 225.87884700113693,
          "angleDeg": -75.9
        },
        "ch_mtdsdvr903k32b": {
          "x": 362.46002372046416,
          "y": 241.4788470011369,
          "angleDeg": -70.5
        },
        "ch_mtdsdvr9025ey6": {
          "x": 192.8,
          "y": 210.7,
          "angleDeg": 149.8
        },
        "ch_mtdsdvr906eggd": {
          "x": 145.1,
          "y": 179.9,
          "angleDeg": -20.2
        },
        "ch_mtdsdvr901ptqs": {
          "x": 134.1,
          "y": 226.1,
          "angleDeg": -14.4
        },
        "ch_mtdsdvr907po65": {
          "x": 412.7600237204642,
          "y": 117.77884700113685,
          "angleDeg": 105.2
        }
      },
      "balls": {
        "bl_mtdsf7f0005j1p": {
          "x": 162.5,
          "y": 198.2
        },
        "bl_mtei9oqd00bhi5": {
          "x": 374.7600237204642,
          "y": 199.57884700113698
        }
      },
      "cones": {},
      "arrows": [
        {
          "id": "ar_mteiaua200o287",
          "from": {
            "x": 404.47910405893356,
            "y": 145.79425680869036
          },
          "ctrl": {
            "x": 394.42695002942673,
            "y": 163.9377068414663
          },
          "to": {
            "x": 381.758599906105,
            "y": 197.5283570831852
          }
        },
        {
          "id": "ar_mteibvgv00n223",
          "from": {
            "x": 349.3064982575146,
            "y": 191.14601610252868
          },
          "ctrl": {
            "x": 375.9915327067913,
            "y": 115.13140515143189
          },
          "to": {
            "x": 285.74241237597903,
            "y": 152.38756230404874
          }
        }
      ],
      "notes": [
        {
          "id": "nt_mteihtar00p1yp",
          "x": 259.9099425790758,
          "y": 341.5086547600682,
          "text": "공을 중심(반경 3미터)으로 2명의 선수가 1명의 선수를 막거나 방해하거나 공을 뺏으려 할때 반칙이 2명인 팀에게 주어지며 상대에게 간접 프리킥이 선언.",
          "size": 14,
          "color": "#ffffff"
        }
      ],
      "shapes": [],
      "ballRings": {
        "bl_mtdsf7f0005j1p": "3m",
        "bl_mtei9oqd00bhi5": "3m"
      }
    }
  ],
  "createdAt": 1788015233346,
  "updatedAt": 1788047634179
} satisfies Drill;
