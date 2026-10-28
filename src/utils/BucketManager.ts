export interface SimpleBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class BucketManager {
  private buckets: Map<string, Set<string>> = new Map();
  private entityToBuckets: Map<string, string[]> = new Map();
  public bucketSize: number = 256;

  private getBucketHash(bx: number, by: number): string {
    return `${bx},${by}`;
  }

  public insertOrUpdate(uid: string, bounds: SimpleBounds) {
    const minBx = Math.floor(bounds.x / this.bucketSize);
    const minBy = Math.floor(bounds.y / this.bucketSize);
    const maxBx = Math.floor((bounds.x + bounds.width) / this.bucketSize);
    const maxBy = Math.floor((bounds.y + bounds.height) / this.bucketSize);

    const newHashes: string[] = [];
    for (let bx = minBx; bx <= maxBx; bx++) {
      for (let by = minBy; by <= maxBy; by++) {
        newHashes.push(this.getBucketHash(bx, by));
      }
    }

    const oldHashes = this.entityToBuckets.get(uid);
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
  }

  public clear() {
    this.buckets.clear();
    this.entityToBuckets.clear();
  }

  public getEntitiesInRect(x: number, y: number, w: number, h: number, outSet?: Set<string>): Set<string> {
    const result = outSet ?? new Set<string>();
    if (outSet) {
      outSet.clear();
    }

    const startX = Math.floor(x / this.bucketSize);
    const startY = Math.floor(y / this.bucketSize);
    const endX = Math.floor((x + w) / this.bucketSize);
    const endY = Math.floor((y + h) / this.bucketSize);

    for (let bx = startX; bx <= endX; bx++) {
      for (let by = startY; by <= endY; by++) {
        const hash = this.getBucketHash(bx, by);
        const bucket = this.buckets.get(hash);
        if (bucket) {
          for (const uid of bucket) {
            result.add(uid);
          }
        }
      }
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
}

export const bucketManager = new BucketManager();
