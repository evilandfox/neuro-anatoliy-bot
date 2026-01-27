import {
  autoChatAction,
  type AutoChatActionFlavor,
} from '@grammyjs/auto-chat-action'
import { Bot, webhookCallback, type Context, InlineKeyboard } from 'grammy'
import { buildSystemPrompt } from './config/systemPrompt'
import { SessionService } from './services/session'
import { NotebookService } from './services/notebook'
import { runChat } from './services/chat'
import productLinks from './data/product-links.json'

function getReferral() {
  return Math.random() > 0.5 ? 2009007717 : 2603169025
}

function escapeMarkdownV2(text: string): string {
  return text
    .replace(/\!/g, '\\!')
    .replace(/\./g, '\\.')
    .replace(/\?/g, '\\?')
    .replace(/-/g, '\\-')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\=/g, '\\=')
    .replace(/\+/g, '\\+')
    .replace(/\#/g, '\\#')
    .replace(/\>/g, '\\>')
    .replace(/\</g, '\\<')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
}

function processProductLinks(text: string): string {
  // Replace REGISTRATION_LINK placeholder
  let processed = text.replaceAll(
    'REGISTRATION_LINK',
    `https://ru.siberianhealth.com/ru/shop/user/registration/PRIVILEGED_CLIENT/?referral=${getReferral()}`
  )

  // Find and replace product links [Name](ID) -> [Name](URL?referral=XXX)
  const productIds = (processed.match(/(?<=\[.+?\]\\\()\d+(?=\\\))/g) ?? []).map(
    Number
  )

  if (productIds.length > 0) {
    processed = processed.replace(/\[(.+?)\]\\\((\d+)\\\)/g, (_, name, id) => {
      const link = productLinks[id as keyof typeof productLinks]
      if (link) {
        const referral = getReferral()
        return `[*${name}*](${link}?referral=${referral})`
      }
      return `*${name}*`
    })
  }

  return processed
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const bot = new Bot<Context & AutoChatActionFlavor>(env.TELEGRAM_BOT_TOKEN)
    const sessionService = new SessionService(env.DB)
    const notebookService = new NotebookService(env.DB, env.AI)

    bot.use(autoChatAction())

    bot.command('start', async (botCtx) => {
      const referralLink = `https://ru.siberianhealth.com/ru/shop/user/registration/PRIVILEGED_CLIENT/?referral=${getReferral()}`
      const keyboard = new InlineKeyboard().url(
        'Стать привилегированным клиентом',
        referralLink
      )

      return botCtx.reply(
        'Приветствую\\! На связи *дед Анатолий*\\. Я тут помогаю организм в порядок приводить\\. Ты мне просто напиши, что не так — где болит, от чего устал или что улучшить хочешь\\. А я тебе программу составлю и подскажу, чем из Сибирского Здоровья подкрепиться\\. Давай, не тяни, пиши запрос\\.',
        {
          parse_mode: 'MarkdownV2',
          reply_markup: keyboard,
        }
      )
    })

    bot.on('message', async (botCtx) => {
      const message = botCtx.message.text
      if (!message) {
        return botCtx.reply('Пришлите текстом пожалуйста')
      }

      const userId = botCtx.from?.id
      if (!userId) {
        return botCtx.reply('Не удалось определить пользователя')
      }

      try {
        botCtx.chatAction = 'typing'

        // Get or create session
        const sessionInfo = await sessionService.getOrCreateSession(userId)

        // Handle session summarization in background if needed
        if (sessionInfo.needsSummarization && sessionInfo.previousSessionId) {
          const previousMessages = await sessionService.getSessionMessages(
            sessionInfo.previousSessionId
          )
          // Run notebook update in background
          ctx.waitUntil(
            notebookService.updateNotebook(userId, previousMessages)
          )
        }

        // If this was an overflow (20+ messages), create new session
        let currentSessionId = sessionInfo.sessionId
        if (
          sessionInfo.needsSummarization &&
          !sessionInfo.isNew &&
          sessionInfo.previousSessionId
        ) {
          currentSessionId = await sessionService.createNewSessionFromOverflow(
            userId,
            sessionInfo.previousSessionId
          )
        }

        // Load notebook and session history
        const notebook = await notebookService.getNotebook(userId)
        const history = await sessionService.getSessionMessages(currentSessionId)

        // Build system prompt with notebook
        const systemPrompt = buildSystemPrompt(notebook)

        // Run chat with function calling
        const chatResponse = await runChat(
          env.AI,
          systemPrompt,
          history,
          message
        )
        console.log(chatResponse.response)

        // Save messages to session
        await sessionService.addMessage(currentSessionId, 'user', message)
        await sessionService.addMessage(
          currentSessionId,
          'assistant',
          chatResponse.response
        )

        // Process response: add product links and escape for Telegram
        let responseText = escapeMarkdownV2(chatResponse.response)
        responseText = processProductLinks(responseText)

        try {
          return botCtx.reply(responseText, {
            parse_mode: 'MarkdownV2',
            link_preview_options: {
              is_disabled: true,
            },
          })
        } catch (e) {
          console.error('MarkdownV2 error:', e)
          // Fallback to plain Markdown
          const plainText = processProductLinks(chatResponse.response)
          return botCtx.reply(plainText, {
            parse_mode: 'Markdown',
            link_preview_options: {
              is_disabled: true,
            },
          })
        }
      } catch (error) {
        console.error('Message handler error:', error)
        return botCtx.reply('Ошибка, попробуйте еще раз')
      }
    })

    return webhookCallback(bot, 'cloudflare-mod', {
      timeoutMilliseconds: 60000,
    })(request)
  },
} satisfies ExportedHandler<Env>
