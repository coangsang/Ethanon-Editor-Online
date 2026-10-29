import { describe, expect, it } from 'vitest';
import { parseScene } from '../parseScene';
import { serializeScene } from '../serializeScene';
import { parsePrefab } from '../parsePrefab';
import { serializePrefab } from '../serializePrefab';

describe('CustomData reference XML parsing and serialization', () => {
  const sampleXml = `<?xml version="1.0"?>
<Ethanon>
  <SceneProperties lightIntensity="2" parallaxIntensity="3">
    <Ambient r="0.5" g="0.5" b="0.5" />
    <ZAxisDirection x="0" y="-1" />
  </SceneProperties>
  <EntitiesInScene>
    <Entity id="10" spriteFrame="0" editorEntityUID="uid-source" editorEntityName="Source Pillar">
      <EntityName>pillar.ent</EntityName>
      <Position x="0" y="0" z="0" angle="0" />
      <Entity>
        <FileName>pillar.ent</FileName>
        <CustomData>
          <Variable>
            <Type>string</Type>
            <Name>material</Name>
            <Value>granite</Value>
          </Variable>
          <Variable>
            <Type>vector2</Type>
            <Name>spawnOffset</Name>
            <Value x="15" y="30" />
          </Variable>
        </CustomData>
      </Entity>
    </Entity>
    <Entity id="11" spriteFrame="0" editorEntityUID="uid-target" editorEntityName="Subscriber">
      <EntityName>follower.ent</EntityName>
      <Position x="50" y="50" z="0" angle="0" />
      <Entity>
        <FileName>follower.ent</FileName>
        <CustomData>
          <Variable>
            <Type>string</Type>
            <Name>refMat</Name>
            <Value refEditorUID="uid-source" refType="customData" refValue="material">stale-stone</Value>
          </Variable>
          <Variable>
            <Type>int</Type>
            <Name>refSourceId</Name>
            <Value refEditorUID="uid-source" refType="baseData" refValue="id">0</Value>
          </Variable>
          <Variable>
            <Type>vector2</Type>
            <Name>refOffset</Name>
            <Value x="0" y="0" refEditorUID="uid-source" refType="customData" refValue="spawnOffset" />
          </Variable>
        </CustomData>
      </Entity>
    </Entity>
  </EntitiesInScene>
</Ethanon>`;

  it('parses refEditorUID, refType, and refValue from <Value> tags and preserves them on normal serialize', () => {
    const scene = parseScene(sampleXml);
    const sub = scene.entities.find(e => e.editorEntityUID === 'uid-target')!;

    expect(sub.customData).toEqual([
      {
        type: 'string',
        name: 'refMat',
        value: 'stale-stone',
        refEditorUID: 'uid-source',
        refType: 'customData',
        refValue: 'material',
      },
      {
        type: 'int',
        name: 'refSourceId',
        value: '0',
        refEditorUID: 'uid-source',
        refType: 'baseData',
        refValue: 'id',
      },
      {
        type: 'vector2',
        name: 'refOffset',
        value: { x: 0, y: 0 },
        refEditorUID: 'uid-source',
        refType: 'customData',
        refValue: 'spawnOffset',
      },
    ]);

    // When serialized normally, values are updated from source and ref attributes are preserved
    const serialized = serializeScene(scene, { clean: false });
    expect(serialized).toContain('refEditorUID="uid-source"');
    expect(serialized).toContain('refType="customData"');
    expect(serialized).toContain('refValue="material"');

    const reparsed = parseScene(serialized);
    const reparsedSub = reparsed.entities.find(e => e.editorEntityUID === 'uid-target')!;
    expect(reparsedSub.customData[0]).toEqual({
      type: 'string',
      name: 'refMat',
      value: 'granite',
      refEditorUID: 'uid-source',
      refType: 'customData',
      refValue: 'material',
    });
    expect(reparsedSub.customData[1].value).toBe('10');
    expect(reparsedSub.customData[2].value).toEqual({ x: 15, y: 30 });
  });

  it('updates referenced values BEFORE stripping ref attributes when clean: true is used', () => {
    const scene = parseScene(sampleXml);
    const cleanXml = serializeScene(scene, { clean: true });

    expect(cleanXml).not.toContain('refEditorUID');
    expect(cleanXml).not.toContain('refType');
    expect(cleanXml).not.toContain('refValue');
    expect(cleanXml).toContain('<Value>granite</Value>');
    expect(cleanXml).toContain('<Value>10</Value>');

    const reparsedClean = parseScene(cleanXml);
    const subClean = reparsedClean.entities[1];
    expect(subClean.customData[0]).toEqual({
      type: 'string',
      name: 'refMat',
      value: 'granite',
    });
    expect(subClean.customData[1]).toEqual({
      type: 'int',
      name: 'refSourceId',
      value: '10',
    });
    expect(subClean.customData[2]).toEqual({
      type: 'vector2',
      name: 'refOffset',
      value: { x: 15, y: 30 },
    });
  });

  it('preserves reference attributes across Prefab serialization and parsing', () => {
    const scene = parseScene(sampleXml);
    const target = scene.entities.find(e => e.editorEntityUID === 'uid-target')!;
    const prfXml = serializePrefab(target, scene.entities, { mode: 'keepReference' });
    const parsedPrefab = parsePrefab(prfXml);

    expect(parsedPrefab[0].customData[0]).toEqual({
      type: 'string',
      name: 'refMat',
      value: 'granite',
      refEditorUID: 'uid-source',
      refType: 'customData',
      refValue: 'material',
    });
  });
});

