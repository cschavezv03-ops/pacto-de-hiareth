import introduction from './introduction.js';
import act1 from './act1.js';
import act2 from './act2.js';
import act3 from './act3.js';
import act4If from './act4-if.js';
import final from './final.js';
import { conventionalEnding, ifEndingScript } from './endings.js';
import { VN_SCENES } from '../../config/constants.js';

export const VN_SCRIPTS = Object.freeze({
  [VN_SCENES.INTRO]: introduction,
  [VN_SCENES.AFTER_ACT1]: act1,
  [VN_SCENES.AFTER_ACT2]: act2,
  [VN_SCENES.AFTER_ACT3]: act3,
  [VN_SCENES.AFTER_ACT4]: act4If,
  [VN_SCENES.BEFORE_BOSS]: final,
  [VN_SCENES.ENDING_CONVENTIONAL]: conventionalEnding,
  [VN_SCENES.ENDING_IF]: ifEndingScript,
});
