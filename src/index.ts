/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import {
  autoChatAction,
  type AutoChatActionFlavor,
} from '@grammyjs/auto-chat-action'
import { Bot, webhookCallback, type Context, InlineKeyboard } from 'grammy'
import { systemPrompt } from './config/systemPrompt'
import productLinks from './data/product-links.json'

function getReferral() {
  return Math.random() > 0.5 ? 2009007717 : 2603169025
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const bot = new Bot<Context & AutoChatActionFlavor>(env.TELEGRAM_BOT_TOKEN)

    bot.use(autoChatAction())

    bot.command('start', async (ctx) => {
      const referralLink = `https://ru.siberianhealth.com/ru/shop/user/registration/PRIVILEGED_CLIENT/?referral=${getReferral()}`
      const keyboard = new InlineKeyboard().url(
        'Стать привилегированным клиентом',
        referralLink
      )

      return ctx.reply(
        'Приветствую\\! На связи *дед Анатолий*\\. Я тут помогаю организм в порядок приводить\\. Ты мне просто напиши, что не так — где болит, от чего устал или что улучшить хочешь\\. А я тебе программу составлю и подскажу, чем из Сибирского Здоровья подкрепиться\\. Давай, не тяни, пиши запрос\\.',
        {
          parse_mode: 'MarkdownV2',
          reply_markup: keyboard,
        }
      )
    })

    bot.on('message', async (ctx) => {
      const message = ctx.message.text
      if (!message) {
        return ctx.reply('Пришлите текстом пожалуйста')
      }
      try {
        ctx.chatAction = 'typing'

        const results = await env.AI.autorag(
          'syberian-wellness-products'
        ).aiSearch({
          system_prompt: systemPrompt,
          query: message,
          max_num_results: 3,
          rewrite_query: true,
        })

        let text = results.response
          .replace(/\!/g, '\\!')
          .replace(/\./g, '\\.')
          .replace(/\?/g, '\\?')
          .replace(/-/g, '\\-')
          .replace('REGISTRATION_LINK', `https://ru.siberianhealth.com/ru/shop/user/registration/PRIVILEGED_CLIENT/?referral=${getReferral()}`)

        const productIds = (text.match(/(?<=\[.+?\]\()\d+(?=\))/g) ?? []).map(
          Number
        )
        if (productIds.length > 0) {
          text = text.replace(/\[(.+?)\]\((.+?)\)/g, (_, name, id) => {
            const link = productLinks[id as keyof typeof productLinks]
            if (link) {
              const referral = getReferral()
              return `[*${name}*](${link}?referral=${referral})`
            }
            return `*${name}*`
          })
        }

        try {
          return ctx.reply(text, {
            parse_mode: 'MarkdownV2',
            link_preview_options: {
              is_disabled: true,
            },
          })
        } catch (e) {
          console.error(e)
          return ctx.reply(text, {
            parse_mode: 'Markdown',
            link_preview_options: {
              is_disabled: true,
            },
          })
        }
      } catch (error) {
        console.error(error)
        return ctx.reply('Ошибка, попробуйте еще раз')
      }
    })

    return webhookCallback(bot, 'cloudflare-mod', {
      timeoutMilliseconds: 60000,
    })(request)
  },
} satisfies ExportedHandler<Env>
