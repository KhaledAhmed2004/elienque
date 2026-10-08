"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KM_PER_LAT_DEGREE = exports.EARTH_RADIUS_KM = void 0;
exports.validateCoordinates = validateCoordinates;
exports.calculateBoundingBox = calculateBoundingBox;
exports.kmToRadians = kmToRadians;
exports.parsePolygonCoordinates = parsePolygonCoordinates;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
exports.EARTH_RADIUS_KM = 6378.1;
exports.KM_PER_LAT_DEGREE = 111.32;
// Validates latitude and longitude ranges.
function validateCoordinates(lat, lng) {
    if (lat < -90 || lat > 90) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Latitude must be between -90 and 90 degrees');
    }
    if (lng < -180 || lng > 180) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Longitude must be between -180 and 180 degrees');
    }
}
// Approximates a bounding box around a latitude/longitude point for index-friendly range querying.
function calculateBoundingBox(lat, lng, distanceKm) {
    const latDelta = distanceKm / exports.KM_PER_LAT_DEGREE;
    const latRad = (lat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const lngDelta = distanceKm / (exports.KM_PER_LAT_DEGREE * (cosLat || 1e-6));
    return {
        minLat: lat - latDelta,
        maxLat: lat + latDelta,
        minLng: lng - lngDelta,
        maxLng: lng + lngDelta,
    };
}
// Converts a distance in kilometers to radians on earth's sphere.
function kmToRadians(distanceKm) {
    return distanceKm / exports.EARTH_RADIUS_KM;
}
// Parses raw polygon string (JSON array or semicolon-separated coordinate pairs)
// and guarantees a closed polygon ring with at least 3 distinct vertices.
function parsePolygonCoordinates(polygonRaw) {
    let coordinates = [];
    try {
        const parsed = JSON.parse(polygonRaw);
        if (Array.isArray(parsed)) {
            coordinates = parsed.map((pair) => [
                parseFloat(String(pair[0])),
                parseFloat(String(pair[1])),
            ]);
        }
    }
    catch {
        coordinates = polygonRaw
            .split(';')
            .map(p => p.trim())
            .filter(Boolean)
            .map(pairStr => {
            const [lngStr, latStr] = pairStr.split(',').map(s => s.trim());
            return [parseFloat(lngStr), parseFloat(latStr)];
        });
    }
    if (!Array.isArray(coordinates) || coordinates.length < 3) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Polygon must have at least 3 points');
    }
    for (const [lng, lat] of coordinates) {
        if (isNaN(lat) || isNaN(lng)) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid polygon coordinates');
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
//# sourceMappingURL=geo.helper.js.map