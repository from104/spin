// 앱 전용 시나리오 — Tauri 명령·네이티브 창·프로세스·디스크 프로필(e2e/app/native.ts). docs/PLAN-TEST-SUITE.md §11.
import native from './native.ts';
import { runGroup } from './run.ts';

runGroup(native);
