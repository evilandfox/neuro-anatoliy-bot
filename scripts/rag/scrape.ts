import { drizzle } from 'drizzle-orm/libsql'
import { decode as htmlEntitiesDecode } from 'html-entities'
import * as s from '../../src/db/schema'
import { ICategoryData } from '../../src/types/category'
import { IProductData } from '../../src/types/product'
import categories from '../utils/categories.json'

const db = drizzle('file:./rag/database.db', { schema: s })

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
      const url = `https:${productUrl}`
      const product = await getProduct(url)
      const [{ id: productId }] = await db
        .insert(s.products)
        .values({
          id: product.product.id,
          name: product.product.name,
          url,
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

async function getProduct(url: string) {
  const result = (await fetchJsonParamsFromPage(url, ['productPage']))
    .productPage as Record<string, unknown>
  const idField = Object.keys(result).find((key) =>
    Number.isInteger(Number(key))
  )!
  const { [idField]: product, ...rest } = result
  return {
    product,
    ...rest,
  } as IProductData
}

async function fetchJsonParamsFromPage<K extends string>(
  url: string,
  params: K[]
): Promise<{ [key in K]: unknown }> {
  let response: Response
  let html: string | null
  try {
    response = await fetch(url)
    html = await response.text()
  } catch (error) {
    console.error(error)
    throw new Error('Невозможно выполнить fetch')
  }
  if (!response.ok) {
    console.error('Error status', {
      status: response.status,
      statusText: response.statusText,
      body: html,
    })
    throw new Error('Сервер вернул ошибку')
  }
  if (!html) {
    throw new Error('Сервер вернул пустой ответ')
  }
  const result = {} as Record<K, unknown>
  for (const param of params) {
    const regexp = new RegExp(
      `<param[^>]+name="${param}"[^>]+value="([\\s\\S]+?)"[^>]*\/?>`
    )
    const match = html.match(regexp)
    if (!match) {
      throw new Error(`Строка с данными не найдена для параметра ${param}`)
    }
    result[param] = parseJsonString(match[1])
  }
  return result
}

function parseJsonString(jsonStringRaw: string) {
  const jsonString = htmlEntitiesDecode(jsonStringRaw)
    .replace(/="(.+?)"/g, "='$1'")
    .replaceAll('\n', '\\n')
  try {
    return JSON.parse(jsonString)
  } catch (error) {
    console.error(error)
    throw new Error('Ошибка парсинга JSON')
  }
}

export default async function getCategory(url: string) {
  const result = (await fetchJsonParamsFromPage(url, [
    'category',
    'products',
  ])) as ICategoryData
  return result
}
