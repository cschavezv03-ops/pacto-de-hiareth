export const n = (text) => ({ type: 'narration', text });
export const a = (text) => ({ type: 'action', text });
export const d = (speaker, text, expression = null) => ({
  type: 'dialogue', speaker, text, ...(expression ? { expression } : {}),
});
export const bg = (key, options = {}) => ({ type: 'background', key, ...options });
export const show = (character, expression = 'neutral', position = null) => ({ type: 'showCharacter', character, expression, position });
export const hide = (character) => ({ type: 'hideCharacter', character });
export const expression = (character, value) => ({ type: 'setExpression', character, expression: value });
export const music = (key, options = {}) => ({ type: 'music', key, ...options });
export const stopMusic = (fadeMs = 700) => ({ type: 'stopMusic', fadeMs });
export const sfx = (key, options = {}) => ({ type: 'sfx', key, ...options });
export const ambience = (key, options = {}) => ({ type: 'ambience', key, ...options });
export const stopAmbience = (key = null, fadeMs = 650) => ({ type: 'stopAmbience', key, fadeMs });

