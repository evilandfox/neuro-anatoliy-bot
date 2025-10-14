import { drizzle } from 'drizzle-orm/libsql'
import fs from 'node:fs/promises'
import * as s from '../../db/schema'
import { IProductData } from '../../types/product'

const db = drizzle('file:./database.db', { schema: s })

const products = await db.query.products.findMany()

const outputDirUrl = new URL('../../../build-products/', import.meta.url)

await fs.mkdir(outputDirUrl, { recursive: true })

for (const product of products) {
  const { fileName, htmlContent } = convertProductToHtml(product.data)
  await fs.writeFile(new URL(fileName, outputDirUrl), htmlContent)
}

function convertProductToHtml(data: IProductData) {
  const { product, feedbackList } = data

  const safeFileName = product.name
    .replace(/[^a-zа-я0-9\s-]/gi, '')
    .replace(/\s+/g, '_')
  const fileName = `${product.id}_${safeFileName}.html`

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
