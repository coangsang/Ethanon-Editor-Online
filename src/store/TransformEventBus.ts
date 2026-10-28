export type TransformUpdate = {
  uid: string;
  x?: number;
  y?: number;
  angle?: number;
  scaleX?: number;
  scaleY?: number;
  spriteFrame?: number;
  flipX?: boolean;
  flipY?: boolean;
  hide?: boolean;
  diffuseColor?: { r: number; g: number; b: number; a: number };
  blendMode?: number;
};

type Listener = (updates: TransformUpdate[]) => void;

class TransformEventBus {
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(updates: TransformUpdate[]) {
    for (const listener of this.listeners) {
      listener(updates);
    }
  }
}

export const transformEventBus = new TransformEventBus();
