import { bot } from '../bot'
import { ButtonAction } from '../common'

export async function nums() {
  bot.command('1', async (ctx) => ctx.reImagine(ButtonAction.V1))
  bot.command('2', async (ctx) => ctx.reImagine(ButtonAction.V2))
  bot.command('3', async (ctx) => ctx.reImagine(ButtonAction.V3))
  bot.command('4', async (ctx) => ctx.reImagine(ButtonAction.V4))
}
