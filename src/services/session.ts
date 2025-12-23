import { eq, and, desc } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { sessions, messages } from '../db/schema'

const SESSION_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
const MAX_MESSAGES_PER_SESSION = 20

export type MessageRole = 'user' | 'assistant' | 'tool'

export interface ChatMessage {
  role: MessageRole
  content: string
}

export interface SessionInfo {
  sessionId: string
  isNew: boolean
  needsSummarization: boolean
  previousSessionId?: string
}

function generateId(): string {
  return crypto.randomUUID()
}

export class SessionService {
  private db: ReturnType<typeof drizzle>

  constructor(d1: D1Database) {
    this.db = drizzle(d1)
  }

  async getOrCreateSession(userId: number): Promise<SessionInfo> {
    const now = new Date()
    const timeoutThreshold = new Date(now.getTime() - SESSION_TIMEOUT_MS)

    // Find active session for user
    const activeSession = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.isActive, true)))
      .orderBy(desc(sessions.lastMessageAt))
      .limit(1)
      .then((rows) => rows[0])

    if (activeSession) {
      const lastMessageTime = new Date(activeSession.lastMessageAt)

      // Session is still valid (within 15 min)
      if (lastMessageTime > timeoutThreshold) {
        // Check message count
        const messageCount = await this.getMessageCount(activeSession.id)

        if (messageCount >= MAX_MESSAGES_PER_SESSION) {
          // Need to summarize and create new session
          return {
            sessionId: activeSession.id,
            isNew: false,
            needsSummarization: true,
            previousSessionId: activeSession.id,
          }
        }

        return {
          sessionId: activeSession.id,
          isNew: false,
          needsSummarization: false,
        }
      }

      // Session expired - close it and return info for summarization
      await this.closeSession(activeSession.id)

      const newSessionId = generateId()
      await this.db.insert(sessions).values({
        id: newSessionId,
        userId,
        createdAt: now,
        lastMessageAt: now,
        isActive: true,
      })

      return {
        sessionId: newSessionId,
        isNew: true,
        needsSummarization: true,
        previousSessionId: activeSession.id,
      }
    }

    // No active session - create new one
    const newSessionId = generateId()
    await this.db.insert(sessions).values({
      id: newSessionId,
      userId,
      createdAt: now,
      lastMessageAt: now,
      isActive: true,
    })

    return {
      sessionId: newSessionId,
      isNew: true,
      needsSummarization: false,
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ isActive: false })
      .where(eq(sessions.id, sessionId))
  }

  async getMessageCount(sessionId: string): Promise<number> {
    const result = await this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))

    return result.length
  }

  async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    const rows = await this.db
      .select({
        role: messages.role,
        content: messages.content,
      })
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.createdAt)

    return rows as ChatMessage[]
  }

  async addMessage(
    sessionId: string,
    role: MessageRole,
    content: string
  ): Promise<void> {
    const now = new Date()

    await this.db.insert(messages).values({
      id: generateId(),
      sessionId,
      role,
      content,
      createdAt: now,
    })

    // Update session lastMessageAt
    await this.db
      .update(sessions)
      .set({ lastMessageAt: now })
      .where(eq(sessions.id, sessionId))
  }

  async createNewSessionFromOverflow(
    userId: number,
    oldSessionId: string
  ): Promise<string> {
    // Close old session
    await this.closeSession(oldSessionId)

    // Create new session
    const now = new Date()
    const newSessionId = generateId()

    await this.db.insert(sessions).values({
      id: newSessionId,
      userId,
      createdAt: now,
      lastMessageAt: now,
      isActive: true,
    })

    return newSessionId
  }
}
