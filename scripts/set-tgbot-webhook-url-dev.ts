import { config } from 'dotenv'
import { Api } from 'grammy'

const { TELEGRAM_BOT_TOKEN } = config({ path: './.dev.vars' }).parsed!

const api = new Api(TELEGRAM_BOT_TOKEN)

await api.setWebhook('https://dev-neuro-anatoliy.loca.lt')

console.log('Готово')
