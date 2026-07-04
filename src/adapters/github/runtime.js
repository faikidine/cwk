import fs from 'node:fs/promises';
import path from 'node:path';
import { ok, err } from '../../shared/result.js';
import { createGitHubActionsWorkflow } from './workflow.js';

export const WORKFLOW_PATH = '.github/workflows/cwk.yml';

export class GitHubActionsRuntime {
  constructor({ cwd }) {
    this.cwd = cwd;
    this.name = 'github-actions';
    this.workflowFile = path.join(cwd, WORKFLOW_PATH);
  }

  /** Describe what installing this runtime will create. No writes. */
  plan({ nextPingMs }) {
    return {
      name: this.name,
      cronMinute: new Date(nextPingMs).getUTCMinutes(),
      files: [WORKFLOW_PATH],
      requirements: ['GitHub Secret: CLAUDE_OAUTH_TOKEN (a Claude Code OAuth token)']
    };
  }

  async install(plan) {
    try {
      await fs.mkdir(path.dirname(this.workflowFile), { recursive: true });
      await fs.writeFile(this.workflowFile, createGitHubActionsWorkflow({ cronMinute: plan.runtime.cronMinute }));
      return ok();
    } catch (error) {
      return err('RUNTIME_INSTALL_FAILED', `Could not write ${WORKFLOW_PATH}.`, error.message);
    }
  }

  async validate() {
    try {
      await fs.access(this.workflowFile);
      return ok();
    } catch {
      return err('WORKFLOW_FILE_MISSING', `${WORKFLOW_PATH} is missing. Run: cwk repair`);
    }
  }

  /**
   * Inspect the workflow and describe, in plain language, which parts
   * are missing or damaged. Never decides what to do about it.
   */
  async diagnose() {
    let content;
    try {
      content = await fs.readFile(this.workflowFile, 'utf8');
    } catch {
      return { ok: false, problems: [`The GitHub Actions workflow (${WORKFLOW_PATH}) is missing.`] };
    }

    const expectations = [
      [/schedule:[\s\S]*?cron:/, 'its scheduled trigger (the workflow would never run automatically)'],
      [/workflow_dispatch/, 'the manual trigger (workflow_dispatch)'],
      [/contents:\s*write/, 'write permission (state updates could not be committed)'],
      [/@anthropic-ai\/claude-code/, 'the step that installs Claude Code'],
      [/cwk ping/, 'the step that runs cwk ping'],
      [/CLAUDE_OAUTH_TOKEN/, 'the wiring of the CLAUDE_OAUTH_TOKEN secret'],
      [/state\.json[\s\S]*git push/, 'the step that commits state updates back to the repository']
    ];

    const problems = expectations
      .filter(([pattern]) => !pattern.test(content))
      .map(([, part]) => `The workflow is missing ${part}.`);

    return { ok: problems.length === 0, problems };
  }

  /**
   * Regenerate the workflow, keeping the existing cron minute when one
   * can still be read from the damaged file.
   */
  async repair({ nextPingMs }) {
    let preservedMinute;
    try {
      const content = await fs.readFile(this.workflowFile, 'utf8');
      const match = content.match(/cron:\s*'(\d{1,2}) \* \* \* \*'/);
      if (match) preservedMinute = Number(match[1]);
    } catch {
      // Nothing to preserve.
    }

    const cronMinute = preservedMinute ?? new Date(nextPingMs).getUTCMinutes();
    try {
      await fs.mkdir(path.dirname(this.workflowFile), { recursive: true });
      await fs.writeFile(this.workflowFile, createGitHubActionsWorkflow({ cronMinute }));
      return ok({
        action: preservedMinute === undefined
          ? `Regenerated ${WORKFLOW_PATH}.`
          : `Regenerated ${WORKFLOW_PATH} (kept your schedule minute ${preservedMinute}).`
      });
    } catch (error) {
      return err('RUNTIME_REPAIR_FAILED', `Could not rewrite ${WORKFLOW_PATH}.`, error.message);
    }
  }

  async uninstall() {
    try {
      await fs.rm(this.workflowFile, { force: true });
      return ok();
    } catch (error) {
      return err('RUNTIME_UNINSTALL_FAILED', `Could not remove ${WORKFLOW_PATH}.`, error.message);
    }
  }
}
