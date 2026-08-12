/**
 * Supported source extensions, mirroring the backend registry (frontend-ui §6).
 * Used as a client-side pre-filter at drop time.
 */
export const SUPPORTED_EXTENSIONS = [
  'pdf',
  'docx',
  'pptx',
  'xlsx',
  'epub',
  'html',
  'htm',
  'md',
  'markdown',
  'txt',
  'json',
  'csv',
  'xml',
  'yaml',
  'yml',
  'py',
  'js',
  'ts',
  'jsx',
  'tsx',
  'zip',
  'tar',
  'gz',
  'tgz',
  'bz2',
  'odt',
  'ods',
  'odp',
  'rtf',
  'msg',
  'eml',
  'azw3',
  'azw4',
  'srt',
  'vtt',
  'tex',
  'ipynb',
  'mdx',
] as const;

/** Lowercased extension of a file name, or '' when none. */
export function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** True when the file name's extension is in the supported list. */
export function isSupported(
  name: string,
  supportedList: readonly string[] = SUPPORTED_EXTENSIONS,
): boolean {
  return supportedList.includes(extOf(name));
}
