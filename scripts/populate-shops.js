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

const KEYWORDS = [
  'boba',
  'bubble tea',
  'milk tea',
  'boba tea',
  // Popular chains — ensures brand names get picked up
  'sharetea',
  'cha for tea',
  'chatime',
  'ding tea',
  'happy lemon',
  'gong cha',
  'the alley',
  '7 leaves',
  'tiger sugar',
  'yi fang',
  'kung fu tea',
  'tastea',
  'tp tea',
  'coco fresh tea',
  'it\'s boba time',
  'heytea',
  'hey tea',
]

async function fetchPage(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchForKeyword(keyword) {
  const base = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`
  const kw = encodeURIComponent(keyword)
  const firstUrl = `${base}?location=${LAT},${LNG}&radius=${RADIUS_METERS}&keyword=${kw}&key=${PLACES_API_KEY}`

  const results = []
  let data = await fetchPage(firstUrl)
  results.push(...(data.results || []))
  console.log(`  "${keyword}" page 1: ${data.results?.length ?? 0}`)

  for (let page = 2; page <= 3; page++) {
    if (!data.next_page_token) break
    await new Promise(r => setTimeout(r, 2000))
    data = await fetchPage(`${base}?pagetoken=${data.next_page_token}&key=${PLACES_API_KEY}`)
    results.push(...(data.results || []))
    console.log(`  "${keyword}" page ${page}: ${data.results?.length ?? 0}`)
  }

  return results
}

// Allowed name patterns — keeps only actual boba shops
const NAME_ALLOWLIST = [
  /\bboba\b/i,
  /\btea\b/i,
  /\btapioca\b/i,
  /\bbubble\b/i,
  /\bmilk\s*tea\b/i,
  // Known chain names (exact/partial)
  /sharetea/i, /chatime/i, /ding\s*tea/i, /happy\s*lemon/i, /gong\s*cha/i,
  /the\s*alley/i, /7\s*leaves/i, /tiger\s*sugar/i, /yi\s*fang/i,
  /kung\s*fu\s*tea/i, /tastea/i, /tp\s*tea/i, /coco\s*fresh/i,
  /boba\s*time/i, /cha\s*for\s*tea/i, /cha4tea/i, /omomo/i,
  /labobatory/i, /sunright/i, /factory\s*tea/i, /presotea/i,
  /hey\s*tea/i, /heytea/i,
]

function isBobaShop(place) {
  const name = place.name || ''
  return NAME_ALLOWLIST.some(rx => rx.test(name))
}

async function fetchAllShops() {
  const byId = new Map()
  for (const keyword of KEYWORDS) {
    console.log(`\nSearching "${keyword}"...`)
    const results = await fetchForKeyword(keyword)
    for (const place of results) {
      if (place.place_id && !byId.has(place.place_id)) {
        byId.set(place.place_id, place)
      }
    }
  }
  const all = Array.from(byId.values())
  const filtered = all.filter(isBobaShop)
  console.log(`\nFiltered ${all.length} → ${filtered.length} actual boba shops`)
  return filtered
}

function mapToShop(place) {
  return {
    name: place.name,
    address: place.vicinity || '',
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng,
    rating: 0,
    review_count: 0,
    tags: [],
  }
}

async function main() {
  console.log(`\nFetching boba shops within ${MILES} miles of (${LAT}, ${LNG})...`)

  const places = await fetchAllShops()
  console.log(`\nTotal unique shops: ${places.length}`)

  if (places.length === 0) {
    console.log('No shops found. Check your API key and location.')
    return
  }

  const shops = places.map(mapToShop)

  const { error } = await supabase
    .from('shops')
    .upsert(shops, { onConflict: 'name,address', ignoreDuplicates: true })

  if (error) {
    console.error('\nSupabase error:', error.message)
    process.exit(1)
  }

  console.log(`\n✓ Upserted ${shops.length} shops into Supabase`)
  shops
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(s => console.log(`  - ${s.name}`))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
