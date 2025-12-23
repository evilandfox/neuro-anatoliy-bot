import { runWithTools } from '@cloudflare/ai-utils'
import { searchProducts, formatProductsForLLM } from './products'
import type { ChatMessage } from './session'

const MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'

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

  // Define the product search tool
  const searchProductsTool = {
    name: 'search_products',
    description:
      'Поиск товаров из каталога Сибирского Здоровья. Вызывай когда готов порекомендовать конкретные товары для решения проблемы клиента. Формулируй запрос чётко под проблему.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description:
            'Поисковый запрос для поиска товаров (например: "витамины для энергии", "поддержка иммунитета", "проблемы со сном")',
        },
      },
      required: ['query'],
    },
    function: async (args: { query: string }): Promise<string> => {
      const results = await searchProducts(ai, args.query)
      return formatProductsForLLM(results)
    },
  }

  let toolCalled = false

  try {
    const response = await runWithTools(ai, MODEL, {
      messages,
      tools: [searchProductsTool],
    })

    // Check if tool was called
    if (
      response &&
      typeof response === 'object' &&
      'tool_calls' in response &&
      Array.isArray(response.tool_calls) &&
      response.tool_calls.length > 0
    ) {
      toolCalled = true
    }

    // Extract response text
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
