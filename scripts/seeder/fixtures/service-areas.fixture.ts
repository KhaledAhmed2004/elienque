/**
 * Service Area Fixtures
 *
 * Pure data — zero logic.
 * Seed all primary metro service areas across the United States with state-coded cities.
 */

export type ServiceAreaFixture = {
  areaName: string;
  cities: string[];
}

export const SERVICE_AREA_FIXTURES: ServiceAreaFixture[] = [
  // ─── Florida (FL) ───────────────────────────────────────────────────────────
  {
    areaName: 'Miami, FL',
    cities: ['Miami, FL', 'Miami Beach, FL', 'Coral Gables, FL', 'Brickell, FL', 'Doral, FL', 'Aventura, FL', 'Key Biscayne, FL'],
  },
  {
    areaName: 'Fort Lauderdale, FL',
    cities: ['Fort Lauderdale, FL', 'Hollywood, FL', 'Pompano Beach, FL', 'Davie, FL', 'Plantation, FL', 'Sunrise, FL'],
  },
  {
    areaName: 'West Palm Beach, FL',
    cities: ['West Palm Beach, FL', 'Palm Beach, FL', 'Jupiter, FL', 'Wellington, FL', 'Palm Beach Gardens, FL'],
  },
  {
    areaName: 'Boca Raton, FL',
    cities: ['Boca Raton, FL', 'Delray Beach, FL', 'Boynton Beach, FL', 'Deerfield Beach, FL'],
  },
  {
    areaName: 'Orlando, FL',
    cities: ['Orlando, FL', 'Kissimmee, FL', 'Winter Park, FL', 'Lake Buena Vista, FL', 'Sanford, FL', 'Altamonte Springs, FL'],
  },
  {
    areaName: 'Tampa, FL',
    cities: ['Tampa, FL', 'St. Petersburg, FL', 'Clearwater, FL', 'Brandon, FL', 'Ybor City, FL'],
  },
  {
    areaName: 'Jacksonville, FL',
    cities: ['Jacksonville, FL', 'Jacksonville Beach, FL', 'St. Augustine, FL', 'Ponte Vedra Beach, FL', 'Orange Park, FL'],
  },
  {
    areaName: 'Naples, FL',
    cities: ['Naples, FL', 'Marco Island, FL', 'Bonita Springs, FL', 'Estero, FL'],
  },
  {
    areaName: 'Sarasota, FL',
    cities: ['Sarasota, FL', 'Bradenton, FL', 'Venice, FL', 'Lakewood Ranch, FL', 'Siesta Key, FL'],
  },
  {
    areaName: 'Fort Myers, FL',
    cities: ['Fort Myers, FL', 'Cape Coral, FL', 'Sanibel, FL', 'Fort Myers Beach, FL', 'Lehigh Acres, FL'],
  },

  // ─── California (CA) ────────────────────────────────────────────────────────
  {
    areaName: 'Los Angeles, CA',
    cities: ['Los Angeles, CA', 'Beverly Hills, CA', 'Santa Monica, CA', 'West Hollywood, CA', 'Pasadena, CA', 'Long Beach, CA', 'Burbank, CA', 'Culver City, CA'],
  },
  {
    areaName: 'San Francisco, CA',
    cities: ['San Francisco, CA', 'Oakland, CA', 'Berkeley, CA', 'San Mateo, CA', 'Palo Alto, CA', 'Sausalito, CA'],
  },
  {
    areaName: 'San Diego, CA',
    cities: ['San Diego, CA', 'La Jolla, CA', 'Chula Vista, CA', 'Coronado, CA', 'Carlsbad, CA', 'Del Mar, CA', 'Encinitas, CA'],
  },
  {
    areaName: 'San Jose, CA',
    cities: ['San Jose, CA', 'Santa Clara, CA', 'Sunnyvale, CA', 'Mountain View, CA', 'Cupertino, CA', 'Los Gatos, CA'],
  },
  {
    areaName: 'Sacramento, CA',
    cities: ['Sacramento, CA', 'Roseville, CA', 'Folsom, CA', 'Elk Grove, CA', 'Davis, CA', 'Rocklin, CA'],
  },
  {
    areaName: 'Santa Barbara, CA',
    cities: ['Santa Barbara, CA', 'Montecito, CA', 'Goleta, CA', 'Carpinteria, CA', 'Summerland, CA'],
  },

  // ─── Texas (TX) ─────────────────────────────────────────────────────────────
  {
    areaName: 'Dallas, TX',
    cities: ['Dallas, TX', 'Fort Worth, TX', 'Arlington, TX', 'Plano, TX', 'Irving, TX', 'Frisco, TX', 'McKinney, TX'],
  },
  {
    areaName: 'Houston, TX',
    cities: ['Houston, TX', 'The Woodlands, TX', 'Sugar Land, TX', 'Katy, TX', 'Pearland, TX', 'Spring, TX'],
  },
  {
    areaName: 'Austin, TX',
    cities: ['Austin, TX', 'Round Rock, TX', 'Cedar Park, TX', 'Georgetown, TX', 'San Marcos, TX', 'Pflugerville, TX'],
  },
  {
    areaName: 'San Antonio, TX',
    cities: ['San Antonio, TX', 'New Braunfels, TX', 'Boerne, TX', 'Schertz, TX', 'Cibolo, TX'],
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
  },

  // ─── Illinois (IL) ──────────────────────────────────────────────────────────
  {
    areaName: 'Chicago, IL',
    cities: ['Chicago, IL', 'Naperville, IL', 'Evanston, IL', 'Schaumburg, IL', 'Oak Park, IL', 'Rosemont, IL'],
  },

  // ─── District of Columbia (DC) ──────────────────────────────────────────────
  {
    areaName: 'Washington, DC',
    cities: ['Washington, DC', 'Arlington, DC', 'Alexandria, DC', 'Bethesda, DC', 'Silver Spring, DC', 'Tysons, DC', 'Reston, DC'],
  },

  // ─── Nevada (NV) ────────────────────────────────────────────────────────────
  {
    areaName: 'Las Vegas, NV',
    cities: ['Las Vegas, NV', 'Henderson, NV', 'North Las Vegas, NV', 'Paradise, NV', 'Summerlin, NV', 'Spring Valley, NV'],
  },

  // ─── Massachusetts (MA) ─────────────────────────────────────────────────────
  {
    areaName: 'Boston, MA',
    cities: ['Boston, MA', 'Cambridge, MA', 'Brookline, MA', 'Newton, MA', 'Somerville, MA', 'Quincy, MA', 'Waltham, MA'],
  },

  // ─── Georgia (GA) ───────────────────────────────────────────────────────────
  {
    areaName: 'Atlanta, GA',
    cities: ['Atlanta, GA', 'Sandy Springs, GA', 'Alpharetta, GA', 'Marietta, GA', 'Roswell, GA', 'Buckhead, GA', 'Duluth, GA'],
  },

  // ─── Washington (WA) ────────────────────────────────────────────────────────
  {
    areaName: 'Seattle, WA',
    cities: ['Seattle, WA', 'Bellevue, WA', 'Redmond, WA', 'Tacoma, WA', 'Kirkland, WA', 'Renton, WA', 'Everett, WA'],
  },

  // ─── Colorado (CO) ──────────────────────────────────────────────────────────
  {
    areaName: 'Denver, CO',
    cities: ['Denver, CO', 'Aurora, CO', 'Boulder, CO', 'Lakewood, CO', 'Centennial, CO', 'Cherry Creek, CO'],
  },
  {
    areaName: 'Aspen, CO',
    cities: ['Aspen, CO', 'Snowmass Village, CO', 'Basalt, CO', 'Carbondale, CO', 'Glenwood Springs, CO'],
  },

  // ─── Arizona (AZ) ───────────────────────────────────────────────────────────
  {
    areaName: 'Phoenix, AZ',
    cities: ['Phoenix, AZ', 'Mesa, AZ', 'Chandler, AZ', 'Tempe, AZ', 'Glendale, AZ', 'Gilbert, AZ'],
  },
  {
    areaName: 'Scottsdale, AZ',
    cities: ['Scottsdale, AZ', 'Paradise Valley, AZ', 'Fountain Hills, AZ', 'Cave Creek, AZ', 'Carefree, AZ'],
  },

  // ─── Pennsylvania (PA) ──────────────────────────────────────────────────────
  {
    areaName: 'Philadelphia, PA',
    cities: ['Philadelphia, PA', 'King of Prussia, PA', 'Center City, PA', 'Main Line, PA', 'Chester, PA', 'Bensalem, PA'],
  },
  {
    areaName: 'Pittsburgh, PA',
    cities: ['Pittsburgh, PA', 'Monroeville, PA', 'Cranberry Township, PA', 'Mount Lebanon, PA', 'Shadyside, PA'],
  },

  // ─── North Carolina (NC) ────────────────────────────────────────────────────
  {
    areaName: 'Charlotte, NC',
    cities: ['Charlotte, NC', 'Concord, NC', 'Huntersville, NC', 'Matthews, NC', 'Ballantyne, NC', 'Gastonia, NC'],
  },
  {
    areaName: 'Raleigh, NC',
    cities: ['Raleigh, NC', 'Durham, NC', 'Chapel Hill, NC', 'Cary, NC', 'Wake Forest, NC', 'Morrisville, NC'],
  },

  // ─── Tennessee (TN) ─────────────────────────────────────────────────────────
  {
    areaName: 'Nashville, TN',
    cities: ['Nashville, TN', 'Franklin, TN', 'Brentwood, TN', 'Murfreesboro, TN', 'Hendersonville, TN', 'Mount Juliet, TN'],
  },

  // ─── Minnesota (MN) ─────────────────────────────────────────────────────────
  {
    areaName: 'Minneapolis, MN',
    cities: ['Minneapolis, MN', 'St. Paul, MN', 'Bloomington, MN', 'Edina, MN', 'Minnetonka, MN', 'Plymouth, MN'],
  },

  // ─── Louisiana (LA) ─────────────────────────────────────────────────────────
  {
    areaName: 'New Orleans, LA',
    cities: ['New Orleans, LA', 'Metairie, LA', 'Kenner, LA', 'French Quarter, LA', 'Garden District, LA', 'Slidell, LA'],
  },

  // ─── Utah (UT) ──────────────────────────────────────────────────────────────
  {
    areaName: 'Salt Lake City, UT',
    cities: ['Salt Lake City, UT', 'Park City, UT', 'Provo, UT', 'Sandy, UT', 'West Valley City, UT', 'Draper, UT'],
  },

  // ─── Oregon (OR) ────────────────────────────────────────────────────────────
  {
    areaName: 'Portland, OR',
    cities: ['Portland, OR', 'Beaverton, OR', 'Gresham, OR', 'Hillsboro, OR', 'Lake Oswego, OR', 'Tigard, OR'],
  },

  // ─── Michigan (MI) ──────────────────────────────────────────────────────────
  {
    areaName: 'Detroit, MI',
    cities: ['Detroit, MI', 'Troy, MI', 'Dearborn, MI', 'Ann Arbor, MI', 'Birmingham, MI', 'Royal Oak, MI', 'Southfield, MI'],
  },

  // ─── Missouri (MO) ──────────────────────────────────────────────────────────
  {
    areaName: 'Kansas City, MO',
    cities: ['Kansas City, MO', 'Overland Park, MO', 'Olathe, MO', "Lee's Summit, MO", 'Independence, MO', 'Blue Springs, MO'],
  },
  {
    areaName: 'St. Louis, MO',
    cities: ['St. Louis, MO', 'Clayton, MO', 'Chesterfield, MO', 'St. Charles, MO', 'Creve Coeur, MO', 'Ballwin, MO'],
  },

  // ─── Ohio (OH) ──────────────────────────────────────────────────────────────
  {
    areaName: 'Columbus, OH',
    cities: ['Columbus, OH', 'Dublin, OH', 'Westerville, OH', 'Upper Arlington, OH', 'New Albany, OH', 'Grove City, OH'],
  },
  {
    areaName: 'Cincinnati, OH',
    cities: ['Cincinnati, OH', 'Mason, OH', 'Norwood, OH', 'Blue Ash, OH', 'Hyde Park, OH', 'West Chester, OH'],
  },
  {
    areaName: 'Cleveland, OH',
    cities: ['Cleveland, OH', 'Akron, OH', 'Parma, OH', 'Lakewood, OH', 'Beachwood, OH', 'Westlake, OH'],
  },

  // ─── Indiana (IN) ───────────────────────────────────────────────────────────
  {
    areaName: 'Indianapolis, IN',
    cities: ['Indianapolis, IN', 'Carmel, IN', 'Fishers, IN', 'Noblesville, IN', 'Zionsville, IN', 'Greenwood, IN'],
  },

  // ─── Virginia (VA) ──────────────────────────────────────────────────────────
  {
    areaName: 'Richmond, VA',
    cities: ['Richmond, VA', 'Henrico, VA', 'Chesterfield, VA', 'Short Pump, VA', 'Glen Allen, VA', 'Midlothian, VA'],
  },

  // ─── South Carolina (SC) ────────────────────────────────────────────────────
  {
    areaName: 'Charleston, SC',
    cities: ['Charleston, SC', 'North Charleston, SC', 'Mount Pleasant, SC', 'Summerville, SC', 'Kiawah Island, SC', 'Isle of Palms, SC'],
  },

  // ─── Connecticut (CT) ───────────────────────────────────────────────────────
  {
    areaName: 'Greenwich, CT',
    cities: ['Greenwich, CT', 'Stamford, CT', 'Norwalk, CT', 'Darien, CT', 'New Canaan, CT', 'Westport, CT'],
  },
];


