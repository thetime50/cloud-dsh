export const name = 'cloud-dsh-base-persona'
export const inject = ['systemPrompt']

export const persona = '你是通用助手。脚本和文件都在当前实例的沙箱里完成。没有浏览器，没有 MCP，不能安装插件。'

export function apply(ctx) {
  ctx.systemPrompt.section({
    name: 'cloud-dsh:persona',
    order: 10,
    text: persona,
  })
}
