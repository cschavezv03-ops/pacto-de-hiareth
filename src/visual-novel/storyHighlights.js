const IMPORTANT_WORDS = new Set([
  'lia', 'fail', 'hiareth', 'hiraeth', 'morrigannus', 'portal', 'portales',
  'ritual', 'fuego', 'pacto', 'dios', 'piedra', 'fragmento',
]);

const VIOLENCE_WORDS = new Set([
  'mata', 'matas', 'mato', 'mate', 'maten', 'matemos', 'matamos', 'matan',
  'matado', 'matada', 'matados', 'matadas', 'matando', 'mataste', 'matastes',
  'matalo', 'matala', 'matalos', 'matalas', 'matarnos', 'matarnos', 'matasteis',
  'mataran', 'matara', 'mataria', 'matarias', 'matariamos', 'matarian', 'mataras',
  'asesinato', 'asesinar', 'asesinarlo', 'asesinarla', 'asesinarlos', 'asesinarlas',
  'asesinaron', 'asesinado', 'asesinada', 'asesinados', 'asesinadas', 'asesina',
  'asesinan', 'asesine', 'asesinaría', 'asesinaria', 'asesinó', 'asesino',
  'morir', 'morirse', 'moriria', 'moririas', 'moririamos', 'moririan', 'morira',
  'moriras', 'moria', 'morias', 'morian', 'muere', 'mueren', 'mueras', 'muera',
  'muera', 'muerto', 'muerta', 'muertos', 'muertas', 'muerte', 'muertes',
  'murio', 'murieron', 'muriera', 'murieras', 'murieramos', 'muriendo', 'muramos',
]);

export function normalizeWord(word) {
  return String(word ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es');
}

export function isStoryKeyword(word) {
  const normalized = normalizeWord(word);
  return IMPORTANT_WORDS.has(normalized) || VIOLENCE_WORDS.has(normalized)
    || normalized.startsWith('mata')
    || normalized.startsWith('mate')
    || normalized.startsWith('matad')
    || normalized.startsWith('matem')
    || normalized.startsWith('mato')
    || normalized.startsWith('matar')
    || normalized.startsWith('asesin')
    || normalized.startsWith('morir')
    || normalized.startsWith('muer')
    || normalized.startsWith('muri');
}

/** Divides text into consecutive colored runs while preserving every source character. */
export function splitStoryRuns(text) {
  const tokens = String(text ?? '').match(/\p{L}+|[^\p{L}]+/gu) ?? [];
  const runs = [];
  tokens.forEach((token) => {
    const highlighted = /^\p{L}+$/u.test(token) && isStoryKeyword(token);
    const previous = runs[runs.length - 1];
    if (previous && previous.highlighted === highlighted) previous.text += token;
    else runs.push({ text: token, highlighted });
  });
  return runs;
}
