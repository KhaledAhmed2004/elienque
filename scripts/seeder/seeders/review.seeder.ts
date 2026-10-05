/**
 * Chauffeur & Operator Reviews Seeder
 *
 * Responsibilities:
 *   1. Finds seeded active Chauffeurs and Fleet Operators across service areas.
 *   2. Creates completed Jobs with realistic luxury route data, diverse 5★ and 4★ ratings,
 *      comments, and realistic timestamps spread across the last 30 days.
 *   3. Populates both `reviewByCreator` (operator reviews chauffeur) and `reviewByDriver`
 *      (chauffeur reviews operator) for full bilateral feedback testing.
 *   4. Recalculates `averageRating` and `totalReviews` on User documents so profile
 *      stats stay 100% synchronized with MongoDB aggregation pipelines.
 */

import { Types } from 'mongoose';
import { Job } from '../../../src/app/modules/job/job.model';
import { User } from '../../../src/app/modules/user/user.model';
import {
  JOB_STATUS,
  JOB_TYPE,
  PAYMENT_TYPE,
  RIDE_STATUS,
  DISPATCH_TYPE,
} from '../../../src/app/modules/job/job.interface';
import { COMPANY_ROLE, USER_ROLES } from '../../../src/enums/user';
import { log } from '../seeder.logger';

type CityReviewProfile = {
  routes: Array<{ pickup: string; dropoff: string; vehicleType: string; amount: number }>;
  creatorReviews: Array<{ rating: number; comment: string }>;
  driverReviews: Array<{ rating: number; comment: string }>;
}

const CITY_PROFILES: Record<string, CityReviewProfile> = {
  'New York Metro': {
    routes: [
      { pickup: 'JFK International Airport, Terminal 4 (Delta Sky Club)', dropoff: 'The Plaza Hotel, 768 5th Ave, New York, NY', vehicleType: 'Sedan', amount: 195 },
      { pickup: 'The Ritz-Carlton New York, Central Park (50 Central Park S)', dropoff: 'Wall Street Financial Center (Multi-Stop Roadshow)', vehicleType: 'Sedan', amount: 280 },
      { pickup: 'LaGuardia Airport, Terminal B (VIP Pickup)', dropoff: 'Baccarat Hotel New York, 28 W 53rd St', vehicleType: 'SUV', amount: 175 },
      { pickup: 'Four Seasons Hotel Downtown, 27 Barclay St', dropoff: 'Teterboro Airport, Jet Aviation FBO', vehicleType: 'Sedan', amount: 260 },
      { pickup: 'The St. Regis New York, Two E 55th St', dropoff: 'Greenwich Polo Club, VIP Pavilion', vehicleType: 'SUV', amount: 380 },
      { pickup: 'Hudson Yards, 30 Hudson Yards', dropoff: 'Newark Liberty International Airport, Terminal C', vehicleType: 'Sedan', amount: 210 },
      { pickup: 'The Mark Hotel, 25 E 77th St, Upper East Side', dropoff: 'Lincoln Center for the Performing Arts', vehicleType: 'Sedan', amount: 150 },
    ],
    creatorReviews: [
      { rating: 5, comment: 'Exceptional chauffeur service! Punctual, immaculate S-Class, and smooth navigation through Midtown.' },
      { rating: 5, comment: 'Top-tier VIP luxury experience. Highly recommended for our international executive board members.' },
      { rating: 5, comment: 'Flawless airport tarmac transfer. Arrived 15 minutes early and assisted with all heavy luggage.' },
      { rating: 4, comment: 'Very professional, courteous, and polite chauffeur. Great vehicle comfort and amenities.' },
      { rating: 5, comment: 'Pristine vehicle condition, smooth driving, and discreet executive protocol throughout.' },
      { rating: 5, comment: 'Outstanding navigation through heavy rain and traffic. Client was extremely pleased!' },
      { rating: 5, comment: 'Consistently five-star performance. Alexander & Marcus are our top preferred chauffeurs.' },
    ],
    driverReviews: [
      { rating: 5, comment: 'Great dispatching from operator, crystal clear instructions, and instant payment settlement.' },
      { rating: 5, comment: 'Pleasant client, seamless communication, and very respectful company management.' },
      { rating: 5, comment: 'Detailed itinerary provided in advance. Always a pleasure driving for Global Executive.' },
      { rating: 5, comment: 'Accurate flight tracking details and generous gratuity included. Top dispatcher!' },
      { rating: 4, comment: 'Good trip dispatch, quick confirmation on gate changes.' },
      { rating: 5, comment: 'Seamless coordination and prompt responses via dispatch chat.' },
      { rating: 5, comment: 'Excellent operator to partner with. Highly professional team.' },
    ],
  },
  'Miami South Florida': {
    routes: [
      { pickup: 'Miami International Airport (MIA), Concourse D', dropoff: 'Faena Hotel Miami Beach, 3201 Collins Ave', vehicleType: 'Sedan', amount: 185 },
      { pickup: 'The Setai Miami Beach, 2001 Collins Ave', dropoff: 'Brickell Financial District, 1450 Brickell Ave', vehicleType: 'Sedan', amount: 160 },
      { pickup: 'Fort Lauderdale-Hollywood Int Airport (FLL)', dropoff: '1 Hotel South Beach, 2341 Collins Ave', vehicleType: 'SUV', amount: 240 },
      { pickup: 'Bal Harbour Shops, 9700 Collins Ave', dropoff: 'Palm Beach Private Club, Ocean Blvd', vehicleType: 'Sedan', amount: 350 },
      { pickup: 'Fisher Island Ferry Terminal', dropoff: 'MIA Signature Flight Support Private Jet FBO', vehicleType: 'SUV', amount: 220 },
      { pickup: 'Four Seasons Hotel at The Surf Club, Surfside', dropoff: 'Miami Beach Convention Center (Art Basel)', vehicleType: 'Sedan', amount: 190 },
    ],
    creatorReviews: [
      { rating: 5, comment: 'Impeccable BMW 7-Series, ice-cold bottled water, and pristine presentation. Sophia is fantastic!' },
      { rating: 5, comment: 'Arrived early at the FBO, handled celebrity luggage with utmost discretion. 5 stars.' },
      { rating: 4, comment: 'Smooth coastal drive, polite and multilingual driver. Will definitely book again.' },
      { rating: 5, comment: 'Best luxury chauffeur experience in Miami Beach. Clients praised the smooth ride.' },
      { rating: 5, comment: 'Extremely professional, elegant driving, and spotless luxury interior.' },
      { rating: 5, comment: 'First-class service from Miami Airport to Faena. Punctual and very courteous.' },
    ],
    driverReviews: [
      { rating: 5, comment: 'Fantastic operator. Dispatch instructions were clear and client was right on time.' },
      { rating: 5, comment: 'Smooth booking and great communication from Luxe Ocean team.' },
      { rating: 5, comment: 'Great job, prompt payout, and very polite VIP passenger.' },
      { rating: 4, comment: 'Good communication and smooth passenger pickup at the marina.' },
      { rating: 5, comment: 'Top-tier luxury client. Pleasure to work with this company.' },
      { rating: 5, comment: 'Seamless dispatch coordination for Art Basel week.' },
    ],
  },
  'Los Angeles Area': {
    routes: [
      { pickup: 'Los Angeles International Airport (LAX), Private Suite PS', dropoff: 'The Beverly Hills Hotel, 9641 Sunset Blvd', vehicleType: 'SUV', amount: 275 },
      { pickup: 'Hotel Bel-Air, 701 Stone Canyon Rd', dropoff: 'Century City Plaza Towers, 2029 Century Park E', vehicleType: 'Sedan', amount: 170 },
      { pickup: 'SoFi Stadium, VIP Champions Club Lot', dropoff: 'Nobu Ryokan Malibu, 22752 Pacific Coast Hwy', vehicleType: 'SUV', amount: 360 },
      { pickup: 'Van Nuys Private Airport (VNY), Signature FBO', dropoff: 'Waldorf Astoria Beverly Hills, 9850 Wilshire Blvd', vehicleType: 'SUV', amount: 230 },
      { pickup: 'Rodeo Drive Boutique Row, Beverly Hills', dropoff: 'Santa Monica Beachfront Estate', vehicleType: 'Sedan', amount: 180 },
    ],
    creatorReviews: [
      { rating: 5, comment: 'David is our go-to chauffeur in LA. Immaculate Lincoln Navigator and unmatched road knowledge.' },
      { rating: 5, comment: 'Executive protection protocol and smooth driving through 405 traffic. Superb!' },
      { rating: 5, comment: 'First class all the way from Van Nuys FBO to Beverly Hills. Highly recommended.' },
      { rating: 4, comment: 'Very pleasant driver, clean SUV, and on-time arrival at the private terminal.' },
      { rating: 5, comment: 'Flawless red-carpet event transfer. Looked sharp and provided exceptional service.' },
    ],
    driverReviews: [
      { rating: 5, comment: 'Beverly Hills Concierge provided crystal-clear passenger manifest and great dispatch notes.' },
      { rating: 5, comment: 'Great VIP client, seamless tarmac access protocol, and rapid payment.' },
      { rating: 5, comment: 'Outstanding communication from operator desk throughout the day.' },
      { rating: 5, comment: 'High-caliber executive clients and pleasant dispatching.' },
      { rating: 5, comment: 'Prompt payment and excellent cooperation on flight delays.' },
    ],
  },
};

/**
 * Recalculate averageRating and totalReviews for all reviewed users to match DB aggregate exactly.
 */
async function syncUserRatings(): Promise<void> {
  const users = await User.find({ role: USER_ROLES.USER });
  for (const user of users) {
    const objectId = user._id as Types.ObjectId;
    const [stats] = await Job.aggregate([
      {
        $match: {
          $or: [
            { createdBy: objectId, 'reviewByDriver.rating': { $exists: true } },
            { assignedTo: objectId, 'reviewByCreator.rating': { $exists: true } },
          ],
        },
      },
      {
        $project: {
          rating: {
            $cond: [
              { $eq: ['$createdBy', objectId] },
              '$reviewByDriver.rating',
              '$reviewByCreator.rating',
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    if (stats && stats.totalReviews > 0) {
      await User.findByIdAndUpdate(objectId, {
        averageRating: Math.round(stats.averageRating * 10) / 10,
        totalReviews: stats.totalReviews,
      });
    }
  }
}

export async function seedChauffeurReviews(verbose: boolean): Promise<number> {
  const chauffeurs = await User.find({
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    role: USER_ROLES.USER,
    accountState: 'VERIFIED',
    appState: 'ACTIVE',
  });

  const operators = await User.find({
    companyRole: { $in: [COMPANY_ROLE.OPERATOR, COMPANY_ROLE.OWNER, COMPANY_ROLE.COMPANY_MANAGER] },
    role: USER_ROLES.USER,
  });

  if (!chauffeurs.length || !operators.length) {
    if (verbose) log.skipped('No active chauffeurs or operators found to seed reviews.');
    return 0;
  }

  let seededCount = 0;
  const now = Date.now();

  for (let cIdx = 0; cIdx < chauffeurs.length; cIdx++) {
    const chauffeur = chauffeurs[cIdx];
    const areaName = chauffeur.serviceArea || 'New York Metro';
    const profile = CITY_PROFILES[areaName] || CITY_PROFILES['New York Metro'];

    // Check existing completed jobs with reviews for this chauffeur
    const existingCount = await Job.countDocuments({
      assignedTo: chauffeur._id,
      status: JOB_STATUS.COMPLETED,
      'reviewByCreator.rating': { $exists: true },
    });

    if (existingCount >= 5) {
      if (verbose) log.skipped(`Reviews for ${chauffeur.name} (${existingCount} reviews already exist)`);
      continue;
    }

    // Seed 5 to 7 reviews per chauffeur with spaced timestamps across the last 30 days
    const reviewCount = Math.min(profile.routes.length, profile.creatorReviews.length);

    for (let i = 0; i < reviewCount; i++) {
      const operator = operators[(cIdx + i) % operators.length];
      const route = profile.routes[i];
      const creatorReview = profile.creatorReviews[i];
      const driverReview = profile.driverReviews[i % profile.driverReviews.length];

      // Spread timestamps over days ago (e.g., 28 days ago, 24 days ago, ..., 1 day ago)
      const daysAgo = Math.max(1, (reviewCount - i) * 4);
      const rideDate = new Date(now - daysAgo * 86400000);
      const reviewedAt = new Date(rideDate.getTime() + 3600000 * 3); // 3 hours after ride

      await Job.create({
        pickup: route.pickup,
        dropoff: route.dropoff,
        jobType: i % 3 === 0 ? JOB_TYPE.BY_THE_HOUR : JOB_TYPE.ONE_WAY,
        date: rideDate,
        time: '10:30',
        vehicleType: route.vehicleType,
        paymentAmount: route.amount,
        paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
        dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
        isPersonalNote: false,
        status: JOB_STATUS.COMPLETED,
        rideStatus: RIDE_STATUS.FINISHED,
        serviceArea: areaName,
        companyName: operator.companyName || operator.company || 'Executive Fleet Partners',
        passengerName: 'VIP Executive Guest',
        passengerPhone: '+12125550199',
        createdBy: operator._id,
        assignedTo: chauffeur._id,
        reviewByCreator: {
          rating: creatorReview.rating,
          comment: creatorReview.comment,
          reviewedAt,
        },
        reviewByDriver: {
          rating: driverReview.rating,
          comment: driverReview.comment,
          reviewedAt: new Date(reviewedAt.getTime() + 1800000), // 30 min later
        },
      });

      seededCount++;
    }

    if (verbose) log.created(`Seeded ${reviewCount} completed ride reviews for ${chauffeur.name} (${areaName})`);
  }

  // Recalculate and update ratings on User documents
  await syncUserRatings();

  return seededCount;
}
