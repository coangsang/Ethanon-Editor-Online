// @vitest-environment jsdom

import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { EntityPhysicsSection } from '../inspector/EntityPhysicsSection';
import { CollisionGeometrySection } from '../inspector/CollisionGeometrySection';
import { RevoluteJointsSection } from '../inspector/RevoluteJointsSection';
import type { EntityTemplate } from '../../types';

describe('Inspector Physics & Collision Sub-sections', () => {
  afterEach(cleanup);

  const createBaseTemplate = (): EntityTemplate => ({
    name: 'test_entity',
    spriteFile: 'test.png',
    spriteCut: { x: 1, y: 1 },
    type: 0,
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
      render(<EntityPhysicsSection template={template} source="Template" />);

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
  });

  describe('CollisionGeometrySection', () => {
    it('renders position, size, and effective size with instance scale', () => {
      const template = createBaseTemplate();
      render(
        <CollisionGeometrySection
          template={template}
          source="Inline"
          instanceScale={{ x: 3, y: 1.5 }}
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
      expect(screen.getAllByDisplayValue('50')).toHaveLength(2);

      // Effective: { x: 30 * 3 = 90, y: 40 * 1.5 = 60, z: 50 }
      expect(screen.getByDisplayValue('90')).toBeDefined();
      expect(screen.getByDisplayValue('60')).toBeDefined();
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
});
