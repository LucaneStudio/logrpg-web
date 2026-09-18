// Copie les fichiers du site statique dans www/ (webDir Capacitor).
// Pas de bundler : on recopie juste ce qui est servi en prod.
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const www  = join(root, 'www');

const ENTRIES = ['index.html', 'css', 'js', 'ic-logrpg-monograme.svg', 'known-bugs.json'];

// Bundles UMD des plugins Capacitor (pas de bundler dans ce projet : on copie
// directement les dist "unpkg" de chaque paquet, chargées via <script> classique).
const VENDOR = [
  ['@capacitor/core',       'dist/capacitor.js'],
  ['@capacitor/synapse',    'dist/synapse.js'],
  ['@capacitor/filesystem', 'dist/plugin.js'],
  ['@capacitor/share',      'dist/plugin.js'],
];

if (existsSync(www)) rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

for (const entry of ENTRIES) {
  cpSync(join(root, entry), join(www, entry), { recursive: true });
}

mkdirSync(join(www, 'vendor'), { recursive: true });
for (const [pkg, distFile] of VENDOR) {
  const dest = pkg.split('/')[1] + '.js';
  cpSync(join(root, 'node_modules', pkg, distFile), join(www, 'vendor', dest));
}

console.log(`[build-www] ${ENTRIES.length} entrées + ${VENDOR.length} vendor copiées vers www/`);
