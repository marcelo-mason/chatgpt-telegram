import {
  AgentExecutor,
  ChatConversationalAgent,
  ChatConversationalCreatePromptArgs,
} from 'langchain/agents'
import { LLMChain } from 'langchain/chains'
import { ChatOpenAI } from 'langchain/chat_models/openai'
import { BufferMemory, ConversationSummaryMemory } from 'langchain/memory'
import { Tool } from 'langchain/tools'
import { Configuration, OpenAIApi } from 'openai'

import PROMPTS from './text/prompts.json'
import { googleTool } from './tools/google'

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

export class GPTChat {
  public tools: Tool[] = [googleTool]
  public executor?: AgentExecutor
  public openai: OpenAIApi
  public model: ChatOpenAI
  public agent!: ChatConversationalAgent
  public memory!: ConversationSummaryMemory

  constructor(model: GPTModel) {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY!,
    })
    this.openai = new OpenAIApi(configuration)
    this.model = new ChatOpenAI(
      {
        ...OpenAIParams,
        modelName: model || GPTModel.GPT3,
        numDimensions: model == GPTModel.GPT4 ? GPTDimension.GPT4 : GPTDimension.GPT3,
      },
      configuration,
    )

    const prompt = ChatConversationalAgent.createPrompt(this.tools, {
      systemMessage: PROMPTS.system.join('\n'),
    } as ChatConversationalCreatePromptArgs)

    const llmChain = new LLMChain({
      prompt,
      llm: this.model,
    })

    this.agent = new ChatConversationalAgent({
      llmChain,
      allowedTools: this.tools.map((tool) => tool.name),
    })

    this.executor = AgentExecutor.fromAgentAndTools({
      agent: this.agent,
      tools: this.tools,
    })

    this.executor.memory = new BufferMemory({
      returnMessages: true,
      memoryKey: 'chat_history',
      inputKey: 'input',
      outputKey: 'output',
    })
    console.log('Onboarded')
  }

  public async call(input: string) {
    const response = await this.executor!.call({ input })
    return response.output
  }
}
