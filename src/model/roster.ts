// 로스터 — 팀 선수 명단 (2026-08-18 구조 개편, 질문 20문 ⑬·⑰: 단일 팀).
//
// **왜 단일 문서인가**: 팀은 하나(질문 ⑰)라 목록 쿼리·인덱스가 필요 없다. 그래서 저장도
// 새 IDB 스토어가 아니라 meta 스토어의 레코드 하나다(storage/rosterRepo.ts) — 스토어를 파면
// DB_VERSION 상승 + onupgradeneeded + 멀티탭 blocked 처리가 따라오는데 문서 하나에 과하다.
//
// **PF 클래스**: 파워체어 풋볼의 선수 분류(PF1 중증 / PF2 경증). 경기 규정상 PF2 는 동시
// 출전 최대 2명이라(FIPFA Laws — 위반 시 페널티) 세션 참가자·라인업 구성의 실질 제약이다.
// optional 인 이유: 분류 심사를 아직 안 받은 선수가 현실에 흔하다 — 없음 = 미분류.
import type { PlayerId } from '../core/ids.ts';
import { newId } from '../core/ids.ts';

export const CURRENT_ROSTER_SCHEMA = 1;

export const PF_CLASSES = ['PF1', 'PF2'] as const;
export type PFClass = (typeof PF_CLASSES)[number];

export interface Player {
  id: PlayerId;
  name: string; // ≤40자 (LIMITS.playerNameLen)
  klass?: PFClass; // 없음 = 미분류
  createdAt: number;
  updatedAt: number;
}

export interface Roster {
  schemaVersion: number;
  players: Player[]; // ≤30명 (LIMITS.rosterMax)
  updatedAt: number;
}

export function emptyRoster(): Roster {
  return { schemaVersion: CURRENT_ROSTER_SCHEMA, players: [], updatedAt: 0 };
}

// ── 순수 편집 헬퍼 — 설정 화면(3차)과 세션 참가자 체크가 같은 함수를 쓴다 ──────────────────

export function addPlayer(r: Roster, name: string, klass?: PFClass): Roster {
  const now = Date.now();
  const p: Player = { id: newId('pl'), name, ...(klass !== undefined ? { klass } : {}), createdAt: now, updatedAt: now };
  return { ...r, players: [...r.players, p], updatedAt: now };
}

export function updatePlayer(r: Roster, id: PlayerId, patch: Partial<Pick<Player, 'name' | 'klass'>>): Roster {
  const now = Date.now();
  return {
    ...r,
    players: r.players.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now } : p)),
    updatedAt: now,
  };
}

export function removePlayer(r: Roster, id: PlayerId): Roster {
  return { ...r, players: r.players.filter((p) => p.id !== id), updatedAt: Date.now() };
}
