import { migrate } from 'drizzle-orm/libsql/migrator'
import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from '../src/db/schema.js'

async function main() {
  const db = drizzle(
    createClient({
      url: 'file:./catalog.db',
    }),
    { schema }
  )

  console.log('Running migrations')

  await migrate(db, {
    migrationsFolder: './drizzle',
  })

  console.log('Migrations finished')

  process.exit(0)
}

main().catch((e) => {
  console.error('Migration failed')
  console.error(e)
  process.exit(1)
})
