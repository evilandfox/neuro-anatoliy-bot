/// <reference lib="DOM" />

import puppeteer from 'puppeteer'

/** Данные, извлекаемые со страницы товара */
export interface PageExtractedData {
  url: string
  name: string
  shortDescription: string
  price: number
  size: string
  /** подробное описание товара ("О продукте") */
  descirption: string // NB: сохраняем оригинальное написание из запроса
  composition: string
  feedback: string[]
}

/**
 * Извлекает данные со страницы товара Siberian Wellness
 * @param url ссылка на страницу товара
 */
export async function extractData(url: string): Promise<PageExtractedData> {
  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2' })

    const data = (await page.evaluate(() => {
      const getText = (selector: string): string => {
        const el = document.querySelector<HTMLElement>(selector)
        return el ? el.textContent!.trim() : ''
      }

      /** Собирает текст до следующего заголовка */
      const collectSection = (title: string): string => {
        const header = Array.from(
          document.querySelectorAll<HTMLElement>('h1, h2, h3')
        ).find((h) => h.textContent!.trim().toLowerCase().includes(title)) as
          | HTMLElement
          | undefined
        if (!header) return ''
        let cur = header.nextElementSibling as HTMLElement | null
        const parts: string[] = []
        while (cur && !['H1', 'H2', 'H3'].includes(cur.tagName)) {
          if (cur.textContent) parts.push(cur.textContent.trim())
          cur = cur.nextElementSibling as HTMLElement | null
        }
        return parts.join('\n')
      }

      /* -------- name и краткое описание -------- */
      const name = getText('h1')
      let shortDescription = ''
      const h1 = document.querySelector('h1')
      if (h1 && h1.nextElementSibling) {
        shortDescription = (
          h1.nextElementSibling as HTMLElement
        ).textContent!.trim()
      }

      /* -------- цена -------- */
      const priceSelectorCandidates = [
        '[itemprop="price"]',
        '.im21--price__current',
        '.product-price__value',
        '.price',
      ]
      const priceTextRaw =
        priceSelectorCandidates.map(getText).find(Boolean) || ''
      const price = parseInt(priceTextRaw.replace(/[^\d]/g, ''), 10) || NaN

      /* -------- описание и состав -------- */
      const description = collectSection('о продукте')
      const composition = collectSection('состав')

      /* -------- отзывы -------- */
      const feedbackNodes = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.os-product-review__text, .review__text, .review__body, [itemprop="reviewBody"]'
        )
      )
      const feedback = feedbackNodes
        .map((n) => n.textContent!.trim())
        .filter(Boolean)

      return {
        url: location.href,
        name,
        shortDescription,
        price,
        descirption: description,
        composition,
        feedback,
      }
    })) as PageExtractedData

    return data
  } finally {
    await browser.close()
  }
}

// // CLI helper: node ./scripts/extract-data.ts <url>
// if (import.meta.url === `file://${process.argv[1]}` && process.argv[2]) {
//   const url = process.argv[2]
//   extractData(url)
//     .then(result => {
//       console.log(JSON.stringify(result, null, 2))
//     })
//     .catch(err => {
//       console.error(err)
//       process.exitCode = 1
//     })
// }

extractData(
  'https://ru.siberianhealth.com/ru/shop/catalog/product/500661/'
).then(console.log)
