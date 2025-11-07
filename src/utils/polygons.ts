import type { LatLngLiteral } from '../types/delivery';

type Point = LatLngLiteral;

function orientation(p: Point, q: Point, r: Point) {
  const val = (q.longitude - p.longitude) * (r.latitude - p.latitude) - (q.latitude - p.latitude) * (r.longitude - p.longitude);
  if (Math.abs(val) < Number.EPSILON) {
    return 0;
  }
  return val > 0 ? 1 : 2;
}

function onSegment(p: Point, q: Point, r: Point) {
  return (
    q.longitude <= Math.max(p.longitude, r.longitude) + Number.EPSILON &&
    q.longitude + Number.EPSILON >= Math.min(p.longitude, r.longitude) &&
    q.latitude <= Math.max(p.latitude, r.latitude) + Number.EPSILON &&
    q.latitude + Number.EPSILON >= Math.min(p.latitude, r.latitude)
  );
}

function segmentsIntersect(p1: Point, q1: Point, p2: Point, q2: Point) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false;
}

export function isPointInsidePolygon(point: Point, polygon: Point[]) {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersect = yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi + Number.EPSILON) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

export function polygonsOverlap(a: Point[], b: Point[]) {
  if (a.length < 3 || b.length < 3) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    const nextI = (i + 1) % a.length;
    for (let j = 0; j < b.length; j++) {
      const nextJ = (j + 1) % b.length;
      if (segmentsIntersect(a[i], a[nextI], b[j], b[nextJ])) {
        return true;
      }
    }
  }

  if (isPointInsidePolygon(a[0], b)) {
    return true;
  }

  if (isPointInsidePolygon(b[0], a)) {
    return true;
  }

  return false;
}

export function overlapsExisting(polygon: Point[], existing: Point[][]) {
  return existing.some((poly) => polygonsOverlap(polygon, poly));
}

