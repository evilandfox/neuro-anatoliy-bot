import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { notebooks } from '../db/schema'
import type { ChatMessage } from './session'

const SUMMARIZATION_PROMPT = `Ты — помощник деда Анатолия. Твоя задача — обновить записную книжку о клиенте на основе диалога.

Записная книжка содержит важную информацию о клиенте:
- Имя, возраст, пол (если известны)
- Образ жизни, работа
- Состояние здоровья, жалобы
- Данные рекомендации
- Что нужно отслеживать в динамике
- Любая другая полезная информация

Формат: краткий структурированный текст, только факты. Не добавляй то, чего нет в диалоге.
Если старая запись пуста — создай новую на основе диалога.
Если в диалоге нет полезной информации — верни старую запись без изменений.`

export class NotebookService {
  private db: ReturnType<typeof drizzle>
  private ai: Ai

  constructor(d1: D1Database, ai: Ai) {
    this.db = drizzle(d1)
    this.ai = ai
  }

  async getNotebook(userId: number): Promise<string | null> {
    const row = await this.db
      .select({ content: notebooks.content })
      .from(notebooks)
      .where(eq(notebooks.userId, userId))
      .limit(1)
      .then((rows) => rows[0])

    return row?.content ?? null
  }

  async updateNotebook(
    userId: number,
    sessionMessages: ChatMessage[]
  ): Promise<void> {
    if (sessionMessages.length === 0) return

    const oldNotebook = await this.getNotebook(userId)

    // Format dialog for summarization
    const dialogText = sessionMessages
      .map((m) => `${m.role === 'user' ? 'Клиент' : 'Анатолий'}: ${m.content}`)
      .join('\n')

    const prompt = `${SUMMARIZATION_PROMPT}

СТАРАЯ ЗАПИСЬ:
${oldNotebook || '(пусто)'}

ДИАЛОГ:
${dialogText}

ОБНОВЛЁННАЯ ЗАПИСЬ:`

    try {
      const response = await this.ai.run(
        '@cf/meta/llama-4-scout-17b-16e-instruct',
        {
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
        }
      )

      const newContent =
        'response' in response
          ? (response.response as string)
          : String(response)

      if (!newContent || newContent.trim().length === 0) return

      const now = new Date()

      if (oldNotebook) {
        await this.db
          .update(notebooks)
          .set({ content: newContent.trim(), updatedAt: now })
          .where(eq(notebooks.userId, userId))
      } else {
        await this.db.insert(notebooks).values({
          userId,
          content: newContent.trim(),
          updatedAt: now,
        })
      }
    } catch (error) {
      console.error('Failed to update notebook:', error)
    }
  }
}
