import axios from 'axios'
import ffmpeg from 'fluent-ffmpeg'
import { createReadStream, createWriteStream } from 'fs'
import { OpenAIApi } from 'openai'

import { bot, storeDir } from './bot'
import VOICES from './lib/htVoices.json'

export interface Voice {
  value: string
  name: string
  languageCode: string
  gender: string
}

const defaultCountryCodes = process.env.DEFAULT_COUNTRYCODES?.split(',') || []

export type Voices = Array<Voice>

const createLanguageMap = (codes: string[]): Map<string, string> => {
  const map = new Map<string, string>()
  codes.map((code) => {
    const [lang, country] = code.trim().split('-')
    map.set(lang, code.trim())
  })
  return map
}

export function pickVoice(language: string): Voice {
  const languageMap = createLanguageMap(defaultCountryCodes)

  language = languageMap.get(language) || language

  const voices = VOICES as Voice[]
  const matchingVoices = voices.filter(
    (voice) => voice.languageCode.startsWith(language) && voice.gender === 'Female',
  )

  let chosen

  if (matchingVoices.length > 0) {
    const randomIndex = Math.floor(Math.random() * matchingVoices.length)
    chosen = matchingVoices[randomIndex]
  } else {
    chosen = voices[0]
  }

  return chosen
}

export async function downloadVoiceFile(fileId: string) {
  try {
    const oggDestination = `${storeDir}/${fileId}.ogg`
    const wavDestination = `${storeDir}/${fileId}.mp3`
    const fileLink = await bot.telegram.getFileLink(fileId)

    const writestream = createWriteStream(oggDestination)
    const response = await axios({
      method: 'GET',
      url: fileLink.toString(),
      responseType: 'stream',
    })

    await new Promise(async (resolve, reject) => {
      response.data.pipe(writestream)
      writestream.on('finish', resolve)
      writestream.on('error', reject)
    })

    await new Promise((resolve, reject) => {
      ffmpeg(oggDestination)
        .format('mp3')
        .on('error', (err) => reject(err))
        .on('end', () => {
          resolve(void 0)
        })
        .save(wavDestination)
    })
    return wavDestination
  } catch (error) {
    console.error(error)
    return null
  }
}

export async function postToWhisper(openai: OpenAIApi, audioFilePath: string) {
  const transcript = await openai.createTranscription(
    createReadStream(audioFilePath) as any,
    'whisper-1',
  )
  console.log('Voice:', transcript.data.text)
  return transcript.data.text
}
