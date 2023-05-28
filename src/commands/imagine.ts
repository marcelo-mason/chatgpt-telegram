import { bot } from '../bot'

export async function imagine() {
  bot.command('imagine', async (ctx) => {
    const text = ctx.messageText
    ctx.imagine(text)
  })
}
