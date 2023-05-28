import { createWriteStream, promises as fsPromises } from 'fs'

import axios from 'axios'
import path from 'path'

const htApiUserId = process.env.PLAY_HT_USER_ID
const htApiSecretKey = process.env.PLAY_HT_SECRET_KEY

export async function textToSpeech(text: string, voice: string, destDir: string) {
  if (!htApiUserId || !htApiSecretKey) {
    throw new Error('Play.ht API credentials not set.')
  }

  const headers = {
    Authorization: htApiSecretKey,
    'X-User-ID': htApiUserId,
    'Content-Type': 'application/json',
  }

  const convert = 'https://play.ht/api/v1/convert'
  const data = {
    voice,
    ssml: [`<speak><p>${text}</p></speak>`],
    title: text.substring(0, 36),
  }

  const convertRes = await axios.post(convert, data, { headers })

  const transcriptionId = convertRes.data.transcriptionId
  const transcriptionStatusUrl = `https://play.ht/api/v1/articleStatus?transcriptionId=${transcriptionId}`

  async function downloadTranscript() {
    const status = await axios.get(transcriptionStatusUrl, { headers })
    if (status.data.converted) {
      return status.data.audioUrl
    }
    if (status.data.error) {
      throw new Error('Transcription failure')
    }
  }

  let audioUrl: string | undefined
  console.log('Waiting for transcript...')
  while (audioUrl === undefined) {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    try {
      audioUrl = await downloadTranscript()
    } catch (error) {
      return
    }
  }
  console.log('Received transcript')

  const transcriptPath = path.join(destDir, `voice-${transcriptionId}.mp3`)
  const writestream = createWriteStream(transcriptPath)
  const download = await axios({
    method: 'GET',
    url: audioUrl,
    responseType: 'stream',
  })

  await new Promise(async (resolve, reject) => {
    download.data.pipe(writestream)
    writestream.on('finish', resolve)
    writestream.on('error', reject)
  })

  return transcriptPath
}
