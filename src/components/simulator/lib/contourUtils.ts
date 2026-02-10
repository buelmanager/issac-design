import * as THREE from 'three';
import type { Point } from './marchingSquares';

/**
 * Perpendicular distance from a point to a line segment.
 */
function perpendicularDistance(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) {
    return Math.sqrt(
      (point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2,
    );
  }
  return (
    Math.abs(
      dy * point.x -
        dx * point.y +
        lineEnd.x * lineStart.y -
        lineEnd.y * lineStart.x,
    ) / len
  );
}

/**
 * Ramer-Douglas-Peucker polygon simplification.
 * Reduces point count while preserving shape fidelity.
 */
export function simplifyPolygon(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPolygon(points.slice(0, maxIdx + 1), epsilon);
    const right = simplifyPolygon(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

/**
 * Convert traced contours to THREE.Shape[] using ShapePath.
 *
 * Uses Three.js ShapePath.toShapes() which automatically:
 * - Detects winding direction (CW vs CCW)
 * - Identifies outer shapes vs holes
 * - Assigns holes to their enclosing outer shapes
 */
/**
 * Compute signed area of a polygon (positive = CCW, negative = CW).
 */
function signedArea(pts: { x: number; y: number }[]): number {
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j].x - pts[i].x) * (pts[i].y + pts[j].y);
  }
  return area / 2;
}

/**
 * Check if point is inside polygon using ray casting.
 */
function pointInPolygon(
  px: number,
  py: number,
  polygon: { x: number; y: number }[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function processContoursToShapes(
  contours: Point[][],
  maskWidth: number,
  maskHeight: number,
  scale: number,
  simplifyEpsilon: number,
): THREE.Shape[] {
  if (contours.length === 0) return [];

  // Simplify and convert all contours to screen-space first
  const processed: { x: number; y: number }[][] = [];
  for (const contour of contours) {
    const simplified =
      simplifyEpsilon > 0
        ? simplifyPolygon(contour, simplifyEpsilon)
        : contour;
    if (simplified.length < 3) continue;

    // Convert to centered, scaled, Y-flipped coordinates
    const converted = simplified.map((p) => ({
      x: (p.x - maskWidth / 2) * scale,
      y: -(p.y - maskHeight / 2) * scale,
    }));
    processed.push(converted);
  }

  if (processed.length === 0) return [];

  // Classify each contour as outer or hole based on signed area and containment
  const areas = processed.map((pts) => Math.abs(signedArea(pts)));

  // Sort by area descending so larger shapes come first
  const indices = processed.map((_, i) => i);
  indices.sort((a, b) => areas[b] - areas[a]);

  const shapes: THREE.Shape[] = [];
  const usedAsHole = new Set<number>();

  for (const outerIdx of indices) {
    if (usedAsHole.has(outerIdx)) continue;

    const outerPts = processed[outerIdx];

    // Create shape from outer contour - ensure CCW winding (positive area)
    const area = signedArea(outerPts);
    const orderedPts = area < 0 ? [...outerPts].reverse() : outerPts;

    const shape = new THREE.Shape();
    shape.moveTo(orderedPts[0].x, orderedPts[0].y);
    for (let i = 1; i < orderedPts.length; i++) {
      shape.lineTo(orderedPts[i].x, orderedPts[i].y);
    }
    shape.closePath();

    // Find holes: smaller contours fully inside this outer contour
    for (const holeIdx of indices) {
      if (holeIdx === outerIdx || usedAsHole.has(holeIdx)) continue;
      if (areas[holeIdx] >= areas[outerIdx]) continue;

      const holePts = processed[holeIdx];
      // Check if the first point of the hole is inside the outer shape
      if (pointInPolygon(holePts[0].x, holePts[0].y, outerPts)) {
        // This is a hole - ensure CW winding (negative area)
        const holeArea = signedArea(holePts);
        const orderedHole = holeArea > 0 ? [...holePts].reverse() : holePts;

        const holePath = new THREE.Path();
        holePath.moveTo(orderedHole[0].x, orderedHole[0].y);
        for (let i = 1; i < orderedHole.length; i++) {
          holePath.lineTo(orderedHole[i].x, orderedHole[i].y);
        }
        holePath.closePath();
        shape.holes.push(holePath);
        usedAsHole.add(holeIdx);
      }
    }

    shapes.push(shape);
  }

  return shapes;
}
