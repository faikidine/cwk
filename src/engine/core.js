import { ok, err } from '../shared/result.js';
import { getSynchronizationDecision } from './scheduler.js';

export class CWKEngine {
  constructor({ stateStore, claudeClient, clock }) {
    this.stateStore = stateStore;
    this.claudeClient = claudeClient;
    this.clock = clock;
  }

  async status() {
    const project = await this.stateStore.loadProject();
    if (!project.ok) return project;

    const now = this.clock.now();
    const { config, state } = project.value;
    const decision = getSynchronizationDecision({
      now,
      lastSuccessfulPing: state.lastSuccessfulPing,
      intervalHours: config.intervalHours
    });

    return ok({ now, config, state, decision });
  }

  async synchronize({ force = false } = {}) {
    const project = await this.stateStore.loadProject();
    if (!project.ok) return project;

    const now = this.clock.now();
    const { config, state } = project.value;
    const decision = getSynchronizationDecision({
      now,
      lastSuccessfulPing: state.lastSuccessfulPing,
      intervalHours: config.intervalHours
    });

    if (!force && decision.action === 'WAIT') {
      return ok({ action: 'WAIT', decision });
    }

    const ping = await this.claudeClient.ping({ prompt: config.prompt, model: config.model });
    if (!ping.ok) return ping;

    const newState = { ...state, lastSuccessfulPing: now, updatedAt: now };
    await this.stateStore.saveState(newState);
    return ok({ action: 'PING', state: newState, claude: ping.value });
  }
}

export function createNotInitializedError() {
  return err('PROJECT_NOT_INITIALIZED', 'CWK project not initialized. Run: cwk init');
}
