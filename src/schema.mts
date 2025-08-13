import {
  blob,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

export const products = sqliteTable('products', {
  id: integer('id').primaryKey(),
  data: blob('data', { mode: 'json' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
})

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  data: blob('data', { mode: 'json' }).notNull(),
  products: blob('products', { mode: 'json' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
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

export const subcategories = sqliteTable('subcategories', {
  id: integer('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id),
  name: text('name').notNull(),
  data: blob('data', { mode: 'json' }).notNull(),
  products: blob('products', { mode: 'json' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
})

export const subcategoryProducts = sqliteTable(
  'subcategory_products',
  {
    subcategoryId: integer('subcategory_id').references(() => subcategories.id),
    productId: integer('product_id').references(() => products.id),
  },
  (table) => [
    primaryKey({
      columns: [table.subcategoryId, table.productId],
    }),
  ]
)
