import { describe, expect, it } from 'vitest';
import { BucketManager } from '../BucketManager';

describe('BucketManager', () => {
  it('adds and retrieves entities in positive coordinates', () => {
    const bm = new BucketManager();
    bm.addEntity('ent1', 100, 100);
    bm.addEntity('ent2', 1000, 1000);

    const results = bm.getEntitiesInRect(0, 0, 300, 300);
    expect(results.has('ent1')).toBe(true);
    expect(results.has('ent2')).toBe(false);
  });

  it('handles negative coordinates correctly without hash collisions', () => {
    const bm = new BucketManager();
    bm.addEntity('ent-neg', -150, -200);
    bm.addEntity('ent-pos', 150, 200);

    const negResults = bm.getEntitiesInRect(-300, -300, 200, 200);
    expect(negResults.has('ent-neg')).toBe(true);
    expect(negResults.has('ent-pos')).toBe(false);

    const posResults = bm.getEntitiesInRect(0, 0, 300, 300);
    expect(posResults.has('ent-pos')).toBe(true);
    expect(posResults.has('ent-neg')).toBe(false);
  });

  it('handles entities spanning multiple bucket boundaries via bounding boxes', () => {
    const bm = new BucketManager();
    // Entity at (100, 100) with size 400x400 spans across multiple 256px buckets
    bm.insertOrUpdate('big-ent', { x: 100, y: 100, width: 400, height: 400 });

    // Query bucket near (400, 400) where entity origin (100,100) is NOT located
    const edgeResults = bm.getEntitiesInRect(350, 350, 100, 100);
    expect(edgeResults.has('big-ent')).toBe(true);
  });

  it('clears all entities when clear() is called', () => {
    const bm = new BucketManager();
    bm.addEntity('ent1', 50, 50);
    bm.clear();

    const results = bm.getEntitiesInRect(0, 0, 200, 200);
    expect(results.size).toBe(0);
  });

  it('updates entity location on position change', () => {
    const bm = new BucketManager();
    bm.addEntity('ent1', 0, 0);
    bm.updateEntityPosition('ent1', 0, 0, 1000, 1000);

    const oldPosResults = bm.getEntitiesInRect(-100, -100, 200, 200);
    expect(oldPosResults.has('ent1')).toBe(false);

    const newPosResults = bm.getEntitiesInRect(900, 900, 200, 200);
    expect(newPosResults.has('ent1')).toBe(true);
  });

  it('queries oversized entities without indexing every covered bucket', () => {
    const bm = new BucketManager({ maxBucketsPerEntity: 2 });
    bm.insertOrUpdate('oversized', { x: 0, y: 0, width: 1000, height: 1000 });

    expect(bm.getEntitiesInRect(900, 900, 20, 20)).toEqual(new Set(['oversized']));
    expect(bm.getEntitiesInRect(1100, 1100, 20, 20)).toEqual(new Set());
  });

  it('moves entities between regular and oversized indexing without stale entries', () => {
    const bm = new BucketManager({ maxBucketsPerEntity: 2 });
    bm.insertOrUpdate('moving', { x: 0, y: 0, width: 10, height: 10 });
    bm.insertOrUpdate('moving', { x: 1000, y: 1000, width: 1000, height: 1000 });

    expect(bm.getEntitiesInRect(0, 0, 20, 20)).toEqual(new Set());
    expect(bm.getEntitiesInRect(1500, 1500, 20, 20)).toEqual(new Set(['moving']));

    bm.insertOrUpdate('moving', { x: -100, y: -100, width: 10, height: 10 });
    expect(bm.getEntitiesInRect(1500, 1500, 20, 20)).toEqual(new Set());
    expect(bm.getEntitiesInRect(-110, -110, 20, 20)).toEqual(new Set(['moving']));

    bm.removeEntity('moving');
    expect(bm.getEntitiesInRect(-110, -110, 20, 20)).toEqual(new Set());
  });

  it('falls back to an exact bounds scan for queries spanning too many buckets', () => {
    const bm = new BucketManager({ maxBucketsPerQuery: 2 });
    bm.insertOrUpdate('inside', { x: 100, y: 100, width: 10, height: 10 });
    bm.insertOrUpdate('outside', { x: 2000, y: 2000, width: 10, height: 10 });

    expect(bm.getEntitiesInRect(0, 0, 1000, 1000)).toEqual(new Set(['inside']));
  });

  it('clears a reused output set and rejects invalid bounds and queries', () => {
    const bm = new BucketManager();
    const output = new Set(['stale']);
    bm.insertOrUpdate('invalid', { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 10 });
    bm.insertOrUpdate('valid', { x: 0, y: 0, width: 10, height: 10 });

    expect(bm.getEntitiesInRect(0, 0, -1, 10, output)).toBe(output);
    expect(output).toEqual(new Set());
    expect(bm.getEntitiesInRect(0, 0, 20, 20, output)).toEqual(new Set(['valid']));

    bm.insertOrUpdate('valid', { x: Number.NaN, y: 0, width: 10, height: 10 });
    expect(bm.getEntitiesInRect(0, 0, 20, 20)).toEqual(new Set());
  });
});
