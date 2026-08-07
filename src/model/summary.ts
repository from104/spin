// §3.11 목록 요약. 저장 시 이 요약만 IDB summaries 스토어에 두고, 본문(Drill)은 필요할 때만 연다.
// 요약 필드 호환 규약: 필드는 추가만 가능 — 제거·의미변경이 필요하면 SUMMARY_BUILD 가 아니라
// DB_VERSION 을 올려 스토어를 새로 만든다.
import type { Drill, TeamSide, TeamStyle, DrillLevel } from './drill.ts';
import type { DrillId } from '../core/ids.ts';
import type { CourtMode } from './court.ts';
import { buildThumb, type ThumbSpec } from './thumb.ts';

export const SUMMARY_BUILD = 1;
export interface DrillSummary {
  id: DrillId;
  build: number; // = SUMMARY_BUILD. 레코드별 버전(전역 스윕 금지)
  title: string;
  category: string;
  level: DrillLevel;
  durationMin: number;
  tags: string[];
  courtMode: CourtMode;
  stepCount: number;
  createdAt: number;
  updatedAt: number;
  teams: Record<TeamSide, TeamStyle>; // 썸네일이 색을 여기서 읽는다
  thumb: ThumbSpec;
  searchKey: string;
  corrupt?: true; // 본문이 손상돼 열 수 없는 레코드(§4.4)
}

function buildSearchKey(d: Drill): string {
  return [d.title, d.category, d.formation, ...d.tags].join(' ').toLowerCase();
}

export function buildSummary(d: Drill): DrillSummary {
  return {
    id: d.id,
    build: SUMMARY_BUILD,
    title: d.title,
    category: d.category,
    level: d.level,
    durationMin: d.durationMin,
    tags: d.tags.slice(),
    courtMode: d.courtMode,
    stepCount: d.steps.length,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    teams: structuredClone(d.teams),
    thumb: buildThumb(d),
    searchKey: buildSearchKey(d),
  };
}
