import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseScene } from "../../io/parseScene";
import { useSceneStore } from "../sceneStore";

const sceneXml = (polygon: string) => `<?xml version="1.0" encoding="utf-8"?>
<Ethanon>
  <SceneProperties lightIntensity="2" parallaxIntensity="0"><Ambient r="1" g="1" b="1" /><ZAxisDirection x="0" y="-1" /></SceneProperties>
  <EntitiesInScene>
    <Entity id="1" spriteFrame="0">
      <EntityName>rock</EntityName>
      <Position x="0" y="0" z="0" angle="0" />
      <Entity shape="3" static="1">
        <Collision><Position x="0" y="0" z="0" /><Size x="64" y="64" z="64" /><Polygon>${polygon}</Polygon></Collision>
      </Entity>
    </Entity>
  </EntitiesInScene>
</Ethanon>`;
const CONVEX =
  "v0 { x = -0.5; y = -0.5; } v1 { x = 0.5; y = -0.5; } v2 { x = 0.5; y = 0.5; } v3 { x = -0.5; y = 0.5; }";
const CONCAVE =
  "v0 { x = -0.5; y = -0.5; } v1 { x = 0; y = 0; } v2 { x = 0.5; y = -0.5; } v3 { x = 0.5; y = 0.5; } v4 { x = -0.5; y = 0.5; }";

describe("saving scenes with invalid collision geometry", () => {
  const write = vi.fn(async () => {});

  beforeEach(() => {
    write.mockClear();
    useSceneStore.setState({
      activeSceneHandle: {
        kind: "file",
        name: "level.esc",
        getFile: async () => {
          throw new Error("not used");
        },
        createWritable: async () => ({ write, close: async () => {} }),
      } as never,
    });
  });

  it("writes the scene and warns about the invalid entity", async () => {
    useSceneStore.setState({ scene: parseScene(sceneXml(CONCAVE)) });

    await useSceneStore.getState().saveActiveScene();

    expect(write).toHaveBeenCalledTimes(1);
    const state = useSceneStore.getState();
    expect(state.projectStatus).toBe("ready");
    expect(state.projectError).toBe(
      "Scene saved, but 1 entity has invalid collision geometry: rock.",
    );
  });

  it("saves without a warning when collisions are valid", async () => {
    useSceneStore.setState({ scene: parseScene(sceneXml(CONVEX)) });

    await useSceneStore.getState().saveActiveScene();

    expect(write).toHaveBeenCalledTimes(1);
    expect(useSceneStore.getState().projectError).toBeNull();
  });

  it("preserves raw invalid Polygon and Compound on save when unedited, and after editing unrelated physics", async () => {
    const rawCompoundXml = `<?xml version="1.0" encoding="utf-8"?>
<Ethanon>
  <SceneProperties lightIntensity="2" parallaxIntensity="0"><Ambient r="1" g="1" b="1" /><ZAxisDirection x="0" y="-1" /></SceneProperties>
  <EntitiesInScene>
    <Entity id="1" spriteFrame="0">
      <EntityName>compEntity</EntityName>
      <Position x="0" y="0" z="0" angle="0" />
      <Entity shape="4" static="1">
        <Collision><Position x="0" y="0" z="0" /><Size x="64" y="64" z="64" /><Compound>/* custom comment */ bad { shape=capsule; } outside { shape=box; posX=2.5; posY=0; sizeX=1; sizeY=1; }</Compound></Collision>
      </Entity>
    </Entity>
  </EntitiesInScene>
</Ethanon>`;

    useSceneStore.setState({ scene: parseScene(rawCompoundXml) });
    await useSceneStore.getState().saveActiveScene();

    expect(write).toHaveBeenCalledTimes(1);
    const savedXml1 = write.mock.calls[0][0] as string;
    expect(savedXml1).toContain("/* custom comment */");
    expect(savedXml1).toContain("shape=capsule");
    expect(savedXml1).toContain("posX=2.5");

    // Now edit an unrelated physics property (e.g. friction)
    write.mockClear();
    const entity = useSceneStore.getState().scene.entities[0];
    const physics = entity.inlineTemplate?.physics;
    expect(physics).toBeDefined();
    const updated = {
      ...physics!,
      friction: 0.5,
    };
    useSceneStore.getState().updateEntity(entity.editorEntityUID, (e) => ({
      ...e,
      inlineTemplate: {
        ...e.inlineTemplate,
        physics: updated,
        name: e.entityName,
      },
      inlineEntityData: { ...e.inlineEntityData, friction: "0.5" },
    }));

    await useSceneStore.getState().saveActiveScene();
    expect(write).toHaveBeenCalledTimes(1);
    const savedXml2 = write.mock.calls[0][0] as string;
    expect(savedXml2).toContain("/* custom comment */");
    expect(savedXml2).toContain("shape=capsule");
  });

  it("serializes new model when geometry is edited", async () => {
    useSceneStore.setState({ scene: parseScene(sceneXml(CONCAVE)) });
    const entity = useSceneStore.getState().scene.entities[0];
    useSceneStore
      .getState()
      .queueInspectorEdit(
        entity.editorEntityUID,
        "collision",
        (currentEntity) => {
          const resolved = currentEntity.inlineTemplate!.physics!;
          const newPolygon = [
            { name: "v0", x: 0, y: -1 },
            { name: "v1", x: 1, y: 1 },
            { name: "v2", x: -1, y: 1 },
          ];
          return {
            ...currentEntity,
            inlineTemplate: {
              ...currentEntity.inlineTemplate!,
              name: currentEntity.entityName,
              physics: {
                ...resolved,
                collision: {
                  ...resolved.collision,
                  polygon: newPolygon,
                  valid: true,
                },
              },
            },
            inlineEntityData: {
              ...currentEntity.inlineEntityData,
              Collision: {
                ...((currentEntity.inlineEntityData?.Collision as Record<
                  string,
                  unknown
                >) ?? {}),
                Polygon:
                  "v0 {\n\tx = 0;\n\ty = -1;\n}\nv1 {\n\tx = 1;\n\ty = 1;\n}\nv2 {\n\tx = -1;\n\ty = 1;\n}",
              },
            },
          };
        },
      );

    write.mockClear();
    await useSceneStore.getState().saveActiveScene();
    expect(write).toHaveBeenCalledTimes(1);
    const savedXml = write.mock.calls[0][0] as string;
    expect(savedXml).not.toContain(CONCAVE);
    expect(savedXml).toContain("v0");
    expect(useSceneStore.getState().projectError).toBeNull();
  });
});
