import { MJMessage } from 'midjourney'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

export const storeDir = process.env.STORE_LOCATION || './store'
export const sessionFile = join(storeDir, 'session.json')

if (!existsSync(storeDir)) {
  mkdirSync(storeDir)
}

export enum GPTModel {
  GPT3 = 'gpt-3.5-turbo',
  GPT4 = 'gpt-4',
}

export enum GPTDimension {
  GPT3 = 768,
  GPT4 = 4096,
}

export enum GPTTemp {
  FOCUSED = 0.25,
  BALANCED = 0.5,
  INVENTIVE = 0.75,
  CREATIVE = 1.0,
}

export const OpenAIParams = {
  verbose: false,
  temperature: GPTTemp.INVENTIVE,
  maxConcurrency: 1,
  maxTokens: 2048,
  maxRetries: 2,
}

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

export interface Voice {
  value: string
  name: string
  languageCode: string
  gender: string
}
