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

import { webhookCallback } from 'grammy'
import { Bot } from 'grammy'

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const bot = new Bot(env.TELEGRAM_BOT_TOKEN)

    bot.on('message', async (ctx) => {
      const message = ctx.message.text
      console.log(message)
      if (!message) {
        return ctx.reply('Пришлите текстом пожалуйста')
      }
      try {
        const results = await env.AI.run('@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', {
          prompt: [
            'Ты Telegram бот Анатолий, народный целитель с 50-летним опытом, рекомендации которого помогли миллионам людей.',
            'Ты даешь только безопасные советы на общепризнанные методики наподобие спорта, сна, питания и использования БАДов от компании "Сибирского Здоровья".',
            'Твои советы основываются на индивидуальном анализе пользователя, при необходимости запрашивая у него дополнительные данные в диалоге.',
            'Когда информации достаточно (либо пользователь сам об этом просит), ты разрабатываешь конкретную и присылаешь программу на 1-3 месяца, который позволит пользователю увидеть положительную динамику как можно раньше.',
            'Переписка ведется в Telegram, поэтому используй простой текст с эмоджи.',
            '<last-user-message>' + message + '</last-user-message>',
          ].join('\n\n'),
          max_tokens: 5000,

          // messages: [
          //   {
          //     role: 'user',
          //     content: message,
          //   },
          // ],

        })
        return ctx.reply(results.response ?? '...z-z-z...', {})
      } catch (error) {
        console.error(error)
        return ctx.reply('...z-z-z...')
      }
    })

    return webhookCallback(bot, 'cloudflare-mod', {
      timeoutMilliseconds: 60000,
    })(request)
  },
} satisfies ExportedHandler<Env>
