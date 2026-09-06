// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "2-4 골킥"(schemaVersion 11(2026-09-06 v11 도장; 원본은 9), 4스텝,
// half/30x18). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/goal-kick.scene.ts --title '2-4 골킥'
//   드리프트 검사: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/goal-kick.scene.ts --title '2-4 골킥' --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 11,
  "id": "dr_gkick00000001",
  "title": "2-4 골킥",
  "drillType": "game-scenario",
  "situation": "goal-kick",
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
        "id": "ch_gkick0home0gk",
        "team": "home",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_gkick0home02",
        "team": "home",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_gkick0home03",
        "team": "home",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_gkick0home04",
        "team": "home",
        "number": "4",
        "isGk": false
      },
      {
        "id": "ch_gkick0away0gk",
        "team": "away",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_gkick0away02",
        "team": "away",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_gkick0away03",
        "team": "away",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_gkick0away04",
        "team": "away",
        "number": "4",
        "isGk": false
      }
    ],
    "balls": [
      {
        "id": "bl_gkick0ball001"
      }
    ],
    "cones": []
  },
  "steps": [
    {
      "id": "st_gkick00000000",
      "name": "",
      "note": "",
      "chairs": {
        "ch_gkick0home0gk": {
          "x": 201.5,
          "y": 76.9,
          "angleDeg": 50.5
        },
        "ch_gkick0home02": {
          "x": 362.5,
          "y": 305.5,
          "angleDeg": 64.1
        },
        "ch_gkick0home03": {
          "x": 270.3,
          "y": 160.1,
          "angleDeg": 86.5
        },
        "ch_gkick0home04": {
          "x": 156,
          "y": 300.4,
          "angleDeg": 78.4
        },
        "ch_gkick0away0gk": {
          "x": 320.5,
          "y": 341.3,
          "angleDeg": 48
        },
        "ch_gkick0away02": {
          "x": 257.7,
          "y": 389.4,
          "angleDeg": 40.2
        },
        "ch_gkick0away03": {
          "x": 430.7,
          "y": 305.5,
          "angleDeg": 98.9
        },
        "ch_gkick0away04": {
          "x": 257.7,
          "y": 213.6,
          "angleDeg": 4.9
        }
      },
      "balls": {
        "bl_gkick0ball001": {
          "x": 374.8,
          "y": 339.5
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_gkick16896",
          "x": 84.8,
          "y": 140,
          "text": "공격이 마지막으로 만진 공이\n골라인을 완전히 넘으면 골킥",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mtammx0501l5v1",
      "name": "",
      "note": "",
      "chairs": {
        "ch_gkick0home0gk": {
          "x": 214.9,
          "y": 91.1,
          "angleDeg": 49.2
        },
        "ch_gkick0home02": {
          "x": 377.6,
          "y": 340,
          "angleDeg": 64.1
        },
        "ch_gkick0home03": {
          "x": 271.6,
          "y": 195.5,
          "angleDeg": 91.3
        },
        "ch_gkick0home04": {
          "x": 162.5,
          "y": 318.8,
          "angleDeg": 78.4
        },
        "ch_gkick0away0gk": {
          "x": 337.4,
          "y": 370.2,
          "angleDeg": 48
        },
        "ch_gkick0away02": {
          "x": 271.6,
          "y": 399.7,
          "angleDeg": 27.6
        },
        "ch_gkick0away03": {
          "x": 437.7,
          "y": 340,
          "angleDeg": 98.9
        },
        "ch_gkick0away04": {
          "x": 307.3,
          "y": 225.8,
          "angleDeg": 42.2
        }
      },
      "balls": {
        "bl_gkick0ball001": {
          "x": 419,
          "y": 423.4
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_gkick16896",
          "x": 84.8,
          "y": 140,
          "text": "공격이 마지막으로 만진 공이\n골라인을 완전히 넘으면 골킥",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_gkick00000003",
      "name": "",
      "note": "",
      "chairs": {
        "ch_gkick0home0gk": {
          "x": 409.5,
          "y": 30.3,
          "angleDeg": 124.7
        },
        "ch_gkick0home02": {
          "x": 119.4,
          "y": 162.5,
          "angleDeg": 41.5
        },
        "ch_gkick0home03": {
          "x": 325.1,
          "y": 104.1,
          "angleDeg": -154.9
        },
        "ch_gkick0home04": {
          "x": 445.4,
          "y": 221.3,
          "angleDeg": 125.2
        },
        "ch_gkick0away0gk": {
          "x": 304.7,
          "y": 294.8,
          "angleDeg": 137.8
        },
        "ch_gkick0away02": {
          "x": 151.2,
          "y": 221.3,
          "angleDeg": 33.4
        },
        "ch_gkick0away03": {
          "x": 297.5,
          "y": 138.1,
          "angleDeg": 80.7
        },
        "ch_gkick0away04": {
          "x": 417.9,
          "y": 272.7,
          "angleDeg": -178.5
        }
      },
      "balls": {
        "bl_gkick0ball001": {
          "x": 279.8,
          "y": 287.5
        }
      },
      "ballRings": {
        "bl_gkick0ball001": "5m"
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_gkick8192",
          "x": 64,
          "y": 128,
          "text": "에어리어를 완전히 벗어나는\n순간 인플레이",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": [],
      "cut": true,
      "ballOwner": {
        "bl_gkick0ball001": "away"
      }
    },
    {
      "id": "st_mta5jchr01pipm",
      "name": "",
      "note": "",
      "chairs": {
        "ch_gkick0home0gk": {
          "x": 432.7,
          "y": 37.5,
          "angleDeg": -109.4
        },
        "ch_gkick0home02": {
          "x": 132.1,
          "y": 167.5,
          "angleDeg": -48.8
        },
        "ch_gkick0home03": {
          "x": 280.4,
          "y": 71.6,
          "angleDeg": -159.9
        },
        "ch_gkick0home04": {
          "x": 440.8,
          "y": 201.9,
          "angleDeg": 125.2
        },
        "ch_gkick0away0gk": {
          "x": 307.5,
          "y": 287.5,
          "angleDeg": -173.5
        },
        "ch_gkick0away02": {
          "x": 151.9,
          "y": 201.9,
          "angleDeg": 33.4
        },
        "ch_gkick0away03": {
          "x": 280.4,
          "y": 158.9,
          "angleDeg": 80.7
        },
        "ch_gkick0away04": {
          "x": 405.2,
          "y": 299.9,
          "angleDeg": -178.5
        }
      },
      "balls": {
        "bl_gkick0ball001": {
          "x": 198.3,
          "y": 224.4
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_gkick8192",
          "x": 64,
          "y": 128,
          "text": "에어리어를 완전히 벗어나는\n순간 인플레이",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    }
  ],
  "createdAt": 1787700000000,
  "updatedAt": 1787781215019
} satisfies Drill;
