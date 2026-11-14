// S2 — 시나리오 정본은 e2e/scenarios/prerender.ts. 스펙은 실행기에 넘기기만 한다(그룹당 3줄).
import group from '../scenarios/prerender.ts';
import { runGroup } from './run.ts';

runGroup(group);
