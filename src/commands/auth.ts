import messages from '../text/messages.json'
import { bot } from '../bot'

export async function auth() {
  bot.command('auth', async (ctx) => {
    const password = ctx.messageText

    if (!password) {
      ctx.replyWithHTML(messages.authMessage)
      return
    }

    const authed = await ctx.tryAuth(password)

    if (!authed) {
      ctx.reply(messages.InvalidPass)
      return
    }

    ctx.replyWithHTML(messages.help.join('\n'))
  })
}
