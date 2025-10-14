import {
  type AnySQLiteColumn,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'
import type { IProductData } from '../types/product'
import { ICategoryData } from '../types/category'

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
