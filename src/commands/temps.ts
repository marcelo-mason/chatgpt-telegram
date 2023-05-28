import { bot } from '../bot'
import { GPTTemp } from '../common'

export async function temps() {
  bot.command('/focused', async (ctx) => (ctx.temperature = GPTTemp.FOCUSED))
  bot.command('/balanced', async (ctx) => (ctx.temperature = GPTTemp.BALANCED))
  bot.command('/inventive', async (ctx) => (ctx.temperature = GPTTemp.INVENTIVE))
  bot.command('/creative', async (ctx) => (ctx.temperature = GPTTemp.CREATIVE))
}
