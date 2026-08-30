// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "2-3 코너킥"(schemaVersion 9, 5스텝,
// half/30x18). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/corner.scene.ts --title '2-3 코너킥'
//   드리프트 검사: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/corner.scene.ts --title '2-3 코너킥' --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 9,
  "id": "dr_mt7b6hq000e3pk",
  "title": "2-3 코너킥",
  "drillType": "game-scenario",
  "situation": "corner",
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
        "id": "bl_mt7b1hp1008xtf"
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
        "ch_mt7ab2gn00puo0": {
          "x": 114.6,
          "y": 106.4,
          "angleDeg": -161.5
        },
        "ch_mt7ab2gn027k8h": {
          "x": 125.4,
          "y": 276.8,
          "angleDeg": 54
        },
        "ch_mt7ab2gn01gd8g": {
          "x": 362.5,
          "y": 287.5,
          "angleDeg": 54.2
        },
        "ch_mt7ab2gn031sex": {
          "x": 271.6,
          "y": 136.1,
          "angleDeg": 90
        },
        "ch_mt7ab2gn04zfmu": {
          "x": 322.7,
          "y": 356.3,
          "angleDeg": -158
        },
        "ch_mt7ab2gn05gr8o": {
          "x": 249.2,
          "y": 391.1,
          "angleDeg": -166.7
        },
        "ch_mt7ab2go004uu4": {
          "x": 347.8,
          "y": 240.3,
          "angleDeg": 128.7
        },
        "ch_mt7ab2go01q6lh": {
          "x": 181,
          "y": 245.2,
          "angleDeg": 88.4
        }
      },
      "balls": {
        "bl_mt7b1hp1008xtf": {
          "x": 347.8,
          "y": 311.8
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [],
      "shapes": []
    },
    {
      "id": "st_mt7b8ib90118zh",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mt7ab2gn00puo0": {
          "x": 114.6,
          "y": 106.4,
          "angleDeg": -161.5
        },
        "ch_mt7ab2gn027k8h": {
          "x": 139.8,
          "y": 304.4,
          "angleDeg": 54
        },
        "ch_mt7ab2gn01gd8g": {
          "x": 362.5,
          "y": 287.5,
          "angleDeg": 147.1
        },
        "ch_mt7ab2gn031sex": {
          "x": 271.6,
          "y": 136.1,
          "angleDeg": 90
        },
        "ch_mt7ab2gn04zfmu": {
          "x": 256.6,
          "y": 357.2,
          "angleDeg": -174.5
        },
        "ch_mt7ab2gn05gr8o": {
          "x": 232.8,
          "y": 391.1,
          "angleDeg": -166.7
        },
        "ch_mt7ab2go004uu4": {
          "x": 347.8,
          "y": 240.3,
          "angleDeg": 128.7
        },
        "ch_mt7ab2go01q6lh": {
          "x": 181,
          "y": 245.2,
          "angleDeg": 88.4
        }
      },
      "balls": {
        "bl_mt7b1hp1008xtf": {
          "x": 162.5,
          "y": 331.4
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [],
      "shapes": []
    },
    {
      "id": "st_mt7b9tob010kks",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mt7ab2gn00puo0": {
          "x": 114.6,
          "y": 106.4,
          "angleDeg": -161.5
        },
        "ch_mt7ab2gn027k8h": {
          "x": 144.5,
          "y": 310.8,
          "angleDeg": 54
        },
        "ch_mt7ab2gn01gd8g": {
          "x": 362.5,
          "y": 287.5,
          "angleDeg": 147.1
        },
        "ch_mt7ab2gn031sex": {
          "x": 271.6,
          "y": 136.1,
          "angleDeg": 90
        },
        "ch_mt7ab2gn04zfmu": {
          "x": 225,
          "y": 354.1,
          "angleDeg": -174.5
        },
        "ch_mt7ab2gn05gr8o": {
          "x": 225,
          "y": 389.8,
          "angleDeg": -166.7
        },
        "ch_mt7ab2go004uu4": {
          "x": 347.8,
          "y": 240.3,
          "angleDeg": 128.7
        },
        "ch_mt7ab2go01q6lh": {
          "x": 181,
          "y": 245.2,
          "angleDeg": 88.4
        }
      },
      "balls": {
        "bl_mt7b1hp1008xtf": {
          "x": 189.2,
          "y": 372.2
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [],
      "shapes": []
    },
    {
      "id": "st_mt7banja01dwh4",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mt7ab2gn00puo0": {
          "x": 114.6,
          "y": 106.4,
          "angleDeg": -161.5
        },
        "ch_mt7ab2gn027k8h": {
          "x": 147.8,
          "y": 322.5,
          "angleDeg": 54
        },
        "ch_mt7ab2gn01gd8g": {
          "x": 362.5,
          "y": 287.5,
          "angleDeg": 147.1
        },
        "ch_mt7ab2gn031sex": {
          "x": 271.6,
          "y": 136.1,
          "angleDeg": 90
        },
        "ch_mt7ab2gn04zfmu": {
          "x": 194.4,
          "y": 363.9,
          "angleDeg": -174.5
        },
        "ch_mt7ab2gn05gr8o": {
          "x": 194,
          "y": 391,
          "angleDeg": 175.9
        },
        "ch_mt7ab2go004uu4": {
          "x": 347.8,
          "y": 240.3,
          "angleDeg": 128.7
        },
        "ch_mt7ab2go01q6lh": {
          "x": 181,
          "y": 245.2,
          "angleDeg": 88.4
        }
      },
      "balls": {
        "bl_mt7b1hp1008xtf": {
          "x": 131.8,
          "y": 426.6
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [],
      "shapes": []
    },
    {
      "id": "st_mtalpwj4008xwr",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mt7ab2gn00puo0": {
          "x": 320.3,
          "y": 165.4,
          "angleDeg": 107.6
        },
        "ch_mt7ab2gn027k8h": {
          "x": 37.5,
          "y": 407.4,
          "angleDeg": 66.5
        },
        "ch_mt7ab2gn01gd8g": {
          "x": 148.9,
          "y": 303,
          "angleDeg": 48.3
        },
        "ch_mt7ab2gn031sex": {
          "x": 356.2,
          "y": 287.5,
          "angleDeg": 128.3
        },
        "ch_mt7ab2gn04zfmu": {
          "x": 195.9,
          "y": 427.1,
          "angleDeg": 0.8
        },
        "ch_mt7ab2gn05gr8o": {
          "x": 227.3,
          "y": 407.4,
          "angleDeg": -88.2
        },
        "ch_mt7ab2go004uu4": {
          "x": 387.8,
          "y": 247.4,
          "angleDeg": 128.7
        },
        "ch_mt7ab2go01q6lh": {
          "x": 162.5,
          "y": 247.4,
          "angleDeg": 88.4
        }
      },
      "balls": {
        "bl_mt7b1hp1008xtf": {
          "x": 62.5,
          "y": 412.5
        }
      },
      "ballRings": {
        "bl_mt7b1hp1008xtf": "5m"
      },
      "ballOwner": {
        "bl_mt7b1hp1008xtf": "home"
      },
      "cones": {},
      "arrows": [
        {
          "id": "ar_mta9647y00ha26",
          "from": {
            "x": 75.52662033411276,
            "y": 404.0978045347031
          },
          "ctrl": {
            "x": 193.69079071242896,
            "y": 345.3398381042608
          },
          "to": {
            "x": 311.8549610907452,
            "y": 286.5818716738185
          },
          "headTo": "wide"
        }
      ],
      "notes": [
        {
          "id": "nt_mt7bmx7700f0fw",
          "x": 39.1,
          "y": 329.6,
          "text": "코너 삼각형 아무곳에 놓고 시작",
          "size": 14,
          "color": "#fde047"
        },
        {
          "id": "nt_mt7bung6000hef",
          "x": 388.8,
          "y": 415.9,
          "text": "골키퍼는 골대사이 골라인을 완전히 넘어가 위치해야함",
          "size": 14,
          "color": "#fde047"
        },
        {
          "id": "nt_mt7c10b200xpsg",
          "x": 276.4,
          "y": 342.3,
          "text": "골대 안의 수비수는 골대 안쪽 1미터 밖의 선을 벗어나야함.",
          "size": 14,
          "color": "#fde047"
        },
        {
          "id": "nt_mt7upj540067z4",
          "x": 127,
          "y": 224.9,
          "text": "골대 밖의 수비수는 5미터 이상 떨어져야함.",
          "size": 14,
          "color": "#ffffff"
        }
      ],
      "shapes": [],
      "cut": true
    }
  ],
  "createdAt": 1787580339768,
  "updatedAt": 1788014291464
} satisfies Drill;
