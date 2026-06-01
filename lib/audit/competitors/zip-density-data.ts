// ZIP→density classification for competitor search radius.
//
// Source: USPS ZIP prefix geography + 2020 Census ZCTA population density.
// "Urban" = downtown core of metros >300k pop with >5,000/sq mi density.
// "Rural" = low-population-density state regions (<500/sq mi typical).
// Everything else falls through to "suburban" (the safe middle).
//
// Lookups are O(1) — Sets indexed by 3-digit prefix or full 5-digit ZIP.
// The 5-digit override set wins over 3-digit prefixes (e.g. Flushing's
// 11354-11368 are urban inside Long Island's mostly-suburban 113 prefix).

export const URBAN_3DIGIT_PREFIXES: ReadonlySet<string> = new Set([
  // Northeast
  "021", "022",           // Boston / Cambridge
  "029",                  // Providence RI
  "061",                  // Hartford CT central
  "065",                  // New Haven CT
  "066",                  // Bridgeport CT
  "071",                  // Newark NJ
  "072",                  // Elizabeth NJ
  "073",                  // Jersey City
  "074",                  // Paterson NJ
  "100", "101", "102",    // Manhattan
  "104",                  // Bronx
  "107",                  // Yonkers
  "110", "111", "112",    // Long Island City / Brooklyn / NW Queens
  "142",                  // Buffalo
  "146",                  // Rochester NY
  "152",                  // Pittsburgh
  "181",                  // Allentown PA
  "191",                  // Philadelphia central
  "198",                  // Wilmington DE

  // South / Mid-Atlantic
  "200", "202", "203", "204", "205", // Washington DC
  "212",                  // Baltimore central
  "232",                  // Richmond VA
  "235",                  // Norfolk VA
  "274",                  // Greensboro NC
  "276",                  // Raleigh NC
  "277",                  // Durham NC
  "282",                  // Charlotte NC
  "292",                  // Columbia SC
  "294",                  // Charleston SC
  "303",                  // Atlanta central
  "322",                  // Jacksonville FL
  "328",                  // Orlando FL
  "330",                  // Hialeah / North Miami
  "331",                  // Miami central
  "333",                  // Fort Lauderdale
  "336",                  // Tampa
  "337",                  // St. Petersburg
  "352",                  // Birmingham AL
  "372",                  // Nashville TN
  "381",                  // Memphis TN

  // Midwest
  "402",                  // Louisville KY
  "432",                  // Columbus OH
  "441",                  // Cleveland
  "443",                  // Akron OH
  "452",                  // Cincinnati
  "462",                  // Indianapolis
  "482",                  // Detroit
  "532",                  // Milwaukee
  "537",                  // Madison WI
  "551",                  // St. Paul MN
  "554",                  // Minneapolis
  "606",                  // Chicago
  "631",                  // St. Louis
  "641",                  // Kansas City MO
  "672",                  // Wichita KS
  "681",                  // Omaha NE

  // South Central
  "701",                  // New Orleans
  "708",                  // Baton Rouge
  "722",                  // Little Rock
  "731",                  // Oklahoma City
  "741",                  // Tulsa
  "752",                  // Dallas central
  "761",                  // Fort Worth
  "770",                  // Houston central
  "772",                  // Houston east
  "782",                  // San Antonio
  "787",                  // Austin

  // Mountain / Southwest
  "800",                  // Aurora CO
  "802",                  // Denver
  "809",                  // Colorado Springs
  "841",                  // Salt Lake City
  "850",                  // Phoenix
  "857",                  // Tucson
  "871",                  // Albuquerque
  "891",                  // Las Vegas

  // Pacific
  "900", "901", "902",    // Los Angeles core
  "904",                  // Inglewood / SW LA
  "905",                  // Torrance / South Bay urban
  "908",                  // Long Beach
  "911",                  // Pasadena
  "912",                  // Glendale CA
  "915",                  // Burbank
  "921",                  // San Diego central
  "927",                  // Santa Ana
  "928",                  // Anaheim
  "937",                  // Fresno
  "941",                  // San Francisco
  "946",                  // Oakland
  "947",                  // Berkeley
  "951",                  // San Jose
  "958",                  // Sacramento
  "968",                  // Honolulu
  "972",                  // Portland OR
  "981",                  // Seattle
  "995",                  // Anchorage
]);

// 5-digit ZIPs that are urban-density pockets within otherwise non-urban
// 3-digit prefixes. Most common case: NYC outer boroughs where the 3-digit
// prefix covers Long Island suburbs but specific ZIPs are dense Queens
// neighborhoods.
export const URBAN_5DIGIT_OVERRIDES: ReadonlySet<string> = new Set([
  // Flushing / Bayside / NE Queens (inside 113 — Long Island)
  "11354", "11355", "11356", "11357", "11358",
  "11361", "11362", "11363", "11364", "11365", "11366", "11367", "11368",
  "11373", "11375", "11377",
]);

// State regions with low population density where competitors are
// geographically sparse. Bumping radius from suburban (5mi) to rural
// (15mi) lets us actually find peer businesses in these areas.
export const RURAL_3DIGIT_PREFIXES: ReadonlySet<string> = new Set([
  // Vermont (statewide rural)
  "050", "051", "052", "053", "054", "056", "057", "058", "059",

  // Maine inland (043-049 covers most of inland Maine)
  "043", "044", "045", "046", "047", "048", "049",

  // West Virginia (statewide rural except Charleston metro)
  "247", "248", "249", "250", "251", "252", "254", "255", "256", "257",
  "258", "259", "260", "261", "262", "263", "264", "265", "266", "267", "268",

  // Northern New England / Upstate NY rural
  "138", "139",           // Far upstate NY
  "127", "128", "129",    // Adirondacks
  "139",                  // Watertown area

  // Dakotas / Montana / Wyoming (statewide rural)
  "570", "571", "572", "573", "574", "575", "576", "577", // South Dakota
  "580", "581", "582", "583", "584", "585", "586", "587", "588", // North Dakota
  "590", "591", "592", "593", "594", "595", "596", "597", "598", "599", // Montana
  "820", "821", "822", "823", "824", "825", "826", "827", "828", "829", "830", "831", // Wyoming

  // Idaho rural (excludes Boise 837)
  "832", "833", "834", "835", "836", "838",

  // New Mexico rural (excludes Albuquerque 871)
  "870", "872", "873", "874", "875", "877", "878", "879", "880", "881", "882", "883", "884",

  // Alaska outside Anchorage (995 is Anchorage)
  "996", "997", "998", "999",

  // Nebraska / Kansas rural west
  "688", "689", "690", "691", "692", "693", // Western NE
  "676", "677", "678", "679",               // Western KS

  // Eastern Oregon / Eastern Washington rural
  "977",                  // Eastern OR
  "993",                  // SE Washington
]);
