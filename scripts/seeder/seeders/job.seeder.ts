/**
 * Job & Application Seeder
 *
 * Responsibilities:
 *   1. Seeds realistic open jobs across all service areas (New York, Miami, Los Angeles)
 *      so drivers can browse, view, and apply.
 *   2. Seeds jobs with driver applications (Alexander, Marcus, Sophia, David) complete
 *      with applicant driver info, vehicleId, appliedAt timestamps, and pre-established
 *      negotiation chats and messages.
 *   3. Seeds active ASSIGNED rides in various ride statuses (PENDING, ON_THE_WAY,
 *      AT_THE_LOCATION, POB) for real-time tracking demonstrations.
 *   4. Seeds TARGETED_CHAUFFEURS jobs, PERSONAL_NOTE jobs, and CANCELLED jobs.
 */

import { Types } from 'mongoose';
import { Job } from '../../../src/app/modules/job/job.model';
import { User } from '../../../src/app/modules/user/user.model';
import { Chat } from '../../../src/app/modules/chat/chat.model';
import { Message } from '../../../src/app/modules/message/message.model';
import {
  JOB_STATUS,
  JOB_TYPE,
  PAYMENT_TYPE,
  DISPATCH_TYPE,
  RIDE_STATUS,
} from '../../../src/app/modules/job/job.interface';
import { log } from '../seeder.logger';

export async function seedJobsAndApplications(verbose: boolean): Promise<{
  jobsCount: number;
  applicationsCount: number;
  chatsCount: number;
}> {
  const alexander = await User.findOne({ email: 'alex.wright@chauffeur.com' });
  const marcus = await User.findOne({ email: 'marcus.sterling@chauffeur.com' });
  const sophia = await User.findOne({ email: 'sophia.laurent@chauffeur.com' });
  const david = await User.findOne({ email: 'david.rossi@chauffeur.com' });
  const brandon = await User.findOne({ email: 'brandon.hayes@chauffeur.com' });
  const isabella = await User.findOne({ email: 'isabella.gomez@chauffeur.com' });
  const james = await User.findOne({ email: 'james.thornton@chauffeur.com' });
  const carlos = await User.findOne({ email: 'carlos.mendez@chauffeur.com' });

  const harrison = await User.findOne({ email: 'operator@globaltrans.com' });
  const elena = await User.findOne({ email: 'elena.rostova@luxefleet.com' });
  const robert = await User.findOne({ email: 'robert.sterling@beverlyfleet.com' });
  const charles = await User.findOne({ email: 'charles.montgomery@manhattanlimo.com' });
  const victoria = await User.findOne({ email: 'victoria@palmluxury.com' });

  if (!alexander || !marcus) {
    if (verbose) {
      log.skipped('Chauffeur users not found. Ensure chauffeurs are seeded first.');
    }
    return { jobsCount: 0, applicationsCount: 0, chatsCount: 0 };
  }

  // Clear previous non-completed seeded test jobs created by or assigned to these users
  const seedUserIds = [
    alexander._id,
    marcus._id,
    sophia?._id,
    david?._id,
    brandon?._id,
    isabella?._id,
    james?._id,
    carlos?._id,
    harrison?._id,
    elena?._id,
    robert?._id,
    charles?._id,
    victoria?._id,
  ].filter(Boolean) as Types.ObjectId[];

  const previousActiveJobs = await Job.find({
    createdBy: { $in: seedUserIds },
    status: { $ne: JOB_STATUS.COMPLETED },
  });

  const previousJobIds = previousActiveJobs.map((j) => j._id);
  if (previousJobIds.length > 0) {
    await Chat.deleteMany({ jobId: { $in: previousJobIds } });
    await Message.deleteMany({});
    await Job.deleteMany({ _id: { $in: previousJobIds } });
  }

  let jobsCount = 0;
  let applicationsCount = 0;
  let chatsCount = 0;

  const now = Date.now();

  // Helper to create chat & messages for an applied job
  async function createApplicationChat(
    jobId: Types.ObjectId,
    creatorId: Types.ObjectId,
    driverId: Types.ObjectId,
    messages: Array<{ senderId: Types.ObjectId; text: string; offsetMinutesAgo: number }>,
  ) {
    const lastMsg = messages[messages.length - 1];
    const lastMessageAt = new Date(now - (lastMsg?.offsetMinutesAgo || 0) * 60000);

    const chat = await Chat.create({
      participants: [creatorId, driverId],
      jobId,
      createdBy: creatorId,
      lastMessage: lastMsg?.text || 'Driver applied for job',
      lastMessageAt,
    });
    chatsCount++;

    for (const msg of messages) {
      await Message.create({
        chatId: chat._id,
        sender: msg.senderId,
        text: msg.text,
        createdAt: new Date(now - msg.offsetMinutesAgo * 60000),
      });
    }

    return chat;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: NEW YORK METRO JOBS
  // ═══════════════════════════════════════════════════════════════════════════

  // 1.1 Alexander's Job: PENDING with Marcus Sterling applied
  const nyJob1 = await Job.create({
    jobType: JOB_TYPE.ONE_WAY,
    pickup: 'The Ritz-Carlton New York, Central Park (50 Central Park S)',
    dropoff: 'JFK International Airport, Terminal 4 (Delta Sky Club)',
    asap: false,
    date: new Date(now + 86400000 * 2), // 2 days ahead
    time: '14:30',
    vehicleType: 'Sedan',
    paymentAmount: 195,
    paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
    flightNumber: 'DL-4821',
    instruction: 'Meet passenger at front lobby. Assist with 3 large suitcases. Passenger name: Senator Hastings.',
    serviceArea: 'New York Metro',
    companyName: 'Empire Prestige Chauffeurs',
    dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
    isPersonalNote: false,
    status: JOB_STATUS.PENDING,
    rideStatus: null,
    createdBy: alexander._id,
    applicant: {
      driver: marcus._id,
      vehicleId: marcus.selectedVehicle,
      appliedAt: new Date(now - 7200000), // 2 hours ago
    },
  });
  jobsCount++;
  applicationsCount++;

  await createApplicationChat(nyJob1._id, alexander._id, marcus._id, [
    {
      senderId: alexander._id,
      text: 'Hello Marcus, please confirm you have booster seats and pristine interior ready if needed.',
      offsetMinutesAgo: 110,
    },
    {
      senderId: marcus._id,
      text: 'Yes Alexander, Escalade ESV is detailed and ready with booster seats in the rear trunk.',
      offsetMinutesAgo: 85,
    },
    {
      senderId: alexander._id,
      text: 'Perfect. The client appreciates punctual curbside greeting at Central Park South.',
      offsetMinutesAgo: 40,
    },
  ]);

  // 1.2 Alexander's Job: PENDING with Sophia Laurent applied
  if (sophia) {
    const nyJob2 = await Job.create({
      jobType: JOB_TYPE.BY_THE_HOUR,
      pickup: 'The St. Regis New York (Two E 55th St)',
      dropoff: 'Wall Street Financial Center (Multi-Stop Roadshow)',
      asap: false,
      date: new Date(now + 86400000 * 3), // 3 days ahead
      time: '09:00',
      vehicleType: 'SUV',
      paymentAmount: 360,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      flightNumber: 'PRIVATE-EXEC',
      instruction: 'Executive roadshow - 4 hours standby and inter-borough transfers. Sparkling water & mints required.',
      serviceArea: 'New York Metro',
      companyName: 'Empire Prestige Chauffeurs',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: alexander._id,
      applicant: {
        driver: sophia._id,
        vehicleId: sophia.selectedVehicle,
        appliedAt: new Date(now - 14400000), // 4 hours ago
      },
    });
    jobsCount++;
    applicationsCount++;

    await createApplicationChat(nyJob2._id, alexander._id, sophia._id, [
      {
        senderId: alexander._id,
        text: 'Hi Sophia, roadshow timing is strict with Goldman Sachs executives. Please arrive 15 mins early.',
        offsetMinutesAgo: 200,
      },
      {
        senderId: sophia._id,
        text: 'Understood Alexander. I will be on standby at the St. Regis porte-cochere by 8:45 AM sharp.',
        offsetMinutesAgo: 120,
      },
    ]);
  }

  // 1.3 Alexander's Job: Open PENDING (ASAP - available for any NY chauffeur to apply)
  await Job.create({
    jobType: JOB_TYPE.ONE_WAY,
    pickup: 'Hudson Yards Observation Deck (30 Hudson Yards)',
    dropoff: 'LaGuardia Airport, Terminal B',
    asap: true,
    vehicleType: 'SUV',
    paymentAmount: 165,
    paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
    flightNumber: 'AA-2091',
    instruction: 'Urgent airport transfer for VIP guest. Flight departure in 2.5 hours.',
    serviceArea: 'New York Metro',
    companyName: 'Empire Prestige Chauffeurs',
    dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
    isPersonalNote: false,
    status: JOB_STATUS.PENDING,
    rideStatus: null,
    createdBy: alexander._id,
  });
  jobsCount++;

  // 1.4 Alexander's Job: ASSIGNED to Marcus Sterling (Ride Status: ON_THE_WAY)
  await Job.create({
    jobType: JOB_TYPE.ONE_WAY,
    pickup: 'Baccarat Hotel New York (28 W 53rd St)',
    dropoff: 'Teterboro Airport, Private Jet Terminal (Jet Aviation)',
    asap: false,
    date: new Date(now + 86400000), // Tomorrow
    time: '11:00',
    vehicleType: 'Sedan',
    paymentAmount: 280,
    paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
    flightNumber: 'N789VIP',
    instruction: 'Private tarmac escort pass. Back console champagne request.',
    serviceArea: 'New York Metro',
    companyName: 'Empire Prestige Chauffeurs',
    dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
    isPersonalNote: false,
    status: JOB_STATUS.ASSIGNED,
    rideStatus: RIDE_STATUS.ON_THE_WAY,
    createdBy: alexander._id,
    assignedTo: marcus._id,
  });
  jobsCount++;

  // 1.5 Alexander's Job: ASSIGNED to Marcus Sterling (Ride Status: AT_THE_LOCATION)
  await Job.create({
    jobType: JOB_TYPE.ONE_WAY,
    pickup: 'The Mark Hotel (25 E 77th St)',
    dropoff: 'Lincoln Center for the Performing Arts',
    asap: false,
    date: new Date(now + 3600000 * 2), // Today in 2 hours
    time: '18:30',
    vehicleType: 'Sedan',
    paymentAmount: 175,
    paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
    instruction: 'Met Gala evening gala transfer. Driver in full black suit & tie.',
    serviceArea: 'New York Metro',
    companyName: 'Empire Prestige Chauffeurs',
    dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
    isPersonalNote: false,
    status: JOB_STATUS.ASSIGNED,
    rideStatus: RIDE_STATUS.AT_THE_LOCATION,
    createdBy: alexander._id,
    assignedTo: marcus._id,
  });
  jobsCount++;

  // 1.6 Alexander's Job: TARGETED CHAUFFEURS dispatch
  await Job.create({
    jobType: JOB_TYPE.ONE_WAY,
    pickup: 'Mandarin Oriental New York (80 Columbus Cir)',
    dropoff: 'Newark Liberty International Airport (EWR), Terminal A',
    asap: false,
    date: new Date(now + 86400000 * 4),
    time: '07:30',
    vehicleType: 'Sedan',
    paymentAmount: 215,
    paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
    flightNumber: 'UA-882',
    instruction: 'Targeted executive transfer for preferred fleet partners only.',
    serviceArea: 'New York Metro',
    companyName: 'Empire Prestige Chauffeurs',
    dispatchType: DISPATCH_TYPE.TARGETED_CHAUFFEURS,
    targetedChauffeurs: [marcus._id, sophia?._id].filter(Boolean) as Types.ObjectId[],
    isPersonalNote: false,
    status: JOB_STATUS.PENDING,
    rideStatus: null,
    createdBy: alexander._id,
  });
  jobsCount++;

  // 1.7 Alexander's Job: PERSONAL NOTE dispatch
  await Job.create({
    jobType: JOB_TYPE.BY_THE_HOUR,
    pickup: 'Private Residence, Tribeca',
    dropoff: 'Hamptons Estate, Southampton NY',
    asap: false,
    date: new Date(now + 86400000 * 6),
    time: '13:00',
    vehicleType: 'Sedan',
    paymentAmount: 550,
    paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
    instruction: 'Personal calendar booking: Weekend private estate transfer.',
    serviceArea: 'New York Metro',
    companyName: 'Empire Prestige Chauffeurs',
    dispatchType: DISPATCH_TYPE.PERSONAL_NOTE,
    isPersonalNote: true,
    status: JOB_STATUS.PENDING,
    rideStatus: null,
    createdBy: alexander._id,
  });
  jobsCount++;

  // 1.8 Harrison Vance (Global Executive) Job: PENDING with Alexander Wright applied
  if (harrison) {
    const nyOpJob = await Job.create({
      jobType: JOB_TYPE.ONE_WAY,
      pickup: 'John F. Kennedy International Airport, Terminal 8',
      dropoff: 'Mandarin Oriental New York, 80 Columbus Cir',
      asap: false,
      date: new Date(now + 86400000 * 4),
      time: '18:00',
      vehicleType: 'Sedan',
      paymentAmount: 230,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      flightNumber: 'BA-0178',
      instruction: 'VIP London arrival. Nameboard at customs exit: Sir Jonathan Reed.',
      serviceArea: 'New York Metro',
      companyName: 'Global Executive Logistics Group',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: harrison._id,
      applicant: {
        driver: alexander._id,
        vehicleId: alexander.selectedVehicle,
        appliedAt: new Date(now - 18000000), // 5 hours ago
      },
    });
    jobsCount++;
    applicationsCount++;

    await createApplicationChat(nyOpJob._id, harrison._id, alexander._id, [
      {
        senderId: alexander._id,
        text: 'Good afternoon Harrison. Applying with Mercedes S-Class S580. I track BA-0178 directly on FlightAware.',
        offsetMinutesAgo: 280,
      },
      {
        senderId: harrison._id,
        text: 'Thank you Alexander. The client has 2 checked bags and prefers a quiet cabin. Reviewing approval shortly.',
        offsetMinutesAgo: 160,
      },
    ]);

    // 1.9 Harrison's Job: ASSIGNED to Alexander Wright (Scheduled / PENDING)
    await Job.create({
      jobType: JOB_TYPE.BY_THE_HOUR,
      pickup: 'Greenwich Polo Club, VIP Entrance',
      dropoff: 'Manhattan Penthouse / Tribeca',
      asap: false,
      date: new Date(now + 86400000 * 5),
      time: '15:00',
      vehicleType: 'Sedan',
      paymentAmount: 420,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      instruction: 'Polo championship evening transfer. Top-tier luxury protocol.',
      serviceArea: 'New York Metro',
      companyName: 'Global Executive Logistics Group',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.ASSIGNED,
      rideStatus: RIDE_STATUS.PENDING,
      createdBy: harrison._id,
      assignedTo: alexander._id,
    });
    jobsCount++;

    // 1.10 Harrison's Job: Open PENDING (For any NY chauffeur to view & apply)
    await Job.create({
      jobType: JOB_TYPE.ONE_WAY,
      pickup: 'Cipriani 42nd Street, Grand Ballroom',
      dropoff: 'The Carlyle Hotel, 35 E 76th St',
      asap: false,
      date: new Date(now + 86400000 * 1),
      time: '23:00',
      vehicleType: 'Sedan',
      paymentAmount: 185,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      instruction: 'Charity gala departure transfer. Punctual arrival at Cipriani private driveway.',
      serviceArea: 'New York Metro',
      companyName: 'Global Executive Logistics Group',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: harrison._id,
    });
    jobsCount++;
  }

  // 1.11 Charles Montgomery Job: PENDING with Brandon Hayes applied
  if (charles && brandon) {
    const nyCharlesJob = await Job.create({
      jobType: JOB_TYPE.BY_THE_HOUR,
      pickup: 'Wall Street Heliport, Pier 6',
      dropoff: 'Tribeca Penthouse Suite (Multi-Stop Dining & Lounge)',
      asap: false,
      date: new Date(now + 86400000 * 3),
      time: '17:00',
      vehicleType: 'SUV',
      paymentAmount: 480,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      instruction: 'Heliport VIP arrival. 4-hour evening standby for private tech founders dinner.',
      serviceArea: 'New York Metro',
      companyName: 'Manhattan Elite Limousine & Dispatch',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: charles._id,
      applicant: {
        driver: brandon._id,
        vehicleId: brandon.selectedVehicle,
        appliedAt: new Date(now - 12000000), // 3.3 hours ago
      },
    });
    jobsCount++;
    applicationsCount++;

    await createApplicationChat(nyCharlesJob._id, charles._id, brandon._id, [
      {
        senderId: brandon._id,
        text: 'Hi Charles, Suburban High Country is ready with black tie attire and rear privacy tint for Wall St Heliport.',
        offsetMinutesAgo: 190,
      },
      {
        senderId: charles._id,
        text: 'Excellent Brandon. The guests are traveling with light carry-on luggage and value confidentiality.',
        offsetMinutesAgo: 80,
      },
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: MIAMI SOUTH FLORIDA JOBS
  // ═══════════════════════════════════════════════════════════════════════════

  if (elena && sophia) {
    // 2.1 Elena's Job: PENDING with Sophia Laurent applied
    const miamiJob1 = await Job.create({
      jobType: JOB_TYPE.ONE_WAY,
      pickup: 'Miami International Airport (MIA), Signature Flight Support FBO',
      dropoff: 'Faena Hotel Miami Beach, 3201 Collins Ave',
      asap: false,
      date: new Date(now + 86400000 * 2),
      time: '12:00',
      vehicleType: 'Sedan',
      paymentAmount: 225,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      flightNumber: 'N450GA',
      instruction: 'Private jet arrival at MIA Signature FBO. Greet CEO on tarmac with name card.',
      serviceArea: 'Miami South Florida',
      companyName: 'Luxe Ocean Transport Ltd',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: elena._id,
      applicant: {
        driver: sophia._id,
        vehicleId: sophia.selectedVehicle,
        appliedAt: new Date(now - 10800000), // 3 hours ago
      },
    });
    jobsCount++;
    applicationsCount++;

    await createApplicationChat(miamiJob1._id, elena._id, sophia._id, [
      {
        senderId: sophia._id,
        text: 'Hi Elena, BMW 760i ready for the FBO arrival with Pellegrino sparkling water and chilled towels.',
        offsetMinutesAgo: 170,
      },
      {
        senderId: elena._id,
        text: 'Wonderful Sophia! Passenger will have 2 golf bags and 3 luggage pieces. Looking forward to assigning you.',
        offsetMinutesAgo: 95,
      },
    ]);

    // 2.2 Elena's Job: Open PENDING in Miami (For any driver to apply)
    await Job.create({
      jobType: JOB_TYPE.BY_THE_HOUR,
      pickup: 'The Setai Miami Beach (2001 Collins Ave)',
      dropoff: 'Palm Beach Private Club, Ocean Blvd',
      asap: false,
      date: new Date(now + 86400000 * 3),
      time: '14:00',
      vehicleType: 'SUV',
      paymentAmount: 450,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      instruction: 'Art Basel VIP gallery tour and inter-city transfer to Palm Beach estate.',
      serviceArea: 'Miami South Florida',
      companyName: 'Luxe Ocean Transport Ltd',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: elena._id,
    });
    jobsCount++;

    // 2.3 Elena's Job: ASSIGNED to Sophia Laurent (Ride Status: ON_THE_WAY)
    await Job.create({
      jobType: JOB_TYPE.ONE_WAY,
      pickup: '1 Hotel South Beach (2341 Collins Ave)',
      dropoff: 'Brickell Financial District, 1450 Brickell Ave',
      asap: false,
      date: new Date(now + 86400000),
      time: '08:45',
      vehicleType: 'Sedan',
      paymentAmount: 160,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      instruction: 'Morning hedge fund conference transfer. Client is CEO of Apollo Capital.',
      serviceArea: 'Miami South Florida',
      companyName: 'Luxe Ocean Transport Ltd',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.ASSIGNED,
      rideStatus: RIDE_STATUS.ON_THE_WAY,
      createdBy: elena._id,
      assignedTo: sophia._id,
    });
    jobsCount++;
  }

  // 2.4 Victoria Sterling (Miami) Job: PENDING with Isabella Gomez applied (Sprinter Luxury Van)
  if (victoria && isabella) {
    const miamiVicJob = await Job.create({
      jobType: JOB_TYPE.BY_THE_HOUR,
      pickup: 'Fisher Island Ferry Terminal, VIP Slip',
      dropoff: 'Hard Rock Stadium VIP Lounge (Multi-Stop F1 Event)',
      asap: false,
      date: new Date(now + 86400000 * 3),
      time: '11:30',
      vehicleType: 'Van',
      paymentAmount: 650,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      instruction: 'Miami Grand Prix corporate executive group transfer. 6 hours VIP van standby with refreshments.',
      serviceArea: 'Miami South Florida',
      companyName: 'Palm Beach Luxury Transport',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: victoria._id,
      applicant: {
        driver: isabella._id,
        vehicleId: isabella.selectedVehicle,
        appliedAt: new Date(now - 14400000), // 4 hours ago
      },
    });
    jobsCount++;
    applicationsCount++;

    await createApplicationChat(miamiVicJob._id, victoria._id, isabella._id, [
      {
        senderId: isabella._id,
        text: 'Hello Victoria, Mercedes Sprinter Luxury Executive Van is prepped with captain chairs, Wi-Fi, and champagne cooler.',
        offsetMinutesAgo: 220,
      },
      {
        senderId: victoria._id,
        text: 'That sounds perfect Isabella. The group consists of 6 senior international directors attending the Grand Prix.',
        offsetMinutesAgo: 100,
      },
    ]);
  }

  // 2.5 Victoria Sterling (Miami) Job: PENDING with Carlos Mendez applied
  if (victoria && carlos) {
    const miamiCarlosJob = await Job.create({
      jobType: JOB_TYPE.ONE_WAY,
      pickup: 'Four Seasons Hotel at The Surf Club (9011 Collins Ave)',
      dropoff: 'Fort Lauderdale-Hollywood Int Airport (FLL), Sheltair FBO',
      asap: false,
      date: new Date(now + 86400000 * 2),
      time: '16:00',
      vehicleType: 'SUV',
      paymentAmount: 260,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      flightNumber: 'PRIVATE-G650',
      instruction: 'FBO departure. Greet family at Surf Club private entrance.',
      serviceArea: 'Miami South Florida',
      companyName: 'Palm Beach Luxury Transport',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: victoria._id,
      applicant: {
        driver: carlos._id,
        vehicleId: carlos.selectedVehicle,
        appliedAt: new Date(now - 9000000),
      },
    });
    jobsCount++;
    applicationsCount++;

    await createApplicationChat(miamiCarlosJob._id, victoria._id, carlos._id, [
      {
        senderId: carlos._id,
        text: 'Hi Victoria, Escalade ESV Sport Platinum ready for the FLL transfer.',
        offsetMinutesAgo: 140,
      },
      {
        senderId: victoria._id,
        text: 'Thanks Carlos. Passenger requested bottled Fiji water and extra luggage space.',
        offsetMinutesAgo: 70,
      },
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: LOS ANGELES AREA JOBS
  // ═══════════════════════════════════════════════════════════════════════════

  if (robert && david) {
    // 3.1 Robert Sterling's Job: PENDING with David Rossi applied
    const laJob1 = await Job.create({
      jobType: JOB_TYPE.ONE_WAY,
      pickup: 'Los Angeles International Airport (LAX), Private Suite (PS)',
      dropoff: 'The Beverly Hills Hotel (9641 Sunset Blvd)',
      asap: false,
      date: new Date(now + 86400000 * 2),
      time: '15:30',
      vehicleType: 'SUV',
      paymentAmount: 290,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      flightNumber: 'VIP-772',
      instruction: 'Tarmac pickup at LAX Private Suite. Full VIP protocol for Hollywood producer.',
      serviceArea: 'Los Angeles Area',
      companyName: 'Beverly Hills VIP Concierge',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: robert._id,
      applicant: {
        driver: david._id,
        vehicleId: david.selectedVehicle,
        appliedAt: new Date(now - 7200000),
      },
    });
    jobsCount++;
    applicationsCount++;

    await createApplicationChat(laJob1._id, robert._id, david._id, [
      {
        senderId: david._id,
        text: 'Hello Robert, Navigator Black Label is ready with tarmac security badges. I have direct PS gate clearance.',
        offsetMinutesAgo: 110,
      },
      {
        senderId: robert._id,
        text: 'Excellent David. Client has security detail following in a second vehicle. Smooth driving preferred.',
        offsetMinutesAgo: 60,
      },
    ]);

    // 3.2 Robert's Job: Open PENDING in LA (For any driver to apply)
    await Job.create({
      jobType: JOB_TYPE.ONE_WAY,
      pickup: 'Van Nuys Airport (VNY), Signature Aviation FBO',
      dropoff: 'Nobu Ryokan Malibu, 22752 Pacific Coast Hwy',
      asap: false,
      date: new Date(now + 86400000 * 1),
      time: '17:30',
      vehicleType: 'SUV',
      paymentAmount: 320,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      flightNumber: 'N991LA',
      instruction: 'Executive weekend sunset dinner transfer. PCH route along coast.',
      serviceArea: 'Los Angeles Area',
      companyName: 'Beverly Hills VIP Concierge',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: robert._id,
    });
    jobsCount++;

    // 3.3 Robert's Job: ASSIGNED to David Rossi (Scheduled / PENDING)
    await Job.create({
      jobType: JOB_TYPE.BY_THE_HOUR,
      pickup: 'Waldorf Astoria Beverly Hills, 9850 Wilshire Blvd',
      dropoff: 'SoFi Stadium, VIP Champions Club Suite',
      asap: false,
      date: new Date(now + 86400000 * 4),
      time: '16:00',
      vehicleType: 'SUV',
      paymentAmount: 480,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      instruction: 'Championship concert evening standby: 5 hours total duration.',
      serviceArea: 'Los Angeles Area',
      companyName: 'Beverly Hills VIP Concierge',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.ASSIGNED,
      rideStatus: RIDE_STATUS.PENDING,
      createdBy: robert._id,
      assignedTo: david._id,
    });
    jobsCount++;
  }

  // 3.4 Robert Sterling's Job: PENDING with James Thornton applied (Rolls-Royce Ghost)
  if (robert && james) {
    const laJamesJob = await Job.create({
      jobType: JOB_TYPE.BY_THE_HOUR,
      pickup: 'Hotel Bel-Air (701 Stone Canyon Rd)',
      dropoff: 'Academy Museum of Motion Pictures (Gala Red Carpet)',
      asap: false,
      date: new Date(now + 86400000 * 2),
      time: '18:00',
      vehicleType: 'Sedan',
      paymentAmount: 750,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      instruction: 'Oscars season red carpet gala. Rolls-Royce Ghost required with pristine exterior and interior.',
      serviceArea: 'Los Angeles Area',
      companyName: 'Beverly Hills VIP Concierge',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: robert._id,
      applicant: {
        driver: james._id,
        vehicleId: james.selectedVehicle,
        appliedAt: new Date(now - 10000000),
      },
    });
    jobsCount++;
    applicationsCount++;

    await createApplicationChat(laJamesJob._id, robert._id, james._id, [
      {
        senderId: james._id,
        text: 'Good evening Robert. Applying with 2023 Rolls-Royce Ghost Extended Wheelbase in Diamond Black. Ready for red carpet protocol.',
        offsetMinutesAgo: 160,
      },
      {
        senderId: robert._id,
        text: 'Superb James. The celebrity client requested the highest standard of discretion and punctuality.',
        offsetMinutesAgo: 90,
      },
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4: 10 NEW WORK / OPEN BROADCAST JOBS (EVERY POSSIBLE CATEGORY)
  // ═══════════════════════════════════════════════════════════════════════════

  // 4.1 NY - ASAP VIP Airport Transfer (Sedan, Credit Card, Flight)
  if (harrison) {
    await Job.create({
      jobType: JOB_TYPE.ONE_WAY,
      pickup: 'The Plaza Hotel, Fifth Avenue & Central Park South',
      dropoff: 'John F. Kennedy International Airport (JFK), Terminal 4',
      asap: true,
      vehicleType: 'Sedan',
      paymentAmount: 210,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      flightNumber: 'EK-202',
      passengerName: 'Jonathan Vance-Sterling',
      passengerPhone: '+12125550192',
      instruction: 'ASAP VIP airport departure. Passenger has 2 Rimowa suitcases. Greet at 5th Ave VIP porte-cochere.',
      serviceArea: 'New York Metro',
      companyName: 'Global Executive Logistics Group',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: harrison._id,
    });
    jobsCount++;

    // 4.2 NY - Hourly Financial District Roadshow (SUV, Credit Card, Multi-Stop)
    await Job.create({
      jobType: JOB_TYPE.BY_THE_HOUR,
      pickup: 'The Greenwich Hotel, 377 Greenwich St, Tribeca',
      dropoff: 'Midtown Financial District (BlackRock -> Morgan Stanley -> JPMorgan)',
      asap: false,
      date: new Date(now + 86400000 * 1),
      time: '08:30',
      vehicleType: 'SUV',
      paymentAmount: 520,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      passengerName: 'Victoria Sterling (Managing Director)',
      passengerPhone: '+12125550341',
      instruction: '5-hour executive financial roadshow. Multiple C-suite stops. Sparkling water, phone chargers, and absolute discretion required.',
      serviceArea: 'New York Metro',
      companyName: 'Global Executive Logistics Group',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: harrison._id,
    });
    jobsCount++;

    // 4.3 NY - Luxury Sprinter / Group Private Jet Transfer (Sprinter Van, Credit Card, TEB FBO)
    await Job.create({
      jobType: JOB_TYPE.ONE_WAY,
      pickup: 'Aman New York, 730 5th Ave',
      dropoff: 'Teterboro Airport (TEB), Signature Flight Support FBO',
      asap: false,
      date: new Date(now + 86400000 * 3),
      time: '11:00',
      vehicleType: 'Sprinter Van',
      paymentAmount: 450,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      flightNumber: 'GLF-650',
      passengerName: 'Ambassador Philippe Dupont & Delegation',
      passengerPhone: '+12125550719',
      instruction: 'Delegation of 5 passengers with 8 large luggage bags. Sprinter van with premium leather captain chairs. Direct tarmac escort pass.',
      serviceArea: 'New York Metro',
      companyName: 'Global Executive Logistics Group',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: harrison._id,
    });
    jobsCount++;
  }

  // 4.4 NY - Broadway & Dining Transfer (Sedan, Collect Payment)
  if (alexander) {
    await Job.create({
      jobType: JOB_TYPE.ONE_WAY,
      pickup: 'Per Se, The Shops at Columbus Circle (10 Columbus Cir)',
      dropoff: 'Richard Rodgers Theatre (226 W 46th St)',
      asap: false,
      date: new Date(now + 86400000 * 2),
      time: '19:15',
      vehicleType: 'Sedan',
      paymentAmount: 145,
      paymentType: PAYMENT_TYPE.COLLECT_PAYMENT,
      passengerName: 'Dr. Alan Davenport',
      passengerPhone: '+12125550882',
      instruction: 'Collect payment on arrival ($145 cash/card). Punctual curbside arrival at Columbus Circle. Formal black suit attire required.',
      serviceArea: 'New York Metro',
      companyName: 'Empire Prestige Chauffeurs',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: alexander._id,
    });
    jobsCount++;
  }

  if (elena) {
    // 4.5 Miami - ASAP South Beach Oceanfront Transfer (SUV, Credit Card, Airport)
    await Job.create({
      jobType: JOB_TYPE.ONE_WAY,
      pickup: 'Four Seasons Hotel at The Surf Club (9011 Collins Ave)',
      dropoff: 'Miami International Airport (MIA), Concourse D VIP',
      asap: true,
      vehicleType: 'SUV',
      paymentAmount: 240,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      flightNumber: 'AA-1420',
      passengerName: 'Sebastian Cruz',
      passengerPhone: '+13055550412',
      instruction: 'Urgent ASAP airport run. Chilled Fiji water and cool mint towels requested. Assist with luggage.',
      serviceArea: 'Miami South Florida',
      companyName: 'Luxe Ocean Transport Ltd',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: elena._id,
    });
    jobsCount++;

    // 4.6 Miami - Hourly Nightlife & VIP Dining Standby (SUV, Collect Payment)
    await Job.create({
      jobType: JOB_TYPE.BY_THE_HOUR,
      pickup: 'The Miami Beach EDITION, 2901 Collins Ave',
      dropoff: 'Carbone Miami -> Sexy Fish Brickell -> E11EVEN Miami VIP Lounge',
      asap: false,
      date: new Date(now + 86400000 * 2),
      time: '20:30',
      vehicleType: 'SUV',
      paymentAmount: 600,
      paymentType: PAYMENT_TYPE.COLLECT_PAYMENT,
      passengerName: 'Camila Rodriguez',
      passengerPhone: '+13055550923',
      instruction: '6-hour weekend VIP evening standby. High-profile entertainment client. Direct phone contact with personal concierge upon arrival.',
      serviceArea: 'Miami South Florida',
      companyName: 'Luxe Ocean Transport Ltd',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: elena._id,
    });
    jobsCount++;

    // 4.7 Miami - Private FBO Arrival to Palm Beach Estate (Sedan, Credit Card, FLL FBO)
    await Job.create({
      jobType: JOB_TYPE.ONE_WAY,
      pickup: 'Fort Lauderdale-Hollywood International Airport (FLL), Sheltair Aviation FBO',
      dropoff: 'The Breakers Palm Beach (1 S County Rd, Palm Beach)',
      asap: false,
      date: new Date(now + 86400000 * 3),
      time: '13:45',
      vehicleType: 'Sedan',
      paymentAmount: 285,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      flightNumber: 'N550TX',
      passengerName: 'Edward & Beverly Thornton',
      passengerPhone: '+13055550744',
      instruction: 'Private flight arrival at Sheltair FBO. Meet inside VIP lounge. Child booster seat required in backseat.',
      serviceArea: 'Miami South Florida',
      companyName: 'Luxe Ocean Transport Ltd',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: elena._id,
    });
    jobsCount++;
  }

  if (robert) {
    // 4.8 LA - ASAP Rodeo Drive to Hollywood Hills (Sedan, Credit Card)
    await Job.create({
      jobType: JOB_TYPE.ONE_WAY,
      pickup: 'The Maybourne Beverly Hills, 225 N Canon Dr',
      dropoff: 'Bird Streets Private Compound, Hollywood Hills West',
      asap: true,
      vehicleType: 'Sedan',
      paymentAmount: 190,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      passengerName: 'Charlotte Dupont',
      passengerPhone: '+13105550183',
      instruction: 'Immediate pickup at Maybourne valet. 2 shopping bags from Rodeo Drive. Smooth and discreet scenic drive.',
      serviceArea: 'Los Angeles Area',
      companyName: 'Beverly Hills VIP Concierge',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: robert._id,
    });
    jobsCount++;

    // 4.9 LA - Hourly Studio & Awards Show Standby (SUV, Credit Card)
    await Job.create({
      jobType: JOB_TYPE.BY_THE_HOUR,
      pickup: 'Chateau Marmont, 8221 Sunset Blvd, West Hollywood',
      dropoff: 'Warner Bros Studios Burbank -> Dolby Theatre Hollywood',
      asap: false,
      date: new Date(now + 86400000 * 2),
      time: '14:00',
      vehicleType: 'SUV',
      paymentAmount: 580,
      paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
      passengerName: 'Marcus Holloway (Producer)',
      passengerPhone: '+13105550621',
      instruction: '6 hours studio lot standby and red carpet gala arrival. Chauffeur must wear formal black tuxedo/suit with studio gate pass.',
      serviceArea: 'Los Angeles Area',
      companyName: 'Beverly Hills VIP Concierge',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: robert._id,
    });
    jobsCount++;

    // 4.10 LA - Collect Payment LAX Private Suite to Malibu Beach Estate (SUV, Collect Payment, Flight)
    await Job.create({
      jobType: JOB_TYPE.ONE_WAY,
      pickup: 'PS LAX (The Private Suite at Los Angeles International Airport)',
      dropoff: 'Malibu Beach House, Pacific Coast Highway, Malibu CA',
      asap: false,
      date: new Date(now + 86400000 * 4),
      time: '16:15',
      vehicleType: 'SUV',
      paymentAmount: 340,
      paymentType: PAYMENT_TYPE.COLLECT_PAYMENT,
      flightNumber: 'AF-0066',
      passengerName: 'Laurent & Genevieve Mercier',
      passengerPhone: '+13105550977',
      instruction: 'Direct gate greeting at PS Private Suite. Collect $340 payment at completion. Surfboards and 4 large hard-shell bags.',
      serviceArea: 'Los Angeles Area',
      companyName: 'Beverly Hills VIP Concierge',
      dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
      isPersonalNote: false,
      status: JOB_STATUS.PENDING,
      rideStatus: null,
      createdBy: robert._id,
    });
    jobsCount++;
  }

  // 1.11 Alexander's Job: CANCELLED state demonstration
  await Job.create({
    jobType: JOB_TYPE.ONE_WAY,
    pickup: 'The Carlyle, A Rosewood Hotel (35 E 76th St)',
    dropoff: 'JFK International Airport, Terminal 1',
    asap: false,
    date: new Date(now - 86400000 * 2),
    time: '06:00',
    vehicleType: 'Sedan',
    paymentAmount: 180,
    paymentType: PAYMENT_TYPE.CREDIT_CARD_ON_FILE,
    flightNumber: 'LH-401',
    instruction: 'Cancelled by passenger due to airline flight cancellation.',
    serviceArea: 'New York Metro',
    companyName: 'Empire Prestige Chauffeurs',
    dispatchType: DISPATCH_TYPE.ALL_CHAUFFEURS,
    isPersonalNote: false,
    status: JOB_STATUS.CANCELLED,
    rideStatus: null,
    createdBy: alexander._id,
  });
  jobsCount++;

  if (verbose) {
    log.created(
      `Seeded ${jobsCount} jobs, ${applicationsCount} driver applications, and ${chatsCount} negotiation chats across NY, Miami, and LA.`,
    );
  }

  return { jobsCount, applicationsCount, chatsCount };
}
