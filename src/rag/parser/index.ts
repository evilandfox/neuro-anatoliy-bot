import { drizzle } from 'drizzle-orm/libsql'
import * as s from '../../db/schema'
import categories from './constants/categories.json'
import getCategory from './utils/getCategory'
import getProduct from './utils/getProduct'

const db = drizzle('file:./database.db', { schema: s })

await db.delete(s.productCategories).execute()
await db.delete(s.products).execute()
await db.delete(s.categories).execute()

let lastCategoryId = 0

const insertedCategories = await Promise.all(
  categories.groups.flatMap((categoryGroup) =>
    categoryGroup.categories.map(async ({ url: categoryUrl }) => {
      const id = ++lastCategoryId
      const { category, products } = await getCategory(categoryUrl)
      const [{ id: categoryId }] = await db
        .insert(s.categories)
        .values({
          id,
          name: `${categoryGroup.name} | ${category.name}`,
          data: category,
          products,
        })
        .returning({ id: s.categories.id })
        .execute()
      return {
        categoryId,
        productUrls: products.map(({ url }) => url),
      }
    })
  )
)
console.log('Найдено и вставлено категорий', insertedCategories.length)

const uniqueProductUrls = Array.from(
  new Set(insertedCategories.flatMap(({ productUrls }) => productUrls))
)
const productUrlIdMap = new Map<string, number>()
console.log('Найдено товаров', uniqueProductUrls.length)
const batchSize = 5
for (let offset = 0; offset < uniqueProductUrls.length; offset += batchSize) {
  const batchProductUrls = uniqueProductUrls.slice(offset, offset + batchSize)
  console.log(
    'Обработка товаров %d-%d',
    offset + 1,
    offset + batchProductUrls.length
  )
  await Promise.all(
    batchProductUrls.map(async (productUrl) => {
      const product = await getProduct(`https:${productUrl}`)
      const [{ id: productId }] = await db
        .insert(s.products)
        .values({
          id: product.product.id,
          name: product.product.name,
          data: product,
        })
        .returning({ id: s.products.id })
        .execute()
      productUrlIdMap.set(productUrl, productId)
    })
  )
}
console.log('Все товары обработаны')

const insertProductCategoriesResult = await db
  .insert(s.productCategories)
  .values(
    insertedCategories.flatMap(({ categoryId, productUrls }) =>
      productUrls.map((productUrl) => ({
        categoryId,
        productId: productUrlIdMap.get(productUrl)!,
      }))
    )
  )
  .execute()
console.log(
  'Добавлено %d связей товаров с категориями',
  insertProductCategoriesResult.rowsAffected
)
