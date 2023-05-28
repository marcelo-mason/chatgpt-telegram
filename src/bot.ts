import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { session, Telegraf } from 'telegraf'

import { SQLite } from '@telegraf/session/sqlite'

import { ChibiContext, UserSession } from './chibi'

export const storeDir = process.env.STORE_LOCATION || './store'
export const sessionFile = join(storeDir, 'session.sqlite')

if (!existsSync(storeDir)) {
  mkdirSync(storeDir)
}

const store = SQLite<UserSession>({
  filename: sessionFile,
})

export const bot = new Telegraf(process.env.TELEGRAM_TOKEN!, {
  contextType: ChibiContext,
})

bot.use(session({ store }))
