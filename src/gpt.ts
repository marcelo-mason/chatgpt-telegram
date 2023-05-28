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

import { GPTDimension, GPTModel, OpenAIParams } from './common'
import PROMPTS from './text/prompts.json'
import { googleTool } from './tools/google'

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
      systemMessage: PROMPTS.system.join(' '),
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
