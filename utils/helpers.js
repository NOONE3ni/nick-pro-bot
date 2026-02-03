import fs from 'fs-extra';

export function readJSON(path) {
  try { return fs.readJSONSync(path); } catch { return {}; }
}

export function writeJSON(path, data) {
  fs.writeJSONSync(path, data, { spaces: 2 });
                                              }
