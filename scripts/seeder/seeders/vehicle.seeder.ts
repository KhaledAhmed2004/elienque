/**
 * Vehicle Seeder
 *
 * Responsibilities:
 *   1. Create an approved Vehicle fleet for each chauffeur (multiple vehicles per user)
 *   2. Skip if the specific vehicle already exists (idempotent)
 *   3. Return primary vehicle ID for user.seeder.ts to link selectedVehicle
 */

import { Types } from 'mongoose';
import { Vehicle } from '../../../src/app/modules/vehicle/vehicle.model';
import { VEHICLE_STATUS } from '../../../src/enums/user';
import { ChauffeurFixture, VehicleFixture } from '../fixtures/chauffeurs.fixture';
import { log } from '../seeder.logger';

export type VehicleMap = Map<string, Types.ObjectId>;

const PLACEHOLDER_IMAGE = 'https://placehold.co/600x400/png';
const FUTURE_DATE = new Date('2028-12-31');

type SeedVehiclesInput = {
  fixture: ChauffeurFixture;
  chauffeurId: Types.ObjectId;
  verbose: boolean;
};

export async function seedVehiclesForChauffeur({
  fixture,
  chauffeurId,
  verbose,
}: SeedVehiclesInput): Promise<Types.ObjectId[]> {
  const vehicleList: VehicleFixture[] = fixture.vehicles || [(fixture as any).vehicle];
  const vehicleIds: Types.ObjectId[] = [];

  for (const vehicle of vehicleList) {
    if (!vehicle) continue;

    // Check if vehicle with this license plate already exists
    const existing = await Vehicle.findOne({
      licensePlate: vehicle.licensePlate.toUpperCase(),
    });

    if (existing) {
      if (verbose) log.skipped(`Vehicle: ${vehicle.makeAndModel} for ${fixture.name}`);
      vehicleIds.push(existing._id as Types.ObjectId);
      continue;
    }

    const doc = await Vehicle.create({
      owner: chauffeurId,
      type: vehicle.type,
      makeAndModel: vehicle.makeAndModel,
      colorInside: vehicle.colorInside,
      colorOutside: vehicle.colorOutside,
      year: vehicle.year,
      licensePlate: vehicle.licensePlate.toUpperCase(),
      licensePlateRaw: vehicle.licensePlate,
      status: VEHICLE_STATUS.APPROVED,
      vehicleRegistration: {
        image: `https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600`,
        expiryDate: FUTURE_DATE,
      },
      commercialInsurance: {
        image: `https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600`,
        expiryDate: FUTURE_DATE,
      },
      photos: {
        frontView: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600',
        rearView: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600',
        interiorView: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600',
      },
    });

    log.created(`Vehicle: ${vehicle.makeAndModel} → ${fixture.name} (${vehicle.licensePlate})`);
    vehicleIds.push(doc._id as Types.ObjectId);
  }

  return vehicleIds;
}

export async function seedVehicleForEdgeCase({
  chauffeurId,
  chauffeurName,
  status,
  licensePlate,
  makeAndModel,
  type,
  colorInside = 'Jet Black Nappa Leather',
  colorOutside = 'Obsidian Black',
  year = 2024,
  verbose,
}: {
  chauffeurId: Types.ObjectId;
  chauffeurName: string;
  status: VEHICLE_STATUS;
  licensePlate: string;
  makeAndModel: string;
  type: string;
  colorInside?: string;
  colorOutside?: string;
  year?: number;
  verbose: boolean;
}): Promise<Types.ObjectId> {
  const existing = await Vehicle.findOne({
    licensePlate: licensePlate.toUpperCase(),
  });

  if (existing) {
    if (verbose) log.skipped(`Vehicle: ${makeAndModel} for ${chauffeurName}`);
    return existing._id as Types.ObjectId;
  }

  const doc = await Vehicle.create({
    owner: chauffeurId,
    type,
    makeAndModel,
    colorInside,
    colorOutside,
    year,
    licensePlate: licensePlate.toUpperCase(),
    licensePlateRaw: licensePlate,
    status,
    vehicleRegistration: {
      image: `https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600`,
      expiryDate: FUTURE_DATE,
    },
    commercialInsurance: {
      image: `https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600`,
      expiryDate: FUTURE_DATE,
    },
    photos: {
      frontView: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600',
      rearView: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600',
      interiorView: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600',
    },
  });

  log.created(`Vehicle (${status}): ${makeAndModel} → ${chauffeurName} (${licensePlate})`);
  return doc._id as Types.ObjectId;
}
