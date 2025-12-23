export interface ProductSearchResult {
  file_id: string
  filename: string
  score: number
  content: { type: string; text: string }[]
}

export interface ProductSearchResponse {
  search_query: string
  data: ProductSearchResult[]
}

export async function searchProducts(
  ai: Ai,
  query: string
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

export function formatProductsForLLM(results: ProductSearchResponse): string {
  if (results.data.length === 0) {
    return 'Товары по запросу не найдены.'
  }

  return results.data
    .map((product) => {
      const textContent = product.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n')
      return `---\n${textContent}\n---`
    })
    .join('\n\n')
}
