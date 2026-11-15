const EARTH_RADIUS_KM = 6371;

// Branches further than this are not shown to a customer who shared their location.
export const NEARBY_RADIUS_KM = 30;

export type Point = { latitude: number; longitude: number };

// Great-circle distance in kilometres (haversine).
export function distanceKm(from: Point, to: Point): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// Prisma Decimal / string / number → point, or null when either coordinate is missing.
export function toPoint(latitude: unknown, longitude: unknown): Point | null {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
}
