// populate-shops.js
// Usage: node scripts/populate-shops.js
//
// Required env vars:
//   PLACES_API_KEY    — Google Places API key
//   SUPABASE_URL      — your Supabase project URL
//   SUPABASE_SERVICE_KEY — Supabase service role key (bypasses RLS)
//
// Optional env vars:
//   LAT   — center latitude  (default: 33.6846 — Irvine, CA)
//   LNG   — center longitude (default: -117.8265)
//   MILES — search radius in miles (default: 10)

const { createClient } = require('@supabase/supabase-js')

const PLACES_API_KEY = process.env.PLACES_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!PLACES_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required env vars: PLACES_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const LAT   = parseFloat(process.env.LAT   || '33.6846')
const LNG   = parseFloat(process.env.LNG   || '-117.8265')
const MILES = parseFloat(process.env.MILES || '10')
const RADIUS_METERS = Math.round(MILES * 1609.34)

async function fetchPage(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchAllShops() {
  const base = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`
  const firstUrl = `${base}?location=${LAT},${LNG}&radius=${RADIUS_METERS}&keyword=boba+tea&type=cafe&key=${PLACES_API_KEY}`

  const results = []
  let data = await fetchPage(firstUrl)
  results.push(...(data.results || []))
  console.log(`Page 1: ${data.results?.length ?? 0} results`)

  // Places API supports up to 2 more pages
  for (let page = 2; page <= 3; page++) {
    if (!data.next_page_token) break
    // Google requires a short delay before the next_page_token becomes valid
    await new Promise(r => setTimeout(r, 2000))
    data = await fetchPage(`${base}?pagetoken=${data.next_page_token}&key=${PLACES_API_KEY}`)
    results.push(...(data.results || []))
    console.log(`Page ${page}: ${data.results?.length ?? 0} results`)
  }

  return results
}

function mapToShop(place) {
  return {
    name: place.name,
    address: place.vicinity || '',
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng,
    rating: place.rating ?? 0,
    review_count: place.user_ratings_total ?? 0,
    tags: [],
  }
}

async function main() {
  console.log(`\nFetching boba shops within ${MILES} miles of (${LAT}, ${LNG})...\n`)

  const places = await fetchAllShops()
  console.log(`\nTotal fetched: ${places.length} shops`)

  if (places.length === 0) {
    console.log('No shops found. Check your API key and location.')
    return
  }

  const shops = places.map(mapToShop)

  // Upsert by name + address to avoid duplicates on re-runs
  const { error } = await supabase
    .from('shops')
    .upsert(shops, { onConflict: 'name,address', ignoreDuplicates: true })

  if (error) {
    console.error('\nSupabase error:', error.message)
    process.exit(1)
  }

  console.log(`\n✓ Inserted ${shops.length} shops into Supabase`)
  shops.forEach(s => console.log(`  - ${s.name} (${s.rating}⭐)`))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
