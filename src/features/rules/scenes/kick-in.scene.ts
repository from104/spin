// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "2-2 킥인"(schemaVersion 9, 4스텝,
// half/30x18). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/kick-in.scene.ts --title '2-2 킥인'
//   드리프트 검사: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/kick-in.scene.ts --title '2-2 킥인' --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 9,
  "id": "dr_mt7ab80000o6km",
  "title": "2-2 킥인",
  "drillType": "game-scenario",
  "situation": "kick-in",
  "level": "초급",
  "durationMin": 2,
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
        "id": "ch_mt7ab2gn00puo0",
        "team": "home",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mt7ab2gn01gd8g",
        "team": "home",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mt7ab2gn027k8h",
        "team": "home",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mt7ab2gn031sex",
        "team": "home",
        "number": "4",
        "isGk": false
      },
      {
        "id": "ch_mt7ab2gn04zfmu",
        "team": "away",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mt7ab2gn05gr8o",
        "team": "away",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mt7ab2go004uu4",
        "team": "away",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mt7ab2go01q6lh",
        "team": "away",
        "number": "4",
        "isGk": false
      }
    ],
    "balls": [
      {
        "id": "bl_mt7ace5i00yssn"
      }
    ],
    "cones": []
  },
  "steps": [
    {
      "id": "st_mt7ab2go034hy8",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mt7ab2gn04zfmu": {
          "x": 196.5,
          "y": 381.1,
          "angleDeg": -90
        },
        "ch_mt7ab2gn05gr8o": {
          "x": 111.3,
          "y": 346.5,
          "angleDeg": -95.6
        },
        "ch_mt7ab2go004uu4": {
          "x": 279.3,
          "y": 212.6,
          "angleDeg": 90
        },
        "ch_mt7ab2gn01gd8g": {
          "x": 90.3,
          "y": 278.8,
          "angleDeg": 81.2
        },
        "ch_mt7ab2gn031sex": {
          "x": 375.5,
          "y": 93.7,
          "angleDeg": 90
        },
        "ch_mt7ab2go01q6lh": {
          "x": 297,
          "y": 389.3,
          "angleDeg": -90
        },
        "ch_mt7ab2gn027k8h": {
          "x": 346.4,
          "y": 278.8,
          "angleDeg": 166.9
        },
        "ch_mt7ab2gn00puo0": {
          "x": 155,
          "y": 102.1,
          "angleDeg": 32.6
        }
      },
      "balls": {
        "bl_mt7ace5i00yssn": {
          "x": 90.3,
          "y": 327.4
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [],
      "shapes": []
    },
    {
      "id": "st_mt7almxt01kncp",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mt7ab2gn04zfmu": {
          "x": 196.5,
          "y": 381.1,
          "angleDeg": -90
        },
        "ch_mt7ab2gn05gr8o": {
          "x": 111.3,
          "y": 346.5,
          "angleDeg": -177.6
        },
        "ch_mt7ab2go004uu4": {
          "x": 279.3,
          "y": 212.6,
          "angleDeg": 90
        },
        "ch_mt7ab2gn01gd8g": {
          "x": 90.3,
          "y": 278.8,
          "angleDeg": 156.5
        },
        "ch_mt7ab2gn031sex": {
          "x": 375.5,
          "y": 93.7,
          "angleDeg": 90
        },
        "ch_mt7ab2go01q6lh": {
          "x": 297,
          "y": 389.3,
          "angleDeg": -90
        },
        "ch_mt7ab2gn027k8h": {
          "x": 346.4,
          "y": 278.8,
          "angleDeg": 166.9
        },
        "ch_mt7ab2gn00puo0": {
          "x": 155,
          "y": 102.1,
          "angleDeg": 32.6
        }
      },
      "balls": {
        "bl_mt7ace5i00yssn": {
          "x": 12.5,
          "y": 346.5
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [],
      "shapes": []
    },
    {
      "id": "st_mt7ag4pn010qse",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mt7ab2gn04zfmu": {
          "x": 198.2,
          "y": 354,
          "angleDeg": -90
        },
        "ch_mt7ab2gn05gr8o": {
          "x": 198.3,
          "y": 398.8,
          "angleDeg": -90
        },
        "ch_mt7ab2go004uu4": {
          "x": 160,
          "y": 252.8,
          "angleDeg": 90
        },
        "ch_mt7ab2gn01gd8g": {
          "x": 59.6,
          "y": 346.5,
          "angleDeg": 177.4
        },
        "ch_mt7ab2gn031sex": {
          "x": 47.3,
          "y": 181.9,
          "angleDeg": 90
        },
        "ch_mt7ab2go01q6lh": {
          "x": 330.5,
          "y": 239.2,
          "angleDeg": 105.3
        },
        "ch_mt7ab2gn027k8h": {
          "x": 209.9,
          "y": 309.7,
          "angleDeg": 178.8
        },
        "ch_mt7ab2gn00puo0": {
          "x": 421.8,
          "y": 239.2,
          "angleDeg": 133.1
        }
      },
      "balls": {
        "bl_mt7ace5i00yssn": {
          "x": 37.5,
          "y": 327.2
        }
      },
      "ballRings": {
        "bl_mt7ace5i00yssn": "5m"
      },
      "ballOwner": {
        "bl_mt7ace5i00yssn": "home"
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mt7aqviy00uwum",
          "x": 210.9,
          "y": 221.3,
          "text": "수비는 5미터 떨어져야함",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": [],
      "cut": true
    },
    {
      "id": "st_mt7as4yf01xv00",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mt7ab2gn04zfmu": {
          "x": 198.3,
          "y": 351.7,
          "angleDeg": -90
        },
        "ch_mt7ab2gn05gr8o": {
          "x": 198.3,
          "y": 398.8,
          "angleDeg": -90
        },
        "ch_mt7ab2go004uu4": {
          "x": 191.5,
          "y": 251,
          "angleDeg": 90
        },
        "ch_mt7ab2gn01gd8g": {
          "x": 60,
          "y": 344.7,
          "angleDeg": 177.4
        },
        "ch_mt7ab2gn031sex": {
          "x": 47.3,
          "y": 181.9,
          "angleDeg": 90
        },
        "ch_mt7ab2go01q6lh": {
          "x": 344.1,
          "y": 251,
          "angleDeg": 105.3
        },
        "ch_mt7ab2gn027k8h": {
          "x": 212.3,
          "y": 303.5,
          "angleDeg": 178.7
        },
        "ch_mt7ab2gn00puo0": {
          "x": 372,
          "y": 280.5,
          "angleDeg": 134.8
        }
      },
      "balls": {
        "bl_mt7ace5i00yssn": {
          "x": 37.5,
          "y": 327.2
        }
      },
      "ballRings": {
        "bl_mt7ace5i00yssn": "5m"
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mt7aqviy00uwum",
          "x": 219,
          "y": 192.2,
          "text": "수비는 5미터 떨어져야함",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    }
  ],
  "createdAt": 1787578880832,
  "updatedAt": 1787998414813
} satisfies Drill;
