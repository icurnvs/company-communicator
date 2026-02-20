import type { ComponentType } from 'react';
import type { FluentIconsProps } from '@fluentui/react-icons';
import {
  MegaphoneRegular,
  CalendarRegular,
  AlertUrgentRegular,
  LinkRegular,
  ClipboardTaskRegular,
  DocumentOnePage20Regular,
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
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'builtin-announcement',
    name: 'Announcement',
    description: 'Headline, body copy, hero image, and a call-to-action button.',
    icon: MegaphoneRegular,
    schema: {
      headline: 'Announcement Headline',
      body: 'Share the details of your announcement here. Keep it clear and concise.',
      imageLink: null,
      buttonTitle: 'Learn More',
      buttonLink: 'https://',
      keyDetails: undefined,
      secondaryText: null,
      cardPreference: 'Standard',
    },
  },
  {
    id: 'builtin-event-invite',
    name: 'Event Invite',
    description: 'Headline, hero image, date/time/location details, and an RSVP button.',
    icon: CalendarRegular,
    schema: {
      headline: "You're Invited!",
      body: "Join us for a special event. We'd love to see you there.",
      imageLink: null,
      keyDetails: [
        { label: 'Date', value: 'Monday, March 10, 2026' },
        { label: 'Time', value: '10:00 AM – 12:00 PM PST' },
        { label: 'Location', value: 'Main Conference Room / Teams' },
      ],
      buttonTitle: 'RSVP',
      buttonLink: 'https://',
      secondaryText: null,
      cardPreference: 'Standard',
    },
  },
  {
    id: 'builtin-urgent-alert',
    name: 'Urgent Alert',
    description: 'Emphasized headline, body, and action button. No image.',
    icon: AlertUrgentRegular,
    schema: {
      headline: 'URGENT: Action Required',
      body: 'Describe the urgent situation and the steps employees should take immediately.',
      imageLink: null,
      keyDetails: undefined,
      buttonTitle: 'Take Action',
      buttonLink: 'https://',
      secondaryText: null,
      cardPreference: 'Standard',
    },
  },
  {
    id: 'builtin-link-share',
    name: 'Link Share',
    description: 'Minimal card with headline, short body, and an emphasized CTA.',
    icon: LinkRegular,
    schema: {
      headline: 'Check This Out',
      body: "A quick summary of the resource or article you're sharing.",
      imageLink: null,
      keyDetails: undefined,
      buttonTitle: 'Open Link',
      buttonLink: 'https://',
      secondaryText: null,
      cardPreference: 'Standard',
    },
  },
  {
    id: 'builtin-survey',
    name: 'Survey / Feedback',
    description: 'Headline, body, and a "Take Survey" button.',
    icon: ClipboardTaskRegular,
    schema: {
      headline: 'We Want Your Feedback',
      body: 'Your opinion matters! Please take a moment to complete this short survey.',
      imageLink: null,
      keyDetails: undefined,
      buttonTitle: 'Take Survey',
      buttonLink: 'https://',
      secondaryText: null,
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
