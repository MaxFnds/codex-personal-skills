import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const collection = path.join(root, 'skills');
const legacy = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'skills');
const modern = path.join(os.homedir(), '.agents', 'skills');
const [action, customPath] = process.argv.slice(2);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const blocked = /^(?:\.env(?:\..*)?|auth\.json|credentials(?:\..*)?|id_rsa|id_ed25519|.*\.(?:pem|key|p12|pfx))$/i;

function files(dir) {
  if (fs.lstatSync(dir).isSymbolicLink()) throw Error(`Link nao permitido: ${dir}`);
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw Error(`Link nao permitido: ${file}`);
    if (['.git', '.system', 'node_modules', '__pycache__'].includes(entry.name)) return [];
    if (blocked.test(entry.name)) throw Error(`Arquivo sensivel bloqueado: ${file}`);
    if (entry.isDirectory()) return files(file);
    if (!entry.isFile()) throw Error(`Tipo de arquivo nao suportado: ${file}`);
    const text = fs.readFileSync(file, 'utf8');
    if (/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-(?:proj-)?[A-Za-z0-9_-]{40,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text)) {
      throw Error(`Possivel credencial em ${file}; revise antes de copiar.`);
    }
    return [file];
  });
}

function skillDirs(base) {
  if (!fs.existsSync(base)) return [];
  if (fs.lstatSync(base).isSymbolicLink()) throw Error(`Raiz com link nao permitida: ${base}`);
  return fs.readdirSync(base, { withFileTypes: true }).filter(entry => {
    if (entry.name.startsWith('.')) return false;
    if (entry.isSymbolicLink()) throw Error(`Skill com link: ${entry.name}`);
    return entry.isDirectory() && fs.existsSync(path.join(base, entry.name, 'SKILL.md'));
  }).map(entry => path.join(base, entry.name));
}

function copyFile(source, destination) {
  // Never follow a destination symlink, including any ancestor.
  for (let current = destination; ; current = path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw Error(`Destino com link: ${current}`);
    if (path.dirname(current) === current) break;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  if (hash(source) !== hash(destination)) throw Error(`Copia divergente: ${destination}`);
}

function saveManifest() {
  const entries = files(collection).map(file => ({ path: path.relative(collection, file).replaceAll('\\', '/'), sha256: hash(file) }));
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ skills: skillDirs(collection).length, files: entries }, null, 2) + '\n');
}

function verify() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const actual = files(collection);
  if (actual.length !== manifest.files.length) throw Error('Quantidade de arquivos divergente do manifesto.');
  const seen = new Set();
  for (const item of manifest.files) {
    const file = path.resolve(collection, item.path);
    if (!file.startsWith(collection + path.sep) || seen.has(file)) throw Error('Caminho invalido no manifesto.');
    seen.add(file);
    if (!fs.existsSync(file) || hash(file) !== item.sha256) throw Error(`Integridade divergente: ${item.path}`);
  }
  console.log(`Verificado: ${skillDirs(collection).length} skills, ${actual.length} arquivos.`);
}

try {
  if (action === 'export') {
    const bases = customPath ? [path.resolve(customPath)] : [...new Set([legacy, modern])];
    const selected = new Map();
    for (const base of bases) {
      for (const dir of skillDirs(base)) {
        const name = path.basename(dir);
        if (selected.has(name)) throw Error(`Skill duplicada em duas origens: ${name}. Informe uma origem explicita.`);
        selected.set(name, dir);
      }
    }
    if (!selected.size) throw Error('Nenhuma skill pessoal encontrada.');
    const copies = [];
    for (const [name, dir] of selected) {
      for (const file of files(dir)) copies.push([file, path.join(collection, name, path.relative(dir, file))]);
    }
    for (const base of bases) {
      const schema = path.join(base, 'schema.json');
      if (fs.existsSync(schema)) {
        if (fs.lstatSync(schema).isSymbolicLink()) throw Error('schema.json nao pode ser link.');
        copies.push([schema, path.join(collection, 'schema.json')]);
      }
    }
    for (const [source, destination] of copies) copyFile(source, destination);
    saveManifest();
    verify();
    console.log('Exportado. Revise git diff; depois git add skills manifest.json, git commit e git push.');
  } else if (action === 'install') {
    verify();
    const destination = path.resolve(customPath || (fs.existsSync(legacy) ? legacy : modern));
    if (destination === collection || destination.startsWith(collection + path.sep)) throw Error('Destino deve ficar fora do backup.');
    // Refuse differing existing files; no local customization is overwritten.
    const copies = files(collection).map(file => [file, path.join(destination, path.relative(collection, file))]);
    for (const [source, target] of copies) {
      for (let current = target; ; current = path.dirname(current)) {
        if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw Error(`Destino com link: ${current}`);
        if (path.dirname(current) === current) break;
      }
      if (fs.existsSync(target) && hash(source) !== hash(target)) throw Error(`Conflito local: ${target}. Preserve sua copia e resolva antes de instalar.`);
    }
    for (const [source, target] of copies) copyFile(source, target);
    console.log(`Skills instaladas em ${destination}. Se nao aparecerem, reinicie o Codex.`);
  } else if (action === 'verify') {
    verify();
  } else {
    throw Error('Uso: node skills.mjs install [destino] | export [origem] | verify');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
