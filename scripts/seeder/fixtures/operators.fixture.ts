/**
 * Operator & Edge-Case User Fixtures
 *
 * Pure data — zero logic.
 * `serviceAreaName` → resolved to ObjectId at runtime.
 * `favoriteIndexes` → indices into CHAUFFEUR_FIXTURES[] to pre-populate favoriteChauffeurs.
 */

import { ACCOUNT_STATE, APP_STATE, CARD_PAYMENT_STATUS, COMPANY_ROLE } from '../../../src/enums/user';
import type { IPaymentMethods } from '../../../src/app/modules/user/user.interface';

export type OperatorFixture = {
  name: string;
  nickname: string;
  email: string;
  phone: string;
  serviceAreaName: string;
  companyName: string;
  companyRole: COMPANY_ROLE;
  accountState: ACCOUNT_STATE;
  appState: APP_STATE;
  /** Indices into CHAUFFEUR_FIXTURES[] to pre-link as favorites */
  favoriteIndexes: number[];
  profilePicture: string;
  paymentMethods?: IPaymentMethods;
}

import { VehicleFixture } from './chauffeurs.fixture';

export type EdgeCaseUserFixture = {
  name: string;
  email: string;
  phone: string;
  serviceAreaName: string;
  companyName: string;
  companyRole: COMPANY_ROLE;
  accountState: ACCOUNT_STATE;
  appState: APP_STATE;
  /** Human-readable label for summary table */
  label: string;
  vehicles?: VehicleFixture[];
  paymentMethods?: IPaymentMethods;
};

// ─── Fleet Operators / Clients ──────────────────────────────────────────────

export const OPERATOR_FIXTURES: OperatorFixture[] = [
  {
    name: 'Harrison Vance',
    nickname: 'Harrison',
    email: 'operator@globaltrans.com',
    phone: '+12125558001',
    serviceAreaName: 'New York City, NY',
    companyName: 'Global Executive Logistics Group',
    companyRole: COMPANY_ROLE.OPERATOR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.ACTIVE,
    favoriteIndexes: [0, 1],  // Alex Wright + Marcus Sterling pre-favorited
    profilePicture: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400',
    paymentMethods: {
      cardPayment: {
        status: CARD_PAYMENT_STATUS.ACCEPTED,
      },
    },
  },
  {
    name: 'Elena Rostova',
    nickname: 'Elena',
    email: 'elena.rostova@luxefleet.com',
    phone: '+13055558002',
    serviceAreaName: 'Miami, FL',
    companyName: 'Luxe Ocean Transport Ltd',
    companyRole: COMPANY_ROLE.OWNER,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.ACTIVE,
    favoriteIndexes: [2],  // Sophia Laurent pre-favorited
    profilePicture: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
  },
  {
    name: 'Robert Sterling',
    nickname: 'Robert',
    email: 'robert.sterling@beverlyfleet.com',
    phone: '+13105558003',
    serviceAreaName: 'Los Angeles, CA',
    companyName: 'Beverly Hills VIP Concierge',
    companyRole: COMPANY_ROLE.COMPANY_MANAGER,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.ACTIVE,
    favoriteIndexes: [3],  // David Rossi pre-favorited
    profilePicture: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400',
    paymentMethods: {
      cardPayment: {
        status: CARD_PAYMENT_STATUS.ACCEPTED,
      },
    },
  },
  {
    name: 'Charles Montgomery',
    nickname: 'Charles',
    email: 'charles.montgomery@manhattanlimo.com',
    phone: '+12125558004',
    serviceAreaName: 'New York City, NY',
    companyName: 'Manhattan Elite Limousine & Dispatch',
    companyRole: COMPANY_ROLE.COMPANY_MANAGER,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.ACTIVE,
    favoriteIndexes: [0, 1, 4], // Alex, Marcus, Brandon
    profilePicture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    paymentMethods: {
      cardPayment: {
        status: CARD_PAYMENT_STATUS.ACCEPTED,
      },
    },
  },
  {
    name: 'Victoria Sterling',
    nickname: 'Victoria',
    email: 'victoria@palmluxury.com',
    phone: '+13055558005',
    serviceAreaName: 'Miami, FL',
    companyName: 'Palm Beach Luxury Transport',
    companyRole: COMPANY_ROLE.OPERATOR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.ACTIVE,
    favoriteIndexes: [2, 5, 7], // Sophia, Isabella, Carlos
    profilePicture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    paymentMethods: {
      cardPayment: {
        status: CARD_PAYMENT_STATUS.ACCEPTED,
      },
    },
  },
];

// ─── Edge-Case / Status-Variant Users ───────────────────────────────────────

export const EDGE_CASE_FIXTURES: EdgeCaseUserFixture[] = [
  {
    name: 'Julian Montgomery',
    email: 'pending.applicant@chauffeur.com',
    phone: '+12125559090',
    serviceAreaName: 'New York City, NY',
    companyName: 'Freelance Chauffeur VIP',
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.PENDING,
    label: 'appState: PENDING · NYC (Fleet of 2: Escalade ESV & Mercedes S580)',
    vehicles: [
      {
        type: 'SUV',
        makeAndModel: 'Cadillac Escalade ESV Luxury',
        colorInside: 'Jet Black Leather',
        colorOutside: 'Black Raven',
        year: 2024,
        licensePlate: 'NY-PEND-9090',
      },
      {
        type: 'Sedan',
        makeAndModel: 'Mercedes-Benz S-Class S580',
        colorInside: 'Sienna Brown',
        colorOutside: 'Obsidian Black',
        year: 2024,
        licensePlate: 'NY-PEND-9091',
      },
    ],
  },
  {
    name: 'Mateo Hernandez',
    email: 'pending.miami@chauffeur.com',
    phone: '+13055559092',
    serviceAreaName: 'Miami, FL',
    companyName: 'South Beach Executive Sprinters',
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.PENDING,
    label: 'appState: PENDING · Miami (Fleet of 2: Sprinter VIP & BMW 760i)',
    vehicles: [
      {
        type: 'Van',
        makeAndModel: 'Mercedes-Benz Sprinter 2500 VIP',
        colorInside: 'Ivory Diamond Stitch',
        colorOutside: 'Arctic White',
        year: 2024,
        licensePlate: 'FL-PEND-9092',
      },
      {
        type: 'Sedan',
        makeAndModel: 'BMW 760i xDrive Sedan',
        colorInside: 'Cognac Leather',
        colorOutside: 'Mineral White',
        year: 2023,
        licensePlate: 'FL-PEND-9093',
      },
    ],
  },
  {
    name: 'Damon Vance',
    email: 'pending.la@chauffeur.com',
    phone: '+13105559093',
    serviceAreaName: 'Los Angeles, CA',
    companyName: 'Rodeo Luxury Chauffeur',
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.PENDING,
    label: 'appState: PENDING · LA (Rolls-Royce Ghost & Range Rover LWB)',
    vehicles: [
      {
        type: 'Sedan',
        makeAndModel: 'Rolls-Royce Ghost Extended',
        colorInside: 'Grace White Leather',
        colorOutside: 'Diamond Black',
        year: 2023,
        licensePlate: 'CA-PEND-9093',
      },
      {
        type: 'SUV',
        makeAndModel: 'Range Rover SV Autobiography LWB',
        colorInside: 'Perlino Leather',
        colorOutside: 'Santorini Black',
        year: 2024,
        licensePlate: 'CA-PEND-9094',
      },
    ],
  },
  {
    name: 'Evelyn Reed',
    email: 'pending.chicago@chauffeur.com',
    phone: '+13125559094',
    serviceAreaName: 'Chicago, IL',
    companyName: 'Windy City Black Car Service',
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.PENDING,
    label: 'appState: PENDING · Chicago (Lincoln Navigator L & Genesis G90)',
    vehicles: [
      {
        type: 'SUV',
        makeAndModel: 'Lincoln Navigator L Reserve',
        colorInside: 'Chalet Theme Alpine',
        colorOutside: 'Pristine White',
        year: 2024,
        licensePlate: 'IL-PEND-9094',
      },
      {
        type: 'Sedan',
        makeAndModel: 'Genesis G90 Prestige',
        colorInside: 'Dune Beige',
        colorOutside: 'Uyuni White',
        year: 2024,
        licensePlate: 'IL-PEND-9095',
      },
    ],
  },
  {
    name: 'Harrison Brooks',
    email: 'pending.dallas@chauffeur.com',
    phone: '+12145559095',
    serviceAreaName: 'Dallas, TX',
    companyName: 'Lone Star Elite Transport',
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.PENDING,
    label: 'appState: PENDING · Dallas (BMW 760i & Cadillac Escalade)',
    vehicles: [
      {
        type: 'Sedan',
        makeAndModel: 'BMW 760i xDrive Sedan',
        colorInside: 'Tartufo Merino',
        colorOutside: 'Carbon Black',
        year: 2024,
        licensePlate: 'TX-PEND-9095',
      },
      {
        type: 'SUV',
        makeAndModel: 'Cadillac Escalade ESV Sport Platinum',
        colorInside: 'Whisper Beige',
        colorOutside: 'Crystal White',
        year: 2024,
        licensePlate: 'TX-PEND-9096',
      },
    ],
  },
  {
    name: 'Dominic Sterling',
    email: 'pending.approvedveh@chauffeur.com',
    phone: '+13055559096',
    serviceAreaName: 'Miami, FL',
    companyName: 'Biscayne Bay Chauffeur Group',
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.PENDING,
    label: 'appState: PENDING · Miami (Mercedes S-Class & Sprinter / Approved Fleet)',
    vehicles: [
      {
        type: 'Sedan',
        makeAndModel: 'Mercedes-Benz S-Class S580',
        colorInside: 'Black Nappa',
        colorOutside: 'Obsidian Black',
        year: 2024,
        licensePlate: 'FL-APPR-9096',
      },
      {
        type: 'Van',
        makeAndModel: 'Mercedes-Benz Sprinter Executive',
        colorInside: 'Beige Leather',
        colorOutside: 'Cavansite Blue',
        year: 2024,
        licensePlate: 'FL-APPR-9097',
      },
    ],
  },
  {
    name: 'Lucas Vance',
    email: 'action.required@chauffeur.com',
    phone: '+12125559091',
    serviceAreaName: 'New York City, NY',
    companyName: 'Vance Executive Rides',
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    accountState: ACCOUNT_STATE.VERIFIED,
    appState: APP_STATE.ACTION_REQUIRED,
    label: 'appState: ACTION_REQUIRED · NYC (Local Permit Rejected)',
    vehicles: [
      {
        type: 'Sedan',
        makeAndModel: 'Mercedes-Benz E-Class E450',
        colorInside: 'Macchiato Beige',
        colorOutside: 'Selenite Grey',
        year: 2024,
        licensePlate: 'NY-ACTN-9091',
      },
    ],
  },
  {
    name: 'Victor Nance',
    email: 'suspended.driver@chauffeur.com',
    phone: '+12125559099',
    serviceAreaName: 'New York City, NY',
    companyName: 'Suspended Driver LLC',
    companyRole: COMPANY_ROLE.CHAUFFEUR,
    accountState: ACCOUNT_STATE.SUSPENDED,
    appState: APP_STATE.ACTIVE,
    label: 'accountState: SUSPENDED · NYC (Policy Violation)',
    vehicles: [
      {
        type: 'Sedan',
        makeAndModel: 'BMW 530i Sedan',
        colorInside: 'Black Sensatec',
        colorOutside: 'Alpine White',
        year: 2023,
        licensePlate: 'NY-SUSP-9099',
      },
    ],
  },
];
