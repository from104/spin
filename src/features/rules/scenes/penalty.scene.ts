// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "2-7 패널티킥"(schemaVersion 10(2026-09-03 v10 도장; 원본은 9), 2스텝,
// half/30x18). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
// ⚠️ 교정 1건: `situation` 을 direct-fk → penalty 로 바꿔 찍었다. 편집기에서 상황을
// 잘못 고른 채 저장된 값이고, 스키마(model/drill.ts DRILL_SITUATIONS)에 옳은 값이 이미 있다.
// **고친 것은 이 임베드 사본뿐이다 — 기현님 라이브러리의 원본 드릴은 건드리지 않았다.**
// 좌표·노트·타이밍은 한 글자도 바뀌지 않았다(스크립트가 `situation` 말고는 갈지 못한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/penalty.scene.ts --title '2-7 패널티킥' --situation penalty
//   드리프트 검사: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/penalty.scene.ts --title '2-7 패널티킥' --situation penalty --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 10,
  "id": "dr_mtd7x51y00yjl1",
  "title": "2-7 패널티킥",
  "drillType": "game-scenario",
  "situation": "penalty",
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
        "id": "ch_mtbs101200rkeh",
        "team": "home",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mtbs101201gg4h",
        "team": "home",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mtbs101202q4bj",
        "team": "home",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mtbs101203aahx",
        "team": "home",
        "number": "4",
        "isGk": false
      },
      {
        "id": "ch_mtbs101204kgae",
        "team": "away",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mtbs1012059zh3",
        "team": "away",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mtbs101206lip2",
        "team": "away",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mtbs101207yzuz",
        "team": "away",
        "number": "4",
        "isGk": false
      }
    ],
    "balls": [
      {
        "id": "bl_mtc4clez00w1wp"
      }
    ],
    "cones": []
  },
  "steps": [
    {
      "id": "st_mtbs1012098be8",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtbs101204kgae": {
          "x": 275.7,
          "y": 427.9,
          "angleDeg": -179.1
        },
        "ch_mtbs1012059zh3": {
          "x": 299.9,
          "y": 159.9,
          "angleDeg": 74.3
        },
        "ch_mtbs101201gg4h": {
          "x": 250.1,
          "y": 301.3,
          "angleDeg": 14.2
        },
        "ch_mtbs101206lip2": {
          "x": 116.4,
          "y": 248.2,
          "angleDeg": 64.4
        },
        "ch_mtbs101207yzuz": {
          "x": 438.2,
          "y": 248.2,
          "angleDeg": 143
        },
        "ch_mtbs101200rkeh": {
          "x": 250.1,
          "y": 159.9,
          "angleDeg": 72.8
        },
        "ch_mtbs101203aahx": {
          "x": 128.9,
          "y": 216.7,
          "angleDeg": 55.4
        },
        "ch_mtbs101202q4bj": {
          "x": 397.5,
          "y": 218.8,
          "angleDeg": 39.2
        }
      },
      "balls": {
        "bl_mtc4clez00w1wp": {
          "x": 262.5,
          "y": 325
        }
      },
      "cones": {},
      "arrows": [
        {
          "id": "ar_mtdkg9vn004obq",
          "from": {
            "x": 44.56080588622201,
            "y": 287.13137214349626
          },
          "ctrl": {
            "x": 263.4263040826357,
            "y": 286.5970355793488
          },
          "to": {
            "x": 486.24755728412924,
            "y": 287.0452817692954
          },
          "headTo": "none"
        }
      ],
      "notes": [
        {
          "id": "nt_mtd24j1o00jfei",
          "x": 280.3591556531772,
          "y": 106.07635806472996,
          "text": "키커와 골리를 제외한 선수들은 5미터 떨어져 있어야하고 골에리어 뒤에 있어야한다. ",
          "size": 14,
          "color": "#fde047"
        },
        {
          "id": "nt_mtd84ffi00fqnq",
          "x": 399.76751346649473,
          "y": 375.9569429713983,
          "text": "골리는 골라인 뒤에서 키커가 차기 전까지 움직이면 안 된다.",
          "size": 14,
          "color": "#ef4444"
        }
      ],
      "shapes": [],
      "ballRings": {
        "bl_mtc4clez00w1wp": "5m"
      },
      "ballOwner": {
        "bl_mtc4clez00w1wp": "home"
      }
    },
    {
      "id": "st_mtdkn0gn00p7is",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtbs101204kgae": {
          "x": 250.1,
          "y": 421.4,
          "angleDeg": -162.2
        },
        "ch_mtbs1012059zh3": {
          "x": 299.9,
          "y": 159.9,
          "angleDeg": 74.3
        },
        "ch_mtbs101201gg4h": {
          "x": 250.1,
          "y": 301.3,
          "angleDeg": 124.2
        },
        "ch_mtbs101206lip2": {
          "x": 128.9,
          "y": 278.5,
          "angleDeg": 64.4
        },
        "ch_mtbs101207yzuz": {
          "x": 438.2,
          "y": 248.2,
          "angleDeg": 143
        },
        "ch_mtbs101200rkeh": {
          "x": 250.1,
          "y": 159.9,
          "angleDeg": 72.8
        },
        "ch_mtbs101203aahx": {
          "x": 128.9,
          "y": 218.8,
          "angleDeg": 55.4
        },
        "ch_mtbs101202q4bj": {
          "x": 397.5,
          "y": 218.8,
          "angleDeg": 39.2
        }
      },
      "balls": {
        "bl_mtc4clez00w1wp": {
          "x": 199.7,
          "y": 427.9
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtd24j1o00jfei",
          "x": 280.3591556531772,
          "y": 106.07635806472996,
          "text": "키커와 골리를 제외한 선수들은 5미터 떨어져 있어야하고 골에리어 뒤에 있어야한다. ",
          "size": 14,
          "color": "#fde047"
        },
        {
          "id": "nt_mtd84ffi00fqnq",
          "x": 399.76751346649473,
          "y": 375.9569429713983,
          "text": "골리는 골라인 뒤에서 키커가 차기 전까지 움직이면 안 된다.",
          "size": 14,
          "color": "#ef4444"
        }
      ],
      "shapes": []
    }
  ],
  "createdAt": 1787937661654,
  "updatedAt": 1787959213727
} satisfies Drill;
