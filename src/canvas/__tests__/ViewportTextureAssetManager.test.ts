import { describe, expect, it, vi } from 'vitest';
import { ViewportTextureAssetManager } from '../ViewportTextureAssetManager';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('ViewportTextureAssetManager', () => {
  it('keeps a pending texture alive across a StrictMode-style acquire-cleanup-acquire cycle', async () => {
    const pending = deferred<object>();
    const texture = {};
    const load = vi.fn(() => pending.promise);
    const unload = vi.fn(async () => undefined);
    const manager = new ViewportTextureAssetManager(load, unload);

    const staleGeneration = manager.acquire(['texture.png']);
    const currentGeneration = manager.acquire(['texture.png']);
    pending.resolve(texture);

    const staleLease = await staleGeneration;
    const currentLease = await currentGeneration;
    await staleLease.release();

    expect(load).toHaveBeenCalledTimes(1);
    expect(unload).not.toHaveBeenCalled();
    expect(currentLease.assets.get('texture.png')).toBe(texture);

    await currentLease.release();
    expect(unload).toHaveBeenCalledTimes(1);
  });

  it('cancels a queued unload when the URL is acquired again in the same turn', async () => {
    const texture = {};
    const load = vi.fn(async () => texture);
    const unload = vi.fn(async () => undefined);
    const manager = new ViewportTextureAssetManager(load, unload);
    const firstLease = await manager.acquire(['shared.png']);

    const release = firstLease.release();
    const secondLease = await manager.acquire(['shared.png']);
    await release;

    expect(load).toHaveBeenCalledTimes(1);
    expect(unload).not.toHaveBeenCalled();
    expect(secondLease.assets.get('shared.png')).toBe(texture);

    await secondLease.release();
    expect(unload).toHaveBeenCalledTimes(1);
  });

  it('serializes a new load behind an unload that has already started', async () => {
    const unloadPending = deferred<void>();
    const firstTexture = { generation: 1 };
    const secondTexture = { generation: 2 };
    const load = vi.fn()
      .mockResolvedValueOnce(firstTexture)
      .mockResolvedValueOnce(secondTexture);
    const unload = vi.fn(() => unloadPending.promise);
    const manager = new ViewportTextureAssetManager(load, unload);
    const firstLease = await manager.acquire(['texture.png']);

    const release = firstLease.release();
    await vi.waitFor(() => expect(unload).toHaveBeenCalledTimes(1));
    const nextLeasePromise = manager.acquire(['texture.png']);

    expect(load).toHaveBeenCalledTimes(1);
    unloadPending.resolve();
    await release;

    const nextLease = await nextLeasePromise;
    expect(load).toHaveBeenCalledTimes(2);
    expect(nextLease.assets.get('texture.png')).toBe(secondTexture);
  });

  it('deduplicates shared URLs and releases the source only once', async () => {
    const load = vi.fn(async () => ({}));
    const unload = vi.fn(async () => undefined);
    const manager = new ViewportTextureAssetManager(load, unload);

    const lease = await manager.acquire(['shared.png', 'shared.png']);
    await lease.release();
    await lease.release();

    expect(load).toHaveBeenCalledTimes(1);
    expect(unload).toHaveBeenCalledTimes(1);
  });

  it('settles local load failures without discarding successful textures', async () => {
    const goodTexture = {};
    const load = vi.fn(async (url: string) => {
      if (url === 'broken.png') throw new Error('decode failed');
      return goodTexture;
    });
    const unload = vi.fn(async () => undefined);
    const manager = new ViewportTextureAssetManager(load, unload);

    const lease = await manager.acquire(['good.png', 'broken.png']);

    expect(lease.assets.get('good.png')).toBe(goodTexture);
    expect(lease.errors.get('broken.png')).toEqual(new Error('decode failed'));
    await lease.release();
    expect(unload).toHaveBeenCalledOnce();
    expect(unload).toHaveBeenCalledWith('good.png');
  });
});
