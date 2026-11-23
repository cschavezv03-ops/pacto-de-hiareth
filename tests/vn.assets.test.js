import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, relative, isAbsolute } from 'node:path';
import { VN_SCENES } from '../src/config/constants.js';
import { BACKGROUNDS } from '../src/config/assets.js';
import { VN_SCRIPTS } from '../src/visual-novel/dialogue/index.js';
import {
  VN_BACKGROUNDS, VN_MUSIC, VN_SFX, VN_CHARACTER_NAMES,
  characterForSpeaker, portraitPath, voiceForSpeaker,
} from '../src/visual-novel/assetManifest.js';

// Solo módulos puros: no importar escenas ni Phaser en Node.
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
function file(path, label) {
  assert.equal(typeof path, 'string', `${label}: falta en el manifiesto`);
  assert.ok(path.length, `${label}: ruta vacía`);
  const absolute = resolve(publicRoot, decodeURIComponent(path.replace(/^\/+/, '')));
  const rel = relative(publicRoot, absolute);
  assert.ok(!rel.startsWith('..') && !isAbsolute(rel), `${label}: fuera de public/`);
  assert.ok(statSync(absolute).isFile(), `${label}: no es un archivo (${path})`);
}
function entry(manifest, key, label) {
  assert.ok(Object.hasOwn(manifest, key), `${label}: ${key} no existe en el manifiesto`);
  file(manifest[key], `${label}:${key}`);
}
function portrait(character, expression = 'neutral') {
  assert.ok(VN_CHARACTER_NAMES.includes(character), `personaje desconocido: ${character}`);
  file(portraitPath(character, expression), `retrato ${character}:${expression}`);
}

test('VN_SCRIPTS cubre exactamente VN_SCENES', () => {
  assert.deepEqual(Object.keys(VN_SCRIPTS).sort(), Object.values(VN_SCENES).sort());
});

for (const [id, commands] of Object.entries(VN_SCRIPTS)) {
  test(`${id}: todos los comandos y recursos referenciados existen`, () => {
    assert.ok(Array.isArray(commands) && commands.length > 0);
    const failures = [];
    commands.forEach((command, index) => {
      try {
        switch (command.type) {
          case 'background': {
            if (command.key.startsWith('gameplay:')) {
              const key = command.key.slice('gameplay:'.length);
              assert.ok(Object.hasOwn(BACKGROUNDS, key), `fondo gameplay desconocido: ${key}`);
              const { folder, files } = BACKGROUNDS[key];
              assert.ok(files.length > 0, `fondo sin capas: ${key}`);
              // Mismo formato de ruta que PreloadScene; BACKGROUNDS es su manifiesto.
              for (const layer of files) file(`assets/bg/${folder}/${layer}.png`, command.key);
            } else entry(VN_BACKGROUNDS, command.key, 'fondo');
            break;
          }
          case 'showCharacter':
            portrait(command.character, command.expression ?? 'neutral');
            break;
          case 'setExpression':
            assert.equal(typeof command.expression, 'string');
            portrait(command.character, command.expression);
            break;
          case 'hideCharacter':
            assert.ok(VN_CHARACTER_NAMES.includes(command.character), `personaje desconocido: ${command.character}`);
            break;
          case 'dialogue': {
            const character = characterForSpeaker(command.speaker);
            if (character) portrait(character, command.expression ?? 'neutral');
            const voice = voiceForSpeaker(command.speaker);
            assert.ok(voice?.key, `voz no declarada: ${command.speaker}`);
            file(voice.path, `voz ${command.speaker}`);
            assert.equal(typeof command.text, 'string');
            break;
          }
          case 'music': entry(VN_MUSIC, command.key, 'música'); break;
          case 'sfx':
          case 'ambience': entry(VN_SFX, command.key, command.type); break;
          case 'stopAmbience':
            if (command.key != null) entry(VN_SFX, command.key, 'stopAmbience');
            break;
          case 'stopMusic': break;
          case 'narration':
          case 'action': assert.equal(typeof command.text, 'string'); break;
          default: assert.fail(`comando desconocido: ${command.type}`);
        }
      } catch (error) {
        failures.push(`${id}[${index}] ${JSON.stringify(command)}: ${error.message}`);
      }
    });
    assert.equal(failures.length, 0, failures.join('\n'));
  });
}
