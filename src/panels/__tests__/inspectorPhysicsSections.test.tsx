// @vitest-environment jsdom

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { EntityPhysicsSection } from "../inspector/EntityPhysicsSection";
import { CollisionGeometrySection } from "../inspector/CollisionGeometrySection";
import { RevoluteJointsSection } from "../inspector/RevoluteJointsSection";
import { AxisNumberInput } from "../inspector/InspectorControls";
import { validatePolygon } from "../../utils/collision";
import type { EntityTemplate } from "../../types";

describe("Inspector Physics & Collision Sub-sections", () => {
  afterEach(cleanup);

  const createBaseTemplate = (): EntityTemplate => ({
    name: "test_entity",
    spriteFile: "test.png",
    spriteCut: { x: 1, y: 1 },
    type: "horizontal",
    pivotAdjust: { x: 0, y: 0 },
    scale: { x: 2, y: 2 },
    parallaxIntensity: 1,
    physics: {
      shape: 1,
      static: false,
      sensor: true,
      bullet: true,
      fixedRotation: true,
      friction: 0.75,
      density: 2.5,
      restitution: 0.5,
      gravityScale: -1,
      collision: {
        valid: true,
        position: { x: 10, y: 20, z: 5 },
        size: { x: 30, y: 40, z: 50 },
        polygon: [],
        compound: [],
        joints: [],
      },
      warnings: [],
    },
  });

  describe("EntityPhysicsSection", () => {
    it("renders restrained body simulation checkboxes and material input fields", () => {
      const template = createBaseTemplate();
      const onChange = vi.fn();
      render(
        <EntityPhysicsSection
          template={template}
          source="Template"
          onChange={onChange}
        />,
      );

      expect(screen.getByText("Physics")).toBeDefined();
      expect(screen.getByText("Template")).toBeDefined();
      expect(screen.getByText("Static")).toBeDefined();
      expect(screen.getByText("Sensor")).toBeDefined();
      expect(screen.getByText("Bullet (CCD)")).toBeDefined();
      expect(screen.getByText("Fixed Rotation")).toBeDefined();

      // Check material properties with edit text inputs
      expect(screen.getByText("Friction")).toBeDefined();
      expect(screen.getByDisplayValue("0.75")).toBeDefined();
      expect(screen.getByText("Density")).toBeDefined();
      expect(screen.getByDisplayValue("2.5")).toBeDefined();
      expect(screen.getByText("Restitution")).toBeDefined();
      expect(screen.getByDisplayValue("0.5")).toBeDefined();
      expect(screen.getByText("Gravity Scale")).toBeDefined();
      expect(screen.getByDisplayValue("-1")).toBeDefined();
    });

    it("updates local state and triggers onChange on user input", () => {
      const template = createBaseTemplate();
      const onChange = vi.fn();
      render(
        <EntityPhysicsSection
          template={template}
          source="Inline"
          onChange={onChange}
        />,
      );

      const frictionInput = screen.getByDisplayValue(
        "0.75",
      ) as HTMLInputElement;
      fireEvent.change(frictionInput, { target: { value: "0.9" } });
      expect(onChange).toHaveBeenCalledWith({ friction: 0.9 });
      expect(frictionInput.value).toBe("0.9");

      // User can clear input to empty draft without immediate reset to 0
      fireEvent.change(frictionInput, { target: { value: "" } });
      expect(frictionInput.value).toBe("");

      // On blur with empty/invalid string, reverts to valid template physics value
      fireEvent.blur(frictionInput);
      expect(frictionInput.value).toBe("0.75");
    });
  });

  describe("CollisionGeometrySection", () => {
    it("renders position and size without effective size", () => {
      const template = createBaseTemplate();
      render(<CollisionGeometrySection template={template} source="Inline" />);

      expect(screen.getByText("Collision")).toBeDefined();
      expect(screen.getByText("Inline")).toBeDefined();
      expect(screen.getByText("1 - Box")).toBeDefined();

      // Position: { x: 10, y: 20, z: 5 }
      expect(screen.getByDisplayValue("10")).toBeDefined();
      expect(screen.getByDisplayValue("20")).toBeDefined();
      expect(screen.getByDisplayValue("5")).toBeDefined();

      // Size: { x: 30, y: 40, z: 50 }
      expect(screen.getByDisplayValue("30")).toBeDefined();
      expect(screen.getByDisplayValue("40")).toBeDefined();
      expect(screen.getByDisplayValue("50")).toBeDefined();

      // Effective size is removed
      expect(screen.queryByText("Effective")).toBeNull();
    });

    it("renders polygon vertices with normalized bounds indicator for shape 3", () => {
      const template = createBaseTemplate();
      if (!template.physics) throw new Error("Physics required");
      template.physics.shape = 3;
      template.physics.collision.polygon = [
        { name: "v0", x: 0, y: -0.5 },
        { name: "v1", x: 0.333333333, y: 0.5 },
        { name: "v2", x: -0.5, y: 0.5 },
      ];

      render(<CollisionGeometrySection template={template} />);

      expect(screen.getByText("Collision")).toBeDefined();
      expect(screen.getByText("3 - Polygon")).toBeDefined();
      expect(screen.getByText(/Polygon Vertices \(3\)/)).toBeDefined();
      expect(screen.getByText("v0")).toBeDefined();
      // Precision 3 format check: 0.333333333 -> 0.333
      expect(screen.getByDisplayValue("0.333")).toBeDefined();
    });

    it("supports polygon interactive operations (add, move, delete, presets)", () => {
      const template = createBaseTemplate();
      if (!template.physics) throw new Error("Physics required");
      template.physics.shape = 3;
      template.physics.collision.polygon = [
        { name: "v0", x: 0, y: -1 },
        { name: "v1", x: 1, y: 1 },
        { name: "v2", x: -1, y: 1 },
      ];

      const onChangePolygon = vi.fn();
      render(
        <CollisionGeometrySection
          template={template}
          source="Inline"
          onChangePolygon={onChangePolygon}
        />,
      );

      // Verify convex badge
      expect(screen.getByText("Convex")).toBeDefined();

      // Delete button for v0 should be disabled when at minimum 3 vertices
      const deleteButtons = screen.getAllByRole("button", { name: /Delete v/ });
      expect(deleteButtons).toHaveLength(3);
      expect((deleteButtons[0] as HTMLButtonElement).disabled).toBe(true);

      // Click + Vertex
      const addBtn = screen.getByRole("button", { name: "Add Polygon Vertex" });
      fireEvent.click(addBtn);
      expect(onChangePolygon).toHaveBeenCalled();
      const updatedAfterAdd = onChangePolygon.mock.calls[0][0];
      expect(updatedAfterAdd).toHaveLength(4);
      expect(updatedAfterAdd[3].name).toBe("v3");
      // Added vertex must produce a strictly convex, clockwise, non-collinear valid polygon
      const addValidation = validatePolygon(updatedAfterAdd);
      expect(addValidation.valid).toBe(true);
      expect(addValidation.isConvex).toBe(true);
      expect(addValidation.isClockwise).toBe(true);
      expect(addValidation.errors).toHaveLength(0);

      // Click Preset Diamond
      onChangePolygon.mockClear();
      const diamondBtn = screen.getByRole("button", { name: /Apply Diamond/ });
      fireEvent.click(diamondBtn);
      expect(onChangePolygon).toHaveBeenCalled();
      const diamondVertices = onChangePolygon.mock.calls[0][0];
      expect(diamondVertices).toHaveLength(4);
    });

    it("shows validation warning when polygon vertices are counter-clockwise or invalid", () => {
      const template = createBaseTemplate();
      if (!template.physics) throw new Error("Physics required");
      template.physics.shape = 3;
      template.physics.collision.polygon = [
        { name: "v0", x: 0, y: -1 },
        { name: "v1", x: -1, y: 1 },
        { name: "v2", x: 1, y: 1 },
      ];

      render(<CollisionGeometrySection template={template} source="Inline" />);

      expect(screen.getByText("Invalid Geometry")).toBeDefined();
      expect(
        screen.getByText(
          /• Polygon vertices must use clockwise screen-space winding./,
        ),
      ).toBeDefined();
    });

    it("renders compound sub-shapes with angle in degrees and radians", () => {
      const template = createBaseTemplate();
      if (!template.physics) throw new Error("Physics required");
      template.physics.shape = 4;
      template.physics.collision.compound = [
        {
          name: "head",
          shape: "circle",
          posX: 0,
          posY: -0.5,
          radius: 12,
          angle: 0,
        },
        {
          name: "arm",
          shape: "box",
          posX: 0.2,
          posY: 0.1,
          sizeX: 10,
          sizeY: 5,
          angle: 1.570796,
          friction: 0.2,
        },
      ];

      render(<CollisionGeometrySection template={template} />);

      expect(screen.getByText(/Compound shapes \(2\)/)).toBeDefined();
      expect(screen.getByText("4 - Compound")).toBeDefined();
      expect(screen.getByText("head")).toBeDefined();
      expect(screen.getByText("arm")).toBeDefined();
      expect(screen.getByText(/90°/)).toBeDefined();
      expect(screen.getByDisplayValue("1.570796")).toBeDefined();
      expect(screen.getAllByText(/rad/).length).toBeGreaterThan(0);
      expect(screen.getByDisplayValue("12")).toBeDefined();
    });

    it("displays non-geometry warning banner when warnings exist and excludes geometry errors from amber banner", () => {
      const template = createBaseTemplate();
      if (!template.physics) throw new Error("Physics required");
      template.physics.warnings = [
        'Joint "arm" anchors must be within [-1, 1].',
        "Polygon must contain 3 to 8 sequential vertices.",
      ];
      template.physics.collision.valid = false;

      render(<CollisionGeometrySection template={template} />);

      expect(
        screen.getByText(/• Joint "arm" anchors must be within \[-1, 1\]\./),
      ).toBeDefined();
      expect(
        screen.queryByText(
          /• Polygon must contain 3 to 8 sequential vertices\./,
        ),
      ).toBeNull();
    });

    it("displays invalid collision banner with issues count, can collapse, and renders inputs for invalid parsed data", () => {
      const template = createBaseTemplate();
      if (!template.physics) throw new Error("Physics required");
      template.physics.shape = 3;
      template.physics.collision.valid = false;
      template.physics.collision.polygon = [
        { name: "v0", x: 0, y: -1 },
        { name: "v1", x: 2.5, y: 1 },
        { name: "v2", x: -1, y: 1 },
      ];

      render(<CollisionGeometrySection template={template} source="Inline" />);

      expect(screen.getByText(/Invalid collision · 1 issue/)).toBeDefined();
      expect(screen.getByText(/Polygon v1:/)).toBeDefined();
      expect(
        screen.getByText(/coordinates are outside \[-1, 1\]/),
      ).toBeDefined();

      expect(screen.getByDisplayValue("2.5")).toBeDefined();

      const toggleBtn = screen.getByRole("button", {
        name: /Invalid collision · 1 issue/,
      });
      fireEvent.click(toggleBtn);
      expect(
        screen.queryByText(/coordinates are outside \[-1, 1\]/),
      ).toBeNull();

      fireEvent.click(toggleBtn);
      expect(
        screen.getByText(/coordinates are outside \[-1, 1\]/),
      ).toBeDefined();
    });

    it("allows editing position and size with delta 0.5 and uniform circle lock", () => {
      const template = createBaseTemplate();
      if (!template.physics) throw new Error("Physics required");
      template.physics.shape = 2; // Circle
      template.physics.collision.size = { x: 40, y: 40, z: 20 };

      const onChangePosition = vi.fn();
      const onChangeSize = vi.fn();
      const onRemoveCollision = vi.fn();

      render(
        <CollisionGeometrySection
          template={template}
          source="Inline"
          onChangePosition={onChangePosition}
          onChangeSize={onChangeSize}
          onRemoveCollision={onRemoveCollision}
        />,
      );

      // Position edit (rounded integer)
      const xInputs = screen.getAllByLabelText("X");
      const posXInput = xInputs[0];
      fireEvent.change(posXInput, { target: { value: "25.7" } });
      expect(onChangePosition).toHaveBeenCalledWith(
        expect.objectContaining({ x: 26 }),
      );

      // Circle Uniform Size edit: editing X should update both X and Y with 0.5 snapping
      const sizeXInput = xInputs[1];
      fireEvent.change(sizeXInput, { target: { value: "80.2" } });
      expect(onChangeSize).toHaveBeenCalledWith(
        expect.objectContaining({ x: 80, y: 80 }),
      );

      // Wheel delta 0.5 test on Size
      fireEvent.wheel(sizeXInput, { deltaY: -100 });
      expect(onChangeSize).toHaveBeenCalledWith(
        expect.objectContaining({ x: 80.5, y: 80.5 }),
      );

      // Remove button
      const removeBtn = screen.getByLabelText("Remove Collision");
      fireEvent.click(removeBtn);
      expect(onRemoveCollision).toHaveBeenCalled();
    });

    it("supports CRUD operations for compound sub-shapes and disables add when reaching 8", () => {
      const template = createBaseTemplate();
      if (!template.physics) throw new Error("Physics required");
      template.physics.shape = 4;
      template.physics.collision.compound = [
        {
          name: "sub_0",
          shape: "box",
          posX: 0,
          posY: 0,
          sizeX: 1,
          sizeY: 1,
          angle: 0,
        },
      ];

      const onChangeShape = vi.fn();
      const onChangeCompound = vi.fn();

      const { rerender } = render(
        <CollisionGeometrySection
          template={template}
          source="Inline"
          onChangeShape={onChangeShape}
          onChangeCompound={onChangeCompound}
        />,
      );

      // 1. Changing Shape to Compound
      const shapeSelect = screen.getByLabelText("Collision Shape");
      fireEvent.change(shapeSelect, { target: { value: "4" } });
      expect(onChangeShape).toHaveBeenCalledWith(4);

      // 2. Add Box
      const addBoxBtn = screen.getByRole("button", {
        name: "Add Box Sub-shape",
      });
      fireEvent.click(addBoxBtn);
      expect(onChangeCompound).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: "sub_0" }),
          expect.objectContaining({ name: "sub_1", shape: "box" }),
        ]),
      );

      // 3. Add Circle
      const addCircleBtn = screen.getByRole("button", {
        name: "Add Circle Sub-shape",
      });
      fireEvent.click(addCircleBtn);
      expect(onChangeCompound).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: "sub_0" }),
          expect.objectContaining({
            name: "sub_1",
            shape: "circle",
            radius: 0.5,
          }),
        ]),
      );

      // 4. Update Name
      const nameInput = screen.getByLabelText("Sub-shape 1 Name");
      fireEvent.change(nameInput, { target: { value: "torso_box" } });
      expect(onChangeCompound).toHaveBeenCalledWith([
        expect.objectContaining({ name: "torso_box" }),
      ]);

      // 5. Update Position
      const posXInput = screen.getByLabelText("Sub-shape 1 Pos X");
      fireEvent.change(posXInput, { target: { value: "0.25" } });
      expect(onChangeCompound).toHaveBeenCalledWith([
        expect.objectContaining({ posX: 0.25 }),
      ]);

      // 6. Delete Sub-shape
      const deleteBtn = screen.getByLabelText("Delete Sub-shape 1");
      fireEvent.click(deleteBtn);
      expect(onChangeCompound).toHaveBeenCalledWith([]);

      // 7. Max 8 limit disables add & duplicate buttons
      const fullTemplate = createBaseTemplate();
      if (!fullTemplate.physics) throw new Error("Physics required");
      fullTemplate.physics.shape = 4;
      fullTemplate.physics.collision.compound = Array.from(
        { length: 8 },
        (_, i) => ({
          name: `sub_${i}`,
          shape: "box",
          posX: 0,
          posY: 0,
          sizeX: 1,
          sizeY: 1,
          angle: 0,
        }),
      );

      rerender(
        <CollisionGeometrySection
          template={fullTemplate}
          source="Inline"
          onChangeCompound={onChangeCompound}
        />,
      );

      expect(
        (
          screen.getByRole("button", {
            name: "Add Box Sub-shape",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      expect(
        (
          screen.getByRole("button", {
            name: "Add Circle Sub-shape",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      expect(
        (screen.getByLabelText("Duplicate Sub-shape 1") as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      expect(screen.getByText("8 / 8")).toBeDefined();
    });

    it("maintains stable input DOM instance across continuous typing and uses copy icon", () => {
      const template = createBaseTemplate();
      if (!template.physics) throw new Error("Physics required");
      template.physics.shape = 4;
      template.physics.collision.compound = [
        {
          name: "head",
          shape: "box",
          posX: 0,
          posY: 0,
          sizeX: 1,
          sizeY: 1,
          angle: 0,
        },
      ];

      const onChangeCompound = vi.fn();

      render(
        <CollisionGeometrySection
          template={template}
          source="Inline"
          onChangeCompound={onChangeCompound}
        />,
      );

      // Verify copy icon on duplicate button
      const duplicateBtn = screen.getByLabelText("Duplicate Sub-shape 1");
      const copyIcon = duplicateBtn.querySelector("svg.lucide-copy");
      expect(copyIcon).not.toBeNull();

      // Verify DOM input node stability when typing multiple characters
      const nameInput = screen.getByLabelText(
        "Sub-shape 1 Name",
      ) as HTMLInputElement;
      nameInput.focus();
      expect(document.activeElement).toBe(nameInput);

      fireEvent.change(nameInput, { target: { value: "h" } });
      expect(screen.getByLabelText("Sub-shape 1 Name")).toBe(nameInput);

      fireEvent.change(nameInput, { target: { value: "he" } });
      expect(screen.getByLabelText("Sub-shape 1 Name")).toBe(nameInput);

      fireEvent.change(nameInput, { target: { value: "head_box" } });
      expect(screen.getByLabelText("Sub-shape 1 Name")).toBe(nameInput);
      expect(nameInput.value).toBe("head_box");
    });
  });

  describe("RevoluteJointsSection", () => {
    it("renders joint details, inputs for target, anchors, limits and motor torque/speed", () => {
      const template = createBaseTemplate();
      if (!template.physics) throw new Error("Physics required");
      template.physics.collision.joints = [
        {
          name: "revoluteJoint_wheel",
          otherEntityName: "cart.ent",
          attachPointAX: -0.5,
          attachPointAY: 0.8,
          attachPointBX: 0,
          attachPointBY: 0,
          enableLimit: true,
          lowerAngle: -0.785398, // -45 deg
          upperAngle: 0.785398, // +45 deg
          enableMotor: true,
          motorSpeed: 3.14159, // ~180 deg/s
          maxMotorTorque: 250,
        },
      ];

      render(<RevoluteJointsSection template={template} source="Template" />);

      expect(screen.getByText(/Revolute Joints \(1\)/)).toBeDefined();
      expect(screen.getByText("Template")).toBeDefined();
      expect(screen.getByText("revoluteJoint_wheel")).toBeDefined();
      expect(screen.getByDisplayValue("cart.ent")).toBeDefined();
      expect(screen.getByDisplayValue("-0.785398")).toBeDefined();
      expect(screen.getByDisplayValue("0.785398")).toBeDefined();
      expect(screen.getByDisplayValue("3.14159")).toBeDefined();
      expect(screen.getByDisplayValue("250")).toBeDefined();
      expect(screen.getAllByText("rad").length).toBeGreaterThan(0);
      expect(screen.getByText("rad/s")).toBeDefined();
    });
  });

  describe("AxisNumberInput", () => {
    it("supports mouse drag scrubbing with dragDelta and commits on pointer up", () => {
      const onChange = vi.fn();
      const onCommit = vi.fn();
      render(
        <AxisNumberInput
          axis="X"
          badgeClass="axis-badge-x"
          value={10}
          dragDelta={0.5}
          precision={1}
          onChange={onChange}
          onCommit={onCommit}
        />,
      );

      const badge = screen.getByText("X");
      fireEvent.pointerDown(badge, { button: 0, clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(badge, { clientX: 116, pointerId: 1 });
      expect(onChange).toHaveBeenCalledWith(12);
      expect(onCommit).not.toHaveBeenCalled();

      fireEvent.pointerUp(badge, { pointerId: 1 });
      expect(onCommit).toHaveBeenCalledWith(12);
    });

    it("does not scrub when readOnly or disabled", () => {
      const onChange = vi.fn();
      render(
        <AxisNumberInput
          axis="X"
          badgeClass="axis-badge-x"
          value={10}
          dragDelta={0.5}
          readOnly
          onChange={onChange}
        />,
      );

      const badge = screen.getByText("X");
      fireEvent.pointerDown(badge, { button: 0, clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(badge, { clientX: 116, pointerId: 1 });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("Unsupported collision shape in CollisionGeometrySection", () => {
    it("displays Unsupported (rawValue) option, error banner, and allows selecting None or valid shapes", () => {
      const unsupportedTemplate: EntityTemplate = {
        name: "unsupported_entity",
        spriteFile: "test.png",
        spriteCut: { x: 1, y: 1 },
        type: "horizontal",
        pivotAdjust: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        parallaxIntensity: 1,
        physics: {
          shape: 0,
          static: false,
          sensor: false,
          bullet: false,
          fixedRotation: false,
          friction: 1,
          density: 1,
          restitution: 0,
          gravityScale: 1,
          collision: {
            valid: false,
            position: { x: 10, y: 20, z: 0 },
            size: { x: 64, y: 64, z: 64 },
            polygon: [],
            compound: [],
            joints: [],
          },
          diagnostics: [
            {
              scope: "collision",
              target: "Collision",
              code: "UNSUPPORTED_SHAPE_VALUE",
              message: 'Unsupported collision shape value "5".',
              rawValue: "5",
            },
          ],
          warnings: ['Unsupported collision shape value "5".'],
        },
      };

      const onChangeShape = vi.fn();
      const { rerender } = render(
        <CollisionGeometrySection
          template={unsupportedTemplate}
          source="Inline"
          onChangeShape={onChangeShape}
        />,
      );

      // 1. Selector shows Unsupported (5) instead of 0 - None
      const shapeSelect = screen.getByLabelText(
        "Collision Shape",
      ) as HTMLSelectElement;
      expect(shapeSelect.value).toBe("unsupported");
      const unsupportedOption = screen.getByRole("option", {
        name: "Unsupported (5)",
      }) as HTMLOptionElement;
      expect(unsupportedOption).toBeDefined();
      expect(unsupportedOption.disabled).toBe(true);

      // 2. Error banner is rendered despite shape === 0
      expect(screen.getByText("Invalid collision · 1 issue")).toBeDefined();
      expect(
        screen.getByText(/Unsupported collision shape value "5"/),
      ).toBeDefined();

      // 3. User can directly select 0 - None and callback receives 0
      fireEvent.change(shapeSelect, { target: { value: "0" } });
      expect(onChangeShape).toHaveBeenCalledWith(0);

      // 4. User can switch to 1 - Box, 3 - Polygon, or 4 - Compound
      onChangeShape.mockClear();
      fireEvent.change(shapeSelect, { target: { value: "1" } });
      expect(onChangeShape).toHaveBeenCalledWith(1);

      onChangeShape.mockClear();
      fireEvent.change(shapeSelect, { target: { value: "3" } });
      expect(onChangeShape).toHaveBeenCalledWith(3);

      onChangeShape.mockClear();
      fireEvent.change(shapeSelect, { target: { value: "4" } });
      expect(onChangeShape).toHaveBeenCalledWith(4);

      // 5. Read-only template renders Unsupported (5) instead of 0 - None
      rerender(
        <CollisionGeometrySection
          template={unsupportedTemplate}
          source="Template"
          readOnly
        />,
      );
      expect(screen.getByText("Unsupported (5)")).toBeDefined();
      expect(screen.queryByText("0 - None")).toBeNull();
    });

    it("renders 'No collision assigned' and no invalid banner when template has no physics or stale collision.valid=false", () => {
      const noPhysicsTemplate: EntityTemplate = {
        name: "no_physics_entity",
        spriteFile: "test.png",
        spriteCut: { x: 1, y: 1 },
        type: "horizontal",
        pivotAdjust: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        parallaxIntensity: 1,
      };

      const { rerender } = render(
        <CollisionGeometrySection template={noPhysicsTemplate} source="Inline" />,
      );

      expect(screen.getByText("No collision assigned")).toBeDefined();
      expect(screen.queryByText(/Invalid collision/)).toBeNull();
      expect(screen.queryByText(/Invalid collision · 0 issues/)).toBeNull();

      // Also test stale collision.valid=false on valid Box geometry with 0 diagnostics
      const staleFalseBoxTemplate = createBaseTemplate();
      staleFalseBoxTemplate.physics!.collision.valid = false;
      staleFalseBoxTemplate.physics!.diagnostics = [];

      rerender(
        <CollisionGeometrySection
          template={staleFalseBoxTemplate}
          source="Inline"
        />,
      );
      expect(screen.queryByText(/Invalid collision/)).toBeNull();

      // Also test stale collision.valid=true on invalid Box geometry (size 0)
      const staleTrueInvalidTemplate = createBaseTemplate();
      staleTrueInvalidTemplate.physics!.collision.valid = true;
      staleTrueInvalidTemplate.physics!.collision.size = { x: 0, y: 40, z: 50 };

      rerender(
        <CollisionGeometrySection
          template={staleTrueInvalidTemplate}
          source="Inline"
        />,
      );
      expect(screen.getByText("Invalid collision · 1 issue")).toBeDefined();
    });

    it("does not render invalid banner for new collision with valid default dimensions", () => {
      const normalNewTemplate: EntityTemplate = {
        name: "normal_box_entity",
        spriteFile: "test.png",
        spriteCut: { x: 1, y: 1 },
        type: "horizontal",
        pivotAdjust: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        parallaxIntensity: 1,
        physics: {
          shape: 1,
          static: false,
          sensor: false,
          bullet: false,
          fixedRotation: false,
          friction: 1,
          density: 1,
          restitution: 0,
          gravityScale: 1,
          collision: {
            valid: true,
            position: { x: 0, y: 0, z: 0 },
            size: { x: 64, y: 64, z: 64 },
            polygon: [],
            compound: [],
            joints: [],
          },
          diagnostics: [],
          warnings: [],
        },
      };

      render(
        <CollisionGeometrySection
          template={normalNewTemplate}
          source="Inline"
        />,
      );

      // Verify no invalid collision banner
      expect(screen.queryByText(/Invalid collision/)).toBeNull();
      expect(
        screen.queryByText(/Collision.Size: dimensions must be positive/),
      ).toBeNull();
    });

    it("displays 'Invalid collision · 1 issue' and error message for missing or invalid Collision.Position, never '0 issues'", () => {
      const templateWithMissingPosition: EntityTemplate = {
        name: "missing_pos_entity",
        spriteFile: "test.png",
        spriteCut: { x: 1, y: 1 },
        type: "horizontal",
        pivotAdjust: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        parallaxIntensity: 1,
        physics: {
          shape: 1,
          static: false,
          sensor: false,
          bullet: false,
          fixedRotation: false,
          friction: 1,
          density: 1,
          restitution: 0,
          gravityScale: 1,
          collision: {
            valid: false,
            position: { x: 0, y: 0, z: 0 },
            size: { x: 64, y: 64, z: 64 },
            polygon: [],
            compound: [],
            joints: [],
          },
          diagnostics: [
            {
              scope: "collision",
              target: "Collision.Position",
              code: "TAG_MISSING",
              message: "Collision.Position tag missing",
            },
          ],
          warnings: ["Collision.Position tag missing"],
        },
      };

      render(
        <CollisionGeometrySection
          template={templateWithMissingPosition}
          source="Inline"
        />,
      );

      expect(screen.getByText("Invalid collision · 1 issue")).toBeDefined();
      expect(screen.queryByText(/Invalid collision · 0 issues/)).toBeNull();
      expect(screen.getByText(/Collision\.Position:/)).toBeDefined();
      expect(screen.getByText(/Collision\.Position tag missing/)).toBeDefined();
    });
  });
});
