import productMarkdown from '../data/product-markdown.json'

const productMarkdownById = productMarkdown as Record<string, string>

export interface ProductSearchResult {
  file_id: string
  filename: string
  score: number
  content: { type: string; text: string }[]
}

export function getProductMarkdown(productId: number): string {
  const markdown = productMarkdownById[String(productId)]
  if (!markdown) {
    return 'Товар с указанным ID не найден.'
  }

  return markdown
}

export interface ProductSearchResponse {
  search_query: string
  data: ProductSearchResult[]
}

export async function searchProducts(
  ai: Ai,
  query: string,
): Promise<ProductSearchResponse> {
  const autorag = ai.autorag('syberian-wellness-products')

  const results = await autorag.search({
    query,
    max_num_results: 3,
    rewrite_query: true,
  })

  return {
    search_query: results.search_query,
    data: results.data.map((item) => ({
      file_id: item.file_id,
      filename: item.filename,
      score: item.score,
      content: item.content,
    })),
  }
}

function extractProductIdAndName(
  filename: string,
): { id: string; name: string } | null {
  const match = filename.match(/^\[(\d+)\]\s*(.+?)\.html?$/i)
  if (match) {
    return { id: match[1], name: match[2].trim() }
  }
  return null
}

export function formatProductsForLLM(results: ProductSearchResponse): string {
  if (results.data.length === 0) {
    return 'Товары по запросу не найдены.'
  }

  return results.data
    .map((product) => {
      const productInfo = extractProductIdAndName(product.filename)
      const textContent = product.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n')

      if (productInfo) {
        return `---
ТОВАР: ${productInfo.name}
ID: ${productInfo.id}
Ссылка для ответа: [${productInfo.name}](${productInfo.id})

${textContent}
---`
      }
      return `---\n${textContent}\n---`
    })
    .join('\n\n')
}
