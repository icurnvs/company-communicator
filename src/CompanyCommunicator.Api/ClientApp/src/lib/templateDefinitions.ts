// lib/templateDefinitions.ts
import type { TemplateDefinition, SlotDefinition } from '@/types';

// ---------------------------------------------------------------------------
// Helper to build slot arrays with auto-incrementing order
// ---------------------------------------------------------------------------
function slots(...defs: Omit<SlotDefinition, 'order'>[]): SlotDefinition[] {
  return defs.map((d, i) => ({ ...d, order: i }));
}

// ---------------------------------------------------------------------------
// Built-in template definitions
// ---------------------------------------------------------------------------

export const BUILTIN_TEMPLATE_DEFINITIONS: readonly TemplateDefinition[] = [
  // -- Blank ---------------------------------------------------------------
  {
    id: 'builtin-blank',
    name: 'Blank',
    description: 'Start from scratch with a heading and body.',
    iconName: 'DocumentOnePage',
    category: 'general',
    accentColor: '#8A8886',
    isBuiltIn: true,
    slots: slots(
      { id: 'heading', type: 'heading', label: 'Heading', visibility: 'required', helpText: 'Enter your message title' },
      { id: 'body', type: 'bodyText', label: 'Body Text', visibility: 'optionalOn', helpText: 'Enter your message content' },
    ),
  },

  // -- Announcement --------------------------------------------------------
  {
    id: 'builtin-announcement',
    name: 'Announcement',
    description: 'Hero image, body copy, and a call-to-action for company-wide announcements.',
    iconName: 'Megaphone',
    category: 'announcement',
    accentColor: '#6264A7',
    isBuiltIn: true,
    slots: slots(
      { id: 'heading', type: 'heading', label: 'Heading', visibility: 'required', helpText: 'Your announcement headline', defaultValue: { text: 'Introducing Flexible Fridays' } },
      { id: 'hero', type: 'heroImage', label: 'Hero Image', visibility: 'optionalOn', helpText: 'A banner image for your announcement', defaultValue: { url: 'https://picsum.photos/seed/announcement/800/300' } },
      { id: 'body', type: 'bodyText', label: 'Body Text', visibility: 'required', helpText: 'The main announcement content', defaultValue: { text: 'Starting next month, all employees can choose to work remotely on Fridays. This new initiative is part of our commitment to work-life balance and has been shaped by your feedback in the recent engagement survey.' } },
      { id: 'cta', type: 'linkButton', label: 'Call to Action', visibility: 'optionalOn', helpText: 'Link to more information', defaultValue: { title: 'Learn More', url: 'https://contoso.com/flexible-fridays' } },
      { id: 'footer', type: 'footer', label: 'Footer', visibility: 'optionalOff', helpText: 'Additional context or contact info', defaultValue: { text: 'Questions? Contact HR at hr@contoso.com' } },
    ),
  },

  // -- Event Invite --------------------------------------------------------
  {
    id: 'builtin-event-invite',
    name: 'Event Invite',
    description: 'Date, time, location details with an RSVP button for meetings and events.',
    iconName: 'Calendar',
    category: 'event',
    accentColor: '#0078D4',
    isBuiltIn: true,
    slots: slots(
      { id: 'heading', type: 'heading', label: 'Event Title', visibility: 'required', helpText: 'Name of the event', defaultValue: { text: 'Annual Company Summit 2026' } },
      { id: 'body', type: 'bodyText', label: 'Description', visibility: 'required', helpText: 'What the event is about', defaultValue: { text: 'Join us for a day of keynotes, breakout sessions, and networking. This year\'s theme is "Building What\'s Next" — hear from leadership about our roadmap and connect with colleagues across every department.' } },
      { id: 'details', type: 'keyDetails', label: 'Event Details', visibility: 'required', helpText: 'Date, time, location, etc.', defaultValue: { pairs: [{ label: 'Date', value: 'March 15, 2026' }, { label: 'Time', value: '9:00 AM – 4:00 PM' }, { label: 'Location', value: 'Contoso HQ, Building 5' }] } },
      { id: 'cta', type: 'linkButton', label: 'RSVP Button', visibility: 'optionalOn', helpText: 'Link to RSVP or calendar invite', defaultValue: { title: 'RSVP Now', url: 'https://contoso.com/summit-2026' } },
      { id: 'footer', type: 'footer', label: 'Footer', visibility: 'optionalOn', helpText: 'Backup info, recording note, etc.', defaultValue: { text: 'Virtual attendance option available — link sent after RSVP' } },
    ),
  },

  // -- Urgent Alert --------------------------------------------------------
  {
    id: 'builtin-urgent-alert',
    name: 'Urgent Alert',
    description: 'High-visibility alert for time-sensitive situations requiring immediate action.',
    iconName: 'AlertUrgent',
    category: 'alert',
    accentColor: '#D13438',
    isBuiltIn: true,
    slots: slots(
      { id: 'heading', type: 'heading', label: 'Alert Title', visibility: 'required', helpText: 'Describe the urgency', defaultValue: { text: 'System Maintenance Tonight' } },
      { id: 'body', type: 'bodyText', label: 'Details', visibility: 'required', helpText: 'What happened and what to do', defaultValue: { text: 'Our core infrastructure will undergo scheduled maintenance tonight. All internal tools — including email, file shares, and the intranet — will be unavailable during the maintenance window. Please save your work and log out before the start time.' } },
      { id: 'details', type: 'keyDetails', label: 'Key Info', visibility: 'optionalOn', helpText: 'Severity, deadline, affected teams', defaultValue: { pairs: [{ label: 'Severity', value: 'High' }, { label: 'Deadline', value: 'Today, 11:00 PM' }] } },
      { id: 'cta', type: 'linkButton', label: 'Action Button', visibility: 'required', helpText: 'Link to take action', defaultValue: { title: 'View Status Page', url: 'https://status.contoso.com' } },
      { id: 'footer', type: 'footer', label: 'Dismissal Note', visibility: 'optionalOff' },
    ),
  },

  // -- Link Share ----------------------------------------------------------
  {
    id: 'builtin-link-share',
    name: 'Link Share',
    description: 'Quick share for articles, tools, or resources with context.',
    iconName: 'Link',
    category: 'general',
    accentColor: '#498205',
    isBuiltIn: true,
    slots: slots(
      { id: 'heading', type: 'heading', label: 'Title', visibility: 'required', helpText: 'What you\'re sharing', defaultValue: { text: 'Must-Read: State of Remote Work 2026' } },
      { id: 'body', type: 'bodyText', label: 'Context', visibility: 'optionalOn', helpText: 'Why this is worth reading', defaultValue: { text: 'This year\'s report highlights a major shift toward async-first communication and four-day work weeks. Several of the findings align directly with initiatives we\'re exploring — worth a read before our next all-hands.' } },
      { id: 'cta', type: 'linkButton', label: 'Open Link', visibility: 'required', helpText: 'The resource URL', defaultValue: { title: 'Read the Article', url: 'https://contoso.com/remote-work-2026' } },
    ),
  },

  // -- Survey / Feedback ---------------------------------------------------
  {
    id: 'builtin-survey',
    name: 'Survey',
    description: 'Collect feedback with clear context and a direct link to the survey.',
    iconName: 'ClipboardTask',
    category: 'feedback',
    accentColor: '#8764B8',
    isBuiltIn: true,
    slots: slots(
      { id: 'heading', type: 'heading', label: 'Title', visibility: 'required', defaultValue: { text: 'Help Shape Our Benefits Package' } },
      { id: 'body', type: 'bodyText', label: 'Description', visibility: 'required', helpText: 'Why their feedback matters', defaultValue: { text: 'We\'re reviewing our benefits package for 2027 and want to hear from you. Your input directly influences which perks and programs we invest in next — take five minutes to let us know what matters most.' } },
      { id: 'details', type: 'keyDetails', label: 'Survey Info', visibility: 'optionalOn', defaultValue: { pairs: [{ label: 'Estimated Time', value: '5 minutes' }, { label: 'Deadline', value: 'March 1, 2026' }] } },
      { id: 'cta', type: 'linkButton', label: 'Start Survey', visibility: 'required', defaultValue: { title: 'Start Survey', url: 'https://contoso.com/benefits-survey' } },
      { id: 'footer', type: 'footer', label: 'Privacy Note', visibility: 'optionalOn', defaultValue: { text: 'Responses are anonymous' } },
    ),
  },

  // -- Welcome / Onboarding ------------------------------------------------
  {
    id: 'builtin-welcome',
    name: 'Welcome',
    description: 'Onboard new team members with key info, contacts, and first-day resources.',
    iconName: 'People',
    category: 'onboarding',
    accentColor: '#038387',
    isBuiltIn: true,
    slots: slots(
      { id: 'heading', type: 'heading', label: 'Welcome Message', visibility: 'required', defaultValue: { text: 'Welcome to the Team, {{name}}!' } },
      { id: 'body', type: 'bodyText', label: 'Introduction', visibility: 'required', defaultValue: { text: 'We\'re thrilled to have you on board! Your first week is all about getting settled — meet your team, explore our tools, and don\'t hesitate to ask questions. Your buddy is here to help with anything you need.' } },
      { id: 'details', type: 'keyDetails', label: 'Key Info', visibility: 'required', defaultValue: { pairs: [{ label: 'Start Date', value: 'February 24, 2026' }, { label: 'Team', value: 'Platform Engineering' }, { label: 'Manager', value: 'Alex Chen' }, { label: 'Buddy', value: 'Sam Rivera' }] } },
      { id: 'cta', type: 'linkButton', label: 'Onboarding Guide', visibility: 'optionalOn', defaultValue: { title: 'Open Onboarding Guide', url: 'https://contoso.com/onboarding' } },
      { id: 'footer', type: 'footer', label: 'Support Note', visibility: 'optionalOn', defaultValue: { text: 'We\'re glad you\'re here!' } },
    ),
  },

  // -- Policy Update -------------------------------------------------------
  {
    id: 'builtin-policy-update',
    name: 'Policy Update',
    description: 'Communicate policy changes with effective dates and required acknowledgment.',
    iconName: 'ShieldCheckmark',
    category: 'policy',
    accentColor: '#CA5010',
    isBuiltIn: true,
    slots: slots(
      { id: 'heading', type: 'heading', label: 'Policy Title', visibility: 'required', defaultValue: { text: 'Updated Travel & Expense Policy' } },
      { id: 'body', type: 'bodyText', label: 'Summary', visibility: 'required', helpText: 'Key changes in plain language', defaultValue: { text: 'We\'ve simplified the travel and expense approval process. The biggest change: expenses under $500 no longer require pre-approval. Please review the updated policy before your next trip to familiarize yourself with the new thresholds and receipt requirements.' } },
      { id: 'details', type: 'keyDetails', label: 'Policy Details', visibility: 'required', defaultValue: { pairs: [{ label: 'Policy', value: 'Travel & Expense v3.2' }, { label: 'Effective Date', value: 'April 1, 2026' }, { label: 'Key Change', value: 'Pre-approval threshold raised to $500' }] } },
      { id: 'cta', type: 'linkButton', label: 'Review & Acknowledge', visibility: 'optionalOn', defaultValue: { title: 'Review Full Policy', url: 'https://contoso.com/policies/travel-expense' } },
      { id: 'footer', type: 'footer', label: 'Applicability Note', visibility: 'optionalOff' },
    ),
  },

  // -- Celebration ---------------------------------------------------------
  {
    id: 'builtin-celebration',
    name: 'Celebration',
    description: 'Recognize achievements, milestones, and team wins.',
    iconName: 'Star',
    category: 'celebration',
    accentColor: '#986F0B',
    isBuiltIn: true,
    slots: slots(
      { id: 'heading', type: 'heading', label: 'Celebration Title', visibility: 'required', defaultValue: { text: 'Congratulations, Platform Team!' } },
      { id: 'hero', type: 'heroImage', label: 'Celebration Image', visibility: 'optionalOn', defaultValue: { url: 'https://picsum.photos/seed/celebration/800/300' } },
      { id: 'body', type: 'bodyText', label: 'Message', visibility: 'required', defaultValue: { text: 'The Platform Team just shipped the new developer portal two weeks ahead of schedule — a huge milestone that will improve the daily experience for over 200 engineers. Thank you for the late nights, creative problem-solving, and relentless focus on quality. You\'ve set a new bar!' } },
      { id: 'footer', type: 'footer', label: 'Nomination Note', visibility: 'optionalOff' },
    ),
  },
] as const;

export const BLANK_TEMPLATE_ID = 'builtin-blank';

/** Look up a built-in template by ID. */
export function getTemplateById(id: string): TemplateDefinition | undefined {
  return BUILTIN_TEMPLATE_DEFINITIONS.find((t) => t.id === id);
}

// ---------------------------------------------------------------------------
// Serialization helpers (Phase D — Template Editor)
// ---------------------------------------------------------------------------

/** Schema version for TemplateDefinition format (distinguishes from legacy CardSchema). */
export const TEMPLATE_SCHEMA_VERSION = 2;

/**
 * Detect whether a JSON string represents a TemplateDefinition (schemaVersion === 2)
 * vs. a legacy CardSchema.
 */
export function isTemplateDefinitionJson(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    return parsed?.schemaVersion === TEMPLATE_SCHEMA_VERSION;
  } catch {
    return false;
  }
}

/**
 * Parse a JSON string into a TemplateDefinition. Returns null if invalid.
 * Performs structural validation on slots to guard against malformed API data.
 */
export function parseTemplateDefinition(json: string): TemplateDefinition | null {
  try {
    const parsed = JSON.parse(json);
    if (
      parsed?.schemaVersion !== TEMPLATE_SCHEMA_VERSION ||
      !Array.isArray(parsed?.slots) ||
      typeof parsed?.name !== 'string'
    ) {
      return null;
    }
    // Validate each slot has required fields
    for (const slot of parsed.slots) {
      if (
        typeof slot?.id !== 'string' ||
        typeof slot?.type !== 'string' ||
        typeof slot?.label !== 'string' ||
        typeof slot?.visibility !== 'string' ||
        typeof slot?.order !== 'number'
      ) {
        return null;
      }
    }
    return parsed as TemplateDefinition;
  } catch {
    return null;
  }
}

/**
 * Serialize a TemplateDefinition to a JSON string for storage.
 * Always stamps schemaVersion so the format can be detected on read.
 */
export function serializeTemplateDefinition(def: TemplateDefinition): string {
  return JSON.stringify({ ...def, schemaVersion: TEMPLATE_SCHEMA_VERSION });
}

/**
 * Create a blank TemplateDefinition as starting point for the editor.
 */
export function createBlankTemplateDef(): TemplateDefinition {
  return {
    id: '',               // Set by backend on save
    name: '',
    description: '',
    iconName: 'DocumentOnePage',
    category: 'general',
    accentColor: '#5B5FC7',
    isBuiltIn: false,
    slots: [
      {
        id: 'heading',
        type: 'heading',
        label: 'Heading',
        helpText: 'Enter a title',
        visibility: 'required',
        order: 0,
      },
      {
        id: 'body',
        type: 'bodyText',
        label: 'Body Text',
        helpText: 'Enter the message content',
        visibility: 'optionalOn',
        order: 1,
      },
    ],
  };
}
