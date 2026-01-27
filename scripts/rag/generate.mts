/**
 * Генерирует из БД с заскрейпленными данными HTML файлы каждого товара
 */

import { drizzle } from 'drizzle-orm/libsql'
import fs from 'node:fs/promises'
import { URL } from 'node:url'
import TurndownService from 'turndown'
import { JSDOM } from 'jsdom'
import * as s from '../../src/db/schema'
import { IProductData } from '../../src/types/product'

const db = drizzle('file:./rag/database.db', { schema: s })

const products = await db.query.products.findMany()

const outputDirUrl = new URL('../../rag/r2-products/', import.meta.url)
const markdownOutputDirUrl = new URL('../../src/data/', import.meta.url)
const markdownOutputUrl = new URL('product-markdown.json', markdownOutputDirUrl)

const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
})
const markdownById: Record<string, string> = {}

await fs.mkdir(outputDirUrl, { recursive: true })
await fs.mkdir(markdownOutputDirUrl, { recursive: true })

for (const product of products) {
  const { fileName, htmlContent } = convertProductToHtml(product.data)
  await fs.writeFile(new URL(fileName, outputDirUrl), htmlContent)
  const markdown = convertHtmlToMarkdown(htmlContent)
  markdownById[String(product.id)] = markdown
}

await fs.writeFile(
  markdownOutputUrl,
  JSON.stringify(markdownById, null, 2)
)

function convertProductToHtml(data: IProductData) {
  const { product, feedbackList } = data

  const safeFileName = product.name
    .trim()
    .replace(/[\\\/]/g, '-')
    .replace(/%/g, 'проц')
    .replace(/\:/g, '-')

  const fileName = `[${product.id}] ${safeFileName}.html`

  const htmlContent = `<!DOCTYPE html>
  <html lang="ru">
  <head>
      <meta charset="UTF-8">
      <title>${product.name}</title>
  </head>
  <body>
  
      <h1>${product.name}</h1>
      
      <h2>ID</h2>
      <p>${product.id}</p>
      
      <h2>Краткое описание</h2>
      <p>${product.shortDescription}</p>
  
      <h2>Подробное описание</h2>
      <div>${product.description}</div>
  
      <h2>Состав и пищевая ценность</h2>
      <div>${product.productComponent}</div>
  
      <h2>Способ применения</h2>
      <div>${product.howToUse}</div>
  
      <h2>Противопоказания</h2>
      <div>${product.contraindications}</div>
  
      <h2>Назначение и категории</h2>
      <ul>
          ${product.categories
            .map((cat) => `<li>${cat.name}</li>`)
            .join('\n        ')}
      </ul>
  
      <h2>Отзывы покупателей</h2>
      <ul>
          ${feedbackList
            .filter((fb) => !fb.text.endsWith('...'))
            .map((fb) => `<li><b>${fb.created}</b> - ${fb.text}</li>`)
            .join('\n        ')}
      </ul>
  </body>
  </html>`

  return { fileName, htmlContent }
}

function convertHtmlToMarkdown(htmlContent: string): string {
  const dom = new JSDOM(htmlContent)
  const markdown = turndownService.turndown(dom.window.document.body)
  return markdown.trim()
}
