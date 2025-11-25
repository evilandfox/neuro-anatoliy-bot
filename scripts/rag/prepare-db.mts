import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

const dbPath = 'rag/database.db'
const dbDir = path.dirname(dbPath)

// 1. Ensure directory exists
if (!existsSync(dbDir)) {
  console.log(`Creating directory: ${dbDir}`)
  mkdirSync(dbDir, { recursive: true })
}

// 2. Remove existing DB file to force recreation
if (existsSync(dbPath)) {
  console.log(`Removing existing database: ${dbPath}`)
  rmSync(dbPath)
}

// 3. Run drizzle-kit push
console.log('Running drizzle-kit push...')
try {
  execSync('npx drizzle-kit push', { stdio: 'inherit' })
} catch (error) {
  console.error('Failed to run db:push')
  process.exit(1)
}
