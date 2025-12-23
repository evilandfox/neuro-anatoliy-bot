import {
  type AnySQLiteColumn,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'
import type { IProductData } from '../types/product'
import { ICategoryData } from '../types/category'

// ========== SESSIONS & CHAT ==========

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  lastMessageAt: integer('last_message_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
})

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id),
  role: text('role', { enum: ['user', 'assistant', 'tool'] }).notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const notebooks = sqliteTable('notebooks', {
  userId: integer('user_id').primaryKey(),
  content: text('content').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
})

// ========== PRODUCTS & CATEGORIES ==========

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey(),
  categoryId: integer('category_id').references(
    (): AnySQLiteColumn => categories.id
  ),
  name: text('name').notNull(),
  data: text('data', { mode: 'json' })
    .$type<ICategoryData['category']>()
    .notNull(),
  products: text('products', { mode: 'json' })
    .$type<ICategoryData['products']>()
    .notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const products = sqliteTable('products', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  data: text('data', { mode: 'json' }).$type<IProductData>().notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const productCategories = sqliteTable(
  'product_categories',
  {
    productId: integer('product_id').references(() => products.id),
    categoryId: integer('category_id').references(() => categories.id),
  },
  (table) => [
    primaryKey({
      columns: [table.productId, table.categoryId],
    }),
  ]
)
