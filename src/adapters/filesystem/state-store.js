import fs from 'node:fs/promises';
import path from 'node:path';
import { ok, err } from '../../shared/result.js';

const FILES = {
  metadata: 'metadata.json',
  config: 'config.json',
  state: 'state.json'
};

export class FileSystemStateStore {
  constructor({ cwd }) {
    this.cwd = cwd;
    this.cwkDir = path.join(cwd, '.cwk');
  }

  async projectExists() {
    try {
      await fs.access(path.join(this.cwkDir, FILES.metadata));
      return true;
    } catch {
      return false;
    }
  }

  async loadProject() {
    const project = {};
    for (const [key, file] of Object.entries(FILES)) {
      const filePath = path.join(this.cwkDir, file);
      let raw;
      try {
        raw = await fs.readFile(filePath, 'utf8');
      } catch {
        return err('PROJECT_NOT_INITIALIZED', 'CWK project not initialized. Run: cwk init', `Missing ${path.join('.cwk', file)}`);
      }
      try {
        project[key] = JSON.parse(raw);
      } catch (error) {
        return err('PROJECT_CORRUPTED', `Could not parse ${path.join('.cwk', file)}.`, error.message);
      }
    }
    return ok(project);
  }

  /**
   * Read each project file independently, so a broken file does not
   * hide the healthy ones. Used by repair.
   */
  async loadParts() {
    const parts = {};
    for (const [key, file] of Object.entries(FILES)) {
      const relPath = path.join('.cwk', file);
      let raw;
      try {
        raw = await fs.readFile(path.join(this.cwkDir, file), 'utf8');
      } catch {
        parts[key] = { status: 'missing', path: relPath };
        continue;
      }
      try {
        parts[key] = { status: 'ok', path: relPath, value: JSON.parse(raw) };
      } catch (error) {
        parts[key] = { status: 'corrupted', path: relPath, detail: error.message };
      }
    }
    return parts;
  }

  async savePart(key, value) {
    const file = FILES[key];
    try {
      await fs.mkdir(this.cwkDir, { recursive: true });
      await writeJson(path.join(this.cwkDir, file), value);
      return ok();
    } catch (error) {
      return err('PROJECT_WRITE_FAILED', `Could not write ${path.join('.cwk', file)}.`, error.message);
    }
  }

  async writeProject({ metadata, config, state }) {
    try {
      await fs.mkdir(this.cwkDir, { recursive: true });
      await writeJson(path.join(this.cwkDir, FILES.metadata), metadata);
      await writeJson(path.join(this.cwkDir, FILES.config), config);
      await writeJson(path.join(this.cwkDir, FILES.state), state);
      return ok();
    } catch (error) {
      return err('PROJECT_WRITE_FAILED', 'Could not write project files.', error.message);
    }
  }

  async saveState(state) {
    try {
      await writeJson(path.join(this.cwkDir, FILES.state), state);
      return ok();
    } catch (error) {
      return err('STATE_WRITE_FAILED', 'Could not write .cwk/state.json.', error.message);
    }
  }

  async removeProject() {
    try {
      await fs.rm(this.cwkDir, { recursive: true, force: true });
      return ok();
    } catch (error) {
      return err('PROJECT_REMOVE_FAILED', 'Could not remove .cwk/.', error.message);
    }
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + '\n');
}
