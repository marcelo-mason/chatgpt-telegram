import { Midjourney, MJMessage } from 'midjourney'

const client = new Midjourney({
  ServerId: <string>process.env.MIDJOURNEY_SERVER_ID,
  ChannelId: <string>process.env.MIDJOURNEY_CHANNEL_ID,
  SalaiToken: <string>process.env.MIDJOURNEY_SALAI_TOKEN,
})

client.init()

export async function imagineIt(text: string): Promise<MJMessage> {
  try {
    text = text.replace('—', '--') // fix for telegram autocorrect
    const msg = await client.Imagine(text)
    if (msg) {
      return msg
    }
  } catch (e: any) {
    console.error(JSON.stringify(e))
  }
  console.log("Couldn't imagineIt")
  return {} as MJMessage
}

export async function upscaleIt(msg: MJMessage, num: number) {
  try {
    const upscaled = await client.Upscale(
      msg.content,
      num,
      <string>msg.id,
      <string>msg.hash,
      (uri: string, progress: string) => {
        console.log('loading', uri, 'progress', progress)
      },
    )
    if (upscaled) {
      return upscaled.uri
    }
  } catch (e) {
    console.error(e)
  }
  console.log("Couldn't upscaleIt")
  return null
}

export async function variateIt(msg: MJMessage, num: number): Promise<MJMessage> {
  try {
    const variation = await client.Variation(
      msg.content,
      num,
      <string>msg.id,
      <string>msg.hash,
      (uri: string, progress: string) => {
        console.log('loading', uri, 'progress', progress)
      },
    )
    if (variation) {
      return variation
    }
  } catch (e) {
    console.error(e)
  }
  console.log("Couldn't variateIt")
  return {} as MJMessage
}
