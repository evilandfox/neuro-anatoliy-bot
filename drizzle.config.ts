import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema.mts',
  out: './drizzle',
  dbCredentials: {
    url: './database.db',
  },
})
