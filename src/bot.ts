import { Telegraf } from 'telegraf'
import LocalSession from 'telegraf-session-local'

import { ChibiContext } from './chibi'
import { defaultSession, sessionFile } from './common'

const telegramToken = process.env.TELEGRAM_TOKEN!
export const bot = new Telegraf(telegramToken, { contextType: ChibiContext })

bot.use(
  new LocalSession({
    database: sessionFile,
    state: defaultSession,
    property: 'userSession',
  }).middleware(),
)
