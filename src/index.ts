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
import { Bot, webhookCallback, type Context } from 'grammy'
import { systemPrompt } from './systemPrompt'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './db/schema'
import { inArray } from 'drizzle-orm'
import productLinks from './product-links.json'

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const bot = new Bot<Context & AutoChatActionFlavor>(env.TELEGRAM_BOT_TOKEN)

    bot.use(autoChatAction())

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
        console.log(results.response)

        let text = results.response
          .replace(/\!/g, '\\!')
          .replace(/\./g, '\\.')
          .replace(/\?/g, '\\?')
          .replace(/-/g, '\\-')

        const productIds = (text.match(/(?<=\[.+?\]\()\d+(?=\))/g) ?? []).map(
          Number
        )
        if (productIds.length > 0) {
          text = text.replace(/\[(.+?)\]\((.+?)\)/g, (_, name, id) => {
            const link = productLinks[id as keyof typeof productLinks]
            if (link) {
              const referral = Math.random() > 0.5 ? 2009007717 : 2603169025
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
          console.error('sendMessage failback', e)
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
