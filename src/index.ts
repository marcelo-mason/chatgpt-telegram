import dotenv from 'dotenv'
dotenv.config()

import { message } from 'telegraf/filters'

import { bot } from './bot'
import { auth } from './commands/auth'
import { gpt } from './commands/gpt'
import { imagine } from './commands/imagine'
import { nums } from './commands/nums'
import { temps } from './commands/temps'
import { voice } from './commands/voice'
import messages from './text/messages.json'

// commands
auth()
voice()
gpt()
imagine()
nums()
temps()

bot.start((ctx) => ctx.replyWithHTML(messages.welcomeMessage))
bot.help((ctx) => ctx.localizedHelp())
bot.on(message('text'), async (ctx) => ctx.processInput())
bot.on(message('voice'), async (ctx) => ctx.processInput())
bot.on(message('photo'), async (ctx) => ctx.processInput())
bot.on(message('document'), async (ctx) => ctx.processInput())
bot.on('callback_query', async (ctx) => ctx.processCallbacks())
bot.launch()

// graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

// undhandled errors
process.on('unhandledRejection', (reason: any) => {
  console.error(reason)
})

console.log('Ready')
