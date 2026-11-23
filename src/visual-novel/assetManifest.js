const BASE = 'assets/vn';

export const VN_BACKGROUNDS = Object.freeze({
  pactHall: `${BASE}/backgrounds/sala_del_pacto.png`,
  wheatPortal: `${BASE}/backgrounds/llanura_trigo_con_portal.png`,
  wheat: `${BASE}/backgrounds/llanura_trigo_sin_portal.png`,
  villageFire: `${BASE}/backgrounds/aldea_en_llamas.png`,
  forestCamp: `${BASE}/backgrounds/claro_bosque_fogata_atardecer.png`,
  school: `${BASE}/backgrounds/aula_escuela_abandonada.png`,
  limbo: `${BASE}/backgrounds/Sendero_de_la_aldea_del_limbo.png`,
  abandonedHouse: `${BASE}/backgrounds/casa_abandonada.png`,
  aurora: `${BASE}/backgrounds/aurora_boreal_nieve.png`,
  snowShelter: `${BASE}/backgrounds/refugio_improvisado_entre troncos.png`,
  snowPath: `${BASE}/backgrounds/Sendero_nevado_al_portal.png`,
  crystal: `${BASE}/backgrounds/Paramo_de_cristal_bajo_la_luna_roja.png`,
  library: `${BASE}/backgrounds/biblioteca.png`,
  bakery: `${BASE}/backgrounds/panaderia.png`,
  mountainCamp: `${BASE}/backgrounds/final.png`,
});

/** Música narrativa cargada bajo demanda por cada guion VN. */
export const VN_MUSIC = Object.freeze({
  anotherHim: 'assets/music/vn_another_him.ogg',
  confessionPiano: 'assets/music/vn_confession_piano.ogg',
  cloudOfAnxiety: 'assets/music/vn_cloud_of_anxiety.ogg',
  nightfall: 'assets/music/vn_spring_meadows_nightfall.ogg',
  youAndI: 'assets/music/vn_you_and_i.ogg',
  erosion: 'assets/music/vn_erosion.ogg',
  calamity: 'assets/music/vn_calamity.ogg',
  protectYou: 'assets/music/vn_i_will_protect_you.ogg',
  faintGlow: 'assets/music/vn_faint_glow.ogg',
  endingTitle: 'assets/music/vn_ending_title.ogg',
});

/** Efectos y ambientes narrativos; las pistas largas se cargan bajo demanda. */
export const VN_SFX = Object.freeze({
  portal: 'assets/sfx/vn/vn_portal.wav',
  villageFire: 'assets/sfx/vn/vn_village_fire_loop.ogg',
  fireExtinguish: 'assets/sfx/vn/vn_fire_extinguish.mp3',
  waterHeal: 'assets/sfx/vn/vn_water_heal.wav',
  campfire: 'assets/sfx/vn/vn_campfire_crackle.mp3',
  skeletonIdle: 'assets/sfx/vn/vn_skeleton_idle.ogg',
  portalFall: 'assets/sfx/vn/vn_portal_fall.mp3',
  leaderLaugh: 'assets/sfx/vn/vn_leader_laugh.wav',
  teleport: 'assets/sfx/vn/vn_teleport.wav',
  winterWind: 'assets/sfx/vn/vn_winter_wind.ogg',
  attackHit: 'assets/sfx/vn/vn_attack_hit.wav',
});

const CHARACTER_FILES = Object.freeze({
  aidan: {
    alegre: 'alegre.png',
    determinado: 'determinado.png',
    enojado: 'enojado.png',
    neutral: 'neutral.png',
    pensativo: 'pensativo.png',
    serio: 'serio.png',
    sorprendido: 'sorprendido.png',
    triste: 'triste.png',
  },
  aine: {
    alegre: 'alegre.png',
    avergonzada: 'avergonzada.png',
    determinada: 'determinada.png',
    llorando: 'llorando.png',
    neutral: 'neutral.png',
    preocupada: 'preocupada.png',
    sorprendida: 'sorprendida.png',
    triste: 'triste.png',
  },
  leader: {
    autoridad: 'autoridad.png',
    conjuro: 'conjuro.png',
    lectura: 'lectura.png',
    neutral: 'neutral.png',
  },
});

export const SPEAKER_CHARACTER = Object.freeze({
  aidan: 'aidan',
  aine: 'aine',
  elfa: 'aine',
  mujer: 'aine',
  'líder del pacto': 'leader',
  'líder del pacto de hiareth': 'leader',
});

const VOICES = Object.freeze({
  aidan: { key: 'vn_voice_aidan', path: `${BASE}/sfx/aidan_voice.wav` },
  aine: { key: 'vn_voice_aine', path: `${BASE}/sfx/aine_voice.wav` },
  leader: { key: 'vn_voice_leader', path: `${BASE}/sfx/leader_voice.wav` },
  morrigannus: { key: 'vn_voice_morrigannus', path: `${BASE}/sfx/morrigannus_voice.wav` },
  unknown: { key: 'vn_voice_unknown', path: `${BASE}/sfx/unknown_voice.wav` },
});

export function voiceForSpeaker(speaker) {
  const label = String(speaker ?? '').toLocaleLowerCase('es');
  if (label === 'morrigannus') return VOICES.morrigannus;
  if (label === '???') return VOICES.unknown;
  const character = characterForSpeaker(label);
  if (character === 'leader') return VOICES.leader;
  if (character === 'aine') return VOICES.aine;
  if (character === 'aidan') return VOICES.aidan;
  return null;
}

export function characterForSpeaker(speaker) {
  const label = String(speaker ?? '').toLocaleLowerCase('es');
  return SPEAKER_CHARACTER[label] ?? null;
}

export function portraitTexture(character, expression = 'neutral') {
  return `vn_${character}_${expression}`;
}

export function portraitPath(character, expression = 'neutral') {
  const file = CHARACTER_FILES[character]?.[expression];
  if (!file) return null;
  return `${BASE}/characters/${character}/${file}`;
}

export function availableExpression(character, expression) {
  return Boolean(CHARACTER_FILES[character]?.[expression]);
}

export const VN_CHARACTER_NAMES = Object.freeze(Object.keys(CHARACTER_FILES));
