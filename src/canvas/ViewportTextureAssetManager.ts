export type AssetLoadResult<T> = {
  assets: ReadonlyMap<string, T>;
  errors: ReadonlyMap<string, unknown>;
  release: () => Promise<void>;
};

type AssetEntry<T> = {
  refs: number;
  loadPromise: Promise<T>;
  unloadRequested: boolean;
  unloading: Promise<void> | null;
};

export class ViewportTextureAssetManager<T> {
  private readonly entries = new Map<string, AssetEntry<T>>();

  private readonly loadAsset: (url: string) => Promise<T>;

  private readonly unloadAsset: (url: string) => Promise<void>;

  constructor(
    loadAsset: (url: string) => Promise<T>,
    unloadAsset: (url: string) => Promise<void>,
  ) {
    this.loadAsset = loadAsset;
    this.unloadAsset = unloadAsset;
  }

  async acquire(urls: Iterable<string>): Promise<AssetLoadResult<T>> {
    const uniqueUrls = [...new Set(urls)];
    const settled = await Promise.allSettled(
      uniqueUrls.map(async url => [url, await this.retain(url)] as const),
    );
    const assets = new Map<string, T>();
    const errors = new Map<string, unknown>();

    for (let index = 0; index < settled.length; index++) {
      const result = settled[index];
      if (result.status === 'fulfilled') {
        assets.set(result.value[0], result.value[1]);
      } else {
        errors.set(uniqueUrls[index], result.reason);
      }
    }

    let released = false;
    return {
      assets,
      errors,
      release: async () => {
        if (released) return;
        released = true;
        await Promise.all([...assets.keys()].map(url => this.release(url)));
      },
    };
  }

  private async retain(url: string): Promise<T> {
    let entry = this.entries.get(url);
    if (entry?.unloading) {
      await entry.unloading;
      return this.retain(url);
    }

    if (!entry) {
      entry = {
        refs: 0,
        loadPromise: this.loadAsset(url),
        unloadRequested: false,
        unloading: null,
      };
      this.entries.set(url, entry);
    }

    entry.refs++;
    entry.unloadRequested = false;

    try {
      return await entry.loadPromise;
    } catch (error) {
      entry.refs--;
      if (entry.refs === 0 && this.entries.get(url) === entry) {
        this.entries.delete(url);
      }
      throw error;
    }
  }

  private release(url: string): Promise<void> {
    const entry = this.entries.get(url);
    if (!entry || entry.refs === 0) return Promise.resolve();

    entry.refs--;
    if (entry.refs > 0) return Promise.resolve();

    entry.unloadRequested = true;
    return Promise.resolve().then(() => this.unloadIfUnused(url, entry));
  }

  private async unloadIfUnused(url: string, entry: AssetEntry<T>): Promise<void> {
    if (
      this.entries.get(url) !== entry ||
      entry.refs > 0 ||
      !entry.unloadRequested ||
      entry.unloading
    ) {
      return;
    }

    try {
      await entry.loadPromise;
    } catch {
      if (this.entries.get(url) === entry && entry.refs === 0) {
        this.entries.delete(url);
      }
      return;
    }

    if (this.entries.get(url) !== entry || entry.refs > 0 || !entry.unloadRequested) return;

    entry.unloading = this.unloadAsset(url);
    try {
      await entry.unloading;
    } finally {
      if (this.entries.get(url) === entry) {
        this.entries.delete(url);
      }
    }
  }
}
