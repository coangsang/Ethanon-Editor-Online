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
                diagnostics: [],
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

  it("restores validity and saves without warning when changing invalid Polygon/Compound to Box or Circle", async () => {
    const { applyPhysicsToEntity } = await import("../../utils/entityTemplate");
    const { filterDiagnosticsForEdit, filterWarningsForEdit, isCollisionGeometryValid } = await import("../../utils/collision");

    // 1. Invalid Polygon -> Box (1)
    useSceneStore.setState({ scene: parseScene(sceneXml(CONCAVE)) });
    const polyEntity = useSceneStore.getState().scene.entities[0];
    useSceneStore.getState().queueInspectorEdit(polyEntity.editorEntityUID, "collision", (currentEntity) => {
      const basePhysics = currentEntity.inlineTemplate!.physics!;
      const remainingDiagnostics = filterDiagnosticsForEdit(basePhysics.diagnostics, { type: "shape", newShape: 1 });
      const remainingWarnings = filterWarningsForEdit(basePhysics.warnings, { type: "shape", newShape: 1 });
      const nextPhysics = {
        ...basePhysics,
        shape: 1 as const,
        collision: {
          ...basePhysics.collision,
          valid: isCollisionGeometryValid({
            shape: 1,
            collision: basePhysics.collision,
            diagnostics: remainingDiagnostics,
          }),
        },
        diagnostics: remainingDiagnostics,
        warnings: remainingWarnings,
      };
      return applyPhysicsToEntity(currentEntity, nextPhysics);
    });

    write.mockClear();
    await useSceneStore.getState().saveActiveScene();
    expect(write).toHaveBeenCalledTimes(1);
    expect(useSceneStore.getState().projectError).toBeNull();

    // 2. Invalid Polygon -> Circle (2)
    useSceneStore.setState({ scene: parseScene(sceneXml(CONCAVE)) });
    const polyEntity2 = useSceneStore.getState().scene.entities[0];
    useSceneStore.getState().queueInspectorEdit(polyEntity2.editorEntityUID, "collision", (currentEntity) => {
      const basePhysics = currentEntity.inlineTemplate!.physics!;
      const remainingDiagnostics = filterDiagnosticsForEdit(basePhysics.diagnostics, { type: "shape", newShape: 2 });
      const remainingWarnings = filterWarningsForEdit(basePhysics.warnings, { type: "shape", newShape: 2 });
      const nextPhysics = {
        ...basePhysics,
        shape: 2 as const,
        collision: {
          ...basePhysics.collision,
          valid: isCollisionGeometryValid({
            shape: 2,
            collision: basePhysics.collision,
            diagnostics: remainingDiagnostics,
          }),
        },
        diagnostics: remainingDiagnostics,
        warnings: remainingWarnings,
      };
      return applyPhysicsToEntity(currentEntity, nextPhysics);
    });

    write.mockClear();
    await useSceneStore.getState().saveActiveScene();
    expect(write).toHaveBeenCalledTimes(1);
    expect(useSceneStore.getState().projectError).toBeNull();
  });

  it("keeps raw block and invalid state on no-op commit, and replaces raw when geometry is actually edited", async () => {
    const { applyPhysicsToEntity } = await import("../../utils/entityTemplate");
    const { compoundsEqual, filterDiagnosticsForEdit, filterWarningsForEdit, isCollisionGeometryValid, validateCompound } = await import("../../utils/collision");

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
    const entity = useSceneStore.getState().scene.entities[0];
    const initialCompound = entity.inlineTemplate!.physics!.collision.compound;

    // Simulate no-op commit: same compound passed back
    useSceneStore.getState().queueInspectorEdit(entity.editorEntityUID, "collision", (currentEntity) => {
      const basePhysics = currentEntity.inlineTemplate!.physics!;
      if (compoundsEqual(basePhysics.collision.compound, initialCompound)) {
        return currentEntity; // No-op: keep current
      }
      const remainingDiagnostics = filterDiagnosticsForEdit(basePhysics.diagnostics, { type: "compound" });
      const nextPhysics = {
        ...basePhysics,
        shape: 4 as const,
        collision: {
          ...basePhysics.collision,
          compound: initialCompound,
          valid: isCollisionGeometryValid({
            shape: 4,
            collision: { ...basePhysics.collision, compound: initialCompound },
            diagnostics: remainingDiagnostics,
          }),
        },
        diagnostics: remainingDiagnostics,
      };
      return applyPhysicsToEntity(currentEntity, nextPhysics, { forceSerializeCompound: true });
    });

    write.mockClear();
    await useSceneStore.getState().saveActiveScene();
    expect(write).toHaveBeenCalledTimes(1);
    const noOpSavedXml = write.mock.calls[0][0] as string;
    expect(noOpSavedXml).toContain("shape=capsule");
    expect(noOpSavedXml).toContain("/* custom comment */");
    expect(useSceneStore.getState().projectError).toBe(
      "Scene saved, but 1 entity has invalid collision geometry: compEntity.",
    );

    // Now actual edit: change posX to 0.5 (within [-1, 1] range)
    const editedCompound = [{ ...initialCompound[0], posX: 0.5 }];
    useSceneStore.getState().queueInspectorEdit(entity.editorEntityUID, "collision", (currentEntity) => {
      const basePhysics = currentEntity.inlineTemplate!.physics!;
      if (compoundsEqual(basePhysics.collision.compound, editedCompound)) {
        return currentEntity;
      }
      const remainingDiagnostics = filterDiagnosticsForEdit(basePhysics.diagnostics, { type: "compound" });
      const compValidation = validateCompound(editedCompound);
      const remainingWarnings = filterWarningsForEdit(basePhysics.warnings, { type: "compound" });
      const nextPhysics = {
        ...basePhysics,
        shape: 4 as const,
        collision: {
          ...basePhysics.collision,
          compound: editedCompound,
          valid: isCollisionGeometryValid({
            shape: 4,
            collision: { ...basePhysics.collision, compound: editedCompound },
            diagnostics: remainingDiagnostics,
          }),
        },
        diagnostics: remainingDiagnostics,
        warnings: compValidation.valid ? remainingWarnings : [...remainingWarnings, ...compValidation.errors],
      };
      return applyPhysicsToEntity(currentEntity, nextPhysics, { forceSerializeCompound: true });
    });

    write.mockClear();
    await useSceneStore.getState().saveActiveScene();
    expect(write).toHaveBeenCalledTimes(1);
    const actualEditXml = write.mock.calls[0][0] as string;
    expect(actualEditXml).not.toContain("shape=capsule");
    expect(actualEditXml).not.toContain("/* custom comment */");
    expect(actualEditXml).toContain("outside");
    expect(useSceneStore.getState().projectError).toBeNull();
  });

  it("warns on save for unsupported collision shape and preserves raw data", async () => {
    const unsupportedShapeXml = `<?xml version="1.0" encoding="utf-8"?>
<Ethanon>
  <SceneProperties lightIntensity="2" parallaxIntensity="0"><Ambient r="1" g="1" b="1" /><ZAxisDirection x="0" y="-1" /></SceneProperties>
  <EntitiesInScene>
    <Entity id="1" spriteFrame="0">
      <EntityName>unsuppEntity</EntityName>
      <Position x="0" y="0" z="0" angle="0" />
      <Entity shape="5" static="1">
        <Collision><Position x="10" y="20" z="0" /><Size x="64" y="64" z="64" /></Collision>
      </Entity>
    </Entity>
    <Entity id="2" spriteFrame="0">
      <EntityName>normalNoCollision</EntityName>
      <Position x="0" y="0" z="0" angle="0" />
      <Entity shape="0" static="0" />
    </Entity>
  </EntitiesInScene>
</Ethanon>`;

    useSceneStore.setState({ scene: parseScene(unsupportedShapeXml) });
    write.mockClear();
    await useSceneStore.getState().saveActiveScene();

    expect(write).toHaveBeenCalledTimes(1);
    expect(useSceneStore.getState().projectError).toBe(
      "Scene saved, but 1 entity has invalid collision geometry: unsuppEntity.",
    );

    const savedXml = write.mock.calls[0][0] as string;
    expect(savedXml).toContain('shape="5"');
    expect(savedXml).toContain('<Position x="10" y="20" z="0"');
  });

  it("evaluates save warnings from actual geometry/diagnostics even if cached collision.valid is stale", async () => {
    // 1. Stale collision.valid = true on concave polygon -> still warns on save
    const invalidScene = parseScene(sceneXml(CONCAVE));
    invalidScene.entities[0].inlineTemplate!.physics!.collision.valid = true;
    useSceneStore.setState({ scene: invalidScene });
    write.mockClear();

    await useSceneStore.getState().saveActiveScene();
    expect(write).toHaveBeenCalledTimes(1);
    expect(useSceneStore.getState().projectError).toBe(
      "Scene saved, but 1 entity has invalid collision geometry: rock.",
    );

    // 2. Stale collision.valid = false on convex polygon with no diagnostics -> saves without warning
    const validScene = parseScene(sceneXml(CONVEX));
    validScene.entities[0].inlineTemplate!.physics!.collision.valid = false;
    validScene.entities[0].inlineTemplate!.physics!.diagnostics = [];
    useSceneStore.setState({ scene: validScene });
    write.mockClear();

    await useSceneStore.getState().saveActiveScene();
    expect(write).toHaveBeenCalledTimes(1);
    expect(useSceneStore.getState().projectError).toBeNull();
  });
});
