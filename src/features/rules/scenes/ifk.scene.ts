// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "2-6 간접FK"(schemaVersion 11(2026-09-06 v11 도장; 원본은 9), 3스텝,
// half/30x18). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
// ⚠️ 교정 1건: `situation` 을 direct-fk → indirect-fk 로 바꿔 찍었다. 편집기에서 상황을
// 잘못 고른 채 저장된 값이고, 스키마(model/drill.ts DRILL_SITUATIONS)에 옳은 값이 이미 있다.
// **고친 것은 이 임베드 사본뿐이다 — 기현님 라이브러리의 원본 드릴은 건드리지 않았다.**
// 좌표·노트·타이밍은 한 글자도 바뀌지 않았다(스크립트가 `situation` 말고는 갈지 못한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/ifk.scene.ts --title '2-6 간접FK' --situation indirect-fk
//   드리프트 검사: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/ifk.scene.ts --title '2-6 간접FK' --situation indirect-fk --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 11,
  "id": "dr_mtd7g4nw00sdjq",
  "title": "2-6 간접FK",
  "drillType": "game-scenario",
  "situation": "indirect-fk",
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
          "x": 321.2,
          "y": 427.5,
          "angleDeg": -179.1
        },
        "ch_mtbs1012059zh3": {
          "x": 220.9,
          "y": 401.7,
          "angleDeg": -142.4
        },
        "ch_mtbs101201gg4h": {
          "x": 321.2,
          "y": 265.1,
          "angleDeg": 61.6
        },
        "ch_mtbs101206lip2": {
          "x": 127.2,
          "y": 235.3,
          "angleDeg": -28.4
        },
        "ch_mtbs101207yzuz": {
          "x": 419.3,
          "y": 370,
          "angleDeg": -55
        },
        "ch_mtbs101200rkeh": {
          "x": 197.3,
          "y": 65.1,
          "angleDeg": 140.2
        },
        "ch_mtbs101203aahx": {
          "x": 250.2,
          "y": 265.1,
          "angleDeg": 120.8
        },
        "ch_mtbs101202q4bj": {
          "x": 394.7,
          "y": 111.9,
          "angleDeg": 39.2
        }
      },
      "balls": {
        "bl_mtc4clez00w1wp": {
          "x": 307.5,
          "y": 287.5
        }
      },
      "ballRings": {
        "bl_mtc4clez00w1wp": "5m"
      },
      "ballOwner": {
        "bl_mtc4clez00w1wp": "home"
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtd24j1o00jfei",
          "x": 344.7,
          "y": 227.9,
          "text": "수비수는 5미터 떨어져 있어야하고",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mtd7meya00xese",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtbs101204kgae": {
          "x": 321.2,
          "y": 427.5,
          "angleDeg": -179.1
        },
        "ch_mtbs1012059zh3": {
          "x": 220.9,
          "y": 401.7,
          "angleDeg": -142.4
        },
        "ch_mtbs101201gg4h": {
          "x": 321.2,
          "y": 265.1,
          "angleDeg": 130.4
        },
        "ch_mtbs101206lip2": {
          "x": 127.2,
          "y": 235.3,
          "angleDeg": -28.4
        },
        "ch_mtbs101207yzuz": {
          "x": 419.3,
          "y": 370,
          "angleDeg": -55
        },
        "ch_mtbs101200rkeh": {
          "x": 197.3,
          "y": 65.1,
          "angleDeg": 140.2
        },
        "ch_mtbs101203aahx": {
          "x": 250.2,
          "y": 265.1,
          "angleDeg": 120.8
        },
        "ch_mtbs101202q4bj": {
          "x": 394.7,
          "y": 111.9,
          "angleDeg": 39.2
        }
      },
      "balls": {
        "bl_mtc4clez00w1wp": {
          "x": 260.7,
          "y": 287.5
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtd24j1o00jfei",
          "x": 344.7,
          "y": 227.9,
          "text": "5미터 떨어져 있어야하고",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mtd7no6401a4vi",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtbs101204kgae": {
          "x": 308.2,
          "y": 427.5,
          "angleDeg": -179.1
        },
        "ch_mtbs1012059zh3": {
          "x": 229.1,
          "y": 412.5,
          "angleDeg": -142.4
        },
        "ch_mtbs101201gg4h": {
          "x": 321.2,
          "y": 265.1,
          "angleDeg": 130.4
        },
        "ch_mtbs101206lip2": {
          "x": 127.2,
          "y": 235.3,
          "angleDeg": -28.4
        },
        "ch_mtbs101207yzuz": {
          "x": 419.3,
          "y": 370,
          "angleDeg": -55
        },
        "ch_mtbs101200rkeh": {
          "x": 197.3,
          "y": 65.1,
          "angleDeg": 140.2
        },
        "ch_mtbs101203aahx": {
          "x": 250.2,
          "y": 265.1,
          "angleDeg": 120.8
        },
        "ch_mtbs101202q4bj": {
          "x": 394.7,
          "y": 111.9,
          "angleDeg": 39.2
        }
      },
      "balls": {
        "bl_mtc4clez00w1wp": {
          "x": 256.7,
          "y": 427.5
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtd24j1o00jfei",
          "x": 344.7,
          "y": 227.9,
          "text": "5미터 떨어져 있어야하고",
          "size": 14,
          "color": "#fde047"
        },
        {
          "id": "nt_mtd7ou8900pyvd",
          "x": 100,
          "y": 329.5,
          "text": "우리편이든 상대편이든 거져야 득점 인정",
          "size": 14,
          "color": "#ef4444"
        },
        {
          "id": "nt_mtd7smjs00zb2c",
          "x": 88.5,
          "y": 393.8,
          "text": "그대로 골라인을 통과하거나 골대나 심판을 맞고 골라인을 넘으면 무효(상대에게 골킥).",
          "size": 14,
          "color": "#ef4444"
        }
      ],
      "shapes": []
    }
  ],
  "createdAt": 1787936867996,
  "updatedAt": 1788014569553
} satisfies Drill;
