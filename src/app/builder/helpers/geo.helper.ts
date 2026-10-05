import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';

export const EARTH_RADIUS_KM = 6378.1;
export const KM_PER_LAT_DEGREE = 111.32;

export type IBoundingBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

// Validates latitude and longitude ranges.
export function validateCoordinates(lat: number, lng: number): void {
  if (lat < -90 || lat > 90) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Latitude must be between -90 and 90 degrees',
    );
  }
  if (lng < -180 || lng > 180) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Longitude must be between -180 and 180 degrees',
    );
  }
}

// Approximates a bounding box around a latitude/longitude point for index-friendly range querying.
export function calculateBoundingBox(
  lat: number,
  lng: number,
  distanceKm: number,
): IBoundingBox {
  const latDelta = distanceKm / KM_PER_LAT_DEGREE;
  const latRad = (lat * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  const lngDelta = distanceKm / (KM_PER_LAT_DEGREE * (cosLat || 1e-6));

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

// Converts a distance in kilometers to radians on earth's sphere.
export function kmToRadians(distanceKm: number): number {
  return distanceKm / EARTH_RADIUS_KM;
}

// Parses raw polygon string (JSON array or semicolon-separated coordinate pairs)
// and guarantees a closed polygon ring with at least 3 distinct vertices.
export function parsePolygonCoordinates(
  polygonRaw: string,
): Array<[number, number]> {
  let coordinates: Array<[number, number]> = [];

  try {
    const parsed = JSON.parse(polygonRaw);
    if (Array.isArray(parsed)) {
      coordinates = parsed.map((pair: [unknown, unknown]) => [
        parseFloat(String(pair[0])),
        parseFloat(String(pair[1])),
      ]);
    }
  } catch {
    coordinates = polygonRaw
      .split(';')
      .map(p => p.trim())
      .filter(Boolean)
      .map(pairStr => {
        const [lngStr, latStr] = pairStr.split(',').map(s => s.trim());
        return [parseFloat(lngStr), parseFloat(latStr)] as [number, number];
      });
  }

  if (!Array.isArray(coordinates) || coordinates.length < 3) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Polygon must have at least 3 points',
    );
  }

  for (const [lng, lat] of coordinates) {
    if (isNaN(lat) || isNaN(lng)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Invalid polygon coordinates',
      );
    }
    validateCoordinates(lat, lng);
  }

  // Ensure closed ring
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coordinates.push([first[0], first[1]]);
  }

  return coordinates;
}
