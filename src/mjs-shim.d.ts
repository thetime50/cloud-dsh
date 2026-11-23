declare module '*.mjs' {
  export const persona: string
  export function startMock(bindings: Record<string, {
    userId: string
    instanceIds: string[]
    llmKey?: string
  }>): Promise<{
    url: string
    close(): Promise<void>
  }>
}
