import retry, { Options } from 'async-retry'
import { promises as fsPromises } from 'fs'
import { MJMessage } from 'midjourney'
import { Context, Input, Markup } from 'telegraf'
import { callbackQuery } from 'telegraf/filters'
import { InputMediaPhoto, Message, PhotoSize } from 'telegraf/typings/core/types/typegram'
import { Key, Keyboard } from 'telegram-keyboard'

import { GPTChat, GPTModel, GPTTemp } from './gpt'
import { textToSpeech } from './lib/htApi'
import { imagineIt, upscaleIt, variateIt } from './lib/midjourneyApi'
import { shortenUrl } from './lib/tinyurlApi'
import { detectLanguage, translateText } from './lib/translateApi'
import messages from './text/messages.json'
import {
  addImagine,
  detectImagine,
  extractTextFromContent,
  getDomainFromUrl,
  isEmptyObject,
  packActionData,
  removeImagine,
  splitImage,
  splitLastPipe,
  unpackActionData,
} from './utils'
import { downloadVoiceFile, pickVoice, postToWhisper } from './voice'
import { storeDir } from './bot'

export interface UserSession {
  language: string
  voice: string
  model: GPTModel
  imagines: MJMessage[]
  auth: {
    authenticated: boolean
    attempts: number
  }
}

export const defaultSession: UserSession = {
  language: 'en-US',
  voice: 'en-US-JaneNeural',
  model: (process.env.DEFAULT_OPENAI_MODEL as GPTModel) || GPTModel.GPT3,
  imagines: [],
  auth: {
    authenticated: false,
    attempts: 0,
  },
}

export enum ButtonAction {
  V1 = 'V1',
  V2 = 'V2',
  V3 = 'V3',
  V4 = 'V4',
  U1 = '1',
  U2 = '2',
  U3 = '3',
  U4 = '4',
  Speak = 'Speak',
}

export type ActionData<T> = {
  action: ButtonAction
  data: T
}

export type URLButton = {
  url: string
  descriptor: string
}

export type ParsedMessage = {
  message: string
  urls: Array<URLButton>
}

export class ChibiContext extends Context {
  private userGPT!: GPTChat
  session!: UserSession

  get userSession(): UserSession {
    if (isEmptyObject(this.session)) {
      this.session = Object.assign(this.session || {}, defaultSession)
    }
    return this.session as UserSession
  }

  get id() {
    return this.from?.id!
  }

  get language(): string {
    return this.userSession.language
  }

  set language(value: string) {
    this.userSession.language = value
  }

  get voice(): string {
    return this.userSession.voice
  }

  set voice(value: string) {
    this.userSession.voice = value
  }

  async initGpt() {
    this.userGPT = new GPTChat(this.model)
  }

  get gpt(): GPTChat {
    if (!this.userGPT) {
      this.initGpt()
    }
    return this.userGPT
  }

  get model(): GPTModel {
    return this.userSession.model as GPTModel
  }

  set model(value: GPTModel) {
    const oldSetting = this.userSession.model
    this.userSession.model = value
    if (oldSetting !== value) {
      this.initGpt()
    }
  }

  set temperature(value: GPTTemp) {
    this.gpt.model.temperature = <number>value
    const reply = `Temperature set to ${value}`
    console.log(reply)
    this.reply(reply)
  }

  get messageText(): string {
    if (this.message && 'text' in this.message) {
      const words = this.message.text.split(' ')
      return words[0].startsWith('/') ? words.slice(1).join(' ') : this.message.text
    }
    return ''
  }

  async tryAuth(password: string) {
    if ((this.userSession.auth.attempts ?? 0) >= 15) {
      return false
    }
    const isValidPassword = password === process.env.AUTH_PASSWORD
    if (!isValidPassword) {
      const currentAttempts = this.userSession.auth.attempts || 0
      this.userSession.auth.attempts = currentAttempts + 1
      return false
    }

    return (this.userSession.auth.authenticated = true)
  }

  isAuth = () => this.userSession.auth.authenticated

  async processInput() {
    if (!this.message) {
      return
    }

    if (!this.isAuth()) {
      this.reply(messages.authMessage)
      return
    }

    const m = this.message as any
    let text = m.text
    const voice = m.voice
    const photo = m.photo
    const photoFile = m.document && m.document.mime_type?.startsWith('image/')

    const stopTyping = await this.startTyping()

    if (photo) {
      text = await this.photoToText()
    }
    if (photoFile) {
      text = await this.photoFileToText()
    }
    if (voice) {
      text = await this.voiceToText()
    }
    if (text) {
      await this.processText(text)
    }

    stopTyping()
  }

  async processText(text: string) {
    if (text.startsWith('/')) {
      // dont process commands
      return
    }

    const actions: { [key: number]: () => Promise<void> } = {
      1: async () => this.reImagine(ButtonAction.V1),
      2: async () => this.reImagine(ButtonAction.V2),
      3: async () => this.reImagine(ButtonAction.V3),
      4: async () => this.reImagine(ButtonAction.V4),
    }

    const imagine = await detectImagine(text)
    if (imagine) {
      const action = actions[imagine.num]
      if (action) {
        await action()
        return
      }
      await this.imagine(imagine.prompt)
      return
    }

    await this.askGpt(text)
  }

  async processCallbacks() {
    await this.answerCbQuery()

    if (!this.has([callbackQuery('data')])) {
      return
    }

    const { action } = unpackActionData(this.callbackQuery.data)

    if (action === ButtonAction.Speak) {
      const text = (this.callbackQuery.message as Message.TextMessage).text
      console.log('Speak:', text)
      await retry(async () => this.sendVoiceToUser(text), {
        retries: 3,
      } as Options)
    }

    const variateActions = [
      ButtonAction.V1,
      ButtonAction.V2,
      ButtonAction.V3,
      ButtonAction.V4,
    ]
    const upscaleActions = [
      ButtonAction.U1,
      ButtonAction.U2,
      ButtonAction.U3,
      ButtonAction.U4,
    ]
    const includesVariate = variateActions.includes(action)
    const includesUpscale = upscaleActions.includes(action)

    if (includesVariate || includesUpscale) {
      const { data } = unpackActionData<string>(this.callbackQuery.data)
      if (includesVariate) {
        this.variate(action, data)
      }
      if (includesUpscale) {
        this.upscale(action, data)
      }
    }
  }

  async photoToText() {
    if (!this.message || !('photo' in this.message)) {
      return
    }
    const photo = this.message.photo.sort(
      (p1: any, p2: any) => p2.width - p1.width,
    )[0] as PhotoSize
    const photoUrl = await this.telegram.getFileLink(photo.file_id)
    const shortUrl = await shortenUrl(photoUrl.toString())
    const text = addImagine(`${shortUrl} ${removeImagine(this.message.caption || '')}`)
    return text
  }

  async photoFileToText() {
    if (!this.message || !('document' in this.message)) {
      return
    }
    const photoUrl = await this.telegram.getFileLink(this.message.document.file_id)
    const shortUrl = await shortenUrl(photoUrl.toString())
    const text = addImagine(`${shortUrl} ${removeImagine(this.message.caption || '')}`)
    return text
  }

  async voiceToText() {
    if (!this.message || !('voice' in this.message)) {
      return
    }
    const localFilePath = await downloadVoiceFile(this.message.voice.file_id)

    if (!localFilePath) {
      await this.reply(messages.voiceError)
      return
    }
    const text = await postToWhisper(this.gpt.openai, localFilePath)
    return text
  }

  async askGpt(text: string) {
    try {
      const response = await this.gpt.call(text)

      const lang = await detectLanguage(response)

      if (this.language != lang) {
        this.language = lang
        const voice = pickVoice(lang)
        this.voice = voice.value
        console.log(lang, voice.value)
      }

      console.log({ text, response })
      if (response) {
        this.respond(response)
      }
    } catch (error: any) {
      console.error(error)
      this.replyWithHTML(messages.gptError)
    }
  }

  parseGptResponse(messageWithUrls: string): ParsedMessage {
    const separator = '^^SEP^^'
    const urlSeparator = '^^URL^^'

    if (!messageWithUrls.includes(separator)) {
      return {
        message: messageWithUrls,
        urls: [] as URLButton[],
      }
    }

    const [message, urlSection] = messageWithUrls.split(separator)
    const urls = urlSection
      ? urlSection.split(urlSeparator).map((urlDesc) => {
          const [url, descriptor] = splitLastPipe(urlDesc)
          const domain = descriptor ? descriptor : getDomainFromUrl(url)
          return { url, descriptor: domain }
        })
      : []

    return {
      message,
      urls,
    }
  }

  async respond(text: string) {
    const { message, urls } = this.parseGptResponse(text)
    console.log({ urls })

    const inline = [] as any[]

    if (message.length > 100) {
      const speak = Markup.button.callback('🔊', ButtonAction.Speak)
      inline.push(speak)
    }

    urls.forEach((url: URLButton) => {
      const urlButton = Markup.button.url(url.descriptor, url.url)
      inline.push(urlButton)
    })

    this.reply(message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...Markup.inlineKeyboard(inline),
    })
  }

  async imagine(text: string) {
    console.log('Imagining', text)
    const msg = await imagineIt(text)
    this.postPhotoGroup(text, msg)
  }

  async upscale(action: ButtonAction, msgId: string) {
    const stopTyping = await this.startTyping()
    const num = parseInt(action.replace(/\D/g, ''))
    const image = this.userSession.imagines.find(
      (imagine: MJMessage) => imagine.id === msgId,
    )
    if (image) {
      console.log('Upscaling', num)
      const url = await upscaleIt(image, num)
      if (url) {
        await this.replyWithDocument(Input.fromURL(url))
      }
    } else {
      this.replyWithHTML(messages.imagineError)
    }

    stopTyping()
  }

  async variate(action: ButtonAction, msgId: string) {
    const stopTyping = await this.startTyping()
    const num = parseInt(action.replace(/\D/g, ''))
    const oldMsg = this.userSession.imagines.find(
      (imagine: MJMessage) => imagine.id === msgId,
    )
    if (oldMsg) {
      console.log('Variating', num)
      const msg = await variateIt(oldMsg, num)
      await this.postPhotoGroup(extractTextFromContent(oldMsg.content), msg)
    } else {
      this.replyWithHTML(messages.imagineError)
    }

    stopTyping()
  }

  async reImagine(action: ButtonAction) {
    const num = parseInt(action.replace(/\D/g, ''))
    const stopTyping = await this.startTyping()
    try {
      const text = this.messageText
      const lastImagine = this.getLastMsg()
      console.log('Upscaling', lastImagine.id, num)
      const url = await upscaleIt(lastImagine, num)
      if (url) {
        const prompt = `${url} ${text}`
        console.log('Imagining', prompt)
        const msg = await imagineIt(prompt)
        await this.postPhotoGroup(text, msg)
      }
    } finally {
      stopTyping()
    }
  }

  async postPhotoGroup(text: string, msg: MJMessage) {
    try {
      const images = await splitImage(msg.uri)
      if (!images) {
        return
      }

      const keyboard = Keyboard.make([
        [
          Key.callback(ButtonAction.V1, packActionData(ButtonAction.V1, msg.id)),
          Key.callback(ButtonAction.V2, packActionData(ButtonAction.V2, msg.id)),
          Key.callback(ButtonAction.V3, packActionData(ButtonAction.V3, msg.id)),
          Key.callback(ButtonAction.V4, packActionData(ButtonAction.V4, msg.id)),
          Key.callback(ButtonAction.U1, packActionData(ButtonAction.U1, msg.id)),
          Key.callback(ButtonAction.U2, packActionData(ButtonAction.U2, msg.id)),
          Key.callback(ButtonAction.U3, packActionData(ButtonAction.U3, msg.id)),
          Key.callback(ButtonAction.U4, packActionData(ButtonAction.U4, msg.id)),
        ],
      ])

      if (images) {
        console.log('Imagined', msg.uri)
        this.userSession.imagines.push(msg)

        const group = [
          {
            media: { source: images[0] },
            type: 'photo',
          } as InputMediaPhoto,
          {
            media: { source: images[1] },
            type: 'photo',
          } as InputMediaPhoto,
          {
            media: { source: images[2] },
            type: 'photo',
          } as InputMediaPhoto,
          {
            media: { source: images[3] },
            type: 'photo',
          } as InputMediaPhoto,
        ]

        await this.replyWithMediaGroup(group)
        await this.reply(text, keyboard.inline())
      } else {
        this.reply(messages.imagineError)
      }
    } catch (error: any) {
      console.error(error)
      this.replyWithHTML(messages.imagineError)
    }
  }

  getLastMsg() {
    return this.userSession.imagines[this.userSession.imagines.length - 1] as MJMessage
  }

  async startTyping() {
    const deleteMessage = await this.sendMessageToUser(`💬`)

    let typingInterval = setInterval(() => {
      try {
        this.sendChatAction('typing')
      } catch (error) {
        console.error(error)
        clearInterval(typingInterval)
      }
    }, 5000)

    // clear the interval after 5 minutes
    let timeout = setTimeout(() => {
      clearInterval(typingInterval)
    }, 5 * 60 * 1000)

    return () => {
      clearTimeout(timeout)
      clearInterval(typingInterval)
      deleteMessage()
    }
  }

  async sendMessageToUser(text: string) {
    const message = await this.reply(text)
    return async () => {
      try {
        await this.deleteMessage(message.message_id)
      } catch (err) {
        console.error(err)
      }
    }
  }

  async sendVoiceToUser(text: string) {
    const filename = await textToSpeech(text, this.voice, storeDir)
    if (!filename) {
      return
    }

    const fileBuffer = await fsPromises.readFile(filename)
    await this.replyWithVoice({
      source: fileBuffer,
      filename,
    })
  }

  async localizedHelp() {
    let help = messages.help.join('\n')
    if (this.language != 'en') {
      help = await translateText(help, this.language)
    }
    this.replyWithHTML(help)
  }
}
