/**
 * Document Seeder
 *
 * Responsibilities:
 *   1. Seed MongoDB Document collection records for all Chauffeurs and Vehicles.
 *   2. Support active approved documents, pending review documents, and rejected documents.
 *   3. Synchronize with Document model indexes and admin verification dashboard.
 */

import { Types } from 'mongoose';
import { Document } from '../../../src/app/modules/document/document.model';
import { User } from '../../../src/app/modules/user/user.model';
import { Vehicle } from '../../../src/app/modules/vehicle/vehicle.model';
import { DOCUMENT_STATUS, DOCUMENT_TYPE, USER_ROLES } from '../../../src/enums/user';
import { log } from '../seeder.logger';

const FUTURE_EXPIRY = new Date('2028-12-31');

type SeedDocsOptions = {
  userId: Types.ObjectId;
  vehicleId?: Types.ObjectId;
  isPending?: boolean;
  isActionRequired?: boolean;
  verbose: boolean;
}

export async function seedDocumentsForUserAndVehicle({
  userId,
  vehicleId,
  isPending = false,
  isActionRequired = false,
  verbose,
}: SeedDocsOptions): Promise<number> {
  let createdCount = 0;

  const defaultStatus = isPending
    ? DOCUMENT_STATUS.PENDING_REVIEW
    : DOCUMENT_STATUS.APPROVED;

  // 1. Personal Documents
  const personalDocs = [
    {
      documentType: DOCUMENT_TYPE.DRIVING_LICENSE,
      storageKey: `documents/driving_license_${userId}.jpg`,
      originalFilename: 'driving_license.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 245120,
      expiryDate: FUTURE_EXPIRY,
      status: defaultStatus,
    },
    {
      documentType: DOCUMENT_TYPE.HACK_LICENSE,
      storageKey: `documents/hack_license_${userId}.jpg`,
      originalFilename: 'tlc_hack_license.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 198400,
      expiryDate: FUTURE_EXPIRY,
      status: defaultStatus,
    },
    {
      documentType: DOCUMENT_TYPE.LOCAL_PERMIT,
      storageKey: `documents/local_permit_${userId}.jpg`,
      originalFilename: 'chauffeur_permit.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 215000,
      expiryDate: FUTURE_EXPIRY,
      status: isActionRequired ? DOCUMENT_STATUS.REJECTED : defaultStatus,
      rejectionReason: isActionRequired
        ? 'Local permit document image is blurry and illegible. Please re-upload a clear copy.'
        : undefined,
    },
    {
      documentType: DOCUMENT_TYPE.PROFILE_PICTURE,
      storageKey: `profiles/headshot_${userId}.jpg`,
      originalFilename: 'profile_headshot.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 350000,
      status: defaultStatus,
    },
  ];

  for (const docData of personalDocs) {
    const existing = await Document.findOne({
      userId,
      documentType: docData.documentType,
    });

    if (existing) {
      if (verbose) log.skipped(`Document: ${docData.documentType} for user ${userId}`);
      continue;
    }

    await Document.create({
      userId,
      ...docData,
      version: 1,
      scanAttempts: 1,
      scanResult: 'PASSED',
    });
    createdCount++;
  }

  // 2. Vehicle Documents (if vehicleId provided)
  if (vehicleId) {
    const vehicleDocs = [
      {
        documentType: DOCUMENT_TYPE.VEHICLE_REGISTRATION,
        storageKey: `vehicles/registration_${vehicleId}.jpg`,
        originalFilename: 'vehicle_registration.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 280000,
        expiryDate: FUTURE_EXPIRY,
        status: defaultStatus,
      },
      {
        documentType: DOCUMENT_TYPE.VEHICLE_INSURANCE,
        storageKey: `vehicles/commercial_insurance_${vehicleId}.pdf`,
        originalFilename: 'commercial_insurance.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 520000,
        expiryDate: FUTURE_EXPIRY,
        status: defaultStatus,
      },
      {
        documentType: DOCUMENT_TYPE.VEHICLE_PHOTO,
        storageKey: `vehicles/exterior_photo_${vehicleId}.jpg`,
        originalFilename: 'vehicle_exterior.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 420000,
        status: defaultStatus,
      },
    ];

    for (const vDoc of vehicleDocs) {
      const existing = await Document.findOne({
        userId,
        entityId: vehicleId,
        documentType: vDoc.documentType,
      });

      if (existing) {
        if (verbose) log.skipped(`Vehicle Document: ${vDoc.documentType} for vehicle ${vehicleId}`);
        continue;
      }

      await Document.create({
        userId,
        entityId: vehicleId,
        ...vDoc,
        version: 1,
        scanAttempts: 1,
        scanResult: 'PASSED',
      });
      createdCount++;
    }
  }

  return createdCount;
}

/**
 * Seed documents for all users and vehicles in the system.
 */
export async function seedAllDocuments(verbose: boolean): Promise<number> {
  const chauffeurs = await User.find({ role: USER_ROLES.USER });
  let totalDocs = 0;

  for (const user of chauffeurs) {
    const isPending = user.appState === 'PENDING';
    const isActionRequired = user.appState === 'ACTION_REQUIRED';
    const vehicles = await Vehicle.find({ owner: user._id });

    // Seed personal documents
    totalDocs += await seedDocumentsForUserAndVehicle({
      userId: user._id as Types.ObjectId,
      isPending,
      isActionRequired,
      verbose,
    });

    // Seed documents for all vehicles in fleet
    for (const vehicle of vehicles) {
      totalDocs += await seedDocumentsForUserAndVehicle({
        userId: user._id as Types.ObjectId,
        vehicleId: vehicle._id as Types.ObjectId,
        isPending: isPending && vehicle.status !== 'APPROVED',
        isActionRequired,
        verbose,
      });
    }
  }

  return totalDocs;
}
