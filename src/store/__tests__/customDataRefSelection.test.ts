import { describe, expect, it } from 'vitest';
import { useSceneStore } from '../sceneStore';

describe('CustomData reference selection purity and loading sync', () => {
  const sampleXml = `<?xml version="1.0"?>
<Ethanon>
  <SceneProperties lightIntensity="2" parallaxIntensity="3">
    <Ambient r="0.5" g="0.5" b="0.5" />
    <ZAxisDirection x="0" y="-1" />
  </SceneProperties>
  <EntitiesInScene>
    <Entity id="10" spriteFrame="0" editorEntityUID="uid-source" editorEntityName="Source">
      <EntityName>source.ent</EntityName>
      <Position x="0" y="0" z="0" angle="0" />
      <Entity>
        <FileName>source.ent</FileName>
        <CustomData>
          <Variable>
            <Type>string</Type>
            <Name>material</Name>
            <Value>granite</Value>
          </Variable>
        </CustomData>
      </Entity>
    </Entity>
    <Entity id="11" spriteFrame="0" editorEntityUID="uid-sub" editorEntityName="Subscriber">
      <EntityName>sub.ent</EntityName>
      <Position x="50" y="50" z="0" angle="0" />
      <Entity>
        <FileName>sub.ent</FileName>
        <CustomData>
          <Variable>
            <Type>string</Type>
            <Name>refMat</Name>
            <Value refEditorUID="uid-source" refType="customData" refValue="material">stale-stone</Value>
          </Variable>
        </CustomData>
      </Entity>
    </Entity>
  </EntitiesInScene>
</Ethanon>`;

  it('syncs referenced values on loadScene, keeping hasUnsavedChanges() false and selection purely read-only', () => {
    const store = useSceneStore.getState();
    store.loadScene(sampleXml);

    const loadedSub = useSceneStore.getState().scene.entities.find(e => e.editorEntityUID === 'uid-sub')!;
    // Values must be synced upon load
    expect(loadedSub.customData[0].value).toBe('granite');
    // Scene is fresh, so hasUnsavedChanges must be false
    expect(useSceneStore.getState().hasUnsavedChanges()).toBe(false);

    const initialHistoryLen = useSceneStore.getState().history.length;
    const initialHistoryIdx = useSceneStore.getState().historyIndex;

    // Selecting subscriber entity should be completely side-effect free
    store.selectEntity('uid-sub');
    expect(useSceneStore.getState().selectedUIDs).toEqual(['uid-sub']);
    expect(useSceneStore.getState().hasUnsavedChanges()).toBe(false);
    expect(useSceneStore.getState().history.length).toBe(initialHistoryLen);
    expect(useSceneStore.getState().historyIndex).toBe(initialHistoryIdx);

    // Toggle selection
    store.toggleSelection('uid-source');
    expect(useSceneStore.getState().selectedUIDs).toEqual(['uid-sub', 'uid-source']);
    expect(useSceneStore.getState().hasUnsavedChanges()).toBe(false);

    // Set selection
    store.setSelection([]);
    expect(useSceneStore.getState().selectedUIDs).toEqual([]);
    expect(useSceneStore.getState().hasUnsavedChanges()).toBe(false);
  });
});
