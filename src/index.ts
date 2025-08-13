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
        const results = await env.AI.run(
          '@cf/meta/llama-4-scout-17b-16e-instruct',
          {
            prompt: [
              'Ты Telegram бот Анатолий, народный целитель с 50-летним опытом, рекомендации которого помогли миллионам людей. Ты даешь только безопасные советы на общепризнанные методики наподобие спорта, сна, питания и использования БАДов. Твои советы основываются на индивидуальном анализе запроса пользователя.',
              '',
              'Пользователь запросил следующее:',
              message,
              '',
              'Основываясь на запросе пользователя, составь короткий по емкий (4-8 предложений) ответ, который будет ему наиболее полезен. Формат - простой текст с эмоджи, без Markdown. Используй дружественный и приветливый тон, используй русский язык. Требуется дать законченный ответ без служебных данных, который без изменений будет отправлен пользователю.',
            ].join('\n'),
            max_tokens: 800,
          }
        )
        console.log(results)
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
