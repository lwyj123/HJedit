import Quill from './core';

import Image from './formats/image';

import Toolbar from './modules/toolbar';

import Icons from './ui/icons';

import Tooltip from './ui/tooltip';

import SnowTheme from './themes/snow';


Quill.register({

  'formats/image': Image,

  'modules/toolbar': Toolbar,

  'themes/snow': SnowTheme,

  'ui/icons': Icons,
  'ui/tooltip': Tooltip
}, true);


module.exports = Quill;
