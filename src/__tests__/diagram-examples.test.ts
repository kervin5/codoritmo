/**
 * Builds and lays out the flowchart of every example program and checks the
 * structural invariants both renderers rely on.
 *
 * Set DIAGRAM_SVG_DIR=/some/dir to also write each routine's SVG export there.
 */
import fs from 'fs';
import path from 'path';

import {
  buildFlowDiagram,
  exportRoutineToSvg,
  FLOW_NODE_KINDS,
  FLOW_SOURCE_HANDLES,
  FLOW_TARGET_HANDLES,
  layoutFlowDiagramSync,
  SHAPE_FOR_KIND,
  type PositionedFlowRoutineDiagram,
} from '@/src/diagram';
import { examplePrograms, normalizeEngineSettings, Parser } from '@/src/engine';

function layoutExample(source: string, settings: Parameters<typeof normalizeEngineSettings>[0]) {
  const parsed = new Parser(source, { settings: normalizeEngineSettings(settings) }).parse();
  expect(parsed.program).not.toBeNull();
  const model = buildFlowDiagram(parsed.program!);
  return { model, positioned: layoutFlowDiagramSync(model) };
}

function overlaps(a: { position: { x: number; y: number }; size: { width: number; height: number } }, b: typeof a) {
  return a.position.x < b.position.x + b.size.width
    && b.position.x < a.position.x + a.size.width
    && a.position.y < b.position.y + b.size.height
    && b.position.y < a.position.y + a.size.height;
}

/** Does an axis-aligned segment pass through the inside of a node box (shrunk by a margin)? */
function segmentCrossesNode(
  a: { x: number; y: number },
  b: { x: number; y: number },
  node: PositionedFlowRoutineDiagram['nodes'][number],
) {
  const margin = 2;
  const left = node.position.x + margin;
  const right = node.position.x + node.size.width - margin;
  const top = node.position.y + margin;
  const bottom = node.position.y + node.size.height - margin;
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return minX < right && maxX > left && minY < bottom && maxY > top;
}

const svgDir = process.env.DIAGRAM_SVG_DIR;

describe.each(examplePrograms.map((example) => [example.id, example] as const))('example %s', (_id, example) => {
  const { model, positioned } = layoutExample(example.source, example.settings);

  it('uses only known symbols', () => {
    model.routines.forEach((routine) => {
      routine.nodes.forEach((node) => {
        expect(FLOW_NODE_KINDS).toContain(node.kind);
        expect(SHAPE_FOR_KIND[node.kind]).toBeDefined();
        expect(node.size.width).toBeGreaterThan(0);
        expect(node.size.height).toBeGreaterThan(0);
        if (node.kind !== 'junction') {
          expect(node.label.length).toBeGreaterThan(0);
          expect(node.lines.length).toBeGreaterThan(0);
        }
      });
    });
  });

  it('connects existing nodes through valid handles', () => {
    model.routines.forEach((routine) => {
      const ids = new Set(routine.nodes.map((node) => node.id));
      expect(ids.size).toBe(routine.nodes.length);
      expect(new Set(routine.edges.map((edge) => edge.id)).size).toBe(routine.edges.length);
      routine.edges.forEach((edge) => {
        expect(ids).toContain(edge.source);
        expect(ids).toContain(edge.target);
        expect(FLOW_SOURCE_HANDLES).toContain(edge.sourceHandle);
        expect(FLOW_TARGET_HANDLES).toContain(edge.targetHandle);
      });
    });
  });

  it('routes sequence connectors straight down, bottom to top', () => {
    positioned.routines.forEach((routine) => {
      routine.edges.filter((edge) => edge.kind === 'default').forEach((edge) => {
        expect(edge.sourceHandle).toBe('bottom');
        expect(edge.targetHandle).toBe('top');
        expect(edge.points).toHaveLength(2);
        expect(edge.points[0].x).toBeCloseTo(edge.points[1].x, 5);
        expect(edge.points[1].y).toBeGreaterThan(edge.points[0].y);
      });
    });
  });

  it('routes every connector orthogonally', () => {
    positioned.routines.forEach((routine) => {
      routine.edges.forEach((edge) => {
        expect(edge.points.length).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < edge.points.length; i += 1) {
          const a = edge.points[i - 1];
          const b = edge.points[i];
          expect(Math.abs(a.x - b.x) < 0.01 || Math.abs(a.y - b.y) < 0.01).toBe(true);
        }
        if (edge.label) expect(edge.labelPosition).toBeDefined();
      });
    });
  });

  it('lays out nodes without overlaps', () => {
    positioned.routines.forEach((routine) => {
      for (let i = 0; i < routine.nodes.length; i += 1) {
        for (let j = i + 1; j < routine.nodes.length; j += 1) {
          const a = routine.nodes[i];
          const b = routine.nodes[j];
          if (overlaps(a, b)) {
            throw new Error(`${routine.label}: "${a.label}" overlaps "${b.label}"`);
          }
        }
      }
    });
  });

  it('never draws a connector through an unrelated block', () => {
    positioned.routines.forEach((routine) => {
      routine.edges.forEach((edge) => {
        routine.nodes
          .filter((node) => node.id !== edge.source && node.id !== edge.target)
          .forEach((node) => {
            for (let i = 1; i < edge.points.length; i += 1) {
              if (segmentCrossesNode(edge.points[i - 1], edge.points[i], node)) {
                throw new Error(`${routine.label}: edge ${edge.id} crosses "${node.label || node.id}"`);
              }
            }
          });
      });
    });
  });

  it('exports an SVG', () => {
    positioned.routines.forEach((routine, index) => {
      const { svg, width, height } = exportRoutineToSvg(routine);
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(svg.startsWith('<svg')).toBe(true);
      if (svgDir) {
        fs.mkdirSync(svgDir, { recursive: true });
        fs.writeFileSync(path.join(svgDir, `${example.id}-${index}.svg`), svg);
      }
    });
  });
});
