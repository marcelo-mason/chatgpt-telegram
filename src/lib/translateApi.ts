import Translate from '@google-cloud/translate'
import { DetectResult } from '@google-cloud/translate/build/src/v2'

const translate = new Translate.v2.Translate({
  key: process.env.GOOGLE_API_KEY,
})

export async function translateText(text: string, targetLang: string) {
  try {
    const translations = await translate.translate(text, targetLang)
    return translations[0]
  } catch (e) {
    console.error(e)
  }
  return text
}

export async function detectLanguage(text: string) {
  try {
    const results = await translate.detect(text)
    let detection = results[0] as DetectResult
    if (detection) {
      return detection.language
    }
  } catch (e) {
    console.error(e)
  }
  return 'en'
}
