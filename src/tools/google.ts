import google from 'googlethis'
import { DynamicTool } from 'langchain/tools'

import PROMPTS from '../text/prompts.json'

export const googleTool = new DynamicTool({
  name: 'Google Search Tool',
  description: PROMPTS.googleTool.description,
  func: async (searchPhrase: string) => {
    try {
      const response = await google.search(searchPhrase, {
        page: 0,
        safe: false,
        parse_ads: false,
      })

      const result = {
        results: response.results,
        featured: response.featured_snippet,
      }
      console.log(result)
      return JSON.stringify(result)
    } catch (error) {
      console.error(error)
      return PROMPTS.googleTool.failed
    }
  },
})
