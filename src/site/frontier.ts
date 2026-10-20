// Outer-world geometry, rearmed boundary encounters and shared escort paths.
import type { Point } from '../shared/physics.ts';

export type Edge = 'west' | 'east' | 'north' | 'south';
// One boundary encounter: whether it has been shown since it was last rearmed, whether it is showing, and at which edge.
export interface FrontierState {
  seen: boolean;
  open: boolean;
  edge: Edge | null;
}
// A step that may cross the world edge. Coordinates are in the padded frontier space (0..width, 0..height).
export interface BoundaryStep {
  from: Point | null;
  to: Point | null;
  kind?: 'move' | 'attempt';
  explore?: boolean;
  blocked?: boolean;
  width?: number;
  height?: number;
  threshold?: number;
  inset?: number;
}
export interface TileView {
  width: number;
  height: number;
  scale: number;
  ox: number;
  oy: number;
  tile?: number;
}

const EDGES: Edge[] = ['west', 'east', 'north', 'south'];
function distances(point: Point, width: number, height: number): Record<Edge, number> {
  return { west: point.x, east: width - point.x, north: point.y, south: height - point.y };
}
export function initialState(): FrontierState {
  return { seen: false, open: false, edge: null };
}
export function boundaryEvent(
  state: FrontierState,
  {
    from,
    to,
    kind = 'move',
    explore = true,
    blocked = false,
    width = 1440,
    height = 900,
    threshold = 96,
    inset = 30,
  }: BoundaryStep,
): FrontierState {
  if (state.seen || state.open || blocked || !explore || !from || !to) return state;
  if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) return state;
  const a = distances(from, width, height),
    b = distances(to, width, height);
  // A blocked attempt is relevant only at the physical world edge, not at a tree.
  const candidates = EDGES.filter((edge) =>
    kind === 'attempt'
      ? a[edge] <= threshold && b[edge] < inset && b[edge] < a[edge]
      : b[edge] <= threshold && b[edge] >= 0 && b[edge] < a[edge] - 0.001,
  );
  if (!candidates.length) return state;
  candidates.sort((left, right) => a[left] - a[right]);
  return { seen: true, open: true, edge: candidates[0] };
}
export function closeBoundary(state: FrontierState): FrontierState {
  return state.open ? { ...state, open: false } : state;
}
export function rearm(state: FrontierState, point: Point, width = 1440, height = 900): FrontierState {
  return !state.open && state.seen && Math.min(point.x, width - point.x, point.y, height - point.y) > 128
    ? initialState()
    : state;
}
export function pathLength(points: Point[]) {
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return length;
}
export function samplePath(points: Point[], distance: number): Point {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      length = Math.hypot(b.x - a.x, b.y - a.y);
    if (distance <= length && length)
      return { x: a.x + ((b.x - a.x) * distance) / length, y: a.y + ((b.y - a.y) * distance) / length };
    distance -= length;
  }
  return { ...points.at(-1)! };
}
export function visibleTiles({ width, height, scale, ox, oy, tile = 32 }: TileView) {
  const left = Math.floor(-ox / scale / tile) * tile;
  const top = Math.floor(-oy / scale / tile) * tile;
  const right = Math.ceil((width - ox) / scale / tile) * tile;
  const bottom = Math.ceil((height - oy) / scale / tile) * tile;
  return { left, top, right, bottom, columns: (right - left) / tile, rows: (bottom - top) / tile };
}
