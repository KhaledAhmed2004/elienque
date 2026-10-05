/**
 * Chauffeur Fixtures
 *
 * Pure data — zero logic.
 * Each entry represents one chauffeur user + their multi-vehicle fleet.
 * `serviceAreaName` is resolved to an ObjectId at runtime by the seeder.
 */

import { ACCOUNT_STATE, APP_STATE, CARD_PAYMENT_STATUS, COMPANY_ROLE } from '../../../src/enums/user';
import type { IPaymentMethods } from '../../../src/app/modules/user/user.interface';

export type VehicleFixture = {
  type: string;
  makeAndModel: string;
  colorInside: string;
  colorOutside: string;
  year: number;
  licensePlate: string;
};

export type ChauffeurFixture = {
  name: string;
  nickname: string;
  email: string;
  phone: string;
  serviceAreaName: string;          // Resolved to ObjectId by user.seeder.ts
  companyName: string;
  companyRole: COMPANY_ROLE;
  accountState: ACCOUNT_STATE;
  appState: APP_STATE;
  averageRating: number;
  totalReviews: number;
  profilePicture: string;
  vehicles: VehicleFixture[];
  paymentMethods?: IPaymentMethods;
};

export const CHAUFFEUR_FIXTURES: ChauffeurFixture[] = [
  // ─── New York ───────────────────────────────────────────────────────────────
  {
    name: 'Alexander Wright',
    nickname: 'Alex',
    email: 'alex.wright@chauffeur.com',
    phone: '+12125551001',
    serviceAreaName: 'New York City, NY',
    companyName: 'Empire Prestige Chauffeurs',
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.ACTIVE,
    averageRating: 4.95,
    totalReviews: 42,
    profilePicture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    vehicles: [
      {
        type: 'Sedan',
        makeAndModel: 'Mercedes-Benz S-Class S580',
        colorInside: 'Black Nappa Leather',
        colorOutside: 'Obsidian Black Metallic',
        year: 2024,
        licensePlate: 'NY-CH-1001',
      },
      {
        type: 'SUV',
        makeAndModel: 'Cadillac Escalade ESV Premium',
        colorInside: 'Jet Black Leather',
        colorOutside: 'Black Raven',
        year: 2024,
        licensePlate: 'NY-CH-1011',
      },
      {
        type: 'Van',
        makeAndModel: 'Mercedes-Benz Sprinter Executive',
        colorInside: 'Ivory Leather',
        colorOutside: 'Diamond Silver',
        year: 2023,
        licensePlate: 'NY-CH-1021',
      },
    ],
    paymentMethods: {
      zelle: { email: 'alex.wright@zellepay.com' },
      venmo: { username: 'alexwright-ny' },
      cashApp: { cashtag: '$AlexWrightVIP' },
      cardPayment: { status: CARD_PAYMENT_STATUS.ACCEPTED },
    },
  },
  {
    name: 'Marcus Sterling',
    nickname: 'Marcus',
    email: 'marcus.sterling@chauffeur.com',
    phone: '+12125551002',
    serviceAreaName: 'New York City, NY',
    companyName: 'Manhattan Black Car Club',
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.ACTIVE,
    averageRating: 4.88,
    totalReviews: 38,
    profilePicture: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    vehicles: [
      {
        type: 'SUV',
        makeAndModel: 'Cadillac Escalade ESV Premium Luxury',
        colorInside: 'Jet Black',
        colorOutside: 'Black Raven',
        year: 2024,
        licensePlate: 'NY-CH-1002',
      },
      {
        type: 'Sedan',
        makeAndModel: 'BMW 760i xDrive Sedan',
        colorInside: 'Tartufo Merino Leather',
        colorOutside: 'Carbon Black Metallic',
        year: 2024,
        licensePlate: 'NY-CH-1012',
      },
    ],
    paymentMethods: {
      zelle: { email: 'marcus.sterling@zellepay.com' },
      cardPayment: { status: CARD_PAYMENT_STATUS.ACCEPTED },
    },
  },

  // ─── Miami ──────────────────────────────────────────────────────────────────
  {
    name: 'Sophia Laurent',
    nickname: 'Sophia',
    email: 'sophia.laurent@chauffeur.com',
    phone: '+13055551003',
    serviceAreaName: 'Miami, FL',
    companyName: 'Miami Ocean Drive Luxury VIP',
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.ACTIVE,
    averageRating: 4.92,
    totalReviews: 55,
    profilePicture: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400',
    vehicles: [
      {
        type: 'Sedan',
        makeAndModel: 'BMW 760i xDrive M Sport',
        colorInside: 'Cognac Merino Leather',
        colorOutside: 'Mineral White Metallic',
        year: 2023,
        licensePlate: 'FL-CH-1003',
      },
      {
        type: 'SUV',
        makeAndModel: 'Lincoln Navigator Black Label L',
        colorInside: 'Chalet Theme Alpine',
        colorOutside: 'Pristine White Tri-coat',
        year: 2024,
        licensePlate: 'FL-CH-1013',
      },
      {
        type: 'Van',
        makeAndModel: 'Mercedes-Benz Sprinter Luxury Van',
        colorInside: 'Beige Diamond Stitch',
        colorOutside: 'Arctic White',
        year: 2024,
        licensePlate: 'FL-CH-1023',
      },
    ],
    paymentMethods: {
      venmo: { username: 'sophia-laurent-miami' },
      cashApp: { cashtag: '$SophiaVIPLimo' },
      cardPayment: { status: CARD_PAYMENT_STATUS.NOT_ACCEPTED },
    },
  },

  // ─── Los Angeles ────────────────────────────────────────────────────────────
  {
    name: 'David Rossi',
    nickname: 'Dave',
    email: 'david.rossi@chauffeur.com',
    phone: '+13105551004',
    serviceAreaName: 'Los Angeles, CA',
    companyName: 'Beverly Hills Executive Fleet',
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.ACTIVE,
    averageRating: 4.85,
    totalReviews: 29,
    profilePicture: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400',
    vehicles: [
      {
        type: 'SUV',
        makeAndModel: 'Lincoln Navigator Black Label L',
        colorInside: 'Chalet Theme Alpine',
        colorOutside: 'Pristine White Tri-coat',
        year: 2023,
        licensePlate: 'CA-CH-1004',
      },
      {
        type: 'Sedan',
        makeAndModel: 'Mercedes-Benz S580 4MATIC',
        colorInside: 'Sienna Brown Leather',
        colorOutside: 'Nautical Blue Metallic',
        year: 2024,
        licensePlate: 'CA-CH-1014',
      },
    ],
  },

  // ─── New York Metro (Additional) ───────────────────────────────────────────
  {
    name: 'Brandon Hayes',
    nickname: 'Brandon',
    email: 'brandon.hayes@chauffeur.com',
    phone: '+12125551005',
    serviceAreaName: 'New York City, NY',
    companyName: 'Tribeca Luxury Limousines',
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.ACTIVE,
    averageRating: 4.96,
    totalReviews: 34,
    profilePicture: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
    vehicles: [
      {
        type: 'SUV',
        makeAndModel: 'Chevrolet Suburban Premier High Country',
        colorInside: 'Jet Black Leather',
        colorOutside: 'Dark Ash Metallic',
        year: 2024,
        licensePlate: 'NY-CH-1005',
      },
      {
        type: 'Sedan',
        makeAndModel: 'Genesis G90 3.5T E-Supercharger',
        colorInside: 'Dune Beige',
        colorOutside: 'Uyuni White',
        year: 2024,
        licensePlate: 'NY-CH-1015',
      },
    ],
    paymentMethods: {
      zelle: { email: 'brandon.hayes@zellepay.com' },
      venmo: { username: 'brandon-hayes-ny' },
      cardPayment: { status: CARD_PAYMENT_STATUS.ACCEPTED },
    },
  },

  // ─── Miami South Florida (Additional) ──────────────────────────────────────
  {
    name: 'Isabella Gomez',
    nickname: 'Bella',
    email: 'isabella.gomez@chauffeur.com',
    phone: '+13055551006',
    serviceAreaName: 'Miami, FL',
    companyName: 'Biscayne VIP Transport',
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.ACTIVE,
    averageRating: 4.98,
    totalReviews: 45,
    profilePicture: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    vehicles: [
      {
        type: 'Van',
        makeAndModel: 'Mercedes-Benz Sprinter Executive Luxury Van',
        colorInside: 'Ivory Italian Leather',
        colorOutside: 'Obsidian Black',
        year: 2024,
        licensePlate: 'FL-CH-1006',
      },
      {
        type: 'SUV',
        makeAndModel: 'Range Rover SV Autobiography Long Wheelbase',
        colorInside: 'Ebony & Perlino Leather',
        colorOutside: 'Santorini Black',
        year: 2024,
        licensePlate: 'FL-CH-1016',
      },
      {
        type: 'Sedan',
        makeAndModel: 'Mercedes-Maybach S680 V12',
        colorInside: 'Manufaktur Deep White',
        colorOutside: 'Onyx Black & Mojave Silver',
        year: 2024,
        licensePlate: 'FL-CH-1026',
      },
    ],
    paymentMethods: {
      zelle: { email: 'isabella.gomez@zellepay.com' },
      cashApp: { cashtag: '$BellaVIPVan' },
      cardPayment: { status: CARD_PAYMENT_STATUS.ACCEPTED },
    },
  },

  // ─── Los Angeles Area (Additional) ─────────────────────────────────────────
  {
    name: 'James Thornton',
    nickname: 'James',
    email: 'james.thornton@chauffeur.com',
    phone: '+13105551007',
    serviceAreaName: 'Los Angeles, CA',
    companyName: 'Sunset Strip Premier Motors',
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.ACTIVE,
    averageRating: 4.97,
    totalReviews: 47,
    profilePicture: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400',
    vehicles: [
      {
        type: 'Sedan',
        makeAndModel: 'Rolls-Royce Ghost Extended Wheelbase',
        colorInside: 'Grace White with Phoenix Red',
        colorOutside: 'Diamond Black',
        year: 2023,
        licensePlate: 'CA-CH-1007',
      },
      {
        type: 'SUV',
        makeAndModel: 'Bentley Bentayga EWB Mulliner',
        colorInside: 'Linen and Beluga',
        colorOutside: 'Glacier White',
        year: 2024,
        licensePlate: 'CA-CH-1017',
      },
    ],
    paymentMethods: {
      zelle: { email: 'james.thornton@zellepay.com' },
      cardPayment: { status: CARD_PAYMENT_STATUS.ACCEPTED },
    },
  },

  // ─── Miami South Florida (Additional) ──────────────────────────────────────
  {
    name: 'Carlos Mendez',
    nickname: 'Carlos',
    email: 'carlos.mendez@chauffeur.com',
    phone: '+13055551008',
    serviceAreaName: 'Miami, FL',
    companyName: 'South Beach Executive Chauffeurs',
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.ACTIVE,
    averageRating: 4.89,
    totalReviews: 22,
    profilePicture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    vehicles: [
      {
        type: 'SUV',
        makeAndModel: 'Cadillac Escalade ESV Sport Platinum',
        colorInside: 'Whisper Beige',
        colorOutside: 'Crystal White Tricoat',
        year: 2024,
        licensePlate: 'FL-CH-1008',
      },
      {
        type: 'Sedan',
        makeAndModel: 'Audi A8 L 60 TFSI Quattro',
        colorInside: 'Valcona Nutmeg Brown Leather',
        colorOutside: 'Mythos Black Metallic',
        year: 2024,
        licensePlate: 'FL-CH-1018',
      },
    ],
    paymentMethods: {
      venmo: { username: 'carlos-mendez-vip' },
      cashApp: { cashtag: '$CarlosChauffeur' },
      cardPayment: { status: CARD_PAYMENT_STATUS.ACCEPTED },
    },
  },
];
