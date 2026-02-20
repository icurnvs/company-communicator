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
      { id: 'heading', type: 'heading', label: 'Heading', visibility: 'required', helpText: 'Your announcement headline', defaultValue: { text: 'Important Company Update' } },
      { id: 'hero', type: 'heroImage', label: 'Hero Image', visibility: 'optionalOn', helpText: 'A banner image for your announcement' },
      { id: 'body', type: 'bodyText', label: 'Body Text', visibility: 'required', helpText: 'The main announcement content' },
      { id: 'cta', type: 'linkButton', label: 'Call to Action', visibility: 'optionalOn', helpText: 'Link to more information' },
      { id: 'footer', type: 'footer', label: 'Footer', visibility: 'optionalOff', helpText: 'Additional context or contact info' },
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
      { id: 'heading', type: 'heading', label: 'Event Title', visibility: 'required', helpText: 'Name of the event' },
      { id: 'body', type: 'bodyText', label: 'Description', visibility: 'required', helpText: 'What the event is about' },
      { id: 'details', type: 'keyDetails', label: 'Event Details', visibility: 'required', helpText: 'Date, time, location, etc.', defaultValue: { pairs: [{ label: 'Date', value: '' }, { label: 'Time', value: '' }, { label: 'Location', value: '' }] } },
      { id: 'cta', type: 'linkButton', label: 'RSVP Button', visibility: 'optionalOn', helpText: 'Link to RSVP or calendar invite' },
      { id: 'footer', type: 'footer', label: 'Footer', visibility: 'optionalOn', helpText: 'Backup info, recording note, etc.' },
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
      { id: 'heading', type: 'heading', label: 'Alert Title', visibility: 'required', helpText: 'Describe the urgency' },
      { id: 'body', type: 'bodyText', label: 'Details', visibility: 'required', helpText: 'What happened and what to do' },
      { id: 'details', type: 'keyDetails', label: 'Key Info', visibility: 'optionalOn', helpText: 'Severity, deadline, affected teams', defaultValue: { pairs: [{ label: 'Severity', value: '' }, { label: 'Deadline', value: '' }] } },
      { id: 'cta', type: 'linkButton', label: 'Action Button', visibility: 'required', helpText: 'Link to take action' },
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
      { id: 'heading', type: 'heading', label: 'Title', visibility: 'required', helpText: 'What you\'re sharing' },
      { id: 'body', type: 'bodyText', label: 'Context', visibility: 'optionalOn', helpText: 'Why this is worth reading' },
      { id: 'cta', type: 'linkButton', label: 'Open Link', visibility: 'required', helpText: 'The resource URL' },
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
      { id: 'heading', type: 'heading', label: 'Title', visibility: 'required' },
      { id: 'body', type: 'bodyText', label: 'Description', visibility: 'required', helpText: 'Why their feedback matters' },
      { id: 'details', type: 'keyDetails', label: 'Survey Info', visibility: 'optionalOn', defaultValue: { pairs: [{ label: 'Estimated Time', value: '' }, { label: 'Deadline', value: '' }] } },
      { id: 'cta', type: 'linkButton', label: 'Start Survey', visibility: 'required' },
      { id: 'footer', type: 'footer', label: 'Privacy Note', visibility: 'optionalOn' },
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
      { id: 'heading', type: 'heading', label: 'Welcome Message', visibility: 'required' },
      { id: 'body', type: 'bodyText', label: 'Introduction', visibility: 'required' },
      { id: 'details', type: 'keyDetails', label: 'Key Info', visibility: 'required', defaultValue: { pairs: [{ label: 'Start Date', value: '' }, { label: 'Team', value: '' }, { label: 'Manager', value: '' }, { label: 'Buddy', value: '' }] } },
      { id: 'cta', type: 'linkButton', label: 'Onboarding Guide', visibility: 'optionalOn' },
      { id: 'footer', type: 'footer', label: 'Support Note', visibility: 'optionalOn' },
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
      { id: 'heading', type: 'heading', label: 'Policy Title', visibility: 'required' },
      { id: 'body', type: 'bodyText', label: 'Summary', visibility: 'required', helpText: 'Key changes in plain language' },
      { id: 'details', type: 'keyDetails', label: 'Policy Details', visibility: 'required', defaultValue: { pairs: [{ label: 'Policy', value: '' }, { label: 'Effective Date', value: '' }, { label: 'Key Change', value: '' }] } },
      { id: 'cta', type: 'linkButton', label: 'Review & Acknowledge', visibility: 'optionalOn' },
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
      { id: 'heading', type: 'heading', label: 'Celebration Title', visibility: 'required' },
      { id: 'hero', type: 'heroImage', label: 'Celebration Image', visibility: 'optionalOn' },
      { id: 'body', type: 'bodyText', label: 'Message', visibility: 'required' },
      { id: 'footer', type: 'footer', label: 'Nomination Note', visibility: 'optionalOff' },
    ),
  },
] as const;

export const BLANK_TEMPLATE_ID = 'builtin-blank';

/** Look up a built-in template by ID. */
export function getTemplateById(id: string): TemplateDefinition | undefined {
  return BUILTIN_TEMPLATE_DEFINITIONS.find((t) => t.id === id);
}
