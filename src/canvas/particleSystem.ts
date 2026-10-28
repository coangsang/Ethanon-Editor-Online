import * as PIXI from 'pixi.js';
import type { ParticleSystemConfig } from '../types';

type Vector2 = { x: number; y: number };
type Vector3 = { x: number; y: number; z: number };

interface PARTICLE {
  released: boolean;
  repeat: number;
  id: number;
  currentFrame: number;
  elapsed: number;
  lifeTime: number;
  size: number;
  angle: number;
  angleDir: number;
  pos: { x: number; y: number };
  dir: { x: number; y: number };
  color: { r: number; g: number; b: number; a: number };
  startPoint: { x: number; y: number; z: number };
  sprite: PIXI.Sprite;
}

type ParticleSprite = PIXI.Sprite & { _offsetY?: number };

const DEFAULT_Z_AXIS_DIRECTION: Vector2 = { x: 0, y: -1 };

function randomizerFloat(min: number, max?: number): number {
  if (max === undefined) {
    return Math.random() * min;
  }
  const minVal = Math.min(min, max);
  const maxVal = Math.max(min, max);
  return minVal + Math.random() * (maxVal - minVal);
}

function rgbToHex(r: number, g: number, b: number): number {
  const cr = Math.max(0, Math.min(255, Math.round(r * 255)));
  const cg = Math.max(0, Math.min(255, Math.round(g * 255)));
  const cb = Math.max(0, Math.min(255, Math.round(b * 255)));
  return (cr << 16) | (cg << 8) | cb;
}

function getBlendMode(alphaMode: number): PIXI.BLEND_MODES {
  switch (alphaMode) {
    case 1:
      return 'add';
    case 2:
      return 'multiply';
    case 3:
      return 'normal';
    case 0:
    default:
      return 'normal';
  }
}

export class ParticleSystemRuntime {
  public container: PIXI.Container;
  private config: ParticleSystemConfig;
  private textures: PIXI.Texture[] = [];
  private isSubTextureCreated = false;
  private particles: PARTICLE[] = [];
  private finished = false;
  private killed = false;
  private activeParticlesCount = 0;
  private blendMode: PIXI.BLEND_MODES;

  constructor(
    config: ParticleSystemConfig,
    texture: PIXI.Texture,
    v2Pos: Vector2 = { x: 0, y: 0 },
    v3Pos: Vector3 = { x: 0, y: 0, z: 0 },
    angle = 0,
    zAxisDirection: Vector2 = DEFAULT_Z_AXIS_DIRECTION,
    scale = 1
  ) {
    this.config = { ...config };
    this.container = new PIXI.Container();
    if (config.alphaMode === 0) {
      this.container.sortableChildren = true;
    }
    this.blendMode = getBlendMode(config.alphaMode);
    this.createTextures(texture);
    this.initParticleSystem(v2Pos, v3Pos, angle, zAxisDirection, scale);
  }

  private createTextures(baseTexture: PIXI.Texture) {
    const cols = Math.max(1, Math.floor(this.config.spriteCut?.x || 1));
    const rows = Math.max(1, Math.floor(this.config.spriteCut?.y || 1));

    if (cols === 1 && rows === 1) {
      this.textures = [baseTexture];
      this.isSubTextureCreated = false;
      return;
    }

    this.isSubTextureCreated = true;
    const frameW = (baseTexture.width || 1) / cols;
    const frameH = (baseTexture.height || 1) / rows;
    const baseFrameX = baseTexture.frame?.x || 0;
    const baseFrameY = baseTexture.frame?.y || 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const frame = new PIXI.Rectangle(
          baseFrameX + c * frameW,
          baseFrameY + r * frameH,
          frameW,
          frameH
        );
        const tex = new PIXI.Texture({
          source: baseTexture.source,
          frame,
        });
        this.textures.push(tex);
      }
    }
  }

  private initParticleSystem(
    v2Pos: Vector2,
    v3Pos: Vector3,
    angle: number,
    zAxisDirection: Vector2,
    scale: number
  ) {
    this.finished = false;
    this.killed = false;

    if (scale !== 1) {
      this.scaleConfig(scale);
    }

    const count = Math.max(1, Math.floor(this.config.particles || 1));
    this.activeParticlesCount = this.config.allAtOnce ? count : 0;

    const rad = (-angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    for (let t = 0; t < count; t++) {
      const sprite = new PIXI.Sprite(this.textures[0]);
      sprite.anchor.set(0.5);
      sprite.blendMode = this.blendMode;
      sprite.visible = false;
      this.container.addChild(sprite);

      const p: PARTICLE = {
        released: Boolean(this.config.allAtOnce),
        repeat: 0,
        id: t,
        currentFrame: 0,
        elapsed: 0,
        lifeTime: Math.max(0, this.config.lifeTime),
        size: Math.max(0, this.config.size),
        angle: 0,
        angleDir: 0,
        pos: { x: 0, y: 0 },
        dir: { x: 0, y: 0 },
        color: { ...this.config.color0 },
        startPoint: { ...v3Pos },
        sprite,
      };

      this.particles.push(p);
      this.resetParticle(t, v2Pos, v3Pos, angle, zAxisDirection, cos, sin);
    }
  }

  private scaleConfig(scale: number) {
    this.config.boundingSphere *= scale;
    this.config.gravity.x *= scale;
    this.config.gravity.y *= scale;
    this.config.direction.x *= scale;
    this.config.direction.y *= scale;
    this.config.randomizeDir.x = Math.abs(this.config.randomizeDir.x * scale);
    this.config.randomizeDir.y = Math.abs(this.config.randomizeDir.y * scale);
    this.config.startPoint.x *= scale;
    this.config.startPoint.y *= scale;
    this.config.startPoint.z *= scale;
    this.config.randStartPoint.x = Math.abs(this.config.randStartPoint.x * scale);
    this.config.randStartPoint.y = Math.abs(this.config.randStartPoint.y * scale);
    this.config.size = Math.max(0, this.config.size * scale);
    this.config.randomizeSize = Math.max(0, this.config.randomizeSize * scale);
    this.config.growth *= scale;
    this.config.minSize = Math.max(0, this.config.minSize * scale);
    this.config.maxSize = Math.max(0, this.config.maxSize * scale);
  }

  private resetParticle(
    t: number,
    v2Pos: Vector2,
    v3Pos: Vector3,
    angle: number,
    zAxisDirection: Vector2,
    cos?: number,
    sin?: number
  ) {
    if (cos === undefined || sin === undefined) {
      const rad = (-angle * Math.PI) / 180;
      cos = Math.cos(rad);
      sin = Math.sin(rad);
    }

    const p = this.particles[t];
    if (!p) return;

    const halfRandDirX = Math.abs(this.config.randomizeDir.x) / 2;
    const halfRandDirY = Math.abs(this.config.randomizeDir.y) / 2;

    p.angleDir =
      this.config.angleDir +
      randomizerFloat(-Math.abs(this.config.randAngle) / 2, Math.abs(this.config.randAngle) / 2);
    p.elapsed = 0;
    p.lifeTime = Math.max(
      0,
      this.config.lifeTime +
        randomizerFloat(
          -Math.abs(this.config.randomLifeTime) / 2,
          Math.abs(this.config.randomLifeTime) / 2
        )
    );
    p.size = Math.max(
      0,
      this.config.size +
        randomizerFloat(
          -Math.abs(this.config.randomizeSize) / 2,
          Math.abs(this.config.randomizeSize) / 2
        )
    );

    const dirX =
      this.config.direction.x + randomizerFloat(-halfRandDirX, halfRandDirX);
    const dirY =
      this.config.direction.y + randomizerFloat(-halfRandDirY, halfRandDirY);

    p.dir.x = dirX * cos - dirY * sin;
    p.dir.y = dirX * sin + dirY * cos;
    p.color = { ...this.config.color0 };

    this.positionParticle(t, v2Pos, angle, v3Pos, zAxisDirection, cos, sin);

    const totalFrames = this.textures.length;
    if (totalFrames > 1) {
      if (this.config.animationMode === 1) {
        p.currentFrame = 0;
      } else if (this.config.animationMode === 2) {
        p.currentFrame = Math.floor(Math.random() * totalFrames);
      }
    }
  }

  private positionParticle(
    t: number,
    v2Pos: Vector2,
    angle: number,
    v3Pos: Vector3,
    zAxisDirection: Vector2,
    cos?: number,
    sin?: number
  ) {
    if (cos === undefined || sin === undefined) {
      const rad = (-angle * Math.PI) / 180;
      cos = Math.cos(rad);
      sin = Math.sin(rad);
    }

    const p = this.particles[t];
    if (!p) return;

    const halfRandStartX = Math.abs(this.config.randStartPoint.x) / 2;
    const halfRandStartY = Math.abs(this.config.randStartPoint.y) / 2;

    p.angle =
      this.config.angleStart +
      randomizerFloat(this.config.randAngleStart) -
      angle;

    const relX =
      this.config.startPoint.x +
      randomizerFloat(-halfRandStartX, halfRandStartX);
    const relY =
      this.config.startPoint.y +
      randomizerFloat(-halfRandStartY, halfRandStartY);

    const rotX = relX * cos - relY * sin;
    const rotY = relX * sin + relY * cos;
    const startX = this.config.startPoint.x * cos - this.config.startPoint.y * sin;
    const startY = this.config.startPoint.x * sin + this.config.startPoint.y * cos;
    const zTotal = v3Pos.z + this.config.startPoint.z;
    const projectedOrigin = {
      x: v2Pos.x + zAxisDirection.x * zTotal,
      y: v2Pos.y + zAxisDirection.y * zTotal,
    };

    p.pos.x = rotX + projectedOrigin.x;
    p.pos.y = rotY + projectedOrigin.y;
    p.startPoint = {
      x: projectedOrigin.x + startX,
      y: projectedOrigin.y + startY,
      z: zTotal,
    };
  }

  public update(
    dtMs: number,
    v2Pos: Vector2 = { x: 0, y: 0 },
    v3Pos: Vector3 = { x: 0, y: 0, z: 0 },
    angle = 0,
    ambient = { r: 1, g: 1, b: 1 },
    zAxisDirection: Vector2 = DEFAULT_Z_AXIS_DIRECTION
  ) {
    if (dtMs <= 0) return;

    const cappedDt = Math.min(dtMs, 250);
    const frameSpeed = (cappedDt / 1000.0) * 60.0;
    const count = this.particles.length;

    let anythingDrawn = false;
    this.activeParticlesCount = 0;

    const rad = (-angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    for (let t = 0; t < count; t++) {
      const p = this.particles[t];

      if (this.config.repeat > 0 && p.repeat >= this.config.repeat) {
        p.sprite.visible = false;
        continue;
      }

      if (this.killed && p.elapsed >= p.lifeTime) {
        p.sprite.visible = false;
        continue;
      }

      p.elapsed += cappedDt;

      if (!p.released) {
        const releaseTime =
          (this.config.lifeTime + this.config.randomLifeTime) * (t / count);

        if (p.elapsed >= releaseTime || this.config.allAtOnce) {
          p.released = true;
          this.resetParticle(t, v2Pos, v3Pos, angle, zAxisDirection, cos, sin);
        }
      }

      if (p.released) {
        p.dir.x += this.config.gravity.x * frameSpeed;
        p.dir.y += this.config.gravity.y * frameSpeed;
        p.pos.x += p.dir.x * frameSpeed;
        p.pos.y += p.dir.y * frameSpeed;
        p.angle += p.angleDir * frameSpeed;
        p.size += this.config.growth * frameSpeed;

        const w = p.lifeTime > 0 ? Math.max(0, Math.min(1, p.elapsed / p.lifeTime)) : 1;

        p.color.r =
          this.config.color0.r + (this.config.color1.r - this.config.color0.r) * w;
        p.color.g =
          this.config.color0.g + (this.config.color1.g - this.config.color0.g) * w;
        p.color.b =
          this.config.color0.b + (this.config.color1.b - this.config.color0.b) * w;
        p.color.a =
          this.config.color0.a + (this.config.color1.a - this.config.color0.a) * w;

        const totalFrames = this.textures.length;
        if (totalFrames > 1 && this.config.animationMode === 1) {
          p.currentFrame = Math.min(
            totalFrames - 1,
            Math.floor(totalFrames * w)
          );
        }

        const effectiveMinSize = Math.min(this.config.minSize, this.config.maxSize);
        const effectiveMaxSize = Math.max(this.config.minSize, this.config.maxSize);
        p.size = Math.min(
          effectiveMaxSize,
          Math.max(effectiveMinSize, p.size)
        );

        if (p.elapsed >= p.lifeTime) {
          p.repeat++;
          if (!this.killed) {
            this.resetParticle(t, v2Pos, v3Pos, angle, zAxisDirection, cos, sin);
          }
        }
      }

      if (
        p.size <= 0 ||
        !p.released ||
        p.color.a <= 0 ||
        (this.killed && p.elapsed >= p.lifeTime) ||
        (this.config.repeat > 0 && p.repeat >= this.config.repeat)
      ) {
        p.sprite.visible = false;
        continue;
      }

      this.activeParticlesCount++;
      anythingDrawn = true;

      p.sprite.visible = true;
      const tex = this.textures[p.currentFrame] || this.textures[0];
      if (p.sprite.texture !== tex) p.sprite.texture = tex;

      let finalR = p.color.r;
      let finalG = p.color.g;
      let finalB = p.color.b;

      const emissive = this.config.luminance || { r: 1, g: 1, b: 1 };
      if (this.config.alphaMode === 0 || this.config.alphaMode === 3) {
        finalR *= Math.min(1, emissive.r + ambient.r);
        finalG *= Math.min(1, emissive.g + ambient.g);
        finalB *= Math.min(1, emissive.b + ambient.b);
      }

      p.sprite.x = p.pos.x;
      p.sprite.y = p.pos.y;

      const renderSize = Math.max(0, p.size);
      const texW = p.sprite.texture.width || 1;
      const texH = p.sprite.texture.height || 1;
      p.sprite.scale.set(renderSize / texW, renderSize / texH);

      p.sprite.rotation = (p.angle * Math.PI) / 180;
      p.sprite.tint = rgbToHex(finalR, finalG, finalB);
      p.sprite.alpha = Math.max(0, Math.min(1, p.color.a));

      const offsetY = p.startPoint.y - p.pos.y;
      (p.sprite as ParticleSprite)._offsetY = offsetY;
      p.sprite.zIndex = offsetY;
    }

    this.finished = !anythingDrawn;

    if (this.config.alphaMode === 0 && anythingDrawn) {
      this.container.sortChildren();
    }
  }

  public play(
    v2Pos: Vector2,
    v3Pos: Vector3,
    angle: number,
    zAxisDirection: Vector2 = DEFAULT_Z_AXIS_DIRECTION
  ) {
    this.finished = false;
    this.killed = false;

    const rad = (-angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    for (let t = 0; t < this.particles.length; t++) {
      this.particles[t].repeat = 0;
      this.particles[t].released = Boolean(this.config.allAtOnce);
      this.resetParticle(t, v2Pos, v3Pos, angle, zAxisDirection, cos, sin);
    }
  }

  public kill(kill = true) {
    this.killed = kill;
  }

  public isKilled(): boolean {
    return this.killed;
  }

  public isFinished(): boolean {
    return this.finished;
  }

  public getActiveParticlesCount(): number {
    return this.activeParticlesCount;
  }

  public scaleParticleSystem(scale: number) {
    this.scaleConfig(scale);
    for (const p of this.particles) {
      p.size = Math.max(0, p.size * scale);
      p.dir.x *= scale;
      p.dir.y *= scale;
    }
  }

  public mirrorX(mirrorGravity = false) {
    if (mirrorGravity) this.config.gravity.x *= -1;
    this.config.startPoint.x *= -1;
    this.config.direction.x *= -1;

    for (const p of this.particles) {
      p.dir.x *= -1;
      p.pos.x *= -1;
    }
  }

  public mirrorY(mirrorGravity = false) {
    if (mirrorGravity) this.config.gravity.y *= -1;
    this.config.startPoint.y *= -1;
    this.config.direction.y *= -1;

    for (const p of this.particles) {
      p.dir.y *= -1;
      p.pos.y *= -1;
    }
  }

  public destroy() {
    this.particles = [];
    if (this.isSubTextureCreated) {
      for (const tex of this.textures) {
        try {
          tex.destroy(false);
        } catch {
          // Ignore sub-texture destroy failure
        }
      }
    }
    this.textures = [];
    this.container.destroy({ children: true });
  }
}
