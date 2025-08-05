import { config } from 'dotenv'
import createBot from './bot'

const { TELEGRAM_BOT_TOKEN } = config({ path: './.dev.vars' }).parsed!

const bot = createBot(TELEGRAM_BOT_TOKEN)

await bot.start()
