import { runWithTools } from '@cloudflare/ai-utils'
import { searchProducts, formatProductsForLLM, getProductMarkdown } from './products'
import type { ChatMessage } from './session'

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
// const MODEL = '@cf/meta/llama-3.1-8b-instruct'

export interface ChatResponse {
  response: string
  toolCalled: boolean
}

export async function runChat(
  ai: Ai,
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string
): Promise<ChatResponse> {
  // Build messages array
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ]

  let toolCalled = false

  const searchProductsTool = {
    name: 'search_products',
    description: 'Поиск товаров из каталога Сибирского Здоровья',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Поисковый запрос для поиска товаров',
        },
      },
      required: ['query'],
    },
    function: async (args: { query: string }): Promise<string> => {
      toolCalled = true
      const results = await searchProducts(ai, args.query)
      console.log('Search products:', args.query)
      console.log(JSON.stringify(results, null, 2))
      return formatProductsForLLM(results)
    },
  }

  const getProductMarkdownTool = {
    name: 'get_product_markdown',
    description: 'Получить полную информацию о товаре по ID',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'ID товара из каталога',
        },
      },
      required: ['id'],
    },
    function: async (args: { id: number }): Promise<string> => {
      toolCalled = true
      const productId = Number(args.id)
      if (!Number.isFinite(productId)) {
        return 'Некорректный ID товара.'
      }

      return getProductMarkdown(productId)
    },
  }

  try {
    const response = await runWithTools(ai, MODEL, {
      messages,
      tools: [searchProductsTool, getProductMarkdownTool],
    })

    let responseText = ''
    if (response && typeof response === 'object') {
      if ('response' in response && typeof response.response === 'string') {
        responseText = response.response
      } else if (
        'choices' in response &&
        Array.isArray(response.choices) &&
        response.choices[0]?.message?.content
      ) {
        responseText = response.choices[0].message.content
      }
    }

    if (!responseText && typeof response === 'string') {
      responseText = response
    }

    return {
      response: responseText || 'Извини, не удалось сформировать ответ.',
      toolCalled,
    }
  } catch (error) {
    console.error('Chat error:', error)
    throw error
  }
}
