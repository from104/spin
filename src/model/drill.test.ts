// §10.5 직렬화 동치 — structuredClone 과 JSON 왕복이 deep-equal 이어야 한다.
// 이 테스트가 `{...m, [k]: undefined}` 같은 undefined 키 누출을 영구히 막는다(§3.7).
import { describe, expect, it } from 'vitest';
import { newId } from '../core/ids.ts';
import { createDrill } from './defaults.ts';
import { addChair, addCone, addStepAfter, setArrow, setNote } from './edits.ts';

describe('직렬화 동치', () => {
  it('구성 요소가 다양하게 채워진 드릴도 structuredClone 과 JSON 왕복이 원본과 deep-equal 이다', () => {
    let d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    d = addCone(d, 0, { x: 10, y: 10 }, 0);
    d = addCone(d, 0, { x: 20, y: 20 }, 1);
    d = addChair(d, 0, { team: 'home', number: 'X', isGk: false, role: 'DF', name: '보조' }, { x: 5, y: 5, angleDeg: 12.3 });
    d = setArrow(d, 0, {
      id: newId('ar'),
      from: { x: 0, y: 0 },
      ctrl: { x: 1, y: 1 },
      to: { x: 2, y: 2 },
      color: '#abcdef',
    });
    d = setNote(d, 0, { id: newId('nt'), x: 3, y: 4, text: '메모', size: 18, color: '#fff', align: 'end' });
    d = addStepAfter(d, 0);

    const cloned = structuredClone(d);
    const roundtrip = JSON.parse(JSON.stringify(d));

    expect(cloned).toEqual(d);
    expect(roundtrip).toEqual(d);
  });
});
