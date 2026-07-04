/**
 * Ports are the abstract interfaces the Core Engine depends on.
 * Adapters provide the concrete implementations.
 *
 * StateStore
 *   projectExists(): Promise<boolean>
 *   loadProject(): Promise<Result<{ metadata, config, state }>>
 *   writeProject(plan): Promise<Result>
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
