import axios from 'axios'
import sharp from 'sharp'
import { Readable } from 'stream'

import * as msgpack from '@msgpack/msgpack'

import { detectLanguage, translateText } from './lib/translateApi'
import { ActionData, ButtonAction } from './chibi'

export function capitalizeFirstLetter(s: string): string {
  if (s.startsWith('http') || s.startsWith('https')) {
    return s
  }
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}`
}

export function addImagine(text: string): string {
  if (!text.toLowerCase().startsWith('imagine ')) {
    return `Imagine ${text}`
  }
  return text
}

export function removeImagine(text: string): string {
  const words = text.split(' ')
  if (words[0].toLowerCase() === 'imagine') {
    words.shift()
  }
  return capitalizeFirstLetter(words.join(' '))
}

export function extractTextFromContent(content: string) {
  const match = content.match(/\*\*(.*?)\*\*/)
  let result = match ? match[1] : content
  result = result.replace(/<.*?>/g, '') //remove things in brackets
  result = result.replace(/(https?:\/\/[^\s]*\/?)\s/g, '') // remove urls
  return result
}

export function packActionData<T>(action: ButtonAction, data: T): string {
  const packedData = msgpack.encode(data)
  const encodedData = Buffer.from(packedData).toString('base64')
  return `${action}|${encodedData}`
}

export function unpackActionData<T>(text: string): ActionData<T> {
  const [action, encodedData] = text.split('|')
  let data = {} as T
  if (encodedData) {
    const packedData = Buffer.from(encodedData, 'base64')
    data = msgpack.decode(packedData) as T
  }
  return { action: action as ButtonAction, data }
}

function removeAccents(str: string) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export async function detectImagine(
  text: string,
): Promise<{ num: number; prompt: string } | null> {
  let words = removeAccents(text).split(' ')

  if (!words[0].toLowerCase().startsWith('imagin')) {
    const lang = await detectLanguage(text)
    if (lang !== 'en') {
      words = (await translateText(text, 'en')).split(' ')
      console.log('Translated', text, words)
    }
    if (!words[0].toLowerCase().startsWith('imagin')) {
      return null
    }
  }

  const [firstWord, secondWord, ...remainingWords] = words
  const numberMap: { [key: string]: number } = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
  }

  const num = numberMap[secondWord]
  const prompt = num ? remainingWords.join(' ') : words.slice(1).join(' ')
  const result = { num, prompt }

  return result
}

export function isEmptyObject(obj: object) {
  return !obj || (Object.entries(obj).length === 0 && obj.constructor === Object)
}

export function splitLastPipe(input: string): string[] {
  const lastPipeIndex = input.lastIndexOf('|')
  if (lastPipeIndex === -1) {
    return [input]
  }
  const part1 = input.slice(0, lastPipeIndex)
  const part2 = input.slice(lastPipeIndex + 1)
  return [part1, part2]
}

export function getDomainFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url)
    const domain = parsedUrl.hostname
    return domain.startsWith('www.') ? domain.slice(4) : domain
  } catch (err) {
    console.error(`Error parsing URL: ${url}`)
    return url
  }
}

export const splitImage = async (url: string) => {
  try {
    const { data } = await axios.get(url, { responseType: 'arraybuffer' })

    const image = sharp(data)
    const metadata = await image.metadata()

    const width = Math.floor(metadata.width ? metadata.width / 2 : 0)
    const height = Math.floor(metadata.height ? metadata.height / 2 : 0)

    const createPart = (left: number, top: number) =>
      sharp(data).extract({ left, top, width, height }).toBuffer()

    const parts = [
      createPart(0, 0),
      createPart(width, 0),
      createPart(0, height),
      createPart(width, height),
    ]

    const buffers = await Promise.all(parts)

    const createReadableStream = (buffer: any) => {
      const readable = new Readable()
      readable.push(buffer)
      readable.push(null)
      return readable
    }

    return buffers.map(createReadableStream)
  } catch (e) {
    console.error(e)
    return null
  }
}
