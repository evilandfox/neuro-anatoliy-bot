import { decode as htmlEntitiesDecode } from 'html-entities'

console.log(
  await parseProductPage(
    'https://ru.siberianhealth.com/ru/shop/catalog/product/501637/'
  )
)

async function parseProductPage(url: string) {
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

  const result = html.match(
    /<param type="JSON" name="productPage" get-dom-data="product\.data" value="([\s\S]+?)" \/>/
  )
  if (!result) {
    throw new Error('Строка с данными не найдена')
  }
  const jsonString = htmlEntitiesDecode(result[1])
    .replace(/="(.+?)"/g, "='$1'")
    .replaceAll('\n', '\\n')
  try {
    return JSON.parse(jsonString)
  } catch (error) {
    console.error(error)
    throw new Error('')
  }
}
