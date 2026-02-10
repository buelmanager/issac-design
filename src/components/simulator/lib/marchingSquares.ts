export interface Point {
  x: number;
  y: number;
}

/**
 * Marching Squares contour tracing algorithm.
 * Converts a boolean mask into ordered, closed contour polylines.
 *
 * Unlike simple edge detection + angle sorting, this produces
 * correctly ordered contours that work for concave shapes, text, and holes.
 */

// Edge indices: 0=top, 1=right, 2=bottom, 3=left
// Each entry: array of [fromEdge, toEdge] segments
const EDGE_TABLE: [number, number][][] = [
  [],               // 0:  ....
  [[3, 0]],         // 1:  X...
  [[0, 1]],         // 2:  .X..
  [[3, 1]],         // 3:  XX..
  [[1, 2]],         // 4:  ..X.
  [[3, 0], [1, 2]], // 5:  X.X. (saddle)
  [[0, 2]],         // 6:  .XX.
  [[3, 2]],         // 7:  XXX.
  [[2, 3]],         // 8:  ...X
  [[2, 0]],         // 9:  X..X
  [[0, 1], [2, 3]], // 10: .X.X (saddle)
  [[2, 1]],         // 11: XX.X
  [[1, 3]],         // 12: ..XX
  [[1, 0]],         // 13: X.XX
  [[0, 3]],         // 14: .XXX
  [],               // 15: XXXX
];

// Edge midpoint offsets relative to cell (x, y)
// edge 0 (top):    (x+0.5, y)
// edge 1 (right):  (x+1,   y+0.5)
// edge 2 (bottom): (x+0.5, y+1)
// edge 3 (left):   (x,     y+0.5)
function edgeMidpoint(cellX: number, cellY: number, edge: number): Point {
  switch (edge) {
    case 0: return { x: cellX + 0.5, y: cellY };
    case 1: return { x: cellX + 1,   y: cellY + 0.5 };
    case 2: return { x: cellX + 0.5, y: cellY + 1 };
    case 3: return { x: cellX,       y: cellY + 0.5 };
    default: return { x: cellX, y: cellY };
  }
}

function classifyCell(mask: boolean[][], x: number, y: number): number {
  let index = 0;
  if (mask[y][x])         index |= 1;  // top-left
  if (mask[y][x + 1])     index |= 2;  // top-right
  if (mask[y + 1][x + 1]) index |= 4;  // bottom-right
  if (mask[y + 1][x])     index |= 8;  // bottom-left
  return index;
}

function getSegments(mask: boolean[][], x: number, y: number): [number, number][] {
  const cellIndex = classifyCell(mask, x, y);

  // Saddle point disambiguation
  if (cellIndex === 5 || cellIndex === 10) {
    const sum =
      (mask[y][x] ? 1 : 0) +
      (mask[y][x + 1] ? 1 : 0) +
      (mask[y + 1][x + 1] ? 1 : 0) +
      (mask[y + 1][x] ? 1 : 0);
    const centerInside = sum >= 3;

    if (cellIndex === 5) {
      return centerInside ? [[3, 2], [1, 0]] : [[3, 0], [1, 2]];
    } else {
      return centerInside ? [[0, 3], [2, 1]] : [[0, 1], [2, 3]];
    }
  }

  return EDGE_TABLE[cellIndex];
}

function pointKey(p: Point): string {
  return `${p.x},${p.y}`;
}

/**
 * Build a directed adjacency map from all cell edge-crossing segments.
 */
function buildEdgeMap(mask: boolean[][]): Map<string, Point> {
  const h = mask.length;
  const w = mask[0].length;
  const edgeMap = new Map<string, Point>();

  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const segments = getSegments(mask, x, y);
      for (const [fromEdge, toEdge] of segments) {
        const from = edgeMidpoint(x, y, fromEdge);
        const to = edgeMidpoint(x, y, toEdge);
        edgeMap.set(pointKey(from), to);
      }
    }
  }

  return edgeMap;
}

/**
 * Trace all closed contours from the directed edge map.
 * Each contour is a naturally ordered, closed polyline.
 */
function traceContours(edgeMap: Map<string, Point>): Point[][] {
  const visited = new Set<string>();
  const contours: Point[][] = [];

  for (const [startKey] of edgeMap) {
    if (visited.has(startKey)) continue;

    const contour: Point[] = [];
    let currentKey = startKey;

    while (!visited.has(currentKey)) {
      visited.add(currentKey);

      const [cx, cy] = currentKey.split(',').map(Number);
      contour.push({ x: cx, y: cy });

      const next = edgeMap.get(currentKey);
      if (!next) break;

      currentKey = pointKey(next);
    }

    if (contour.length >= 3) {
      contours.push(contour);
    }
  }

  return contours;
}

/**
 * Main entry point: extract ordered closed contours from a boolean mask.
 * Returns Point[][] where each sub-array is a closed contour polygon.
 * Both outer boundaries and inner holes are returned as separate contours.
 */
export function marchingSquaresTrace(mask: boolean[][]): Point[][] {
  if (mask.length < 2 || mask[0].length < 2) return [];

  const edgeMap = buildEdgeMap(mask);
  return traceContours(edgeMap);
}
