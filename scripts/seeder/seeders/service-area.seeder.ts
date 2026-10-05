/**
 * Service Area Seeder
 *
 * Responsibilities:
 *   1. Upsert ServiceArea documents from fixtures (idempotent)
 *   2. Return a Map<areaName, ObjectId> for downstream seeders to resolve foreign keys
 */

import { Types } from 'mongoose';
import { ServiceArea } from '../../../src/app/modules/service-area/service-area.model';
import { SERVICE_AREA_FIXTURES } from '../fixtures/service-areas.fixture';
import { log } from '../seeder.logger';

export type AreaMap = Map<string, Types.ObjectId>;

export async function seedServiceAreas(verbose: boolean): Promise<AreaMap> {
  const areaMap: AreaMap = new Map();

  for (const fixture of SERVICE_AREA_FIXTURES) {
    // Upsert: sync cities and set default status on insert
    const doc = await ServiceArea.findOneAndUpdate(
      { areaName: fixture.areaName },
      { $set: { cities: fixture.cities }, $setOnInsert: { status: 'ACTIVE' } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );


    const isNew = !doc.createdAt || Date.now() - doc.createdAt.getTime() < 3000;

    if (verbose || isNew) {
      if (isNew) {
        log.created(`ServiceArea: ${fixture.areaName} (${fixture.cities.join(', ')})`);
      } else {
        log.skipped(`ServiceArea: ${fixture.areaName}`);
      }
    } else {
      log.skipped(`ServiceArea: ${fixture.areaName}`);
    }

    areaMap.set(fixture.areaName, doc._id as Types.ObjectId);
  }

  return areaMap;
}
