import { describe, expect, it } from 'vitest';
import { matterVToPxPerS, pxPerSToMatterV } from './units.ts';

describe('units', () => {
  it('pxPerSToMatterV(420) === 7', () => {
    expect(pxPerSToMatterV(420)).toBe(7);
  });
  it('matterVToPxPerS(5) === 300', () => {
    expect(matterVToPxPerS(5)).toBe(300);
  });
});
