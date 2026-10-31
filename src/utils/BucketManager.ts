export interface SimpleBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BucketManagerOptions {
  maxBucketsPerEntity?: number;
  maxBucketsPerQuery?: number;
}

const DEFAULT_MAX_BUCKETS_PER_ENTITY = 256;
const DEFAULT_MAX_BUCKETS_PER_QUERY = 4096;

type BucketRange = {
  minBx: number;
  minBy: number;
  maxBx: number;
  maxBy: number;
};

export class BucketManager {
  private buckets: Map<string, Set<string>> = new Map();
  private entityToBuckets: Map<string, string[]> = new Map();
  private entityBounds: Map<string, SimpleBounds> = new Map();
  private oversizedEntities: Set<string> = new Set();
  private readonly maxBucketsPerEntity: number;
  private readonly maxBucketsPerQuery: number;
  public bucketSize: number = 256;

  constructor(options: BucketManagerOptions = {}) {
    this.maxBucketsPerEntity = this.normalizeLimit(
      options.maxBucketsPerEntity,
      DEFAULT_MAX_BUCKETS_PER_ENTITY,
    );
    this.maxBucketsPerQuery = this.normalizeLimit(
      options.maxBucketsPerQuery,
      DEFAULT_MAX_BUCKETS_PER_QUERY,
    );
  }

  private getBucketHash(bx: number, by: number): string {
    return `${bx},${by}`;
  }

  public insertOrUpdate(uid: string, bounds: SimpleBounds) {
    const range = this.getBucketRange(bounds);
    if (!range) {
      this.removeEntity(uid);
      return;
    }

    this.entityBounds.set(uid, { ...bounds });
    const oldHashes = this.entityToBuckets.get(uid);
    if (this.exceedsCellLimit(range, this.maxBucketsPerEntity)) {
      if (oldHashes) {
        this.removeFromBucketHashes(uid, oldHashes);
        this.entityToBuckets.delete(uid);
      }
      this.oversizedEntities.add(uid);
      return;
    }

    this.oversizedEntities.delete(uid);

    const newHashes: string[] = [];
    for (let bx = range.minBx; bx <= range.maxBx; bx++) {
      for (let by = range.minBy; by <= range.maxBy; by++) {
        newHashes.push(this.getBucketHash(bx, by));
      }
    }

    if (oldHashes && this.areHashArraysEqual(oldHashes, newHashes)) {
      return;
    }

    if (oldHashes) {
      this.removeFromBucketHashes(uid, oldHashes);
    }

    for (const hash of newHashes) {
      let bucket = this.buckets.get(hash);
      if (!bucket) {
        bucket = new Set<string>();
        this.buckets.set(hash, bucket);
      }
      bucket.add(uid);
    }

    this.entityToBuckets.set(uid, newHashes);
  }

  public removeEntity(uid: string) {
    const oldHashes = this.entityToBuckets.get(uid);
    if (oldHashes) {
      this.removeFromBucketHashes(uid, oldHashes);
      this.entityToBuckets.delete(uid);
    }
    this.entityBounds.delete(uid);
    this.oversizedEntities.delete(uid);
  }

  public clear() {
    this.buckets.clear();
    this.entityToBuckets.clear();
    this.entityBounds.clear();
    this.oversizedEntities.clear();
  }

  public getEntitiesInRect(x: number, y: number, w: number, h: number, outSet?: Set<string>): Set<string> {
    const result = outSet ?? new Set<string>();
    result.clear();

    const queryBounds = { x, y, width: w, height: h };
    const range = this.getBucketRange(queryBounds);
    if (!range) return result;

    if (this.exceedsCellLimit(range, this.maxBucketsPerQuery)) {
      for (const [uid, bounds] of this.entityBounds) {
        if (this.boundsIntersect(bounds, queryBounds)) result.add(uid);
      }
      return result;
    }

    for (let bx = range.minBx; bx <= range.maxBx; bx++) {
      for (let by = range.minBy; by <= range.maxBy; by++) {
        const hash = this.getBucketHash(bx, by);
        const bucket = this.buckets.get(hash);
        if (bucket) {
          for (const uid of bucket) {
            result.add(uid);
          }
        }
      }
    }
    for (const uid of this.oversizedEntities) {
      const bounds = this.entityBounds.get(uid);
      if (bounds && this.boundsIntersect(bounds, queryBounds)) result.add(uid);
    }
    return result;
  }

  // Compatibility methods
  public addEntity(uid: string, xOrBounds: number | SimpleBounds, y?: number, width = 0, height = 0) {
    if (typeof xOrBounds === 'object') {
      this.insertOrUpdate(uid, xOrBounds);
    } else {
      this.insertOrUpdate(uid, { x: xOrBounds, y: y ?? 0, width, height });
    }
  }

  public updateEntityPosition(uid: string, _oldX: number, _oldY: number, newX: number, newY: number) {
    this.insertOrUpdate(uid, { x: newX, y: newY, width: 0, height: 0 });
  }

  public requestBucketMove(uid: string, _oldX: number, _oldY: number, newX: number, newY: number) {
    this.insertOrUpdate(uid, { x: newX, y: newY, width: 0, height: 0 });
  }

  public resolveMoveRequests() {
    // Instant consistency in new architecture; no async queue needed
  }

  private removeFromBucketHashes(uid: string, hashes: string[]) {
    for (const hash of hashes) {
      const bucket = this.buckets.get(hash);
      if (bucket) {
        bucket.delete(uid);
        if (bucket.size === 0) {
          this.buckets.delete(hash);
        }
      }
    }
  }

  private areHashArraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  private normalizeLimit(value: number | undefined, fallback: number) {
    return value !== undefined && Number.isSafeInteger(value) && value > 0 ? value : fallback;
  }

  private getBucketRange(bounds: SimpleBounds): BucketRange | null {
    if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
      || bounds.width < 0
      || bounds.height < 0) {
      return null;
    }
    const right = bounds.x + bounds.width;
    const bottom = bounds.y + bounds.height;
    if (!Number.isFinite(right) || !Number.isFinite(bottom)) return null;
    return {
      minBx: Math.floor(bounds.x / this.bucketSize),
      minBy: Math.floor(bounds.y / this.bucketSize),
      maxBx: Math.floor(right / this.bucketSize),
      maxBy: Math.floor(bottom / this.bucketSize),
    };
  }

  private exceedsCellLimit(range: BucketRange, limit: number) {
    const columns = range.maxBx - range.minBx + 1;
    const rows = range.maxBy - range.minBy + 1;
    return columns > limit || rows > limit || columns > Math.floor(limit / rows);
  }

  private boundsIntersect(left: SimpleBounds, right: SimpleBounds) {
    return left.x <= right.x + right.width
      && left.x + left.width >= right.x
      && left.y <= right.y + right.height
      && left.y + left.height >= right.y;
  }
}

export const bucketManager = new BucketManager();
