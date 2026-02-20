import type { CustomVariable } from '@/types';

export interface RecipientVariable {
  name: string;
  label: string;
  sampleValue: string;
  icon: 'Person' | 'Building' | 'Briefcase' | 'Location';
}

export const RECIPIENT_VARIABLES: readonly RecipientVariable[] = [
  { name: 'firstName', label: 'First Name', sampleValue: 'Sarah', icon: 'Person' },
  { name: 'displayName', label: 'Display Name', sampleValue: 'Sarah Johnson', icon: 'Person' },
  { name: 'department', label: 'Department', sampleValue: 'Engineering', icon: 'Building' },
  { name: 'jobTitle', label: 'Job Title', sampleValue: 'Software Engineer', icon: 'Briefcase' },
  { name: 'officeLocation', label: 'Office Location', sampleValue: 'Building 25', icon: 'Location' },
] as const;

/** Token pattern: {{variableName}} */
const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

/** Insert a variable token at the cursor position in a textarea. */
export function insertVariableAtCursor(
  textarea: HTMLTextAreaElement,
  variableName: string,
): void {
  const token = `{{${variableName}}}`;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;

  // Build the new value with the token inserted at cursor
  const newValue = value.slice(0, start) + token + value.slice(end);

  // Use native input setter to work with React's controlled components
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  nativeInputValueSetter?.call(textarea, newValue);

  // Dispatch input event so React picks up the change
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  // Restore cursor position after the inserted token
  const newCursorPos = start + token.length;
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(newCursorPos, newCursorPos);
  });
}

/** Check if a text string contains any recipient variable tokens. */
export function hasRecipientVariables(text: string): boolean {
  const recipientNames = new Set(RECIPIENT_VARIABLES.map((v) => v.name));
  let match: RegExpExecArray | null;
  VARIABLE_PATTERN.lastIndex = 0;
  while ((match = VARIABLE_PATTERN.exec(text)) !== null) {
    if (recipientNames.has(match[1])) return true;
  }
  return false;
}

/** Get all variable names used in a text string. */
export function extractVariableNames(text: string): string[] {
  const names: string[] = [];
  let match: RegExpExecArray | null;
  VARIABLE_PATTERN.lastIndex = 0;
  while ((match = VARIABLE_PATTERN.exec(text)) !== null) {
    if (!names.includes(match[1])) {
      names.push(match[1]);
    }
  }
  return names;
}

/**
 * Check if all audiences are channel posts (Team type).
 * Recipient variables are not available for channel posts.
 */
export function allAudiencesAreChannelPosts(
  allUsers: boolean,
  audiences: { audienceType: string }[] | null | undefined,
): boolean {
  if (allUsers) return false;
  const list = audiences ?? [];
  if (list.length === 0) return false;
  return list.every((a) => a.audienceType === 'Team');
}
