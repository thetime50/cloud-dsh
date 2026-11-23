export const name = 'cloud-dsh-rag-blank-persona'
export const inject = ['systemPrompt']

export const persona = '你是知识库应用。知识库还没有资料，不要编造出处。'

export function apply(ctx) {
  ctx.systemPrompt.section({
    name: 'cloud-dsh:persona',
    order: 10,
    text: persona,
  })
}
