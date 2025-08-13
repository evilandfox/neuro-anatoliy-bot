import { decode as htmlEntitiesDecode } from 'html-entities'

const categoriesUrl = [
  'https://ru.siberianhealth.com/ru/shop/catalog/vitaminy-i-dobavki-1/f/silnyy-immunitet-15/',
  'https://ru.siberianhealth.com/ru/shop/catalog/vitaminy-i-dobavki-1/f/detoks-i-ochishchenie-organizma-21/',
  'https://ru.siberianhealth.com/ru/shop/catalog/vitaminy-i-dobavki-1/f/sustavy-18/',
  'https://ru.siberianhealth.com/ru/shop/catalog/vitaminy-i-dobavki-1/',
  'https://ru.siberianhealth.com/ru/shop/catalog/vitaminy-i-dobavki-1/f/anti-age-19/',
]

async function fetchCategory(url: string) {
  const { category, products } = (await fetchJsonParamsFromPage(url, [
    'category',
    'products',
  ])) as {
    category: { id: number; name: string }
    products: { id: number; url: string }[]
  }
  console.log({ id: category.id, name: category.name })
}

for (const categoryUrl of categoriesUrl) {
  await fetchCategory(categoryUrl)
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
}
