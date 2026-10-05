/**
 * Marketplace Item Fixtures
 *
 * Realistic vehicle accessories, detailing equipment, electronics,
 * and professional chauffeur gear.
 */

import { ITEM_CONDITION, ITEM_STATUS } from '../../../src/app/modules/item/item.interface';

export type ItemFixture = {
  title: string;
  price: number;
  condition: ITEM_CONDITION;
  status: ITEM_STATUS;
  location: string;
  description: string;
  photos: string[];
  chauffeurEmail: string; // Chauffeur who created this listing
}

export const ITEM_FIXTURES: ItemFixture[] = [
  // ─── New York Metro Listings ───────────────────────────────────────────────
  {
    title: 'Mercedes-Benz S-Class OEM 20" AMG Multi-Spoke Wheels (Set of 4)',
    price: 1850,
    condition: ITEM_CONDITION.NEW,
    status: ITEM_STATUS.AVAILABLE,
    location: 'Manhattan, New York (Upper East Side)',
    description: 'Brand new in box OEM AMG multi-spoke alloy wheels with Pirelli P Zero run-flat tires. Perfect for S500 / S580 models.',
    photos: [
      'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=600',
      'https://images.unsplash.com/photo-1611821064430-edff6879893d?w=600',
    ],
    chauffeurEmail: 'alex.wright@chauffeur.com',
  },
  {
    title: 'Thule Vector M Roof Cargo Box - Gloss Black (410L)',
    price: 650,
    condition: ITEM_CONDITION.USED,
    status: ITEM_STATUS.AVAILABLE,
    location: 'Brooklyn, New York (DUMBO)',
    description: 'Gently used premium rooftop cargo box. Fits aerodynamic crossbars. DualSide opening with central locking system. 2 keys included.',
    photos: [
      'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=600',
    ],
    chauffeurEmail: 'alex.wright@chauffeur.com',
  },
  {
    title: 'Garmin Dash Cam 67W - 1440p HDR 180° Ultra-Wide Angle',
    price: 175,
    condition: ITEM_CONDITION.REFURBISHED,
    status: ITEM_STATUS.AVAILABLE,
    location: 'Queens, New York (Astoria)',
    description: 'Factory refurbished with voice control, automatic incident detection, and 64GB High-Endurance MicroSD card.',
    photos: [
      'https://images.unsplash.com/photo-1508974239320-0a029497e820?w=600',
    ],
    chauffeurEmail: 'marcus.sterling@chauffeur.com',
  },
  {
    title: 'Executive Chauffeur Suit Blazer - Charcoal Black Size 42R',
    price: 120,
    condition: ITEM_CONDITION.NEW,
    status: ITEM_STATUS.AVAILABLE,
    location: 'Midtown Manhattan, New York',
    description: 'Tailored slim-fit executive suit blazer made from wrinkle-resistant wool blend fabric. Unworn with original tags attached.',
    photos: [
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600',
    ],
    chauffeurEmail: 'marcus.sterling@chauffeur.com',
  },
  {
    title: 'Escort MAX 360c Laser Radar Detector with WiFi & Bluetooth',
    price: 420,
    condition: ITEM_CONDITION.USED,
    status: ITEM_STATUS.AVAILABLE,
    location: 'Staten Island, New York',
    description: 'Top-tier 360-degree radar and laser protection with directional arrows and AutoLearn GPS intelligence. Includes SmartCord USB.',
    photos: [
      'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=600',
    ],
    chauffeurEmail: 'alex.wright@chauffeur.com',
  },

  // ─── Miami Metro Listings ──────────────────────────────────────────────────
  {
    title: 'Cadillac Escalade WeatherTech FloorLiner HP Set (1st, 2nd & 3rd Row)',
    price: 240,
    condition: ITEM_CONDITION.NEW,
    status: ITEM_STATUS.AVAILABLE,
    location: 'Downtown Miami, Florida',
    description: 'High-performance laser measured custom all-weather floor mats for 2021-2024 Cadillac Escalade / ESV with bucket seating.',
    photos: [
      'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=600',
    ],
    chauffeurEmail: 'sophia.laurent@chauffeur.com',
  },
  {
    title: 'Tornador Black Z-020 Car Interior Deep Cleaning Gun',
    price: 110,
    condition: ITEM_CONDITION.REFURBISHED,
    status: ITEM_STATUS.AVAILABLE,
    location: 'Fort Lauderdale, Florida',
    description: 'Pneumatic pulse air detail cleaning gun. Restored to peak condition with new rotational bearing mechanism and dual nozzles.',
    photos: [
      'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=600',
    ],
    chauffeurEmail: 'sophia.laurent@chauffeur.com',
  },
  {
    title: 'BMW 7 Series Carbon Fiber Mirror Caps (G70 2023+)',
    price: 350,
    condition: ITEM_CONDITION.NEW,
    status: ITEM_STATUS.AVAILABLE,
    location: 'Miami Beach, Florida (South Beach)',
    description: 'Genuine OEM high-gloss autoclave pre-preg carbon fiber mirror replacement housings. Direct bolt-on replacement.',
    photos: [
      'https://images.unsplash.com/photo-1555353540-64580b51c258?w=600',
    ],
    chauffeurEmail: 'sophia.laurent@chauffeur.com',
  },

  // ─── Los Angeles Metro Listings ────────────────────────────────────────────
  {
    title: 'RUPES BigFoot LHR 15 Mark III Random Orbital Polisher',
    price: 340,
    condition: ITEM_CONDITION.USED,
    status: ITEM_STATUS.AVAILABLE,
    location: 'Beverly Hills, Los Angeles, California',
    description: '15mm orbit dual-action paint correction polisher. Used for 3 show vehicles only. Includes backing plate, progressive trigger, and 3 polishing pads.',
    photos: [
      'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=600',
    ],
    chauffeurEmail: 'david.rossi@chauffeur.com',
  },
  {
    title: 'Magna Cart Heavy-Duty Aluminum Folding Luggage Hand Truck (150 lbs)',
    price: 45,
    condition: ITEM_CONDITION.NEW,
    status: ITEM_STATUS.AVAILABLE,
    location: 'Santa Monica, California',
    description: 'Compact collapsible airport luggage cart with rubber wheels. Folds flat to 2.5 inches for discreet trunk storage.',
    photos: [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600',
    ],
    chauffeurEmail: 'david.rossi@chauffeur.com',
  },
  {
    title: 'BlackVue DR900X-2CH 4K UHD Front & Rear Cloud Dash Cam System',
    price: 390,
    condition: ITEM_CONDITION.USED,
    status: ITEM_STATUS.AVAILABLE,
    location: 'Pasadena, Los Angeles, California',
    description: 'Dual-channel 4K front and Full HD rear dashcam with built-in voltage monitor, GPS, and dual-band Wi-Fi. 128GB MicroSD included.',
    photos: [
      'https://images.unsplash.com/photo-1508974239320-0a029497e820?w=600',
    ],
    chauffeurEmail: 'david.rossi@chauffeur.com',
  },
];
