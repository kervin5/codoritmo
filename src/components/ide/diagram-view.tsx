'use client';

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  useNodesInitialized,
  useNodesState,
  type Edge,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type NodeProps,
  type Viewport,
} from '@xyflow/react';
import { motion } from 'motion/react';

import {
  applyFlowNodeOffsets,
  buildFlowDiagram,
  colorForFlowEdgeKind,
  DIAGRAM_BACKGROUND_COLOR,
  DIAGRAM_EDGE_DEFAULT_COLOR,
  DIAGRAM_GRID_COLOR,
  DIAGRAM_LABEL_COLOR,
  exportRoutineToPng,
  layoutFlowDiagram,
  paletteForFlowNodeKind,
  type FlowNodeKind,
  type PositionedFlowRoutineDiagram,
} from '@/src/diagram';
import { Parser, type Diagnostic, type EngineSettings, type SourceSpan } from '@/src/engine';
import type { Dictionary } from '@/src/i18n/types';

import type { DiagramNodeOffset, DiagramViewport } from './types';
import { ActionButton, AppIcon, SelectField, classes } from './ui';
import { WorkspaceSecondaryToolbarStrip } from './workspace-toolbar-strip';

interface DiagramViewProps {
  dictionary: Dictionary;
  isExpanded: boolean;
  nodeOffsets: Record<string, DiagramNodeOffset>;
  onExpandedChange: (expanded: boolean) => void;
  onNodeOffsetChange: (nodeId: string, offset: DiagramNodeOffset) => void;
  onResetLayout: (nodeIds: string[]) => void;
  onRevealSource: (span: SourceSpan) => void;
  onRoutineChange: (routineId: string) => void;
  onSelectedNodeChange: (nodeId: string | null) => void;
  onViewportChange: (viewport: DiagramViewport) => void;
  selectedNodeId: string | null;
  settings: EngineSettings;
  source: string;
  viewport: DiagramViewport | null;
  visibleDiagnostics: Diagnostic[];
  visibleRoutineId: string | null;
}

type DiagramFlowNode = Node<{
  id: string;
  kind: FlowNodeKind;
  label: string;
  sourceSpan?: SourceSpan;
}>;

const DIAGRAM_MIN_ZOOM = 0.35;
const DIAGRAM_MAX_ZOOM = 1.65;
const baseNodeStyle = 'border bg-[rgba(255,252,247,0.98)] text-[var(--foreground)]';
const DEFAULT_EDGE_OPTIONS = {
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: DIAGRAM_EDGE_DEFAULT_COLOR,
  },
  style: {
    stroke: DIAGRAM_EDGE_DEFAULT_COLOR,
    strokeWidth: 1.7,
  },
  labelStyle: {
    fill: DIAGRAM_LABEL_COLOR,
    fontSize: 11,
    fontWeight: 600,
  },
  type: 'smoothstep' as const,
};

function flowNodeStyles(kind: FlowNodeKind): {
  bodyClassName: string;
  bodyStyle?: CSSProperties;
  labelClassName?: string;
  fillColor?: string;
  labelColor?: string;
  strokeColor?: string;
} {
  const palette = paletteForFlowNodeKind(kind);

  switch (kind) {
    case 'terminator':
      return {
        bodyClassName: classes(baseNodeStyle, 'rounded-[999px] px-6 py-4'),
        bodyStyle: {
          backgroundColor: palette.fill,
          borderColor: palette.stroke,
        },
        fillColor: palette.fill,
        labelColor: palette.text,
        strokeColor: palette.stroke,
      };
    case 'io':
      return {
        bodyClassName: classes(baseNodeStyle, 'px-6 py-4'),
        bodyStyle: {
          backgroundColor: palette.fill,
          borderColor: palette.stroke,
          clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0 100%)',
        },
        fillColor: palette.fill,
        labelColor: palette.text,
        strokeColor: palette.stroke,
      };
    case 'decision':
      return {
        bodyClassName: 'relative h-[132px] w-[212px]',
        labelClassName: 'max-w-[120px] text-center',
        fillColor: palette.fill,
        labelColor: palette.text,
        strokeColor: palette.stroke,
      };
    case 'loop':
      return {
        bodyClassName: classes(baseNodeStyle, 'rounded-[24px] px-5 py-4'),
        bodyStyle: {
          backgroundColor: palette.fill,
          borderColor: palette.stroke,
        },
        fillColor: palette.fill,
        labelColor: palette.text,
        strokeColor: palette.stroke,
      };
    case 'switch':
      return {
        bodyClassName: classes(baseNodeStyle, 'px-5 py-4'),
        bodyStyle: {
          backgroundColor: palette.fill,
          borderColor: palette.stroke,
          clipPath: 'polygon(12% 0, 88% 0, 100% 50%, 88% 100%, 12% 100%, 0 50%)',
        },
        fillColor: palette.fill,
        labelColor: palette.text,
        strokeColor: palette.stroke,
      };
    case 'branch':
      return {
        bodyClassName: classes(baseNodeStyle, 'rounded-[18px] border-dashed px-5 py-3.5'),
        bodyStyle: {
          backgroundColor: palette.fill,
          borderColor: palette.stroke,
        },
        fillColor: palette.fill,
        labelColor: palette.text,
        strokeColor: palette.stroke,
      };
    case 'process':
    default:
      return {
        bodyClassName: classes(baseNodeStyle, 'rounded-[18px] px-5 py-4'),
        bodyStyle: {
          backgroundColor: palette.fill,
          borderColor: palette.stroke,
        },
        fillColor: palette.fill,
        labelColor: palette.text,
        strokeColor: palette.stroke,
      };
  }
}

const DiagramNodeCard = memo(function DiagramNodeCard({
  data,
  selected,
}: NodeProps<DiagramFlowNode>) {
  const styles = flowNodeStyles(data.kind);

  if (data.kind === 'decision') {
    return (
      <motion.div
        animate={{ y: selected ? -4 : 0 }}
        className="relative h-full w-full"
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <Handle id="top" position={Position.Top} style={{ opacity: 0 }} type="target" />
        <Handle id="left-in" position={Position.Left} style={{ opacity: 0 }} type="target" />
        <Handle id="right-in" position={Position.Right} style={{ opacity: 0 }} type="target" />
        <Handle id="left" position={Position.Left} style={{ opacity: 0 }} type="source" />
        <Handle id="right" position={Position.Right} style={{ opacity: 0 }} type="source" />
        <Handle id="bottom" position={Position.Bottom} style={{ opacity: 0 }} type="source" />
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          data-testid={`diagram-node-${data.id}`}
          viewBox="0 0 212 132"
        >
          <path
            d="M106 4 L208 66 L106 128 L4 66 Z"
            fill={styles.fillColor}
            stroke={styles.strokeColor}
            strokeWidth="1.4"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center px-8">
          <div
            className={classes('text-sm font-medium leading-5 text-[var(--foreground)]', styles.labelClassName)}
            style={styles.labelColor ? { color: styles.labelColor } : undefined}
          >
            <div>{data.label}</div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      animate={{ y: selected ? -4 : 0 }}
      className="relative"
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <Handle id="top" position={Position.Top} style={{ opacity: 0 }} type="target" />
      <Handle id="left-in" position={Position.Left} style={{ opacity: 0 }} type="target" />
      <Handle id="right-in" position={Position.Right} style={{ opacity: 0 }} type="target" />
      <Handle id="left" position={Position.Left} style={{ opacity: 0 }} type="source" />
      <Handle id="right" position={Position.Right} style={{ opacity: 0 }} type="source" />
      <Handle id="bottom" position={Position.Bottom} style={{ opacity: 0 }} type="source" />
      <div
        className={classes(
          styles.bodyClassName,
          selected && 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[rgba(247,242,233,0.96)]',
        )}
        data-testid={`diagram-node-${data.id}`}
        style={styles.bodyStyle}
      >
        <div
          className={classes('text-center text-sm font-medium leading-5', styles.labelClassName)}
          style={styles.labelColor ? { color: styles.labelColor } : undefined}
        >
          {data.label}
        </div>
      </div>
    </motion.div>
  );
});

const nodeTypes = {
  flow: DiagramNodeCard,
};

function DiagramCanvas({
  edgeList,
  fitRequest,
  nodeList,
  onNodeDragStop,
  onNodeSelect,
  onViewportChange,
  routineId,
  viewport,
}: {
  edgeList: Edge[];
  fitRequest: number;
  nodeList: DiagramFlowNode[];
  onNodeDragStop: (nodeId: string, position: { x: number; y: number }) => void;
  onNodeSelect: (nodeId: string, sourceSpan?: SourceSpan) => void;
  onViewportChange: (viewport: DiagramViewport) => void;
  routineId: string;
  viewport: DiagramViewport | null;
}) {
  const reactFlow = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const [localNodes, setLocalNodes] = useNodesState(nodeList);
  const dragTriggeredRef = useRef(false);

  useEffect(() => {
    setLocalNodes(nodeList);
  }, [nodeList, setLocalNodes]);

  useEffect(() => {
    if (!nodesInitialized) {
      return undefined;
    }

    const applyViewport = () => {
      if (viewport) {
        reactFlow.setViewport(viewport as Viewport, { duration: 0 });
        return;
      }

      reactFlow.fitView({ duration: 260, padding: 0.16 });
    };

    const frame = window.requestAnimationFrame(applyViewport);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [fitRequest, nodeList.length, nodesInitialized, reactFlow, routineId, viewport]);

  const handleNodeClick: NodeMouseHandler<DiagramFlowNode> = (_event, node) => {
    if (dragTriggeredRef.current) {
      return;
    }

    onNodeSelect(node.id, node.data.sourceSpan);
  };

  const handleNodesChange = (changes: NodeChange<DiagramFlowNode>[]) => {
    setLocalNodes((current) => applyNodeChanges(changes, current));
  };

  return (
    <ReactFlow
      className="diagram-canvas"
      defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
      edges={edgeList}
      fitView
      maxZoom={DIAGRAM_MAX_ZOOM}
      minZoom={DIAGRAM_MIN_ZOOM}
      nodeTypes={nodeTypes}
      nodes={localNodes}
      onNodesChange={handleNodesChange}
      onNodeDragStart={() => {
        dragTriggeredRef.current = true;
      }}
      onMoveEnd={() => onViewportChange(reactFlow.getViewport())}
      onNodeClick={handleNodeClick}
      onNodeDragStop={(_event, node) => {
        onNodeDragStop(node.id, node.position);
        window.setTimeout(() => {
          dragTriggeredRef.current = false;
        }, 0);
      }}
      panOnScroll
      proOptions={{ hideAttribution: true }}
    >
      <Background color={DIAGRAM_GRID_COLOR} gap={22} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

function DiagramSurface(props: DiagramViewProps) {
  const { onRoutineChange, visibleRoutineId } = props;
  const [fitRequest, setFitRequest] = useState(0);
  const [isDownloading, setDownloading] = useState(false);
  const [positionedDiagram, setPositionedDiagram] = useState<PositionedFlowRoutineDiagram[] | null>(null);
  const [loading, setLoading] = useState(true);

  const parseResult = useMemo(
    () => new Parser(props.source, { settings: props.settings }).parse(),
    [props.settings, props.source],
  );

  useEffect(() => {
    let active = true;

    async function build() {
      if (!parseResult.program) {
        setPositionedDiagram(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const flow = buildFlowDiagram(parseResult.program);
      const positioned = await layoutFlowDiagram(flow);
      if (!active) {
        return;
      }

      setPositionedDiagram(positioned.routines);
      setLoading(false);
    }

    void build();

    return () => {
      active = false;
    };
  }, [parseResult.program]);

  const activeRoutine = useMemo(() => {
    if (!positionedDiagram || positionedDiagram.length === 0) {
      return null;
    }

    return positionedDiagram.find((routine) => routine.id === visibleRoutineId) ?? positionedDiagram[0];
  }, [positionedDiagram, visibleRoutineId]);

  useEffect(() => {
    if (activeRoutine && activeRoutine.id !== visibleRoutineId) {
      onRoutineChange(activeRoutine.id);
    }
  }, [activeRoutine, onRoutineChange, visibleRoutineId]);

  const routineOptions = useMemo(
    () =>
      positionedDiagram?.map((routine) => ({
        label: routine.label,
        value: routine.id,
      })) ?? [],
    [positionedDiagram],
  );

  const basePositionMap = useMemo(() => {
    if (!activeRoutine) {
      return {};
    }

    return Object.fromEntries(activeRoutine.nodes.map((node) => [node.id, node.position]));
  }, [activeRoutine]);

  const diagramNodes = useMemo<DiagramFlowNode[]>(() => {
    if (!activeRoutine) {
      return [];
    }

    const offsetRoutine = applyFlowNodeOffsets(activeRoutine, props.nodeOffsets);

    return offsetRoutine.nodes.map((node) => {
      return {
        id: node.id,
        type: 'flow',
        draggable: true,
        position: node.position,
        selected: props.selectedNodeId === node.id,
        style: {
          width: node.size.width,
          height: node.size.height,
        },
        data: {
          id: node.id,
          kind: node.kind,
          label: node.label,
          sourceSpan: node.sourceSpan,
        },
      };
    });
  }, [activeRoutine, props.nodeOffsets, props.selectedNodeId]);

  const diagramEdges = useMemo<Edge[]>(() => {
    if (!activeRoutine) {
      return [];
    }

    return activeRoutine.edges.map((edge) => ({
      id: edge.id,
      className: edge.kind === 'loop' ? 'diagram-loop-edge' : undefined,
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: edge.target,
      targetHandle: edge.targetHandle,
      label: edge.label,
      animated: edge.kind === 'loop',
      pathOptions: edge.kind === 'loop'
        ? { offset: 36, borderRadius: 18 }
        : edge.kind === 'branch'
          ? { offset: 24, borderRadius: 16 }
          : undefined,
      style: {
        stroke: colorForFlowEdgeKind(edge.kind),
        strokeWidth: edge.kind === 'loop' ? 2.3 : 1.7,
        ...(edge.kind === 'loop' ? { strokeDasharray: '10 8' } : {}),
      },
      labelStyle: {
        fill: edge.kind === 'loop' ? '#1d5e4d' : DIAGRAM_LABEL_COLOR,
        fontSize: 11,
        fontWeight: 700,
      },
      labelBgStyle: {
        fill: edge.kind === 'loop'
          ? '#e7f6ef'
          : '#fff8ef',
        fillOpacity: 1,
      },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 999,
    }));
  }, [activeRoutine]);

  const exportRoutine = useMemo(
    () => (activeRoutine ? applyFlowNodeOffsets(activeRoutine, props.nodeOffsets) : null),
    [activeRoutine, props.nodeOffsets],
  );

  const handleResetLayout = () => {
    if (!activeRoutine) {
      return;
    }

    props.onResetLayout(activeRoutine.nodes.map((node) => node.id));
    props.onViewportChange({ x: 0, y: 0, zoom: 1 });
    setFitRequest((current) => current + 1);
  };

  const handleDownload = async () => {
    if (!activeRoutine || !exportRoutine || isDownloading) {
      return;
    }

    setDownloading(true);

    try {
      const { dataUrl } = await exportRoutineToPng(exportRoutine);
      const link = document.createElement('a');
      link.download = `${activeRoutine.label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'diagram'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Failed to export diagram.', error);
    } finally {
      setDownloading(false);
    }
  };

  if (!parseResult.program) {
    const primaryDiagnostic = parseResult.diagnostics[0] ?? props.visibleDiagnostics[0];

    return (
      <div className="flex h-full min-h-0 flex-col">
        <WorkspaceSecondaryToolbarStrip className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{props.dictionary.diagram.tab}</p>
            <p className="text-xs text-[var(--muted)]">{props.dictionary.diagram.fixErrorsHint}</p>
          </div>
        </WorkspaceSecondaryToolbarStrip>
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
          <div className="max-w-[420px] rounded-[24px] border border-dashed border-[var(--line)] bg-[rgba(255,252,247,0.86)] px-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--amber-surface)] text-[var(--amber-strong)]">
              <AppIcon className="h-5 w-5" name="alert" />
            </div>
            <p className="mt-4 text-lg font-semibold text-[var(--foreground)]">{props.dictionary.diagram.invalidProgramTitle}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {primaryDiagnostic?.message ?? props.dictionary.diagram.invalidProgramBody}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkspaceSecondaryToolbarStrip>
        <div className="flex items-center gap-2">
          {/* Routine selector — shrinks on mobile, bounded on desktop */}
          <div className="min-w-0 flex-1 lg:max-w-[320px]">
            <SelectField
              ariaLabel={props.dictionary.diagram.routineSelect}
              className="w-full"
              label={props.dictionary.diagram.routine}
              onChange={props.onRoutineChange}
              options={routineOptions}
              value={activeRoutine?.id ?? ''}
              visibleLabel={false}
            />
          </div>

          {/* Actions — pinned to the row end (routine select stays left, capped width) */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {/* Reset layout */}
            <ActionButton
              icon="reset"
              iconOnly
              label={props.dictionary.diagram.resetLayout}
              onClick={handleResetLayout}
              tone="secondary"
            />

            {/* Download */}
            <ActionButton
              disabled={!activeRoutine || loading || isDownloading}
              icon="download"
              iconOnly
              label={props.dictionary.diagram.download}
              onClick={() => { void handleDownload(); }}
              tone="secondary"
            />

            {/* Expand / compress */}
            <ActionButton
              icon={props.isExpanded ? 'compress' : 'expand'}
              iconOnly
              label={props.isExpanded ? props.dictionary.diagram.restore : props.dictionary.diagram.maximize}
              onClick={() => props.onExpandedChange(!props.isExpanded)}
              tone="secondary"
            />
          </div>
        </div>
      </WorkspaceSecondaryToolbarStrip>

      <div className="min-h-0 flex-1" style={{ backgroundColor: DIAGRAM_BACKGROUND_COLOR }}>
        {loading || !activeRoutine ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
            {props.dictionary.diagram.buildInProgress}
          </div>
        ) : (
          <ReactFlowProvider>
            <DiagramCanvas
              edgeList={diagramEdges}
              fitRequest={fitRequest}
              nodeList={diagramNodes}
              onNodeDragStop={(nodeId, position) => {
                const basePosition = basePositionMap[nodeId];
                if (!basePosition) {
                  return;
                }

                props.onNodeOffsetChange(nodeId, {
                  x: Math.round(position.x - basePosition.x),
                  y: Math.round(position.y - basePosition.y),
                });
              }}
              onNodeSelect={(nodeId, sourceSpan) => {
                props.onSelectedNodeChange(nodeId);
                if (sourceSpan) {
                  props.onRevealSource(sourceSpan);
                }
              }}
              onViewportChange={props.onViewportChange}
              routineId={activeRoutine.id}
              viewport={props.viewport}
            />
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}

export default function DiagramView(props: DiagramViewProps) {
  return <DiagramSurface {...props} />;
}
