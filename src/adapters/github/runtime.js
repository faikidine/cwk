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
      return err('WORKFLOW_FILE_MISSING', `${WORKFLOW_PATH} is missing. Run: cwk reset, then cwk init`);
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
