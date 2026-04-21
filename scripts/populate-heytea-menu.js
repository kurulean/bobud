// populate-heytea-menu.js
// Inserts the HeyTea menu into every HeyTea shop in the database.
//
// Required env vars:
//   SUPABASE_URL         — your Supabase project URL
//   SUPABASE_SERVICE_KEY — Supabase service role key
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/populate-heytea-menu.js

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const MENU = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'heytea-menu.json'), 'utf8')
)

async function main() {
  console.log('Fetching HeyTea shops from database...')

  const { data: shops, error: shopsErr } = await supabase
    .from('shops')
    .select('id, name')
    .ilike('name', '%heytea%')

  if (shopsErr) {
    console.error('Failed to fetch shops:', shopsErr.message)
    process.exit(1)
  }
  if (!shops || shops.length === 0) {
    console.log('No HeyTea shops found in database.')
    return
  }

  console.log(`Found ${shops.length} HeyTea shop(s):`)
  shops.forEach(s => console.log(`  - ${s.name}`))

  const rows = []
  for (const shop of shops) {
    for (const item of MENU) {
      rows.push({
        shop_id: shop.id,
        name: item.name,
        category: item.category,
        price: item.price,
        calories: item.calories,
      })
    }
  }

  console.log(`\nInserting ${rows.length} menu items (${MENU.length} per shop × ${shops.length} shops)...`)

  const { error: insertErr } = await supabase
    .from('menu_items')
    .upsert(rows, { onConflict: 'shop_id,name', ignoreDuplicates: true })

  if (insertErr) {
    console.error('\nInsert failed:', insertErr.message)
    process.exit(1)
  }

  console.log('\n✓ Done.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
