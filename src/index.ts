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

import { Bot, webhookCallback } from 'grammy'

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const bot = new Bot(env.TELEGRAM_BOT_TOKEN)

    bot.on('message', async (ctx) => {
      const message = ctx.message.text
      if (!message) {
        return ctx.reply('Пришлите текстом пожалуйста')
      }
      try {
        const results = await env.AI.autorag('siberian-wellness-v1').aiSearch({
          query: message,
          rewrite_query: true,
          max_num_results: 6,
          ranking_options: { score_threshold: 0.28 },
        })
        return ctx.reply(results.response ?? 'Ошибка, попробуйте еще раз')
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
