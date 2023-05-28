import { bot } from '../bot'
import { GPTModel } from '../gpt'

export async function gpt() {
  bot.command('gpt', async (ctx) => {
    const model = ctx.messageText

    if (model == '3') {
      ctx.model = GPTModel.GPT3
      ctx.reply('Using ChatGPT 3.5 Turbo')
    }
    if (model == '4') {
      ctx.model = GPTModel.GPT4
      ctx.reply('Using ChatGPT 4')
    }

    ctx.initGpt()
    console.log('gpt', gpt)
  })
}
