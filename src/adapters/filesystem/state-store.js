import fs from 'node:fs/promises';
import path from 'node:path';
import { ok, err } from '../../shared/result.js';

export class FileSystemStateStore {
  constructor({ cwd }) {
    this.cwd = cwd;
    this.cwkDir = path.join(cwd, '.cwk');
  }

  async loadProject() {
    try {
      const [metadataRaw, configRaw, stateRaw] = await Promise.all([
        fs.readFile(path.join(this.cwkDir, 'metadata.json'), 'utf8'),
        fs.readFile(path.join(this.cwkDir, 'config.json'), 'utf8'),
        fs.readFile(path.join(this.cwkDir, 'state.json'), 'utf8')
      ]);
      return ok({
        metadata: JSON.parse(metadataRaw),
        config: JSON.parse(configRaw),
        state: JSON.parse(stateRaw)
      });
    } catch (error) {
      return err('PROJECT_NOT_INITIALIZED', 'CWK project not initialized. Run: cwk init', error.message);
    }
  }

  async saveState(state) {
    await fs.writeFile(path.join(this.cwkDir, 'state.json'), JSON.stringify(state, null, 2) + '\n');
  }
}
