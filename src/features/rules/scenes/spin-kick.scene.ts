// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "회전킥 시도 및 방해"(schemaVersion 11(2026-09-06 v11 도장; 원본은 10), 1스텝,
// half/30x18). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs drills/SPIN_회전킥 시도 및 방해_20260904.spin.drill.json src/features/rules/scenes/spin-kick.scene.ts
//   드리프트 검사: node scripts/import-rule-scene.mjs drills/SPIN_회전킥 시도 및 방해_20260904.spin.drill.json src/features/rules/scenes/spin-kick.scene.ts --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 11,
  "id": "dr_mtlvmq8j0aw3is",
  "title": "회전킥 시도 및 방해",
  "drillType": "technical",
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
        "id": "ch_mtlvmq8j002lf9",
        "team": "home",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mtlvmq8j01retg",
        "team": "home",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mtlvmq8j02uxws",
        "team": "home",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mtlvmq8j03iogb",
        "team": "home",
        "number": "4",
        "isGk": false
      },
      {
        "id": "ch_mtlvmq8j04k2fr",
        "team": "away",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mtlvmq8j05fk85",
        "team": "away",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mtlvmq8j068etq",
        "team": "away",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mtlvmq8j0733wt",
        "team": "away",
        "number": "4",
        "isGk": false
      }
    ],
    "balls": [
      {
        "id": "bl_mtlvo0qv00ck73"
      },
      {
        "id": "bl_mtlvzang00pirc"
      }
    ],
    "cones": []
  },
  "steps": [
    {
      "id": "st_mtlvmq8j090ox0",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtlvmq8j05fk85": {
          "x": 141,
          "y": 245,
          "angleDeg": -128
        },
        "ch_mtlvmq8j03iogb": {
          "x": 194.2,
          "y": 254.2,
          "angleDeg": -177.7
        },
        "ch_mtlvmq8j068etq": {
          "x": 380.4,
          "y": 280.5,
          "angleDeg": -70.4
        },
        "ch_mtlvmq8j02uxws": {
          "x": 297.1,
          "y": 200.9,
          "angleDeg": 47.3
        }
      },
      "balls": {
        "bl_mtlvo0qv00ck73": {
          "x": 170.2,
          "y": 229.5
        },
        "bl_mtlvzang00pirc": {
          "x": 353.5,
          "y": 280.5
        }
      },
      "cones": {},
      "arrows": [
        {
          "id": "ar_mtlvxlft00quqx",
          "from": {
            "x": 146.984391900398,
            "y": 163.8311727600412
          },
          "ctrl": {
            "x": 147.9221857496643,
            "y": 189.69779847532692
          },
          "to": {
            "x": 138.34280757903662,
            "y": 217.8216990189503
          },
          "color": "#ef4444",
          "headFrom": "none"
        },
        {
          "id": "ar_mtlw302j00wyr1",
          "from": {
            "x": 318.634098821308,
            "y": 223.9649484173601
          },
          "ctrl": {
            "x": 328.1082938025269,
            "y": 232.5602598513291
          },
          "to": {
            "x": 352.1620581191838,
            "y": 262.25897816573513
          }
        },
        {
          "id": "ar_mtlwaszz0037wn",
          "from": {
            "x": 362.35025169367464,
            "y": 167.83192226032955
          },
          "ctrl": {
            "x": 341.41530346990794,
            "y": 183.8614318114725
          },
          "to": {
            "x": 320.4803552461412,
            "y": 199.89094136261545
          },
          "color": "#ef4444"
        }
      ],
      "notes": [
        {
          "id": "nt_mtlvs8x2007nrj",
          "x": 145.3,
          "y": 129.2,
          "text": "상대방이 가까이 있는데 회전킥을 크게 한 경우 반칙!",
          "size": 14,
          "color": "#ef4444"
        },
        {
          "id": "nt_mtlw3p2p0059z9",
          "x": 377.6,
          "y": 134.7,
          "text": "회전킥을 하려는데 멀리에서 빠르게 다가와 칵을 방해한 경우 반칙!",
          "size": 14,
          "color": "#ef4444"
        }
      ],
      "shapes": [],
      "strokes": [
        {
          "id": "fh_mtlvqu8x00ljtf",
          "points": [
            {
              "x": 127.49484850996824,
              "y": 242.27358096766483
            },
            {
              "x": 122.9262726361477,
              "y": 250.41458529267607
            },
            {
              "x": 122.9262726361477,
              "y": 262.6347563264872
            },
            {
              "x": 127.59897559541145,
              "y": 273.2991053272952
            },
            {
              "x": 135.18464393860944,
              "y": 278.212178477451
            },
            {
              "x": 147.62435635667052,
              "y": 282.8171835781856
            },
            {
              "x": 153.7834632919753,
              "y": 282.6471212020659
            },
            {
              "x": 163.64430167300017,
              "y": 273.2123327560925
            },
            {
              "x": 167.841501110734,
              "y": 262.4464666260845
            }
          ],
          "color": "#fde047",
          "width": 0,
          "headTo": "thin"
        },
        {
          "id": "fh_mtlw1rnq00mc0l",
          "points": [
            {
              "x": 400.8520960168459,
              "y": 273.6271088540539
            },
            {
              "x": 409.1678299646117,
              "y": 286.37102763068935
            },
            {
              "x": 410.5535747456654,
              "y": 299.560292444702
            },
            {
              "x": 408.89140592239795,
              "y": 306.77118844052757
            },
            {
              "x": 399.05018482112587,
              "y": 317.25298302414205
            },
            {
              "x": 390.17253545164476,
              "y": 320.5213985665504
            },
            {
              "x": 383.9960867899895,
              "y": 318.4869326935683
            },
            {
              "x": 372.1655131772136,
              "y": 310.4269097190854
            },
            {
              "x": 362.2762241141986,
              "y": 296.3352744761288
            }
          ],
          "color": "#fde047",
          "width": 0,
          "headTo": "thin"
        }
      ]
    }
  ],
  "createdAt": 1788461216083,
  "updatedAt": 1788462517792
} satisfies Drill;
