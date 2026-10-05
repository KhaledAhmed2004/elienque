/**
 * Marketplace Item Seeder
 *
 * Seeds realistic car parts, accessories, and gear linked to seeded chauffeurs.
 */

import { Item } from '../../../src/app/modules/item/item.model';
import { User } from '../../../src/app/modules/user/user.model';
import { ITEM_FIXTURES } from '../fixtures/items.fixture';
import { log, spinner } from '../seeder.logger';

export async function seedMarketplaceItems(verbose = false): Promise<number> {
  spinner.start('Seeding Marketplace items...');

  // 1. Fetch all chauffeurs
  const users = await User.find({ email: { $in: ITEM_FIXTURES.map((f) => f.chauffeurEmail) } });
  const userMap = new Map<string, any>(users.map((u) => [u.email, u]));

  let insertedCount = 0;
  let skippedCount = 0;

  for (const fixture of ITEM_FIXTURES) {
    const user = userMap.get(fixture.chauffeurEmail);

    if (!user) {
      if (verbose) {
        log.warn(`Chauffeur not found for email: ${fixture.chauffeurEmail}, skipping item: ${fixture.title}`);
      }
      continue;
    }

    // Check if item with exact title by this user already exists (idempotency)
    const existing = await Item.findOne({
      title: fixture.title,
      createdBy: user._id,
    });

    if (existing) {
      skippedCount++;
      if (verbose) {
        log.skip(`Item "${fixture.title}" already exists.`);
      }
      continue;
    }

    await Item.create({
      title: fixture.title,
      price: fixture.price,
      condition: fixture.condition,
      status: fixture.status,
      location: fixture.location,
      description: fixture.description,
      photos: fixture.photos,
      createdBy: user._id,
    });

    insertedCount++;
    if (verbose) {
      log.created(`Item "${fixture.title}" ($${fixture.price}) listed by ${user.name}`);
    }
  }

  spinner.succeed(
    `Marketplace Items seeded: ${insertedCount} created, ${skippedCount} skipped.`,
  );

  return insertedCount;
}
