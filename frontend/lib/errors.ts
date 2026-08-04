import * as copy from './copy';

/**
 * Error-kind → surfacing-level triage (ux-flows §5.1).
 * Systemic → banner; job-level → inline; per-item → row; transient → toast.
 * Never more than one level for the same failure.
 */

export type ErrorKind =
  | 'unsupported_format'
  | 'missing_dependency'
  | 'too_large'
  | 'not_found'
  | 'network'
  | 'clipboard_blocked'
  | 'budget_cannot_fit'
  | 'unknown';

export type ErrorLevel = 'banner' | 'inline' | 'row' | 'toast';

/** Structured error body the backend returns (ux-flows §5.2). */
export interface ErrorBody {
  error: string;
  message: string;
  exit_code?: number;
  file?: string;
}

export interface TriageResult {
  level: ErrorLevel;
  message: string;
  nextStep: string;
}

/** Map a backend error name (e.g. "UnsupportedFormatError") to an ErrorKind. */
export function classifyError(error: string): ErrorKind {
  const name = error.toLowerCase();
  if (name.includes('unsupportedformat')) return 'unsupported_format';
  if (name.includes('missingdependency')) return 'missing_dependency';
  if (name.includes('toolarge') || name.includes('payload')) return 'too_large';
  if (name.includes('notfound') || name.includes('disappeared')) return 'not_found';
  if (name.includes('network') || name.includes('connection')) return 'network';
  if (name.includes('clipboard')) return 'clipboard_blocked';
  if (name.includes('budget') || name.includes('cannotfit')) return 'budget_cannot_fit';
  return 'unknown';
}

/**
 * Map an error kind to its surfacing level, message, and next step.
 * `message` (backend verbatim) wins when provided; otherwise a kind fallback.
 * `file` is used for per-item messages.
 */
export function triageError(
  kind: ErrorKind,
  message?: string,
  file?: string,
): TriageResult {
  switch (kind) {
    case 'unsupported_format':
      return {
        level: 'row',
        message: message ?? copy.unsupportedFormat(file ?? ''),
        nextStep: copy.nextStepRemoveFile,
      };
    case 'missing_dependency':
      return {
        level: 'banner',
        message: message ?? copy.missingDependency,
        nextStep: copy.nextStepRetryReinstall,
      };
    case 'too_large':
      return {
        level: 'toast',
        message: message ?? copy.tooLargeFile,
        nextStep: copy.nextStepRemoveFile,
      };
    case 'not_found':
      return {
        level: 'row',
        message: message ?? (file ? copy.fileDisappeared : copy.fetchFailed),
        nextStep: copy.nextStepRetry,
      };
    case 'network':
      return {
        level: 'toast',
        message: message ?? copy.connectionLost,
        nextStep: copy.nextStepRetry,
      };
    case 'clipboard_blocked':
      return {
        level: 'inline',
        message: message ?? copy.clipBlocked,
        nextStep: copy.nextStepCopyManually,
      };
    case 'budget_cannot_fit':
      return {
        level: 'inline',
        message: message ?? copy.budgetOver,
        nextStep: copy.nextStepRaiseCeiling,
      };
    case 'unknown':
    default:
      return {
        level: 'row',
        message: message ?? copyWithFile(copy.conversionFailed, file),
        nextStep: copy.nextStepRetry,
      };
  }
}

function copyWithFile(template: (name: string) => string, file?: string): string {
  return file ? template(file) : template('{name}');
}