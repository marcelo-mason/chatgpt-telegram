import { pickVoice } from '../voice'
import { bot } from '../bot'
import { translateText } from '../lib/translateApi'

export async function voice() {
  bot.command('voice', async (ctx) => {
    const voice = pickVoice(ctx.language)

    console.log()

    let text = `Hi my name is ${voice.name}.`
    if (ctx.language !== 'en') {
      text = await translateText(text, ctx.language)
    }
    ctx.session.voice = voice.value
    await ctx.reply(`Voice set to ${voice.name}`)
    await ctx.sendVoiceToUser(text)
  })
}
