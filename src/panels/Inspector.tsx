import { useState, useEffect, useRef } from 'react';
import { Icon } from '../components/Icon';
import './Inspector.css';
import type { CustomDataRefType, CustomDataValue, CustomDataVariable, CustomDataVectorValue, EntityInstance, EntityTemplate, SpriteAtlas } from '../types';
import { useSceneStore } from '../store/sceneStore';
import { entityHasFileNameTag, getTemplateKey, resolveEntityTemplate, resolveExternalTemplate, unpackEntityInstance } from '../utils/entityTemplate';
import {
  buildCustomDataRefIndex,
  isBaseDataFieldCompatibleWithType,
  isVariableRef,
  resolveCustomDataRefValue,
} from '../utils/customDataRef';
import { SpritePickerModal } from '../components/SpritePickerModal';
import { ExportPrefabModal } from '../components/ExportPrefabModal';
import { EntityRefPickerModal } from '../components/EntityRefPickerModal';
import { ColorControl } from '../components/ColorControl';
import { transformEventBus } from '../store/TransformEventBus';

function AxisNumberInput({
  axis,
  badgeClass,
  value,
  onChange,
  step = 1,
  min,
  max,
  precision,
  ariaLabel,
  title,
  disabled = false,
}: {
  axis: string;
  badgeClass: string;
  value: number;
  onChange: (val: number) => void;
  step?: number | 'any';
  min?: number;
  max?: number;
  precision?: number;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
}) {
  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    if (disabled) return;
    const stepVal = typeof step === 'number' ? step : 1;
    const delta = e.deltaY < 0 ? stepVal : -stepVal;
    let nextVal = value + delta;
    if (min !== undefined) nextVal = Math.max(min, nextVal);
    if (max !== undefined) nextVal = Math.min(max, nextVal);
    const dec = precision ?? (typeof stepVal === 'number' && stepVal.toString().includes('.')
      ? stepVal.toString().split('.')[1].length
      : 0);
    nextVal = Number(nextVal.toFixed(dec));
    onChange(nextVal);
  };

  return (
    <div className={`axis-input-group ${disabled ? 'opacity-50' : ''}`} title={title}>
      <span className={`axis-badge ${badgeClass}`}>{axis}</span>
      <input
        type="number"
        disabled={disabled}
        aria-label={ariaLabel || axis}
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        onWheel={handleWheel}
        onChange={e => {
          if (disabled) return;
          const parsed = parseFloat(e.target.value);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        className="axis-number-input"
      />
    </div>
  );
}

function isVectorValue(value: CustomDataValue): value is CustomDataVectorValue {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: CustomDataValue): number {
  if (isVectorValue(value)) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asText(value: CustomDataValue): string {
  if (!isVectorValue(value)) return value;
  return value.z === undefined
    ? `${value.x}, ${value.y}`
    : `${value.x}, ${value.y}, ${value.z}`;
}

function asVector(value: CustomDataValue): CustomDataVectorValue {
  return isVectorValue(value) ? value : { x: 0, y: 0, z: 0 };
}

function CustomDataInput({ variable, onChange, disabled = false }: {
  variable: CustomDataVariable;
  onChange: (value: CustomDataValue) => void;
  disabled?: boolean;
}) {
  const disabledClass = disabled ? 'opacity-70 cursor-not-allowed' : '';

  if (variable.type === 'float') {
    return (
      <input
        type="number"
        disabled={disabled}
        value={asNumber(variable.value)}
        step="any"
        onChange={e => {
          if (disabled) return;
          onChange(String(parseFloat(e.target.value) || 0));
        }}
        className={`w-full editor-input ${disabledClass}`}
      />
    );
  }

  if (variable.type === 'int' || variable.type === 'uint') {
    return (
      <input
        type="number"
        disabled={disabled}
        value={asNumber(variable.value)}
        step={1}
        min={variable.type === 'uint' ? 0 : undefined}
        onChange={e => {
          if (disabled) return;
          const parsed = Math.round(parseFloat(e.target.value) || 0);
          onChange(String(variable.type === 'uint' ? Math.max(0, parsed) : parsed));
        }}
        className={`w-full editor-input ${disabledClass}`}
      />
    );
  }

  if (variable.type === 'vector2' || variable.type === 'vector3') {
    const vector = asVector(variable.value);
    const updateAxis = (axis: 'x' | 'y' | 'z', value: number) => {
      if (disabled) return;
      onChange({
        x: axis === 'x' ? value : vector.x,
        y: axis === 'y' ? value : vector.y,
        ...(variable.type === 'vector3' ? { z: axis === 'z' ? value : vector.z ?? 0 } : {}),
      });
    };

    return (
      <div className="grid grid-cols-2 gap-1">
        <input
          aria-label={`${variable.name} x`}
          type="number"
          disabled={disabled}
          value={vector.x}
          step="any"
          onChange={e => updateAxis('x', parseFloat(e.target.value) || 0)}
          className={`editor-input min-w-0 ${disabledClass}`}
        />
        <input
          aria-label={`${variable.name} y`}
          type="number"
          disabled={disabled}
          value={vector.y}
          step="any"
          onChange={e => updateAxis('y', parseFloat(e.target.value) || 0)}
          className={`editor-input min-w-0 ${disabledClass}`}
        />
        {variable.type === 'vector3' && (
          <input
            aria-label={`${variable.name} z`}
            type="number"
            disabled={disabled}
            value={vector.z ?? 0}
            step="any"
            onChange={e => updateAxis('z', parseFloat(e.target.value) || 0)}
            className={`col-span-2 editor-input min-w-0 ${disabledClass}`}
          />
        )}
      </div>
    );
  }

  return (
    <input
      type="text"
      disabled={disabled}
      value={asText(variable.value)}
      onChange={e => {
        if (disabled) return;
        onChange(e.target.value);
      }}
      className={`w-full editor-input ${disabledClass}`}
    />
  );
}

function CheckInput({ label, value, onChange }: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={e => onChange(e.target.checked)}
        className="w-3 h-3"
      />
      <span className="text-xs text-gray-300">{label}</span>
    </label>
  );
}

function getAtlasForTemplate(template: EntityTemplate, atlases: Record<string, SpriteAtlas>) {
  const basename = template.spriteFile.split('/').pop() ?? template.spriteFile;
  return atlases[template.spriteFile]
    || atlases[`entities/${basename}`]
    || atlases[basename]
    || null;
}

function getMaxSpriteFrame(template: EntityTemplate | null, atlases: Record<string, SpriteAtlas>) {
  if (!template) return null;
  const atlas = getAtlasForTemplate(template, atlases);
  if (atlas && atlas.frames.length > 0) return atlas.frames.length - 1;

  const cutX = Math.max(1, Math.floor(Number.isFinite(template.spriteCut.x) ? template.spriteCut.x : 1));
  const cutY = Math.max(1, Math.floor(Number.isFinite(template.spriteCut.y) ? template.spriteCut.y : 1));
  return cutX * cutY - 1;
}

function normalizeSpriteCutValue(value: number): number {
  return Math.max(1, Math.round(value));
}

function IdentitySection({ entity }: { entity: EntityInstance }) {
  const [localEditorName, setLocalEditorName] = useState(entity.editorEntityName ?? entity.entityName ?? '');
  const [localEntityName, setLocalEntityName] = useState(entity.entityName ?? '');
  const [sourceNames, setSourceNames] = useState({ editor: entity.editorEntityName, entity: entity.entityName });

  const latestRef = useRef({ editorEntityName: localEditorName, entityName: localEntityName });

  if (sourceNames.editor !== entity.editorEntityName || sourceNames.entity !== entity.entityName) {
    setSourceNames({ editor: entity.editorEntityName, entity: entity.entityName });
    setLocalEditorName(entity.editorEntityName ?? entity.entityName ?? '');
    setLocalEntityName(entity.entityName ?? '');
  }

  useEffect(() => {
    latestRef.current = { editorEntityName: localEditorName, entityName: localEntityName };
  }, [localEditorName, localEntityName]);

  const commitChanges = () => {
    const { editorEntityName, entityName } = latestRef.current;
    useSceneStore.getState().queueInspectorEdit(entity.editorEntityUID, 'identity', currentEntity => ({
      ...currentEntity,
      editorEntityName,
      entityName,
      ...(currentEntity.inlineTemplate ? { inlineTemplate: { ...currentEntity.inlineTemplate, name: entityName } } : {}),
    }));
  };

  const handleEditorNameChange = (val: string) => {
    latestRef.current = { ...latestRef.current, editorEntityName: val };
    setLocalEditorName(val);
    commitChanges();
  };

  const handleEntityNameChange = (val: string) => {
    latestRef.current = { ...latestRef.current, entityName: val };
    setLocalEntityName(val);
    commitChanges();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitChanges();
      useSceneStore.getState().flushInspectorEdits();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="inspector-section px-3 py-2 flex flex-col gap-2 border-b border-gray-700 bg-gray-900/40">
      <div className="inspector-section-title text-xs text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
        Identity
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-24 shrink-0 font-medium" title="Editor Entity Name (hiển thị ở editor/hierarchy)">
          Editor Name
        </span>
        <input
          type="text"
          value={localEditorName}
          onChange={e => handleEditorNameChange(e.target.value)}
          onBlur={commitChanges}
          onKeyDown={handleKeyDown}
          placeholder="Editor Entity Name..."
          className="flex-1 editor-input text-xs px-2 py-1"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-24 shrink-0 font-medium" title="Entity Name (prefab/template identifier)">
          Entity Name
        </span>
        <input
          type="text"
          value={localEntityName}
          onChange={e => handleEntityNameChange(e.target.value)}
          onBlur={commitChanges}
          onKeyDown={handleKeyDown}
          placeholder="Entity Name..."
          className="flex-1 editor-input text-xs px-2 py-1 font-mono"
        />
      </div>
    </div>
  );
}

function TransformSection({ entity, hasFileName, currentScale }: {
  entity: EntityInstance;
  hasFileName: boolean;
  currentScale: { x: number; y: number };
}) {
  const isChild = !!entity.editorParentEntity;
  const initialPos = isChild && entity.localPosition ? entity.localPosition : entity.position;
  const initialAngle = isChild && entity.localPosition ? entity.localPosition.angle : entity.angle;

  const [localPos, setLocalPos] = useState({ x: initialPos.x, y: initialPos.y, z: initialPos.z ?? 0 });
  const [localAngle, setLocalAngle] = useState(initialAngle);
  const [localScale, setLocalScale] = useState(currentScale);
  const [sourceTransform, setSourceTransform] = useState({
    isChild, x: initialPos.x, y: initialPos.y, z: initialPos.z ?? 0,
    angle: initialAngle, scaleX: currentScale.x, scaleY: currentScale.y,
  });

  if (sourceTransform.isChild !== isChild || sourceTransform.x !== initialPos.x ||
    sourceTransform.y !== initialPos.y || sourceTransform.z !== (initialPos.z ?? 0) ||
    sourceTransform.angle !== initialAngle || sourceTransform.scaleX !== currentScale.x ||
    sourceTransform.scaleY !== currentScale.y) {
    setSourceTransform({
      isChild, x: initialPos.x, y: initialPos.y, z: initialPos.z ?? 0,
      angle: initialAngle, scaleX: currentScale.x, scaleY: currentScale.y,
    });
    setLocalPos({ x: initialPos.x, y: initialPos.y, z: initialPos.z ?? 0 });
    setLocalAngle(initialAngle);
    setLocalScale(currentScale);
  }

  const latestLocalPosRef = useRef(localPos);
  const latestLocalAngleRef = useRef(localAngle);
  const latestLocalScaleRef = useRef(localScale);

  useEffect(() => {
    latestLocalPosRef.current = localPos;
    latestLocalAngleRef.current = localAngle;
    latestLocalScaleRef.current = localScale;
  }, [localPos, localAngle, localScale]);

  const commitTransform = () => {
    const position = { ...latestLocalPosRef.current };
    const angle = latestLocalAngleRef.current;
    useSceneStore.getState().queueInspectorEdit(entity.editorEntityUID, 'transform', current => isChild
      ? { ...current, localPosition: { ...(current.localPosition ?? {}), ...position, angle } }
      : { ...current, position: { ...current.position, ...position }, angle });
  };

  const commitScale = () => {
    const scale = { ...latestLocalScaleRef.current };
    useSceneStore.getState().queueInspectorEdit(entity.editorEntityUID, 'scale', current => ({
      ...current,
      inlineTemplate: { ...(current.inlineTemplate ?? { name: current.entityName }), scale },
      inlineEntityData: { ...(current.inlineEntityData ?? {}), Scale: scale },
    }));
  };

  const handlePosChange = (axis: 'x' | 'y' | 'z', val: number) => {
    const v = Math.round(val);
    const newPos = { ...localPos, [axis]: v };
    latestLocalPosRef.current = newPos;
    setLocalPos(newPos);
    
    if (!isChild) {
      transformEventBus.emit([{ uid: entity.editorEntityUID, x: newPos.x, y: newPos.y }]);
    }
    commitTransform();
  };

  const handleAngleChange = (angle: number) => {
    const v = Math.round(angle);
    latestLocalAngleRef.current = v;
    setLocalAngle(v);
    if (!isChild) {
      transformEventBus.emit([{ uid: entity.editorEntityUID, angle: v }]);
    }
    commitTransform();
  };

  const handleScaleChange = (axis: 'x' | 'y', val: number) => {
    const newScale = { ...localScale, [axis]: val };
    latestLocalScaleRef.current = newScale;
    setLocalScale(newScale);
    transformEventBus.emit([{ uid: entity.editorEntityUID, scaleX: newScale.x, scaleY: newScale.y }]);
    commitScale();
  };

  useEffect(() => {
    const unsub = isChild ? null : transformEventBus.subscribe((updates) => {
      const u = updates.find(update => update.uid === entity.editorEntityUID);
      if (u) {
        const { x, y } = u;
        if (x !== undefined) setLocalPos(p => ({ ...p, x }));
        if (y !== undefined) setLocalPos(p => ({ ...p, y }));
        if (u.angle !== undefined) setLocalAngle(u.angle);
        if (u.scaleX !== undefined || u.scaleY !== undefined) {
          setLocalScale(p => ({
            x: u.scaleX !== undefined ? u.scaleX : p.x,
            y: u.scaleY !== undefined ? u.scaleY : p.y,
          }));
        }
      }
    });
    return () => {
      unsub?.();
    };
  }, [entity.editorEntityUID, isChild]);

  return (
    <div className="inspector-section px-3 py-2.5 flex flex-col gap-2 border-b border-gray-700 bg-gray-950/20">
      <div className="inspector-section-title flex items-center justify-between text-xs text-gray-400 font-semibold uppercase tracking-wider">
        <span className="flex items-center gap-1.5 text-gray-300">
          Transform
        </span>
        <button
          type="button"
          onClick={() => {
            const resetPos = { x: 0, y: 0, z: 0 };
            latestLocalPosRef.current = resetPos;
            latestLocalAngleRef.current = 0;
            setLocalPos(resetPos);
            setLocalAngle(0);
            commitTransform();
            if (!hasFileName) {
              latestLocalScaleRef.current = { x: 1, y: 1 };
              setLocalScale({ x: 1, y: 1 });
              commitScale();
            }
            useSceneStore.getState().flushInspectorEdits();
          }}
          className="inspector-text-button text-[10px] text-gray-500 hover:text-gray-300 font-normal lowercase tracking-normal"
          title="Reset Transform (Pos 0,0,0, Angle 0, Scale 1,1)"
        >
          reset
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-14 shrink-0 font-medium" title={isChild ? "Local Position" : "World Position"}>
          {isChild ? "Local Pos" : "Position"}
        </span>
        <div className="grid grid-cols-3 gap-1 flex-1 min-w-0">
          <AxisNumberInput
            axis="X"
            badgeClass="axis-badge-x"
            value={localPos.x}
            step={1}
            onChange={x => handlePosChange('x', x)}
            ariaLabel="Position X"
            title={isChild ? "Local Position X (pixels)" : "Position X (pixels)"}
          />
          <AxisNumberInput
            axis="Y"
            badgeClass="axis-badge-y"
            value={localPos.y}
            step={1}
            onChange={y => handlePosChange('y', y)}
            ariaLabel="Position Y"
            title={isChild ? "Local Position Y (pixels)" : "Position Y (pixels)"}
          />
          <AxisNumberInput
            axis="Z"
            badgeClass="axis-badge-z"
            value={localPos.z}
            step={10}
            onChange={z => handlePosChange('z', z)}
            ariaLabel="Position Z"
            title={isChild ? "Local Depth Z (relative to parent)" : "World Depth Z (layers)"}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 pl-16">
        <span className="text-[10px] text-gray-500 mr-0.5 shrink-0">Z Step:</span>
        {[-100, -10, 10, 100].map(delta => (
          <button
            key={delta}
            type="button"
            onClick={() => handlePosChange('z', localPos.z + delta)}
            className="inspector-button flex-1 bg-gray-800/80 hover:bg-gray-700 active:bg-indigo-900/50 text-gray-300 hover:text-white text-[10px] font-mono py-0.5 rounded border border-gray-700/80 transition-colors"
            title={delta > 0 ? `Bật về gần camera (+${delta})` : `Đưa ra xa camera (${delta})`}
          >
            {delta > 0 ? `+${delta}` : delta}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-14 shrink-0 font-medium">Rotation</span>
        <div className="flex-1 min-w-0">
          <AxisNumberInput
            axis="∠"
            badgeClass="axis-badge-angle"
            value={localAngle}
            step={5}
            onChange={angle => handleAngleChange(angle)}
            ariaLabel="Angle / Rotation"
            title="Rotation Angle (degrees)"
          />
        </div>
      </div>

      {!hasFileName && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-14 shrink-0 font-medium">Scale</span>
          <div className="grid grid-cols-2 gap-1 flex-1 min-w-0">
            <AxisNumberInput
              axis="X"
              badgeClass="axis-badge-x"
              value={localScale.x}
              step={0.1}
              precision={3}
              onChange={x => handleScaleChange('x', x)}
              ariaLabel="Scale X"
              title="Inline Scale X (multiplier)"
            />
            <AxisNumberInput
              axis="Y"
              badgeClass="axis-badge-y"
              value={localScale.y}
              step={0.1}
              precision={3}
              onChange={y => handleScaleChange('y', y)}
              ariaLabel="Scale Y"
              title="Inline Scale Y (multiplier)"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SpriteFlagsSection({ entity, hasFileName, template, maxSpriteFrame, clampSpriteFrameInput, pingSprite, updateSpriteCut, setSpritePickerOpen }: {
  entity: EntityInstance;
  hasFileName: boolean;
  template: EntityTemplate | null;
  maxSpriteFrame: number | null;
  clampSpriteFrameInput: (value: number) => number;
  pingSprite: (sprite: string) => void;
  updateSpriteCut: (axis: 'x' | 'y', value: number) => void;
  setSpritePickerOpen: (open: boolean) => void;
}) {
  const [localSpriteFrame, setLocalSpriteFrame] = useState(entity.spriteFrame);
  const [localFlipX, setLocalFlipX] = useState(entity.flipX);
  const [localFlipY, setLocalFlipY] = useState(entity.flipY);
  const [localHide, setLocalHide] = useState(entity.hide);
  const effectiveSpriteCut: { x: number; y: number } = entity.inlineTemplate?.spriteCut ?? template?.spriteCut ?? { x: 1, y: 1 };
  const [localSpriteCut, setLocalSpriteCut] = useState({ ...effectiveSpriteCut });
  const [sourceFlags, setSourceFlags] = useState({
    spriteFrame: entity.spriteFrame, flipX: entity.flipX, flipY: entity.flipY, hide: entity.hide,
  });

  if (sourceFlags.spriteFrame !== entity.spriteFrame || sourceFlags.flipX !== entity.flipX ||
    sourceFlags.flipY !== entity.flipY || sourceFlags.hide !== entity.hide) {
    setSourceFlags({
      spriteFrame: entity.spriteFrame, flipX: entity.flipX, flipY: entity.flipY, hide: entity.hide,
    });
    setLocalSpriteFrame(entity.spriteFrame);
    setLocalFlipX(entity.flipX);
    setLocalFlipY(entity.flipY);
    setLocalHide(entity.hide);
  }

  const latestRef = useRef({ spriteFrame: localSpriteFrame, flipX: localFlipX, flipY: localFlipY, hide: localHide });

  useEffect(() => {
    latestRef.current = { spriteFrame: localSpriteFrame, flipX: localFlipX, flipY: localFlipY, hide: localHide };
  }, [localSpriteFrame, localFlipX, localFlipY, localHide]);

  const commitChanges = () => {
    const flags = { ...latestRef.current };
    useSceneStore.getState().queueInspectorEdit(entity.editorEntityUID, 'spriteFlags', current => ({
      ...current,
      ...flags,
    }));
  };

  const handleFrameChange = (val: number) => {
    latestRef.current = { ...latestRef.current, spriteFrame: val };
    setLocalSpriteFrame(val);
    transformEventBus.emit([{ uid: entity.editorEntityUID, spriteFrame: val }]);
    commitChanges();
  };

  const handleFlipXChange = (val: boolean) => {
    latestRef.current = { ...latestRef.current, flipX: val };
    setLocalFlipX(val);
    transformEventBus.emit([{ uid: entity.editorEntityUID, flipX: val }]);
    commitChanges();
  };

  const handleFlipYChange = (val: boolean) => {
    latestRef.current = { ...latestRef.current, flipY: val };
    setLocalFlipY(val);
    transformEventBus.emit([{ uid: entity.editorEntityUID, flipY: val }]);
    commitChanges();
  };

  const handleHideChange = (val: boolean) => {
    latestRef.current = { ...latestRef.current, hide: val };
    setLocalHide(val);
    transformEventBus.emit([{ uid: entity.editorEntityUID, hide: val }]);
    commitChanges();
  };

  const handleSpriteCutChange = (axis: 'x' | 'y', val: number) => {
    const value = normalizeSpriteCutValue(val);
    setLocalSpriteCut(current => ({ ...current, [axis]: value }));
    updateSpriteCut(axis, value);
  };

  useEffect(() => {
    const unsub = transformEventBus.subscribe((updates) => {
      const u = updates.find(update => update.uid === entity.editorEntityUID);
      if (u) {
        if (u.spriteFrame !== undefined) setLocalSpriteFrame(u.spriteFrame);
        if (u.flipX !== undefined) setLocalFlipX(u.flipX);
        if (u.flipY !== undefined) setLocalFlipY(u.flipY);
        if (u.hide !== undefined) setLocalHide(u.hide);
      }
    });
    return () => {
      unsub();
    };
  }, [entity.editorEntityUID]);

  return (
    <div className="inspector-section px-3 py-2 flex flex-col gap-2 border-b border-gray-700">
      <div className="inspector-section-title text-xs text-gray-500 mb-0.5">Sprite & Flags</div>

      {!hasFileName && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-14 shrink-0">Sprite</span>
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <button
                className="inspector-button flex-1 editor-input w-0 font-mono text-[10px] text-left truncate px-2 py-1 cursor-pointer bg-gray-800 hover:bg-gray-700 transition-colors"
                onClick={() => pingSprite(entity.inlineTemplate?.spriteFile || '')}
                title={entity.inlineTemplate?.spriteFile ? 'Ping Sprite in Project Panel' : '(none)'}
              >
                {entity.inlineTemplate?.spriteFile || '(none)'}
              </button>
              <button
                onClick={() => setSpritePickerOpen(true)}
                title="Change Sprite"
                className="inspector-button rounded border border-gray-700 bg-gray-800 px-2 py-1 text-[10px] font-semibold text-gray-300 hover:bg-gray-700 hover:text-gray-100 transition-colors shrink-0"
              >
                Change
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-400 w-14 shrink-0">Cut</span>
            <div className="grid grid-cols-2 gap-1 flex-1 min-w-0">
              <AxisNumberInput
                axis="X"
                badgeClass="axis-badge-x"
                value={localSpriteCut.x}
                step={1}
                min={1}
                onChange={x => handleSpriteCutChange('x', x)}
                ariaLabel="Sprite Cut X"
                title="Frames X"
              />
              <AxisNumberInput
                axis="Y"
                badgeClass="axis-badge-y"
                value={localSpriteCut.y}
                step={1}
                min={1}
                onChange={y => handleSpriteCutChange('y', y)}
                ariaLabel="Sprite Cut Y"
                title="Frames Y"
              />
            </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-14 shrink-0">Frame</span>
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={maxSpriteFrame ?? undefined}
            value={localSpriteFrame}
            onChange={e => handleFrameChange(clampSpriteFrameInput(parseFloat(e.target.value) || 0))}
            className="flex-1 editor-input w-0 font-mono text-xs"
          />
          {maxSpriteFrame !== null && (
            <span className="text-[10px] text-gray-500 font-mono shrink-0">
              / {maxSpriteFrame}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <CheckInput label="Flip X" value={localFlipX} onChange={handleFlipXChange} />
        <CheckInput label="Flip Y" value={localFlipY} onChange={handleFlipYChange} />
        <CheckInput label="Hide" value={localHide} onChange={handleHideChange} />
      </div>
    </div>
  );
}

function MaterialSection({ entity, hasFileName, template, currentDiffuseColor }: {
  entity: EntityInstance;
  hasFileName: boolean;
  template: EntityTemplate | null;
  currentDiffuseColor: { r: number; g: number; b: number; a: number };
}) {
  const [localDiffuse, setLocalDiffuse] = useState(currentDiffuseColor);
  const [localBlendMode, setLocalBlendMode] = useState(template?.blendMode ?? 0);
  const [sourceMaterial, setSourceMaterial] = useState({
    ...currentDiffuseColor, blendMode: template?.blendMode ?? 0,
  });

  if (sourceMaterial.r !== currentDiffuseColor.r || sourceMaterial.g !== currentDiffuseColor.g ||
    sourceMaterial.b !== currentDiffuseColor.b || sourceMaterial.a !== currentDiffuseColor.a ||
    sourceMaterial.blendMode !== (template?.blendMode ?? 0)) {
    setSourceMaterial({ ...currentDiffuseColor, blendMode: template?.blendMode ?? 0 });
    setLocalDiffuse(currentDiffuseColor);
    setLocalBlendMode(template?.blendMode ?? 0);
  }

  const latestRef = useRef({ diffuse: localDiffuse, blendMode: localBlendMode });

  useEffect(() => {
    latestRef.current = { diffuse: localDiffuse, blendMode: localBlendMode };
  }, [localDiffuse, localBlendMode]);

  const commitChanges = () => {
    const newColor = latestRef.current.diffuse;
    const mode = latestRef.current.blendMode;
    useSceneStore.getState().queueInspectorEdit(entity.editorEntityUID, 'material', currentEntity => {
      if (entityHasFileNameTag(currentEntity)) return currentEntity;
      return {
        ...currentEntity,
      diffuseColor: newColor,
      color: newColor,
      inlineTemplate: { ...(currentEntity.inlineTemplate ?? { name: currentEntity.entityName }), blendMode: mode, diffuseColor: newColor },
      inlineEntityData: {
        ...(currentEntity.inlineEntityData ?? {}),
        blendMode: mode,
        DiffuseColor: { r: newColor.r, g: newColor.g, b: newColor.b, a: newColor.a },
      },
      };
    });
  };

  const handleColorChange = (c: { r: number; g: number; b: number; a: number }) => {
    latestRef.current = { ...latestRef.current, diffuse: c };
    setLocalDiffuse(c);
    transformEventBus.emit([{ uid: entity.editorEntityUID, diffuseColor: c }]);
    commitChanges();
  };

  const handleBlendModeChange = (mode: number) => {
    if (hasFileName) return;
    latestRef.current = { ...latestRef.current, blendMode: mode };
    setLocalBlendMode(mode);
    transformEventBus.emit([{ uid: entity.editorEntityUID, blendMode: mode }]);
    commitChanges();
  };

  return (
    <div className="inspector-section px-3 py-2 flex flex-col gap-1.5 border-b border-gray-700">
      <div className="inspector-section-title text-xs text-gray-500 mb-0.5">Material & Blending</div>
      {!hasFileName && (
        <ColorControl
          label="Diffuse Color"
          color={localDiffuse}
          showAlpha
          onChange={handleColorChange}
          onReset={() => {
            const defaultCol = template?.diffuseColor ?? { r: 1, g: 1, b: 1, a: 1 };
            handleColorChange(defaultCol);
          }}
        />
      )}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-gray-400 w-16 flex-shrink-0">Blend Mode</span>
        <select
          value={localBlendMode}
          disabled={hasFileName}
          onChange={e => handleBlendModeChange(parseInt(e.target.value, 10))}
          title={hasFileName ? 'Blend mode is inherited from the template file.' : undefined}
          className={`flex-1 editor-input py-1 ${hasFileName ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          <option value={0}>0 - Normal</option>
          <option value={1}>1 - Screen</option>
          <option value={4}>4 - Multiply</option>
        </select>
      </div>
    </div>
  );
}

function getDefaultValueForType(type: string): CustomDataValue {
  switch (type) {
    case 'vector2':
      return { x: 0, y: 0 };
    case 'vector3':
      return { x: 0, y: 0, z: 0 };
    case 'int':
    case 'uint':
    case 'float':
      return '0';
    case 'string':
    default:
      return '';
  }
}

function CustomDataSection({ entity, customData }: {
  entity: EntityInstance;
  customData: CustomDataVariable[];
}) {
  const allEntities = useSceneStore(s => s.scene.entities);
  const refIndex = buildCustomDataRefIndex(allEntities);

  const [localCustomData, setLocalCustomData] = useState<CustomDataVariable[]>(customData);
  const [sourceCustomData, setSourceCustomData] = useState(customData);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('string');
  const [newValue, setNewValue] = useState<CustomDataValue>('');
  const [isNewRef, setIsNewRef] = useState(false);
  const [newRefEditorUID, setNewRefEditorUID] = useState('');
  const [newRefType, setNewRefType] = useState<CustomDataRefType>('customData');
  const [newRefValue, setNewRefValue] = useState('');
  const [error, setError] = useState('');

  // Inline editing state for an existing variable's reference
  const [editingRefIndex, setEditingRefIndex] = useState<number | null>(null);
  const [editRefEditorUID, setEditRefEditorUID] = useState('');
  const [editRefType, setEditRefType] = useState<CustomDataRefType>('customData');
  const [editRefValue, setEditRefValue] = useState('');
  const [editRefError, setEditRefError] = useState('');

  // Modal state (shared between "Add New Variable" and "Edit Ref")
  const [refPickerTarget, setRefPickerTarget] = useState<'new' | 'edit' | null>(null);

  if (sourceCustomData !== customData) {
    setSourceCustomData(customData);
    setLocalCustomData(customData);
  }

  const latestRef = useRef(localCustomData);

  useEffect(() => {
    latestRef.current = localCustomData;
  }, [localCustomData]);

  const commitChanges = (flushImmediately = false) => {
    const nextCustomData = latestRef.current.map(value => ({ ...value }));
    useSceneStore.getState().queueInspectorEdit(entity.editorEntityUID, 'customData', current => ({
      ...current,
      customData: nextCustomData,
    }));
    if (flushImmediately) {
      useSceneStore.getState().flushInspectorEdits();
    }
  };

  const updateCustomDataValue = (index: number, value: CustomDataValue) => {
    const targetVar = localCustomData[index];
    if (targetVar && isVariableRef(targetVar)) return;
    const next = localCustomData.map((variable, i) => (
      i === index ? { ...variable, value } : variable
    ));
    setLocalCustomData(next);
    latestRef.current = next;
    commitChanges();
  };

  const unlinkCustomDataRef = (index: number) => {
    const next = localCustomData.map((variable, i) => {
      if (i !== index) return variable;
      const copy = { ...variable };
      delete copy.refEditorUID;
      delete copy.refType;
      delete copy.refValue;
      return copy;
    });
    setLocalCustomData(next);
    latestRef.current = next;
    if (editingRefIndex === index) {
      setEditingRefIndex(null);
    }
    commitChanges(true);
  };

  const startEditingRef = (index: number) => {
    const v = localCustomData[index];
    if (!v) return;
    setEditingRefIndex(index);
    setEditRefEditorUID(v.refEditorUID ?? '');
    setEditRefType(v.refType ?? 'customData');
    setEditRefValue(v.refValue ?? '');
    setEditRefError('');
  };

  const saveEditedRef = (index: number) => {
    const v = localCustomData[index];
    if (!v) return;
    const trimmedUid = editRefEditorUID.trim();
    if (!trimmedUid) {
      setEditRefError('Target EID cannot be empty');
      return;
    }
    if (trimmedUid === entity.editorEntityUID) {
      setEditRefError('Cannot reference the same entity');
      return;
    }
    const targetEntity = refIndex.byUid.get(trimmedUid);
    if (!targetEntity) {
      setEditRefError('Target entity EID not found in scene');
      return;
    }
    if (!editRefValue) {
      setEditRefError('Please select a reference value');
      return;
    }

    let nextType = v.type;
    if (editRefType === 'baseData') {
      if (editRefValue === 'name' && nextType !== 'string') {
        nextType = 'string';
      } else if (editRefValue === 'id' && !isBaseDataFieldCompatibleWithType('id', nextType)) {
        nextType = 'int';
      }
    } else if (editRefType === 'customData') {
      const targetVar = (targetEntity.customData ?? []).find(item => item.name === editRefValue);
      if (!targetVar) {
        setEditRefError(`Variable "${editRefValue}" not found on target entity`);
        return;
      }
      if (isVariableRef(targetVar)) {
        setEditRefError(`Variable "${editRefValue}" is already a reference`);
        return;
      }
      nextType = targetVar.type;
    }

    const candidateVar: CustomDataVariable = {
      ...v,
      type: nextType,
      refEditorUID: trimmedUid,
      refType: editRefType,
      refValue: editRefValue,
    };
    const resolved = resolveCustomDataRefValue(candidateVar, refIndex, entity.editorEntityUID);
    if (resolved.status === 'ok') {
      candidateVar.value = resolved.value;
    }

    const next = localCustomData.map((item, i) => (i === index ? candidateVar : item));
    setLocalCustomData(next);
    latestRef.current = next;
    setEditingRefIndex(null);
    setEditRefError('');
    commitChanges(true);
  };

  const deleteCustomDataValue = (index: number) => {
    const next = localCustomData.filter((_, i) => i !== index);
    setLocalCustomData(next);
    latestRef.current = next;
    if (editingRefIndex === index) {
      setEditingRefIndex(null);
    }
    commitChanges();
  };

  const handleTypeChange = (type: string) => {
    setNewType(type);
    setNewValue(getDefaultValueForType(type));
    if (isNewRef && newRefType === 'baseData' && newRefValue && !isBaseDataFieldCompatibleWithType(newRefValue, type)) {
      setNewRefValue('');
    }
    setError('');
  };

  const handleSelectNewTargetUid = (uid: string) => {
    setNewRefEditorUID(uid);
    setNewRefValue('');
    setError('');
  };

  const handleNewRefTypeChange = (refType: CustomDataRefType) => {
    setNewRefType(refType);
    setNewRefValue('');
    setError('');
  };

  const handleNewRefValueChange = (val: string, targetEntity?: EntityInstance) => {
    setNewRefValue(val);
    setError('');
    if (!val) return;

    if (newRefType === 'baseData') {
      if (val === 'name' && newType !== 'string') {
        setNewType('string');
      } else if (val === 'id' && !isBaseDataFieldCompatibleWithType('id', newType)) {
        setNewType('int');
      }
    } else if (newRefType === 'customData' && targetEntity) {
      const targetVar = (targetEntity.customData ?? []).find(v => v.name === val);
      if (targetVar && !isVariableRef(targetVar) && targetVar.type !== newType) {
        setNewType(targetVar.type);
      }
    }
  };

  const newTargetEntity = newRefEditorUID.trim()
    ? refIndex.byUid.get(newRefEditorUID.trim())
    : undefined;

  const previewNewVariable: CustomDataVariable = isNewRef
    ? (() => {
        const draft: CustomDataVariable = {
          type: newType,
          name: newName,
          value: getDefaultValueForType(newType),
          refEditorUID: newRefEditorUID.trim(),
          refType: newRefType,
          refValue: newRefValue,
        };
        const resolved = resolveCustomDataRefValue(draft, refIndex, entity.editorEntityUID);
        return {
          ...draft,
          value: resolved.status === 'ok' ? resolved.value : getDefaultValueForType(newType),
        };
      })()
    : { type: newType, name: newName, value: newValue };

  const handleAddVariable = () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setError('Variable name cannot be empty');
      return;
    }
    if (localCustomData.some(v => v.name === trimmedName)) {
      setError('Variable name already exists');
      return;
    }

    if (isNewRef) {
      const trimmedUid = newRefEditorUID.trim();
      if (!trimmedUid) {
        setError('Target entity EID cannot be empty');
        return;
      }
      if (trimmedUid === entity.editorEntityUID) {
        setError('Cannot reference the same entity');
        return;
      }
      if (!newTargetEntity) {
        setError('Target entity EID not found in scene');
        return;
      }
      if (!newRefValue) {
        setError('Please select a reference value');
        return;
      }
      if (newRefType === 'customData') {
        const targetVar = (newTargetEntity.customData ?? []).find(v => v.name === newRefValue);
        if (!targetVar) {
          setError(`Variable "${newRefValue}" not found on target entity`);
          return;
        }
        if (isVariableRef(targetVar)) {
          setError(`Variable "${newRefValue}" is a reference and cannot be selected`);
          return;
        }
      }

      const addedVar: CustomDataVariable = {
        type: previewNewVariable.type,
        name: trimmedName,
        value: previewNewVariable.value,
        refEditorUID: trimmedUid,
        refType: newRefType,
        refValue: newRefValue,
      };
      const next = [...localCustomData, addedVar];
      setLocalCustomData(next);
      latestRef.current = next;
      commitChanges(true);
    } else {
      const next = [...localCustomData, { type: newType, name: trimmedName, value: newValue }];
      setLocalCustomData(next);
      latestRef.current = next;
      commitChanges();
    }

    // Reset form
    setNewName('');
    setNewType('string');
    setNewValue('');
    setIsNewRef(false);
    setNewRefEditorUID('');
    setNewRefType('customData');
    setNewRefValue('');
    setError('');
    setIsAdding(false);
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setNewName('');
    setNewType('string');
    setNewValue('');
    setIsNewRef(false);
    setNewRefEditorUID('');
    setNewRefType('customData');
    setNewRefValue('');
    setError('');
  };

  return (
    <div className="inspector-section px-3 py-2 flex flex-col gap-2 border-b border-gray-700 bg-gray-950/10">
      <div className="inspector-section-title flex items-center justify-between text-xs text-gray-400 font-semibold uppercase tracking-wider mb-0.5">
        <span className="flex items-center gap-1.5 text-gray-300">
          Custom Data
        </span>
        <span className="text-[10px] text-gray-500 font-normal lowercase font-mono">
          {localCustomData.length} item{localCustomData.length !== 1 ? 's' : ''}
        </span>
      </div>

      {localCustomData.length === 0 && !isAdding ? (
        <div className="text-xs text-gray-600 italic py-1">No custom data variables</div>
      ) : (
        localCustomData.map((variable, index) => {
          const hasRef = isVariableRef(variable);
          const resolvedRef = hasRef
            ? resolveCustomDataRefValue(variable, refIndex, entity.editorEntityUID)
            : null;
          const targetEntity = hasRef && variable.refEditorUID
            ? refIndex.byUid.get(variable.refEditorUID.trim())
            : undefined;
          const isEditingThisRef = editingRefIndex === index;
          const editTargetEntity = isEditingThisRef && editRefEditorUID.trim()
            ? refIndex.byUid.get(editRefEditorUID.trim())
            : undefined;

          return (
            <div key={`${variable.name}:${index}`} className="inspector-subsection flex flex-col gap-1.5 rounded border border-gray-800 bg-gray-950/40 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-mono font-medium text-gray-300" title={variable.name}>
                  {variable.name || '(unnamed)'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {hasRef && (
                    <span
                      className={`rounded border px-1 py-0.5 font-mono text-[9px] uppercase ${
                        resolvedRef?.status === 'broken'
                          ? 'border-amber-700/80 bg-amber-950/60 text-amber-300'
                          : 'border-indigo-700/80 bg-indigo-950/60 text-indigo-300'
                      }`}
                      title={resolvedRef?.status === 'broken' ? resolvedRef.reason : 'Referenced value'}
                    >
                      {resolvedRef?.status === 'broken' ? 'ref!' : 'ref'}
                    </span>
                  )}
                  <span className="inspector-data-type-badge rounded border border-gray-700 bg-gray-900 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
                    {variable.type || 'unknown'}
                  </span>
                  <button
                    type="button"
                    onClick={() => (isEditingThisRef ? setEditingRefIndex(null) : startEditingRef(index))}
                    className="inspector-button rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    title={hasRef ? `Edit reference for '${variable.name}'` : `Set reference for '${variable.name}'`}
                  >
                    {hasRef ? 'Edit Ref' : 'Ref'}
                  </button>
                  {hasRef && (
                    <button
                      type="button"
                      onClick={() => unlinkCustomDataRef(index)}
                      className="inspector-button rounded border border-amber-800/70 bg-amber-950/40 px-1.5 py-0.5 text-[10px] text-amber-300 hover:bg-amber-900/60 hover:text-amber-100 transition-colors"
                      title={`Unlink reference for '${variable.name}' (keep current value)`}
                    >
                      Unlink
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteCustomDataValue(index)}
                    className="inspector-icon-button inspector-danger-icon rounded p-0.5 text-gray-500 hover:bg-red-950/60 hover:text-red-400 transition-colors"
                    title={`Delete variable '${variable.name}'`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {hasRef && (
                <div
                  className={`text-[10px] font-mono px-1.5 py-1 rounded border truncate ${
                    resolvedRef?.status === 'broken'
                      ? 'border-amber-800/60 bg-amber-950/30 text-amber-300'
                      : 'border-indigo-900/50 bg-indigo-950/25 text-indigo-300'
                  }`}
                  title={
                    resolvedRef?.status === 'broken'
                      ? `Broken Ref: ${resolvedRef.reason ?? 'Target missing'}`
                      : `Target EID: ${variable.refEditorUID} • ${variable.refType}.${variable.refValue}`
                  }
                >
                  {resolvedRef?.status === 'broken' ? (
                    <span>
                      ⚠ Broken Ref: {resolvedRef.reason ?? 'Target missing'} ({variable.refType}.{variable.refValue})
                    </span>
                  ) : (
                    <span>
                      Ref: {targetEntity?.editorEntityName || targetEntity?.entityName || '(unnamed)'} (#{targetEntity?.id}) → {variable.refType}.{variable.refValue}
                    </span>
                  )}
                </div>
              )}

              {isEditingThisRef && (
                <div className="rounded border border-indigo-800/60 bg-indigo-950/30 p-2 flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-400">Target Entity EID</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editRefEditorUID}
                        onChange={e => {
                          setEditRefEditorUID(e.target.value);
                          setEditRefValue('');
                          setEditRefError('');
                        }}
                        placeholder="Enter EID..."
                        aria-label={`Edit target EID for ${variable.name}`}
                        className="flex-1 editor-input text-xs px-2 py-1 font-mono min-w-0"
                      />
                      <button
                        type="button"
                        onClick={() => setRefPickerTarget('edit')}
                        className="inspector-button rounded border border-indigo-700 bg-indigo-900/60 px-2 py-1 text-[10px] font-medium text-indigo-200 hover:bg-indigo-800 hover:text-white shrink-0"
                      >
                        Select...
                      </button>
                    </div>
                    {editTargetEntity && (
                      <div className="text-[10px] font-mono text-indigo-300 truncate">
                        Target: {editTargetEntity.editorEntityName || editTargetEntity.entityName || '(unnamed)'} (ID: {editTargetEntity.id})
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">Ref Type</label>
                      <select
                        aria-label={`Edit refType for ${variable.name}`}
                        value={editRefType}
                        onChange={e => {
                          setEditRefType(e.target.value as CustomDataRefType);
                          setEditRefValue('');
                          setEditRefError('');
                        }}
                        className="w-full editor-input text-xs px-1.5 py-1 font-mono"
                      >
                        <option value="baseData">baseData</option>
                        <option value="customData">customData</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">Ref Value</label>
                      <select
                        aria-label={`Edit refValue for ${variable.name}`}
                        value={editRefValue}
                        disabled={!editTargetEntity}
                        onChange={e => {
                          setEditRefValue(e.target.value);
                          setEditRefError('');
                        }}
                        className="w-full editor-input text-xs px-1.5 py-1 font-mono"
                      >
                        <option value="">-- Select --</option>
                        {editRefType === 'baseData' && editTargetEntity && (
                          <>
                            <option value="name">name ({editTargetEntity.entityName || 'empty'})</option>
                            <option value="id">id ({editTargetEntity.id})</option>
                          </>
                        )}
                        {editRefType === 'customData' && editTargetEntity && (
                          (editTargetEntity.customData ?? []).map(targetVar => {
                            const isTargetRef = isVariableRef(targetVar);
                            return (
                              <option
                                key={targetVar.name}
                                value={targetVar.name}
                                disabled={isTargetRef}
                                className={isTargetRef ? 'text-gray-500 bg-gray-900' : ''}
                              >
                                {targetVar.name} ({targetVar.type}){isTargetRef ? ' (ref)' : ''}
                              </option>
                            );
                          })
                        )}
                      </select>
                    </div>
                  </div>

                  {editRefError && (
                    <div className="text-[10px] text-red-400 font-medium">{editRefError}</div>
                  )}

                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingRefIndex(null)}
                      className="inspector-button rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300 hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEditedRef(index)}
                      className="inspector-button inspector-button-primary rounded border border-indigo-600 bg-indigo-600/80 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-indigo-500"
                    >
                      Apply Ref
                    </button>
                  </div>
                </div>
              )}

              <CustomDataInput
                variable={variable}
                disabled={hasRef}
                onChange={value => updateCustomDataValue(index, value)}
              />
            </div>
          );
        })
      )}

      {/* Add Custom Data Form / Trigger */}
      {isAdding ? (
        <div className="inspector-subsection inspector-add-form rounded border border-indigo-900/60 bg-indigo-950/30 p-2.5 flex flex-col gap-2.5 mt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-300">New Custom Variable</span>
            <button
              type="button"
              onClick={cancelAdd}
              className="inspector-text-button text-[10px] text-gray-500 hover:text-gray-300"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            <div className="col-span-2">
              <label className="block text-[10px] text-gray-400 mb-0.5">Type</label>
              <select
                aria-label="New variable type"
                value={newType}
                onChange={e => handleTypeChange(e.target.value)}
                className="w-full editor-input text-xs px-1.5 py-1 font-mono"
              >
                <option value="string">string</option>
                <option value="int">int</option>
                <option value="uint">uint</option>
                <option value="float">float</option>
                <option value="vector2">vector2</option>
                <option value="vector3">vector3</option>
              </select>
            </div>
            <div className="col-span-3">
              <label className="block text-[10px] text-gray-400 mb-0.5">Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => {
                  setNewName(e.target.value);
                  setError('');
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddVariable();
                  if (e.key === 'Escape') cancelAdd();
                }}
                placeholder="Variable name..."
                className="w-full editor-input text-xs px-2 py-1 font-mono"
                autoFocus
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isNewRef}
              onChange={e => {
                setIsNewRef(e.target.checked);
                setError('');
              }}
              className="w-3.5 h-3.5"
            />
            <span className="text-xs text-indigo-200 font-medium">Reference Custom Data</span>
          </label>

          {isNewRef && (
            <div className="rounded border border-indigo-800/50 bg-gray-900/70 p-2 flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400">Target Entity EID</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    aria-label="Reference Target EID"
                    value={newRefEditorUID}
                    onChange={e => handleSelectNewTargetUid(e.target.value)}
                    placeholder="Enter or select EID..."
                    className="flex-1 editor-input text-xs px-2 py-1 font-mono min-w-0"
                  />
                  <button
                    type="button"
                    onClick={() => setRefPickerTarget('new')}
                    className="inspector-button rounded border border-indigo-700 bg-indigo-900/60 px-2 py-1 text-[10px] font-semibold text-indigo-200 hover:bg-indigo-800 hover:text-white shrink-0"
                  >
                    Select EID
                  </button>
                </div>
                {newRefEditorUID.trim() && (
                  newTargetEntity ? (
                    <div className="text-[10px] font-mono text-indigo-300 truncate">
                      Target: {newTargetEntity.editorEntityName || newTargetEntity.entityName || '(unnamed)'} (ID: {newTargetEntity.id})
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-amber-400">
                      Entity with this EID was not found in scene
                    </div>
                  )
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5">Ref Type</label>
                  <select
                    aria-label="Reference Type"
                    value={newRefType}
                    onChange={e => handleNewRefTypeChange(e.target.value as CustomDataRefType)}
                    className="w-full editor-input text-xs px-1.5 py-1 font-mono"
                  >
                    <option value="baseData">baseData</option>
                    <option value="customData">customData</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5">Ref Value</label>
                  <select
                    aria-label="Reference Value"
                    value={newRefValue}
                    disabled={!newTargetEntity}
                    onChange={e => handleNewRefValueChange(e.target.value, newTargetEntity)}
                    className="w-full editor-input text-xs px-1.5 py-1 font-mono"
                  >
                    <option value="">-- Select --</option>
                    {newRefType === 'baseData' && newTargetEntity && (
                      <>
                        <option value="name">name ({newTargetEntity.entityName || 'empty'})</option>
                        <option value="id">id ({newTargetEntity.id})</option>
                      </>
                    )}
                    {newRefType === 'customData' && newTargetEntity && (
                      (newTargetEntity.customData ?? []).map(targetVar => {
                        const isTargetRef = isVariableRef(targetVar);
                        return (
                          <option
                            key={targetVar.name}
                            value={targetVar.name}
                            disabled={isTargetRef}
                            className={isTargetRef ? 'text-gray-500 bg-gray-900' : ''}
                          >
                            {targetVar.name} ({targetVar.type}){isTargetRef ? ' (ref)' : ''}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] text-gray-400 mb-0.5">
              {isNewRef ? 'Resolved Value (Read-only)' : 'Initial Value'}
            </label>
            <CustomDataInput
              variable={previewNewVariable}
              disabled={isNewRef}
              onChange={val => setNewValue(val)}
            />
          </div>

          {error && (
            <div className="text-[10px] text-red-400 font-medium">{error}</div>
          )}

          <div className="flex items-center gap-1.5 justify-end mt-0.5">
            <button
              type="button"
              onClick={cancelAdd}
              className="inspector-button rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddVariable}
              className="inspector-button inspector-button-primary rounded border border-indigo-600 bg-indigo-600/80 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500 active:bg-indigo-700"
            >
              Add Variable
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsAdding(true);
            setNewName('');
            setNewType('string');
            setNewValue('');
            setIsNewRef(false);
            setNewRefEditorUID('');
            setNewRefType('customData');
            setNewRefValue('');
            setError('');
          }}
          className="inspector-add-button w-full mt-1 border border-dashed border-gray-700/80 hover:border-indigo-500/80 bg-gray-900/40 hover:bg-gray-800/60 text-gray-400 hover:text-indigo-300 text-xs py-1.5 px-3 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <span className="text-sm font-bold text-indigo-400">+</span> Add Custom Data
        </button>
      )}

      <EntityRefPickerModal
        isOpen={refPickerTarget !== null}
        entities={allEntities}
        excludeEntityUid={entity.editorEntityUID}
        selectedEntityUid={refPickerTarget === 'new' ? newRefEditorUID.trim() : editRefEditorUID.trim()}
        onSelect={(selectedUid) => {
          if (refPickerTarget === 'new') {
            handleSelectNewTargetUid(selectedUid);
          } else if (refPickerTarget === 'edit') {
            setEditRefEditorUID(selectedUid);
            setEditRefValue('');
            setEditRefError('');
          }
        }}
        onClose={() => setRefPickerTarget(null)}
      />
    </div>
  );
}

export function Inspector() {
  const selectedUIDs = useSceneStore(s => s.selectedUIDs);
  const scene = useSceneStore(s => s.scene);
  const deleteSelected = useSceneStore(s => s.deleteSelected);
  const templates = useSceneStore(s => s.templates);
  const templateAtlases = useSceneStore(s => s.templateAtlases);
  const pingTemplate = useSceneStore(s => s.pingTemplate);
  const pingSprite = useSceneStore(s => s.pingSprite);

  const [spritePickerOpen, setSpritePickerOpen] = useState(false);
  const [spritePickerEntityUid, setSpritePickerEntityUid] = useState<string | null>(null);
  const [exportPrefabModalOpen, setExportPrefabModalOpen] = useState(false);
  const [exportPrefabEntityUid, setExportPrefabEntityUid] = useState<string | null>(null);

  const selectedUID = selectedUIDs[0] ?? null;
  const entity = scene.entities.find(e => e.editorEntityUID === selectedUID);

  if (selectedUIDs.length === 0) {
    return (
      <div className="inspector-ui inspector-empty h-full bg-gray-900 flex flex-col items-center justify-center gap-2 p-4 text-center">
        <span className="inspector-empty-title text-xs text-gray-500">No entity selected</span>
        <span className="inspector-empty-help text-[11px] text-gray-600">Select an entity on canvas or in hierarchy to edit its properties</span>
      </div>
    );
  }

  if (selectedUIDs.length > 1) {
    return (
      <div className="inspector-ui h-full bg-gray-900 flex flex-col">
        <div className="inspector-header px-3 py-2 border-b border-gray-700 text-xs font-semibold text-gray-400 uppercase tracking-wider flex justify-between items-center">
          <span>Inspector</span>
          <button
            onClick={deleteSelected}
            className="inspector-button inspector-button-danger rounded border border-red-900/70 bg-red-950/50 px-2 py-0.5 text-xs text-red-300 hover:bg-red-900/70 hover:text-red-100"
            title="Delete selected (Del)"
          >
            Delete
          </button>
        </div>
        <div className="inspector-empty flex flex-col items-center justify-center flex-1 gap-2 text-center px-4">
          <span className="inspector-empty-title text-sm text-gray-300">{selectedUIDs.length} entities selected</span>
          <span className="inspector-empty-help text-xs text-gray-500">Move / Rotate / Delete<br />applies to all</span>
        </div>
      </div>
    );
  }

  if (!entity) return null;

  const rawEntityName = entity.entityName ?? '';
  const templateName = getTemplateKey(rawEntityName);
  const externalTemplate = resolveExternalTemplate(rawEntityName, templates);
  const template = resolveEntityTemplate(entity, templates);
  const canPingTemplate = Boolean(templateName && externalTemplate);
  const customData = entity.customData ?? [];
  const maxSpriteFrame = getMaxSpriteFrame(template, templateAtlases);
  const clampSpriteFrameInput = (value: number) => {
    const frame = Math.max(0, Math.round(value));
    return maxSpriteFrame === null ? frame : Math.min(maxSpriteFrame, frame);
  };

  const hasFileName = entityHasFileNameTag(entity);
  const currentScale = template?.scale ?? { x: 1, y: 1 };
  const currentSpriteCut = entity.inlineTemplate?.spriteCut ?? template?.spriteCut ?? { x: 1, y: 1 };
  const currentDiffuseColor = entity.diffuseColor ?? entity.color ?? template?.diffuseColor ?? { r: 1, g: 1, b: 1, a: 1 };

  const updateSpriteFile = (newSpriteFile: string) => {
    useSceneStore.getState().queueInspectorEdit(entity.editorEntityUID, 'spriteData', currentEntity => {
      if (entityHasFileNameTag(currentEntity)) return currentEntity;
      const data = { ...(currentEntity.inlineEntityData ?? {}), Sprite: newSpriteFile };
      return {
        ...currentEntity,
        inlineTemplate: { ...(currentEntity.inlineTemplate ?? { name: currentEntity.entityName }), spriteFile: newSpriteFile },
        inlineEntityData: data,
      };
    });
  };

  const updateSpriteCut = (axis: 'x' | 'y', val: number) => {
    const value = normalizeSpriteCutValue(val);
    useSceneStore.getState().queueInspectorEdit(entity.editorEntityUID, 'spriteData', currentEntity => {
      if (entityHasFileNameTag(currentEntity)) return currentEntity;
      const template = resolveEntityTemplate(currentEntity, useSceneStore.getState().templates);
      const cut = { ...(currentEntity.inlineTemplate?.spriteCut ?? template?.spriteCut ?? { x: 1, y: 1 }), [axis]: value };
      return {
        ...currentEntity,
        inlineTemplate: { ...(currentEntity.inlineTemplate ?? { name: currentEntity.entityName }), spriteCut: cut },
        inlineEntityData: { ...(currentEntity.inlineEntityData ?? {}), SpriteCut: cut },
      };
    });
  };

  return (
    <div className="inspector-ui h-full bg-gray-900 flex flex-col overflow-y-auto hierarchy-scrollbar">
      <div className="inspector-header px-3 py-2 border-b border-gray-700 text-xs font-semibold text-gray-400 uppercase tracking-wider flex justify-between items-center">
        <span>Inspector</span>
        <button
          onClick={deleteSelected}
          className="inspector-button inspector-button-danger rounded border border-red-900/70 bg-red-950/50 px-2 py-0.5 text-xs text-red-300 hover:bg-red-900/70 hover:text-red-100"
          title="Delete (Del)"
        >
          Delete
        </button>
      </div>

      <div className="inspector-entity-header px-3 py-2 border-b border-gray-700 flex items-center justify-between">
        <div className="truncate min-w-0 flex-1 mr-2">
          <div className="text-xs text-gray-200 font-semibold truncate" title={entity.editorEntityName || entity.entityName}>
            {entity.editorEntityName || entity.entityName || '(unnamed)'}
          </div>
          <div className="text-[11px] text-gray-400 font-mono truncate">
            id: {entity.id} {entity.entityName ? `• ${entity.entityName}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => {
              setExportPrefabEntityUid(entity.editorEntityUID);
              setExportPrefabModalOpen(true);
            }}
            title="Export this entity (and all descendants) as a Prefab (.prf) file"
            className="inspector-button rounded border border-cyan-700/80 bg-cyan-950/60 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-900/80 hover:text-white transition-colors flex items-center gap-1 shadow-sm"
          >
            <Icon name="prefab" size={12} /> Prefab
          </button>
          {hasFileName && (
            <button
              onClick={() => {
                const store = useSceneStore.getState();
                store.flushInspectorEdits();
                const refreshedStore = useSceneStore.getState();
                const current = refreshedStore.scene.entities.find(item => item.editorEntityUID === entity.editorEntityUID);
                if (current) {
                  refreshedStore.updateEntity(
                    current.editorEntityUID,
                    unpackEntityInstance(current, refreshedStore.templates),
                  );
                }
              }}
              title="Unpack entity template to create an inline entity and merge custom data"
              className="inspector-button rounded border border-purple-700/80 bg-purple-950/60 px-2 py-0.5 text-[10px] font-semibold text-purple-200 hover:bg-purple-900/80 hover:text-white transition-colors flex items-center gap-1 shadow-sm"
            >
              Unpack
            </button>
          )}
          <button
            onClick={() => pingTemplate(templateName)}
            disabled={!canPingTemplate}
            title={canPingTemplate ? `Ping entities/${templateName}.ent` : `Template not found: entities/${templateName}.ent`}
            className={`inspector-button rounded border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
              canPingTemplate
                ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-gray-100'
                : 'cursor-not-allowed border-gray-800 bg-gray-900 text-gray-600'
            }`}
          >
            Ping
          </button>
        </div>
      </div>

      {/* Identity Section */}
      <IdentitySection key={`${entity.editorEntityUID}:identity`} entity={entity} />

      {/* Transform Section (Unity Style) */}
      <TransformSection key={`${entity.editorEntityUID}:transform`}
        entity={entity} 
        hasFileName={hasFileName} 
        currentScale={currentScale} 
      />

      <SpriteFlagsSection key={`${entity.editorEntityUID}:sprite-flags:${currentSpriteCut.x}:${currentSpriteCut.y}`}
        entity={entity}
        hasFileName={hasFileName}
        template={template}
        maxSpriteFrame={maxSpriteFrame}
        clampSpriteFrameInput={clampSpriteFrameInput}
        pingSprite={pingSprite}
        updateSpriteCut={updateSpriteCut}
        setSpritePickerOpen={() => {
          setSpritePickerEntityUid(entity.editorEntityUID);
          setSpritePickerOpen(true);
        }}
      />

      <MaterialSection key={`${entity.editorEntityUID}:material`}
        entity={entity}
        hasFileName={hasFileName}
        template={template}
        currentDiffuseColor={currentDiffuseColor}
      />

      {template?.particleSystems && template.particleSystems.length > 0 && (
        <div className="inspector-section px-3 py-2 flex flex-col gap-1.5 border-b border-gray-700">
          <div className="inspector-section-title text-xs text-gray-500 mb-0.5 flex items-center justify-between">
            <span>Particle Systems ({template.particleSystems.length})</span>
            <span className="text-[10px] text-purple-400 font-mono">
              {template.particleSystems.reduce((acc, ps) => acc + ps.particles, 0)} particles
            </span>
          </div>
          <div className="flex flex-col gap-1 mt-1">
            {template.particleSystems.map((ps, idx) => (
              <div key={idx} className="inspector-subsection rounded bg-gray-900 border border-gray-800 p-2 text-[11px] flex flex-col gap-0.5">
                <div className="flex items-center justify-between font-mono text-gray-200">
                  <span className="truncate max-w-[140px]" title={ps.bitmap}>
                    {ps.bitmap || 'Default Bitmap'}
                  </span>
                  <span className="text-[10px] bg-purple-900/60 text-purple-200 px-1 rounded">
                    {ps.particles} max
                  </span>
                </div>
                <div className="text-gray-400 flex items-center justify-between text-[10px]">
                  <span>Life: {ps.lifeTime}ms</span>
                  <span>Size: {ps.size}px</span>
                  <span>Mode: {ps.alphaMode === 1 ? 'Additive' : ps.alphaMode === 2 ? 'Multiply' : 'Pixel'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CustomDataSection key={`${entity.editorEntityUID}:custom-data`}
        entity={entity}
        customData={customData}
      />

      <SpritePickerModal
        isOpen={spritePickerOpen && spritePickerEntityUid === entity.editorEntityUID}
        onClose={() => {
          setSpritePickerOpen(false);
          setSpritePickerEntityUid(null);
        }}
        currentSprite={entity.inlineTemplate?.spriteFile || null}
        onSelect={(sprite) => {
          updateSpriteFile(sprite);
          setSpritePickerOpen(false);
          setSpritePickerEntityUid(null);
        }}
      />

      <ExportPrefabModal
        isOpen={exportPrefabModalOpen && exportPrefabEntityUid === entity.editorEntityUID}
        entityUid={entity.editorEntityUID}
        defaultName={entity.editorEntityName || entity.entityName}
        onClose={() => {
          setExportPrefabModalOpen(false);
          setExportPrefabEntityUid(null);
        }}
      />
    </div>
  );
}
