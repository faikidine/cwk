import { ok, err } from '../shared/result.js';
import { getSynchronizationDecision, computeInitialState } from './scheduler.js';

export const FORMAT_VERSION = 1;

export const DEFAULT_CONFIG = Object.freeze({
  runtime: 'github-actions',
  intervalHours: 5,
  model: 'haiku',
  prompt: '.'
});

/**
 * The Core Engine. Owns every business rule: scheduling, project
 * lifecycle, validation, state transitions.
 *
 * It never touches the filesystem, Git, GitHub or Claude directly:
 * everything goes through the injected ports (stateStore, claudeClient,
 * runtime, clock).
 */
export class CWKEngine {
  constructor({ stateStore, claudeClient, runtime, clock, cwkVersion = '0.0.0' }) {
    this.stateStore = stateStore;
    this.claudeClient = claudeClient;
    this.runtime = runtime;
    this.clock = clock;
    this.cwkVersion = cwkVersion;
  }

  /**
   * Build an initialization plan. Nothing is written: the caller must
   * confirm, then pass the plan to applyInitialization().
   */
  async initialize({ nextPingMs, timezone, intervalHours = DEFAULT_CONFIG.intervalHours } = {}) {
    if (await this.stateStore.projectExists()) {
      return err('PROJECT_ALREADY_INITIALIZED', 'A CWK project already exists here. Run: cwk reset');
    }
    if (!Number.isFinite(nextPingMs)) {
      return err('INVALID_NEXT_PING', 'The next ping time could not be determined.');
    }
    if (!Number.isFinite(intervalHours) || intervalHours <= 0) {
      return err('INVALID_INTERVAL', 'The synchronization interval must be a positive number of hours.');
    }
    if (typeof timezone !== 'string' || timezone.length === 0) {
      return err('INVALID_TIMEZONE', 'A timezone is required.');
    }

    const now = this.clock.now();
    const metadata = {
      formatVersion: FORMAT_VERSION,
      createdAt: new Date(now).toISOString(),
      cwkVersion: this.cwkVersion
    };
    const config = { ...DEFAULT_CONFIG, intervalHours, timezone };
    const state = { ...computeInitialState({ nextPingMs, intervalHours }), updatedAt: now };

    const runtimePlan = this.runtime.plan({ config, nextPingMs });

    return ok({
      plan: {
        metadata,
        config,
        state,
        nextPingMs,
        runtime: runtimePlan,
        files: ['.cwk/metadata.json', '.cwk/config.json', '.cwk/state.json', ...runtimePlan.files]
      }
    });
  }

  /** Persist a confirmed initialization plan through the ports. */
  async applyInitialization(plan) {
    const written = await this.stateStore.writeProject(plan);
    if (!written.ok) return written;

    const installed = await this.runtime.install(plan);
    if (!installed.ok) return installed;

    return ok({ files: plan.files, runtime: plan.runtime });
  }

  async status() {
    const project = await this.loadValidProject();
    if (!project.ok) return project;

    const now = this.clock.now();
    const { metadata, config, state } = project.value;
    const decision = getSynchronizationDecision({
      now,
      lastSuccessfulPing: state.lastSuccessfulPing,
      intervalHours: config.intervalHours
    });

    return ok({ now, metadata, config, state, decision });
  }

  /**
   * The primary use case: decide whether a ping is due and, if so,
   * contact Claude and persist the new state.
   */
  async synchronize({ force = false } = {}) {
    const project = await this.loadValidProject();
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
    const saved = await this.stateStore.saveState(newState);
    if (saved && saved.ok === false) return saved;

    return ok({ action: 'PING', decision, state: newState, claude: ping.value });
  }

  /** Health check: every check explains how to fix itself. */
  async doctor() {
    const checks = [];
    const add = (name, passed, message) => checks.push({ name, ok: passed, message });

    const exists = await this.stateStore.projectExists();
    add('Project', exists, exists ? 'Project detected.' : 'No CWK project found. Run: cwk init');

    if (exists) {
      const project = await this.stateStore.loadProject();
      if (!project.ok) {
        add('Configuration', false, `${project.error.message} Run: cwk reset, then cwk init`);
      } else {
        const issues = validateProject(project.value);
        add('Configuration', !issues.config, issues.config ?? 'Configuration is valid.');
        add('State', !issues.state, issues.state ?? 'State is valid.');
        add('Format', !issues.metadata, issues.metadata ?? `Format version ${FORMAT_VERSION} supported.`);
      }

      const runtime = await this.runtime.validate();
      add('Runtime', runtime.ok, runtime.ok ? 'Runtime files present.' : `${runtime.error.message}`);
    }

    return ok({ checks, healthy: checks.every((c) => c.ok) });
  }

  /** Remove the project. The caller is responsible for confirmation. */
  async reset() {
    if (!(await this.stateStore.projectExists())) {
      return err('PROJECT_NOT_INITIALIZED', 'CWK project not initialized. Run: cwk init');
    }
    const removed = await this.stateStore.removeProject();
    if (removed && removed.ok === false) return removed;

    const uninstalled = await this.runtime.uninstall();
    if (uninstalled && uninstalled.ok === false) return uninstalled;

    return ok({ removed: true });
  }

  async loadValidProject() {
    const project = await this.stateStore.loadProject();
    if (!project.ok) return project;

    const issues = validateProject(project.value);
    const firstIssue = issues.metadata || issues.config || issues.state;
    if (firstIssue) {
      return err('PROJECT_INVALID', `${firstIssue} Run: cwk doctor`);
    }
    return project;
  }
}

export function validateProject({ metadata, config, state }) {
  const issues = {};

  if (!metadata || metadata.formatVersion !== FORMAT_VERSION) {
    issues.metadata = `Unsupported project format (expected version ${FORMAT_VERSION}).`;
  }
  if (!config || !Number.isFinite(config.intervalHours) || config.intervalHours <= 0) {
    issues.config = 'Invalid configuration: intervalHours must be a positive number.';
  } else if (typeof config.timezone !== 'string' || !config.timezone) {
    issues.config = 'Invalid configuration: timezone is missing.';
  } else if (typeof config.runtime !== 'string' || !config.runtime) {
    issues.config = 'Invalid configuration: runtime is missing.';
  }
  if (!state || !Number.isFinite(state.lastSuccessfulPing)) {
    issues.state = 'Invalid state: lastSuccessfulPing must be a timestamp.';
  }

  return issues;
}
