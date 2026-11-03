// @vitest-environment jsdom

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { EntityPhysicsSection } from '../inspector/EntityPhysicsSection';
import { CollisionGeometrySection } from '../inspector/CollisionGeometrySection';
import { RevoluteJointsSection } from '../inspector/RevoluteJointsSection';
import { AxisNumberInput } from '../inspector/InspectorControls';
import type { EntityTemplate } from '../../types';

describe('Inspector Physics & Collision Sub-sections', () => {
  afterEach(cleanup);

  const createBaseTemplate = (): EntityTemplate => ({
    name: 'test_entity',
    spriteFile: 'test.png',
    spriteCut: { x: 1, y: 1 },
    type: 'horizontal',
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

  describe('EntityPhysicsSection', () => {
    it('renders restrained body simulation checkboxes and material input fields', () => {
      const template = createBaseTemplate();
      const onChange = vi.fn();
      render(<EntityPhysicsSection template={template} source="Template" onChange={onChange} />);

      expect(screen.getByText('Physics')).toBeDefined();
      expect(screen.getByText('Template')).toBeDefined();
      expect(screen.getByText('Static')).toBeDefined();
      expect(screen.getByText('Sensor')).toBeDefined();
      expect(screen.getByText('Bullet (CCD)')).toBeDefined();
      expect(screen.getByText('Fixed Rotation')).toBeDefined();

      // Check material properties with edit text inputs
      expect(screen.getByText('Friction')).toBeDefined();
      expect(screen.getByDisplayValue('0.75')).toBeDefined();
      expect(screen.getByText('Density')).toBeDefined();
      expect(screen.getByDisplayValue('2.5')).toBeDefined();
      expect(screen.getByText('Restitution')).toBeDefined();
      expect(screen.getByDisplayValue('0.5')).toBeDefined();
      expect(screen.getByText('Gravity Scale')).toBeDefined();
      expect(screen.getByDisplayValue('-1')).toBeDefined();
    });

    it('updates local state and triggers onChange on user input', () => {
      const template = createBaseTemplate();
      const onChange = vi.fn();
      render(<EntityPhysicsSection template={template} source="Inline" onChange={onChange} />);

      const frictionInput = screen.getByDisplayValue('0.75') as HTMLInputElement;
      fireEvent.change(frictionInput, { target: { value: '0.9' } });
      expect(onChange).toHaveBeenCalledWith({ friction: 0.9 });
      expect(frictionInput.value).toBe('0.9');

      // User can clear input to empty draft without immediate reset to 0
      fireEvent.change(frictionInput, { target: { value: '' } });
      expect(frictionInput.value).toBe('');

      // On blur with empty/invalid string, reverts to valid template physics value
      fireEvent.blur(frictionInput);
      expect(frictionInput.value).toBe('0.75');
    });
  });

  describe('CollisionGeometrySection', () => {
    it('renders position and size without effective size', () => {
      const template = createBaseTemplate();
      render(
        <CollisionGeometrySection
          template={template}
          source="Inline"
        />
      );

      expect(screen.getByText('Collision')).toBeDefined();
      expect(screen.getByText('Inline')).toBeDefined();
      expect(screen.getByText('1 - Box')).toBeDefined();

      // Position: { x: 10, y: 20, z: 5 }
      expect(screen.getByDisplayValue('10')).toBeDefined();
      expect(screen.getByDisplayValue('20')).toBeDefined();
      expect(screen.getByDisplayValue('5')).toBeDefined();

      // Size: { x: 30, y: 40, z: 50 }
      expect(screen.getByDisplayValue('30')).toBeDefined();
      expect(screen.getByDisplayValue('40')).toBeDefined();
      expect(screen.getByDisplayValue('50')).toBeDefined();

      // Effective size is removed
      expect(screen.queryByText('Effective')).toBeNull();
    });

    it('renders polygon vertices with normalized bounds indicator for shape 3', () => {
      const template = createBaseTemplate();
      if (!template.physics) throw new Error('Physics required');
      template.physics.shape = 3;
      template.physics.collision.polygon = [
        { name: 'v0', x: 0, y: -0.5 },
        { name: 'v1', x: 0.333333333, y: 0.5 },
        { name: 'v2', x: -0.5, y: 0.5 },
      ];

      render(<CollisionGeometrySection template={template} />);

      expect(screen.getByText('Collision')).toBeDefined();
      expect(screen.getByText('3 - Polygon')).toBeDefined();
      expect(screen.getByText(/Polygon Vertices \(3\)/)).toBeDefined();
      expect(screen.getByText('[-1.0, 1.0]')).toBeDefined();
      expect(screen.getByText('v0')).toBeDefined();
      // Precision 3 format check: 0.333333333 -> 0.333
      expect(screen.getByDisplayValue('0.333')).toBeDefined();
    });

    it('renders compound sub-shapes with angle in degrees and radians', () => {
      const template = createBaseTemplate();
      if (!template.physics) throw new Error('Physics required');
      template.physics.shape = 4;
      template.physics.collision.compound = [
        {
          name: 'head',
          shape: 'circle',
          posX: 0,
          posY: -0.5,
          radius: 12,
          angle: 0,
        },
        {
          name: 'arm',
          shape: 'box',
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
      expect(screen.getByText('4 - Compound')).toBeDefined();
      expect(screen.getByText('head')).toBeDefined();
      expect(screen.getByText('arm')).toBeDefined();
      expect(screen.getByText(/90°/)).toBeDefined();
      expect(screen.getByDisplayValue('1.570796')).toBeDefined();
      expect(screen.getAllByText(/rad/).length).toBeGreaterThan(0);
      expect(screen.getByDisplayValue('12')).toBeDefined();
    });

    it('displays geometry warning banner when warnings exist', () => {
      const template = createBaseTemplate();
      if (!template.physics) throw new Error('Physics required');
      template.physics.warnings = ['Polygon must be convex.'];
      template.physics.collision.valid = false;

      render(<CollisionGeometrySection template={template} />);

      expect(screen.getByText(/• Polygon must be convex./)).toBeDefined();
    });

    it('allows editing position and size with delta 0.5 and uniform circle lock', () => {
      const template = createBaseTemplate();
      if (!template.physics) throw new Error('Physics required');
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
        />
      );

      // Position edit (rounded integer)
      const xInputs = screen.getAllByLabelText('X');
      const posXInput = xInputs[0];
      fireEvent.change(posXInput, { target: { value: '25.7' } });
      expect(onChangePosition).toHaveBeenCalledWith(expect.objectContaining({ x: 26 }));

      // Circle Uniform Size edit: editing X should update both X and Y with 0.5 snapping
      const sizeXInput = xInputs[1];
      fireEvent.change(sizeXInput, { target: { value: '80.2' } });
      expect(onChangeSize).toHaveBeenCalledWith(expect.objectContaining({ x: 80, y: 80 }));

      // Wheel delta 0.5 test on Size
      fireEvent.wheel(sizeXInput, { deltaY: -100 });
      expect(onChangeSize).toHaveBeenCalledWith(expect.objectContaining({ x: 80.5, y: 80.5 }));

      // Remove button
      const removeBtn = screen.getByLabelText('Remove Collision');
      fireEvent.click(removeBtn);
      expect(onRemoveCollision).toHaveBeenCalled();
    });
  });

  describe('RevoluteJointsSection', () => {
    it('renders joint details, inputs for target, anchors, limits and motor torque/speed', () => {
      const template = createBaseTemplate();
      if (!template.physics) throw new Error('Physics required');
      template.physics.collision.joints = [
        {
          name: 'revoluteJoint_wheel',
          otherEntityName: 'cart.ent',
          attachPointAX: -0.5,
          attachPointAY: 0.8,
          attachPointBX: 0,
          attachPointBY: 0,
          enableLimit: true,
          lowerAngle: -0.785398, // -45 deg
          upperAngle: 0.785398,  // +45 deg
          enableMotor: true,
          motorSpeed: 3.14159,   // ~180 deg/s
          maxMotorTorque: 250,
        },
      ];

      render(<RevoluteJointsSection template={template} source="Template" />);

      expect(screen.getByText(/Revolute Joints \(1\)/)).toBeDefined();
      expect(screen.getByText('Template')).toBeDefined();
      expect(screen.getByText('revoluteJoint_wheel')).toBeDefined();
      expect(screen.getByDisplayValue('cart.ent')).toBeDefined();
      expect(screen.getByDisplayValue('-0.785398')).toBeDefined();
      expect(screen.getByDisplayValue('0.785398')).toBeDefined();
      expect(screen.getByDisplayValue('3.14159')).toBeDefined();
      expect(screen.getByDisplayValue('250')).toBeDefined();
      expect(screen.getAllByText('rad').length).toBeGreaterThan(0);
      expect(screen.getByText('rad/s')).toBeDefined();
    });
  });

  describe('AxisNumberInput', () => {
    it('supports mouse drag scrubbing with dragDelta and commits on pointer up', () => {
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
        />
      );

      const badge = screen.getByText('X');
      fireEvent.pointerDown(badge, { button: 0, clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(badge, { clientX: 116, pointerId: 1 });
      expect(onChange).toHaveBeenCalledWith(12);
      expect(onCommit).not.toHaveBeenCalled();

      fireEvent.pointerUp(badge, { pointerId: 1 });
      expect(onCommit).toHaveBeenCalledWith(12);
    });

    it('does not scrub when readOnly or disabled', () => {
      const onChange = vi.fn();
      render(
        <AxisNumberInput
          axis="X"
          badgeClass="axis-badge-x"
          value={10}
          dragDelta={0.5}
          readOnly
          onChange={onChange}
        />
      );

      const badge = screen.getByText('X');
      fireEvent.pointerDown(badge, { button: 0, clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(badge, { clientX: 116, pointerId: 1 });
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
