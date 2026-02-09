import { drizzle } from 'drizzle-orm/libsql'
import fs from 'node:fs'
import { URL } from 'node:url'
import * as s from '../../src/db/schema'

const db = drizzle('file:./rag/database.db', { schema: s })

const productIdsAndLinks = await db.query.products.findMany({
  columns: {
    id: true,
    url: true,
  },
})

const json = JSON.stringify(
  Object.fromEntries(productIdsAndLinks.map((p) => [p.id, p.url])),
  null,
  2
)

fs.writeFileSync(new URL('../../src/data/product-links.json', import.meta.url), json)
