import { describe, it, expect } from 'vitest';
import { parseScene } from '../parseScene';
import { serializeScene } from '../serializeScene';

describe('Inline Light Element Serialization', () => {
  const SAMPLE_SCENE_WITH_LIGHT = `<?xml version="1.0" encoding="utf-8"?>
<Ethanon>
    <SceneProperties lightIntensity="2" parallaxIntensity="0">
        <Ambient r="1" g="1" b="1" />
        <ZAxisDirection x="0" y="-1" />
    </SceneProperties>
    <EntitiesInScene>
        <Entity id="101" spriteFrame="0">
            <EntityName>torch_light</EntityName>
            <Position x="-48" y="32" z="1" angle="0" />
            <Entity static="1">
                <Light active="1" static="1" castShadows="0" range="1" haloBrightness="1" haloSize="294">
                    <Position x="-48" y="32" z="1" />
                    <Color r="1" g="0.6" b="0.4" />
                    <HaloBitmap>sparkle_entity.png</HaloBitmap>
                </Light>
            </Entity>
        </Entity>
    </EntitiesInScene>
</Ethanon>`;

  it('should parse and serialize inline Light element with attributes intact', () => {
    const scene = parseScene(SAMPLE_SCENE_WITH_LIGHT);
    expect(scene.entities).toHaveLength(1);

    const lightEntity = scene.entities[0];
    expect(lightEntity.inlineEntityData).toBeDefined();
    expect(lightEntity.inlineEntityData?.Light).toBeDefined();

    const serializedXml = serializeScene(scene);

    // Verify Light attributes are preserved as XML attributes, not child elements
    expect(serializedXml).toContain('active="1"');
    expect(serializedXml).toContain('static="1"');
    expect(serializedXml).toContain('castShadows="0"');
    expect(serializedXml).toContain('range="1"');
    expect(serializedXml).toContain('haloBrightness="1"');
    expect(serializedXml).toContain('haloSize="294"');

    // Verify child nodes of Light are preserved as elements
    expect(serializedXml).toContain('<HaloBitmap>sparkle_entity.png</HaloBitmap>');

    // Ensure bad child elements were NOT created
    expect(serializedXml).not.toContain('<active>');
    expect(serializedXml).not.toContain('<castShadows>');
    expect(serializedXml).not.toContain('<range>');
    expect(serializedXml).not.toContain('<haloBrightness>');
    expect(serializedXml).not.toContain('<haloSize>');
  });
});
