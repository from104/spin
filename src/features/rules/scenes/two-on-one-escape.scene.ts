// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "2매1 반칙 일시적 회피"(schemaVersion 10, 3스텝,
// full/28x15). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs drills/SPIN_2매1 반칙 일시적 회피_20260904.spin.drill.json src/features/rules/scenes/two-on-one-escape.scene.ts
//   드리프트 검사: node scripts/import-rule-scene.mjs drills/SPIN_2매1 반칙 일시적 회피_20260904.spin.drill.json src/features/rules/scenes/two-on-one-escape.scene.ts --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 10,
  "id": "dr_mtluu8qc0af0ye",
  "title": "2매1 반칙 일시적 회피",
  "drillType": "technical",
  "level": "초급",
  "durationMin": 10,
  "tags": [],
  "objective": "",
  "coachingPoints": [],
  "playersNeeded": 0,
  "equipment": "",
  "courtMode": "full",
  "courtSize": "28x15",
  "defense": "home",
  "formation": "1-2-1",
  "teams": { home: { ...DEFAULT_TEAMS.home }, away: { ...DEFAULT_TEAMS.away } },
  "cast": {
    "chairs": [
      {
        "id": "ch_mtluu8qc007trl",
        "team": "home",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mtluu8qc01ykyo",
        "team": "home",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mtluu8qc02vjtg",
        "team": "home",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mtluu8qc03g10u",
        "team": "home",
        "number": "4",
        "isGk": false
      },
      {
        "id": "ch_mtluu8qc04hwwv",
        "team": "away",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mtluu8qc05scym",
        "team": "away",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mtluu8qc06f0cb",
        "team": "away",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mtluu8qc07b7bl",
        "team": "away",
        "number": "4",
        "isGk": false
      }
    ],
    "balls": [
      {
        "id": "bl_mtluufm000r5n0"
      }
    ],
    "cones": []
  },
  "steps": [
    {
      "id": "st_mtluu8qc09d13d",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtluu8qc03g10u": {
          "x": 351.5,
          "y": 344.2,
          "angleDeg": 10
        },
        "ch_mtluu8qc07b7bl": {
          "x": 368.9,
          "y": 412.5,
          "angleDeg": -9
        },
        "ch_mtluu8qc06f0cb": {
          "x": 506.9,
          "y": 353.1,
          "angleDeg": 160.5
        }
      },
      "balls": {
        "bl_mtluufm000r5n0": {
          "x": 368.9,
          "y": 371
        }
      },
      "ballRings": {
        "bl_mtluufm000r5n0": "3m"
      },
      "cones": {},
      "arrows": [
        {
          "id": "ar_mtluvzob00xblb",
          "from": {
            "x": 388.5627244059793,
            "y": 343.02381585743433
          },
          "ctrl": {
            "x": 427.43725204621364,
            "y": 342.84361570967013
          },
          "to": {
            "x": 466.31177968644795,
            "y": 342.663415561906
          },
          "color": "#ef4444"
        },
        {
          "id": "ar_mtluw5oz006sra",
          "from": {
            "x": 402.27760661182225,
            "y": 399.73537858753696
          },
          "ctrl": {
            "x": 445.95369471959447,
            "y": 404.24338887999073
          },
          "to": {
            "x": 480.0266618922909,
            "y": 399.3749782920086
          }
        },
        {
          "id": "ar_mtluww6900er92",
          "from": {
            "x": 532.3268885781329,
            "y": 350.3110466347714
          },
          "ctrl": {
            "x": 561.5774965296173,
            "y": 350.3110466347714
          },
          "to": {
            "x": 583.3645808726922,
            "y": 404.1064862512732
          }
        }
      ],
      "notes": [
        {
          "id": "nt_mtluxceg001sgf",
          "x": 486.3,
          "y": 273.3,
          "text": "이대로 가면 파란팀이 2대1 반칙 위기",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mtluznh50155iq",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtluu8qc03g10u": {
          "x": 415.4,
          "y": 334.9,
          "angleDeg": 10
        },
        "ch_mtluu8qc07b7bl": {
          "x": 432.8,
          "y": 403.2,
          "angleDeg": -9
        },
        "ch_mtluu8qc06f0cb": {
          "x": 533.1,
          "y": 364.2,
          "angleDeg": -128.4
        }
      },
      "balls": {
        "bl_mtluufm000r5n0": {
          "x": 432.8,
          "y": 361.7
        }
      },
      "ballRings": {
        "bl_mtluufm000r5n0": "3m"
      },
      "cones": {},
      "arrows": [
        {
          "id": "ar_mtluvzob00xblb",
          "from": {
            "x": 452.47556446612225,
            "y": 333.7544307587676
          },
          "ctrl": {
            "x": 491.3500921063566,
            "y": 333.57423061100343
          },
          "to": {
            "x": 530.224619746591,
            "y": 333.3940304632393
          },
          "color": "#ef4444"
        },
        {
          "id": "ar_mtluw5oz006sra",
          "from": {
            "x": 466.1904466719652,
            "y": 390.46599348887025
          },
          "ctrl": {
            "x": 509.86653477973744,
            "y": 394.97400378132403
          },
          "to": {
            "x": 543.9395019524337,
            "y": 390.1055931933419
          }
        },
        {
          "id": "ar_mtluww6900er92",
          "from": {
            "x": 543.262531377462,
            "y": 369.81659861924845
          },
          "ctrl": {
            "x": 563.578004832501,
            "y": 409.1861917990535
          },
          "to": {
            "x": 529.9361805804232,
            "y": 442.11294200851063
          }
        }
      ],
      "notes": [
        {
          "id": "nt_mtluxceg001sgf",
          "x": 486.3,
          "y": 273.3,
          "text": "이대로 가면 파란팀이 2대1 반칙 위기",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mtlv1rhe01l21d",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtluu8qc03g10u": {
          "x": 481.4,
          "y": 328.8,
          "angleDeg": 10
        },
        "ch_mtluu8qc07b7bl": {
          "x": 498.8,
          "y": 397.1,
          "angleDeg": -9
        },
        "ch_mtluu8qc06f0cb": {
          "x": 528.2,
          "y": 432.9,
          "angleDeg": 4.1
        }
      },
      "balls": {
        "bl_mtluufm000r5n0": {
          "x": 498.8,
          "y": 355.6
        }
      },
      "ballRings": {
        "bl_mtluufm000r5n0": "3m"
      },
      "cones": {},
      "arrows": [
        {
          "id": "ar_mtluvzob00xblb",
          "from": {
            "x": 518.4810233262684,
            "y": 327.63945175382867
          },
          "ctrl": {
            "x": 557.3555509665026,
            "y": 327.45925160606447
          },
          "to": {
            "x": 596.230078606737,
            "y": 327.27905145830033
          },
          "color": "#ef4444"
        },
        {
          "id": "ar_mtluw5oz006sra",
          "from": {
            "x": 532.1959055321113,
            "y": 384.3510144839313
          },
          "ctrl": {
            "x": 575.8719936398835,
            "y": 388.85902477638507
          },
          "to": {
            "x": 609.9449608125798,
            "y": 383.99061418840296
          }
        }
      ],
      "notes": [
        {
          "id": "nt_mtlv2jo8003bsu",
          "x": 332,
          "y": 349.3,
          "text": "그럴때는 일시적으로 사이드라인 밖으로 빠저나갈 수 있음\n단 플레이가 멀리 벗어난 경우에만 경기장애 들어올 수 있음",
          "size": 14,
          "color": "#ef4444"
        }
      ],
      "shapes": []
    }
  ],
  "createdAt": 1788459887028,
  "updatedAt": 1788461134182
} satisfies Drill;
