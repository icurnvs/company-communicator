import type { ComponentType } from 'react';
import type { FluentIconsProps } from '@fluentui/react-icons';
import {
  MegaphoneRegular,
  CalendarRegular,
  AlertUrgentRegular,
  LinkRegular,
  ClipboardTaskRegular,
  DocumentOnePage20Regular,
  PeopleRegular,
  ShieldCheckmarkRegular,
  StarRegular,
} from '@fluentui/react-icons';
import type { CardSchema } from '@/types';

// ---------------------------------------------------------------------------
// Built-in template descriptor
// ---------------------------------------------------------------------------

export interface BuiltinTemplate {
  id: string;
  name: string;
  description: string;
  icon: ComponentType<FluentIconsProps>;
  schema: CardSchema;
  /** Accent color for the picker card header (CSS color) */
  accentColor: string;
  /** Tags showing which card features this template uses */
  features: string[];
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'builtin-announcement',
    name: 'Announcement',
    description: 'Hero image, body copy, and a call-to-action for company-wide announcements.',
    icon: MegaphoneRegular,
    accentColor: '#6264a7',
    features: ['Image', 'Button'],
    schema: {
      headline: 'Important Company Update',
      body: 'We\'re excited to share some important news with the team. Read on for the full details and what this means for you.\n\nPlease review the information below and reach out to your manager if you have any questions.',
      imageLink: null,
      buttonTitle: 'Read Full Announcement',
      buttonLink: 'https://',
      keyDetails: undefined,
      secondaryText: 'Questions? Contact the Internal Communications team.',
      cardPreference: 'Standard',
    },
  },
  {
    id: 'builtin-event-invite',
    name: 'Event Invite',
    description: 'Date, time, location details with an RSVP button for meetings and events.',
    icon: CalendarRegular,
    accentColor: '#0078d4',
    features: ['Facts', 'Button', 'Footnote'],
    schema: {
      headline: "You're Invited: Q1 All-Hands Meeting",
      body: "Join us for our quarterly all-hands where we'll celebrate wins, share updates on company goals, and preview what's ahead.",
      imageLink: null,
      keyDetails: [
        { label: 'Date', value: 'Monday, March 10, 2026' },
        { label: 'Time', value: '10:00 AM \u2013 12:00 PM PST' },
        { label: 'Location', value: 'Main Auditorium / Teams Live Event' },
        { label: 'Dress Code', value: 'Business Casual' },
      ],
      buttonTitle: 'RSVP Now',
      buttonLink: 'https://',
      secondaryText: 'Can\'t make it? A recording will be shared within 24 hours.',
      cardPreference: 'Standard',
    },
  },
  {
    id: 'builtin-urgent-alert',
    name: 'Urgent Alert',
    description: 'High-visibility alert for time-sensitive situations requiring immediate action.',
    icon: AlertUrgentRegular,
    accentColor: '#d13438',
    features: ['Facts', 'Button'],
    schema: {
      headline: '\u26a0\ufe0f URGENT: Action Required',
      body: 'This is a time-sensitive notice that requires your immediate attention. Please review the details below and take the necessary steps.',
      imageLink: null,
      keyDetails: [
        { label: 'Severity', value: 'High' },
        { label: 'Deadline', value: 'Today by 5:00 PM' },
        { label: 'Affected Teams', value: 'All departments' },
      ],
      buttonTitle: 'Take Action Now',
      buttonLink: 'https://',
      secondaryText: 'If you have already completed this action, you may disregard this message.',
      cardPreference: 'Standard',
    },
  },
  {
    id: 'builtin-link-share',
    name: 'Link Share',
    description: 'Quick share for articles, tools, or resources with context.',
    icon: LinkRegular,
    accentColor: '#498205',
    features: ['Button'],
    schema: {
      headline: 'Recommended Resource',
      body: "We've found a great resource that's relevant to our current work. Take a few minutes to check it out \u2014 it covers best practices that can help streamline our processes.",
      imageLink: null,
      keyDetails: undefined,
      buttonTitle: 'Open Resource \u2192',
      buttonLink: 'https://',
      secondaryText: null,
      cardPreference: 'Standard',
    },
  },
  {
    id: 'builtin-survey',
    name: 'Survey',
    description: 'Collect feedback with clear context and a direct link to the survey.',
    icon: ClipboardTaskRegular,
    accentColor: '#8764b8',
    features: ['Facts', 'Button', 'Footnote'],
    schema: {
      headline: 'Your Feedback Matters',
      body: 'Help us improve by sharing your thoughts. This short survey takes about 5 minutes and your responses are completely anonymous.',
      imageLink: null,
      keyDetails: [
        { label: 'Estimated Time', value: '5 minutes' },
        { label: 'Deadline', value: 'Friday, March 14' },
        { label: 'Responses So Far', value: '142 of 500' },
      ],
      buttonTitle: 'Start Survey',
      buttonLink: 'https://',
      secondaryText: 'All responses are anonymous. Results will be shared in the next town hall.',
      cardPreference: 'Standard',
    },
  },
  {
    id: 'builtin-welcome',
    name: 'Welcome',
    description: 'Onboard new team members with key info, contacts, and first-day resources.',
    icon: PeopleRegular,
    accentColor: '#038387',
    features: ['Facts', 'Button', 'Footnote'],
    schema: {
      headline: 'Welcome to the Team! \ud83c\udf89',
      body: "We're thrilled to have you on board. Here's everything you need to get started on your first day.",
      imageLink: null,
      keyDetails: [
        { label: 'Start Date', value: 'Monday, March 10' },
        { label: 'Team', value: 'Engineering \u2013 Platform' },
        { label: 'Manager', value: 'Alex Thompson' },
        { label: 'Buddy', value: 'Jordan Lee' },
      ],
      buttonTitle: 'Open Onboarding Guide',
      buttonLink: 'https://',
      secondaryText: 'Need help? Your onboarding buddy is your go-to resource for the first 30 days.',
      cardPreference: 'Standard',
    },
  },
  {
    id: 'builtin-policy-update',
    name: 'Policy Update',
    description: 'Communicate policy changes with effective dates and required acknowledgment.',
    icon: ShieldCheckmarkRegular,
    accentColor: '#ca5010',
    features: ['Facts', 'Button', 'Footnote'],
    schema: {
      headline: 'Policy Update: Remote Work Guidelines',
      body: "We've updated our remote work policy to better support flexible working arrangements. Please review the key changes below.",
      imageLink: null,
      keyDetails: [
        { label: 'Policy', value: 'Remote Work Guidelines v3.0' },
        { label: 'Effective Date', value: 'April 1, 2026' },
        { label: 'Key Change', value: '3 days minimum in-office per week' },
        { label: 'Acknowledgment Due', value: 'March 21, 2026' },
      ],
      buttonTitle: 'Review & Acknowledge',
      buttonLink: 'https://',
      secondaryText: 'This policy applies to all full-time employees. Contractors should consult their team lead.',
      cardPreference: 'Standard',
    },
  },
  {
    id: 'builtin-celebration',
    name: 'Celebration',
    description: 'Recognize achievements, milestones, and team wins.',
    icon: StarRegular,
    accentColor: '#986f0b',
    features: ['Image', 'Footnote'],
    schema: {
      headline: '\ud83c\udfc6 Congratulations to Our Q1 Top Performers!',
      body: "Let's take a moment to recognize the outstanding work of our colleagues who went above and beyond this quarter.\n\nTheir dedication, creativity, and teamwork have made a real impact. Join us in celebrating their achievements!",
      imageLink: null,
      keyDetails: undefined,
      buttonTitle: null,
      buttonLink: null,
      secondaryText: 'Want to nominate someone for next quarter? Submit a peer recognition through the HR portal.',
      cardPreference: 'Standard',
    },
  },
];

// Blank template — schema is intentionally empty so applying it clears the form
export const BLANK_TEMPLATE_ID = 'builtin-blank';

export const BLANK_TEMPLATE: BuiltinTemplate = {
  id: BLANK_TEMPLATE_ID,
  name: 'Blank',
  description: 'Start from scratch.',
  icon: DocumentOnePage20Regular,
  accentColor: '#8a8886',
  features: [],
  schema: {
    headline: '',
    body: null,
    imageLink: null,
    keyDetails: undefined,
    buttonTitle: null,
    buttonLink: null,
    secondaryText: null,
    cardPreference: 'Standard',
  },
};
