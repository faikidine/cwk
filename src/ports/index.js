/**
 * Ports are the abstract interfaces the Core Engine depends on.
 * Adapters provide the concrete implementations.
 *
 * StateStore
 *   projectExists(): Promise<boolean>
 *   loadProject(): Promise<Result<{ metadata, config, state }>>
 *   loadParts(): Promise<{ metadata, config, state }> where each part is
 *     { status: "ok" | "missing" | "corrupted", path, value?, detail? }
 *   writeProject(plan): Promise<Result>
 *   savePart(key, value): Promise<Result>
 *   saveState(state): Promise<Result | void>
 *   removeProject(): Promise<Result | void>
 *
 * ClaudeClient
 *   ping({ prompt, model }): Promise<Result<{ status, output }>>
 *   status is one of: "success" | "rate_limited"
 *   (auth and unexpected failures are returned as errors)
 *
 * RuntimeAdapter
 *   name: string
 *   plan({ config, nextPingMs }): { name, files: string[], requirements: string[] }
 *   install(plan): Promise<Result>
 *   validate(): Promise<Result>
 *   diagnose(): Promise<{ ok, problems: string[] }> — natural-language findings
 *   repair({ config, nextPingMs }): Promise<Result<{ action }>>
 *   uninstall(): Promise<Result | void>
 *
 * Clock
 *   now(): number (epoch ms)
 */
export const Ports = Object.freeze({
  StateStore: 'StateStore',
  ClaudeClient: 'ClaudeClient',
  RuntimeAdapter: 'RuntimeAdapter',
  Clock: 'Clock'
});
