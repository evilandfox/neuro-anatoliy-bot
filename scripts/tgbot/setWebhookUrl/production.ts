import { Api } from 'grammy'
import JSON5 from 'json5'
import fs from 'node:fs/promises'

const wranglerConfig = JSON5.parse(
  await fs.readFile('./wrangler.jsonc', 'utf-8')
)
const { TELEGRAM_BOT_TOKEN } = wranglerConfig.vars

const api = new Api(TELEGRAM_BOT_TOKEN)

await api.setWebhook('https://neuro-anatoliy-bot.plazzzm.workers.dev')

console.log('Готово')
