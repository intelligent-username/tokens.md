/**
 * Single source of copy for the tokens.md web workbench.
 * Modularized domain exports with backwards-compatible default copy object.
 */

export * from './copy/controls';
export * from './copy/dropzone';
export * from './copy/workspaces';
export * from './copy/messages';

import * as controls from './copy/controls';
import * as dropzone from './copy/dropzone';
import * as workspaces from './copy/workspaces';
import * as messages from './copy/messages';

const copy = {
  ...controls,
  ...dropzone,
  ...workspaces,
  ...messages,
};

export default copy;