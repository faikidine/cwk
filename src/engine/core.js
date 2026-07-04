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
        add('Configuration', false, `${project.error.message} Run: cwk repair`);
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

  /**
   * Fix what doctor complains about, without a reset. Every valid
   * value is preserved; only broken files are rewritten. Returns the
   * list of repairs in natural language.
   */
  async repair({ timezone } = {}) {
    const parts = await this.stateStore.loadParts();
    const everythingMissing = Object.values(parts).every((part) => part.status === 'missing');
    if (everythingMissing) {
      return err('PROJECT_NOT_INITIALIZED', 'There is nothing to repair: no CWK project exists here. Run: cwk init');
    }

    const now = this.clock.now();
    const repairs = [];

    const brokenFile = (part) => (part.status === 'missing'
      ? `${part.path} was missing.`
      : `${part.path} contained unreadable JSON.`);

    // metadata: identity of the project. The creation date cannot be
    // recovered, everything else can be rebuilt.
    let metadata = asObject(parts.metadata);
    if (!metadata) {
      metadata = { formatVersion: FORMAT_VERSION, createdAt: new Date(now).toISOString(), cwkVersion: this.cwkVersion };
      repairs.push({
        name: 'Metadata',
        problem: brokenFile(parts.metadata),
        action: 'Recreated it. The original creation date could not be recovered.'
      });
      await this.stateStore.savePart('metadata', metadata);
    } else if (metadata.formatVersion !== FORMAT_VERSION) {
      const old = metadata.formatVersion;
      metadata = { ...metadata, formatVersion: FORMAT_VERSION, cwkVersion: this.cwkVersion };
      repairs.push({
        name: 'Metadata',
        problem: `The project declared format version ${JSON.stringify(old)}, which this version of CWK does not support.`,
        action: `Set the format version to ${FORMAT_VERSION}. Everything else was preserved.`
      });
      await this.stateStore.savePart('metadata', metadata);
    }

    // config: fix invalid fields one by one, keep every valid one.
    const existingConfig = asObject(parts.config);
    const config = { ...DEFAULT_CONFIG, timezone: timezone || 'UTC', ...(existingConfig ?? {}) };
    const fieldFixes = [];
    if (!Number.isFinite(config.intervalHours) || config.intervalHours <= 0) {
      config.intervalHours = DEFAULT_CONFIG.intervalHours;
      fieldFixes.push(`intervalHours was invalid and was restored to ${DEFAULT_CONFIG.intervalHours} hours`);
    }
    if (typeof config.timezone !== 'string' || !config.timezone) {
      config.timezone = timezone || 'UTC';
      fieldFixes.push(`timezone was missing and was set to ${config.timezone}`);
    }
    if (typeof config.runtime !== 'string' || !config.runtime) {
      config.runtime = DEFAULT_CONFIG.runtime;
      fieldFixes.push(`runtime was missing and was set to ${DEFAULT_CONFIG.runtime}`);
    }
    if (typeof config.model !== 'string' || !config.model) {
      config.model = DEFAULT_CONFIG.model;
      fieldFixes.push(`model was missing and was set to ${DEFAULT_CONFIG.model}`);
    }
    if (typeof config.prompt !== 'string' || !config.prompt) {
      config.prompt = DEFAULT_CONFIG.prompt;
      fieldFixes.push(`prompt was missing and was set to "${DEFAULT_CONFIG.prompt}"`);
    }
    if (!existingConfig) {
      repairs.push({
        name: 'Configuration',
        problem: brokenFile(parts.config),
        action: `Rebuilt it with the defaults (every ${config.intervalHours} hours, timezone ${config.timezone}, model ${config.model}).`
      });
      await this.stateStore.savePart('config', config);
    } else if (fieldFixes.length > 0) {
      repairs.push({
        name: 'Configuration',
        problem: `Some configuration values were invalid: ${fieldFixes.join('; ')}.`,
        action: 'All other settings were preserved.'
      });
      await this.stateStore.savePart('config', config);
    }

    // state: a lost schedule cannot be recovered. Fall back to "last
    // ping = now" so the next ping happens one full interval from now,
    // and never contact Claude without being asked.
    const existingState = asObject(parts.state);
    let state = existingState;
    if (!state || !Number.isFinite(state.lastSuccessfulPing)) {
      state = { ...(existingState ?? {}), lastSuccessfulPing: now, updatedAt: now };
      repairs.push({
        name: 'State',
        problem: existingState
          ? 'The recorded last ping was not a valid timestamp, so the schedule was lost.'
          : brokenFile(parts.state),
        action: `Restarted the schedule from now: next ping in ${config.intervalHours} hours. Run cwk ping --force if you want to open a window immediately.`
      });
      await this.stateStore.savePart('state', state);
    }

    // runtime: the adapter says what is broken, the engine decides to fix it.
    const diagnosis = await this.runtime.diagnose();
    if (!diagnosis.ok) {
      const { nextPingMs } = getSynchronizationDecision({
        now,
        lastSuccessfulPing: state.lastSuccessfulPing,
        intervalHours: config.intervalHours
      });
      const repaired = await this.runtime.repair({ config, nextPingMs });
      if (!repaired.ok) return repaired;
      repairs.push({
        name: 'Runtime',
        problem: diagnosis.problems.join(' '),
        action: repaired.value.action
      });
    }

    return ok({ repairs, repaired: repairs.length > 0 });
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

function asObject(part) {
  if (part.status !== 'ok') return null;
  const { value } = part;
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
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
