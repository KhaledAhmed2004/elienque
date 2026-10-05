import { ServiceArea } from '../app/modules/service-area/service-area.model';
import { SERVICE_AREA_STATUS } from '../app/modules/service-area/service-area.interface';
import { logger } from '../shared/logger';

export const initialServiceAreas = [
  // ─── Florida (FL) ───────────────────────────────────────────────────────────
  {
    areaName: 'Miami, FL',
    cities: ['Miami, FL', 'Miami Beach, FL', 'Coral Gables, FL', 'Brickell, FL', 'Doral, FL', 'Aventura, FL', 'Key Biscayne, FL'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Fort Lauderdale, FL',
    cities: ['Fort Lauderdale, FL', 'Hollywood, FL', 'Pompano Beach, FL', 'Davie, FL', 'Plantation, FL', 'Sunrise, FL'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'West Palm Beach, FL',
    cities: ['West Palm Beach, FL', 'Palm Beach, FL', 'Jupiter, FL', 'Wellington, FL', 'Palm Beach Gardens, FL'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Boca Raton, FL',
    cities: ['Boca Raton, FL', 'Delray Beach, FL', 'Boynton Beach, FL', 'Deerfield Beach, FL'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Orlando, FL',
    cities: ['Orlando, FL', 'Kissimmee, FL', 'Winter Park, FL', 'Lake Buena Vista, FL', 'Sanford, FL', 'Altamonte Springs, FL'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Tampa, FL',
    cities: ['Tampa, FL', 'St. Petersburg, FL', 'Clearwater, FL', 'Brandon, FL', 'Ybor City, FL'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Jacksonville, FL',
    cities: ['Jacksonville, FL', 'Jacksonville Beach, FL', 'St. Augustine, FL', 'Ponte Vedra Beach, FL', 'Orange Park, FL'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Naples, FL',
    cities: ['Naples, FL', 'Marco Island, FL', 'Bonita Springs, FL', 'Estero, FL'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Sarasota, FL',
    cities: ['Sarasota, FL', 'Bradenton, FL', 'Venice, FL', 'Lakewood Ranch, FL', 'Siesta Key, FL'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Fort Myers, FL',
    cities: ['Fort Myers, FL', 'Cape Coral, FL', 'Sanibel, FL', 'Fort Myers Beach, FL', 'Lehigh Acres, FL'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── California (CA) ────────────────────────────────────────────────────────
  {
    areaName: 'Los Angeles, CA',
    cities: ['Los Angeles, CA', 'Beverly Hills, CA', 'Santa Monica, CA', 'West Hollywood, CA', 'Pasadena, CA', 'Long Beach, CA', 'Burbank, CA', 'Culver City, CA'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'San Francisco, CA',
    cities: ['San Francisco, CA', 'Oakland, CA', 'Berkeley, CA', 'San Mateo, CA', 'Palo Alto, CA', 'Sausalito, CA'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'San Diego, CA',
    cities: ['San Diego, CA', 'La Jolla, CA', 'Chula Vista, CA', 'Coronado, CA', 'Carlsbad, CA', 'Del Mar, CA', 'Encinitas, CA'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'San Jose, CA',
    cities: ['San Jose, CA', 'Santa Clara, CA', 'Sunnyvale, CA', 'Mountain View, CA', 'Cupertino, CA', 'Los Gatos, CA'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Sacramento, CA',
    cities: ['Sacramento, CA', 'Roseville, CA', 'Folsom, CA', 'Elk Grove, CA', 'Davis, CA', 'Rocklin, CA'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Santa Barbara, CA',
    cities: ['Santa Barbara, CA', 'Montecito, CA', 'Goleta, CA', 'Carpinteria, CA', 'Summerland, CA'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Texas (TX) ─────────────────────────────────────────────────────────────
  {
    areaName: 'Dallas, TX',
    cities: ['Dallas, TX', 'Fort Worth, TX', 'Arlington, TX', 'Plano, TX', 'Irving, TX', 'Frisco, TX', 'McKinney, TX'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Houston, TX',
    cities: ['Houston, TX', 'The Woodlands, TX', 'Sugar Land, TX', 'Katy, TX', 'Pearland, TX', 'Spring, TX'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Austin, TX',
    cities: ['Austin, TX', 'Round Rock, TX', 'Cedar Park, TX', 'Georgetown, TX', 'San Marcos, TX', 'Pflugerville, TX'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'San Antonio, TX',
    cities: ['San Antonio, TX', 'New Braunfels, TX', 'Boerne, TX', 'Schertz, TX', 'Cibolo, TX'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── New York (NY) ──────────────────────────────────────────────────────────
  {
    areaName: 'New York City, NY',
    cities: [
      'New York City, NY',
      'Manhattan, NY',
      'Brooklyn, NY',
      'Queens, NY',
      'Bronx, NY',
      'Staten Island, NY',
      'Long Island, NY',
    ],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Illinois (IL) ──────────────────────────────────────────────────────────
  {
    areaName: 'Chicago, IL',
    cities: ['Chicago, IL', 'Naperville, IL', 'Evanston, IL', 'Schaumburg, IL', 'Oak Park, IL', 'Rosemont, IL'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── District of Columbia (DC) ──────────────────────────────────────────────
  {
    areaName: 'Washington, DC',
    cities: ['Washington, DC', 'Arlington, DC', 'Alexandria, DC', 'Bethesda, DC', 'Silver Spring, DC', 'Tysons, DC', 'Reston, DC'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Nevada (NV) ────────────────────────────────────────────────────────────
  {
    areaName: 'Las Vegas, NV',
    cities: ['Las Vegas, NV', 'Henderson, NV', 'North Las Vegas, NV', 'Paradise, NV', 'Summerlin, NV', 'Spring Valley, NV'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Massachusetts (MA) ─────────────────────────────────────────────────────
  {
    areaName: 'Boston, MA',
    cities: ['Boston, MA', 'Cambridge, MA', 'Brookline, MA', 'Newton, MA', 'Somerville, MA', 'Quincy, MA', 'Waltham, MA'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Georgia (GA) ───────────────────────────────────────────────────────────
  {
    areaName: 'Atlanta, GA',
    cities: ['Atlanta, GA', 'Sandy Springs, GA', 'Alpharetta, GA', 'Marietta, GA', 'Roswell, GA', 'Buckhead, GA', 'Duluth, GA'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Washington (WA) ────────────────────────────────────────────────────────
  {
    areaName: 'Seattle, WA',
    cities: ['Seattle, WA', 'Bellevue, WA', 'Redmond, WA', 'Tacoma, WA', 'Kirkland, WA', 'Renton, WA', 'Everett, WA'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Colorado (CO) ──────────────────────────────────────────────────────────
  {
    areaName: 'Denver, CO',
    cities: ['Denver, CO', 'Aurora, CO', 'Boulder, CO', 'Lakewood, CO', 'Centennial, CO', 'Cherry Creek, CO'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Aspen, CO',
    cities: ['Aspen, CO', 'Snowmass Village, CO', 'Basalt, CO', 'Carbondale, CO', 'Glenwood Springs, CO'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Arizona (AZ) ───────────────────────────────────────────────────────────
  {
    areaName: 'Phoenix, AZ',
    cities: ['Phoenix, AZ', 'Mesa, AZ', 'Chandler, AZ', 'Tempe, AZ', 'Glendale, AZ', 'Gilbert, AZ'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Scottsdale, AZ',
    cities: ['Scottsdale, AZ', 'Paradise Valley, AZ', 'Fountain Hills, AZ', 'Cave Creek, AZ', 'Carefree, AZ'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Pennsylvania (PA) ──────────────────────────────────────────────────────
  {
    areaName: 'Philadelphia, PA',
    cities: ['Philadelphia, PA', 'King of Prussia, PA', 'Center City, PA', 'Main Line, PA', 'Chester, PA', 'Bensalem, PA'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Pittsburgh, PA',
    cities: ['Pittsburgh, PA', 'Monroeville, PA', 'Cranberry Township, PA', 'Mount Lebanon, PA', 'Shadyside, PA'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── North Carolina (NC) ────────────────────────────────────────────────────
  {
    areaName: 'Charlotte, NC',
    cities: ['Charlotte, NC', 'Concord, NC', 'Huntersville, NC', 'Matthews, NC', 'Ballantyne, NC', 'Gastonia, NC'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Raleigh, NC',
    cities: ['Raleigh, NC', 'Durham, NC', 'Chapel Hill, NC', 'Cary, NC', 'Wake Forest, NC', 'Morrisville, NC'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Tennessee (TN) ─────────────────────────────────────────────────────────
  {
    areaName: 'Nashville, TN',
    cities: ['Nashville, TN', 'Franklin, TN', 'Brentwood, TN', 'Murfreesboro, TN', 'Hendersonville, TN', 'Mount Juliet, TN'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Minnesota (MN) ─────────────────────────────────────────────────────────
  {
    areaName: 'Minneapolis, MN',
    cities: ['Minneapolis, MN', 'St. Paul, MN', 'Bloomington, MN', 'Edina, MN', 'Minnetonka, MN', 'Plymouth, MN'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Louisiana (LA) ─────────────────────────────────────────────────────────
  {
    areaName: 'New Orleans, LA',
    cities: ['New Orleans, LA', 'Metairie, LA', 'Kenner, LA', 'French Quarter, LA', 'Garden District, LA', 'Slidell, LA'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Utah (UT) ──────────────────────────────────────────────────────────────
  {
    areaName: 'Salt Lake City, UT',
    cities: ['Salt Lake City, UT', 'Park City, UT', 'Provo, UT', 'Sandy, UT', 'West Valley City, UT', 'Draper, UT'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Oregon (OR) ────────────────────────────────────────────────────────────
  {
    areaName: 'Portland, OR',
    cities: ['Portland, OR', 'Beaverton, OR', 'Gresham, OR', 'Hillsboro, OR', 'Lake Oswego, OR', 'Tigard, OR'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Michigan (MI) ──────────────────────────────────────────────────────────
  {
    areaName: 'Detroit, MI',
    cities: ['Detroit, MI', 'Troy, MI', 'Dearborn, MI', 'Ann Arbor, MI', 'Birmingham, MI', 'Royal Oak, MI', 'Southfield, MI'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Missouri (MO) ──────────────────────────────────────────────────────────
  {
    areaName: 'Kansas City, MO',
    cities: ['Kansas City, MO', 'Overland Park, MO', 'Olathe, MO', "Lee's Summit, MO", 'Independence, MO', 'Blue Springs, MO'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'St. Louis, MO',
    cities: ['St. Louis, MO', 'Clayton, MO', 'Chesterfield, MO', 'St. Charles, MO', 'Creve Coeur, MO', 'Ballwin, MO'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Ohio (OH) ──────────────────────────────────────────────────────────────
  {
    areaName: 'Columbus, OH',
    cities: ['Columbus, OH', 'Dublin, OH', 'Westerville, OH', 'Upper Arlington, OH', 'New Albany, OH', 'Grove City, OH'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Cincinnati, OH',
    cities: ['Cincinnati, OH', 'Mason, OH', 'Norwood, OH', 'Blue Ash, OH', 'Hyde Park, OH', 'West Chester, OH'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
  {
    areaName: 'Cleveland, OH',
    cities: ['Cleveland, OH', 'Akron, OH', 'Parma, OH', 'Lakewood, OH', 'Beachwood, OH', 'Westlake, OH'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Indiana (IN) ───────────────────────────────────────────────────────────
  {
    areaName: 'Indianapolis, IN',
    cities: ['Indianapolis, IN', 'Carmel, IN', 'Fishers, IN', 'Noblesville, IN', 'Zionsville, IN', 'Greenwood, IN'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Virginia (VA) ──────────────────────────────────────────────────────────
  {
    areaName: 'Richmond, VA',
    cities: ['Richmond, VA', 'Henrico, VA', 'Chesterfield, VA', 'Short Pump, VA', 'Glen Allen, VA', 'Midlothian, VA'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── South Carolina (SC) ────────────────────────────────────────────────────
  {
    areaName: 'Charleston, SC',
    cities: ['Charleston, SC', 'North Charleston, SC', 'Mount Pleasant, SC', 'Summerville, SC', 'Kiawah Island, SC', 'Isle of Palms, SC'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },

  // ─── Connecticut (CT) ───────────────────────────────────────────────────────
  {
    areaName: 'Greenwich, CT',
    cities: ['Greenwich, CT', 'Stamford, CT', 'Norwalk, CT', 'Darien, CT', 'New Canaan, CT', 'Westport, CT'],
    status: SERVICE_AREA_STATUS.ACTIVE,
  },
];

export const seedServiceAreas = async () => {
  try {
    for (const area of initialServiceAreas) {
      const existing = await ServiceArea.findOne({ areaName: area.areaName });
      if (!existing) {
        await ServiceArea.create(area);
      }
    }
    logger.info('✨ Default Service Areas verified and synced successfully!');
  } catch (error) {
    logger.error('Failed to seed Service Areas:', error);
  }
};

