/**
 * User Seeder
 *
 * Responsibilities:
 *   1. Seed Chauffeurs  — with multi-vehicle fleet linking via vehicle.seeder
 *   2. Seed Operators   — with pre-populated favoriteChauffeurs
 *   3. Seed Edge Cases  — pending/suspended status variants with multi-vehicle fleets
 *
 * PASSWORD SAFETY NOTE:
 *   We use `new User(payload).save()` — NOT `User.create()` or `findOneAndUpdate()`.
 *   Only `.save()` triggers the Mongoose `pre('save')` middleware that bcrypt-hashes the password.
 *   Upsert methods (findOneAndUpdate) bypass middleware and would store plaintext passwords.
 *
 * IDEMPOTENCY:
 *   We guard with `User.findOne({ email })` before calling `.save()`.
 *   If user already exists, we skip — no duplicate, no error.
 */

import { Types } from 'mongoose';
import { User } from '../../../src/app/modules/user/user.model';
import { USER_ROLES, VEHICLE_STATUS, APP_STATE, ACCOUNT_STATE } from '../../../src/enums/user';
import { CHAUFFEUR_FIXTURES } from '../fixtures/chauffeurs.fixture';
import { OPERATOR_FIXTURES, EDGE_CASE_FIXTURES } from '../fixtures/operators.fixture';
import { AreaMap } from './service-area.seeder';
import { seedVehiclesForChauffeur, seedVehicleForEdgeCase } from './vehicle.seeder';
import { seedDocumentsForUserAndVehicle } from './document.seeder';
import { log } from '../seeder.logger';
import { SeededUserRow } from '../seeder.logger';

const PASSWORD = 'Password123!';
const LICENSE_EXPIRY = new Date('2028-12-31');

// ─── Chauffeurs ───────────────────────────────────────────────────────────────

export async function seedChauffeurs(
  areaMap: AreaMap,
  verbose: boolean,
): Promise<{ ids: Types.ObjectId[]; rows: SeededUserRow[] }> {
  const ids: Types.ObjectId[] = [];
  const rows: SeededUserRow[] = [];

  for (let i = 0; i < CHAUFFEUR_FIXTURES.length; i++) {
    const fixture = CHAUFFEUR_FIXTURES[i];
    const serviceAreaId = areaMap.get(fixture.serviceAreaName);

    if (!serviceAreaId) {
      log.error(`ServiceArea "${fixture.serviceAreaName}" not found for chauffeur ${fixture.email}`);
      continue;
    }

    // Idempotency guard
    const existing = await User.findOne({ email: fixture.email });
    if (existing) {
      await User.findByIdAndUpdate(existing._id, {
        $set: {
          nickname: fixture.nickname,
          isOnboard: true,
          profilePicture: fixture.profilePicture,
          drivingLicense: {
            image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
            expireDate: LICENSE_EXPIRY,
          },
          hackLicense: {
            image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
            expireDate: LICENSE_EXPIRY,
          },
          localPermit: {
            image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
            expireDate: LICENSE_EXPIRY,
          },
          ...(fixture.paymentMethods ? { paymentMethods: fixture.paymentMethods } : {}),
        },
      });

      // Ensure vehicles and documents exist even if user previously existed
      const vehicleIds = await seedVehiclesForChauffeur({
        fixture,
        chauffeurId: existing._id as Types.ObjectId,
        verbose,
      });

      if (vehicleIds.length > 0) {
        await User.findByIdAndUpdate(existing._id, {
          selectedVehicle: vehicleIds[0],
        });

        for (const vId of vehicleIds) {
          await seedDocumentsForUserAndVehicle({
            userId: existing._id as Types.ObjectId,
            vehicleId: vId,
            verbose,
          });
        }
      }

      if (verbose) log.skipped(`Chauffeur: ${fixture.name} (${fixture.email})`);
      ids.push(existing._id as Types.ObjectId);
      rows.push({
        index: rows.length + 1,
        role: 'Chauffeur',
        email: fixture.email,
        name: fixture.name,
        note: `${fixture.vehicles?.length || 1} Vehicles in fleet · ${fixture.averageRating}★`,
      });
      continue;
    }

    // Create chauffeur user — triggers pre('save') password hashing
    const user = new User({
      name: fixture.name,
      nickname: fixture.nickname,
      email: fixture.email,
      password: PASSWORD,
      phone: fixture.phone,
      role: USER_ROLES.USER,
      companyName: fixture.companyName,
      company: fixture.companyName,
      companyRole: fixture.companyRole,
      accountState: fixture.accountState,
      appState: fixture.appState,
      isOnboard: true,
      serviceArea: fixture.serviceAreaName,
      serviceAreaId,
      averageRating: fixture.averageRating,
      totalReviews: fixture.totalReviews,
      profilePicture: fixture.profilePicture,
      uploadedHeadshot: fixture.profilePicture,
      drivingLicense: {
        image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
        expireDate: LICENSE_EXPIRY,
      },
      hackLicense: {
        image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
        expireDate: LICENSE_EXPIRY,
      },
      localPermit: {
        image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
        expireDate: LICENSE_EXPIRY,
      },
      paymentMethods: fixture.paymentMethods,
    });
    await user.save();

    const chauffeurId = user._id as Types.ObjectId;

    // Seed vehicle fleet and link primary to user
    const vehicleIds = await seedVehiclesForChauffeur({
      fixture,
      chauffeurId,
      verbose,
    });

    if (vehicleIds.length > 0) {
      await User.findByIdAndUpdate(chauffeurId, {
        selectedVehicle: vehicleIds[0],
      });

      // Seed MongoDB Document collection records for user & all vehicles
      for (const vId of vehicleIds) {
        await seedDocumentsForUserAndVehicle({
          userId: chauffeurId,
          vehicleId: vId,
          verbose,
        });
      }
    }

    log.created(
      `Chauffeur: ${fixture.name} (${fixture.email}) — ${fixture.vehicles?.length || 1} vehicles in fleet (${fixture.averageRating}★)`,
    );

    ids.push(chauffeurId);
    rows.push({
      index: rows.length + 1,
      role: 'Chauffeur',
      email: fixture.email,
      name: fixture.name,
      note: `${fixture.vehicles?.length || 1} Vehicles in fleet · ${fixture.averageRating}★`,
    });
  }

  return { ids, rows };
}

// ─── Operators ────────────────────────────────────────────────────────────────

export async function seedOperators(
  areaMap: AreaMap,
  chauffeurIds: Types.ObjectId[],
  verbose: boolean,
): Promise<SeededUserRow[]> {
  const rows: SeededUserRow[] = [];

  for (const fixture of OPERATOR_FIXTURES) {
    const serviceAreaId = areaMap.get(fixture.serviceAreaName);

    if (!serviceAreaId) {
      log.error(`ServiceArea "${fixture.serviceAreaName}" not found for operator ${fixture.email}`);
      continue;
    }

    // Resolve favorite chauffeur IDs from indexes
    const favoriteChauffeurs = fixture.favoriteIndexes
      .map((idx) => chauffeurIds[idx])
      .filter(Boolean);

    // Idempotency guard
    const existing = await User.findOne({ email: fixture.email });
    if (existing) {
      await User.findByIdAndUpdate(existing._id, {
        $set: {
          nickname: fixture.nickname,
          isOnboard: true,
          profilePicture: fixture.profilePicture,
          ...(fixture.paymentMethods ? { paymentMethods: fixture.paymentMethods } : {}),
          ...(favoriteChauffeurs.length > 0 ? { favoriteChauffeurs } : {}),
        },
      });
      if (verbose) log.skipped(`Operator: ${fixture.name} (${fixture.email})`);
      rows.push({
        index: rows.length + 1,
        role: fixture.companyRole,
        email: fixture.email,
        name: fixture.name,
        note: `${favoriteChauffeurs.length} favorites pre-linked`,
      });
      continue;
    }

    const user = new User({
      name: fixture.name,
      nickname: fixture.nickname,
      email: fixture.email,
      password: PASSWORD,
      phone: fixture.phone,
      role: USER_ROLES.USER,
      companyName: fixture.companyName,
      company: fixture.companyName,
      companyRole: fixture.companyRole,
      accountState: fixture.accountState,
      appState: fixture.appState,
      isOnboard: true,
      serviceArea: fixture.serviceAreaName,
      serviceAreaId,
      profilePicture: fixture.profilePicture,
      favoriteChauffeurs,
      paymentMethods: fixture.paymentMethods,
    });
    await user.save();

    log.created(
      `Operator: ${fixture.name} (${fixture.email}) — ${favoriteChauffeurs.length} pre-favorited chauffeurs`,
    );
    if (favoriteChauffeurs.length > 0) {
      log.linked(
        `Favorites linked: ${fixture.favoriteIndexes.map((i) => CHAUFFEUR_FIXTURES[i]?.name).filter(Boolean).join(', ')}`,
      );
    }

    rows.push({
      index: rows.length + 1,
      role: fixture.companyRole,
      email: fixture.email,
      name: fixture.name,
      note: `${favoriteChauffeurs.length} favorites pre-linked`,
    });
  }

  return rows;
}

// ─── Edge-Case / Status-Variant Users ────────────────────────────────────────

export async function seedEdgeCaseUsers(
  areaMap: AreaMap,
  verbose: boolean,
): Promise<SeededUserRow[]> {
  const rows: SeededUserRow[] = [];

  for (const fixture of EDGE_CASE_FIXTURES) {
    const serviceAreaId = areaMap.get(fixture.serviceAreaName);

    // Idempotency guard
    const existing = await User.findOne({ email: fixture.email });
    if (existing) {
      if (verbose) log.skipped(`Edge-case user: ${fixture.name} (${fixture.email})`);
      rows.push({
        index: rows.length + 1,
        role: fixture.companyRole,
        email: fixture.email,
        name: fixture.name,
        note: fixture.label,
      });
      continue;
    }

    const isPending = fixture.appState === APP_STATE.PENDING;
    const isActionRequired = fixture.appState === APP_STATE.ACTION_REQUIRED;
    const isApprovedVeh = fixture.email.includes('approvedveh');

    const user = new User({
      name: fixture.name,
      email: fixture.email,
      password: PASSWORD,
      phone: fixture.phone,
      role: USER_ROLES.USER,
      companyName: fixture.companyName,
      company: fixture.companyName,
      companyRole: fixture.companyRole,
      accountState: fixture.accountState,
      appState: fixture.appState,
      isOnboard: true,
      serviceArea: fixture.serviceAreaName,
      serviceAreaId,
      profilePicture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
      drivingLicense: {
        image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
        expireDate: LICENSE_EXPIRY,
      },
      hackLicense: {
        image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
        expireDate: LICENSE_EXPIRY,
      },
      localPermit: {
        image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
        expireDate: LICENSE_EXPIRY,
      },
      ...(isActionRequired
        ? { rejectionReason: 'Local permit document image is blurry. Please re-upload a clear copy.' }
        : {}),
      ...(fixture.accountState === ACCOUNT_STATE.SUSPENDED
        ? { blockReason: 'Policy violation: Unresolved customer dispute.' }
        : {}),
    });
    await user.save();

    const edgeUserId = user._id as Types.ObjectId;

    // Seed vehicle fleet for edge case
    const vehicleList = fixture.vehicles || [
      {
        type: 'Sedan',
        makeAndModel: 'Cadillac Escalade ESV Luxury',
        colorInside: 'Jet Black Leather',
        colorOutside: 'Black Raven',
        year: 2024,
        licensePlate: 'NY-PEND-9090',
      },
    ];

    const vehicleStatus = isApprovedVeh
      ? VEHICLE_STATUS.APPROVED
      : isPending
      ? VEHICLE_STATUS.PENDING_REVIEW
      : VEHICLE_STATUS.APPROVED;

    const edgeVehicleIds: Types.ObjectId[] = [];

    for (const v of vehicleList) {
      const edgeVehicleId = await seedVehicleForEdgeCase({
        chauffeurId: edgeUserId,
        chauffeurName: fixture.name,
        status: vehicleStatus,
        licensePlate: v.licensePlate,
        makeAndModel: v.makeAndModel,
        type: v.type,
        colorInside: v.colorInside,
        colorOutside: v.colorOutside,
        year: v.year,
        verbose,
      });

      edgeVehicleIds.push(edgeVehicleId);

      // Seed MongoDB Document collection records for this vehicle
      await seedDocumentsForUserAndVehicle({
        userId: edgeUserId,
        vehicleId: edgeVehicleId,
        isPending: isPending && !isApprovedVeh,
        isActionRequired,
        verbose,
      });
    }

    if (edgeVehicleIds.length > 0) {
      await User.findByIdAndUpdate(edgeUserId, {
        selectedVehicle: edgeVehicleIds[0],
      });
    }

    log.created(`Edge-case: ${fixture.name} (${fixture.email}) — ${fixture.label}`);

    rows.push({
      index: rows.length + 1,
      role: fixture.companyRole,
      email: fixture.email,
      name: fixture.name,
      note: fixture.label,
    });
  }

  return rows;
}
