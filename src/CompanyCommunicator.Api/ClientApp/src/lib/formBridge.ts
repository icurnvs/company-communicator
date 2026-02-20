// lib/formBridge.ts — Bridge between ComposeFormValues and CardDocument
import type {
  CardDocument,
  TemplateDefinition,
  SlotDefinition,
  HeadingSlotValue,
  BodyTextSlotValue,
  HeroImageSlotValue,
  KeyDetailsSlotValue,
  LinkButtonSlotValue,
  FooterSlotValue,
} from '@/types';
import type { ComposeFormValues } from './validators';
import { DEFAULT_THEME_ID } from './builtinThemes';

// ---------------------------------------------------------------------------
// Form values → CardDocument (for the pipeline)
// ---------------------------------------------------------------------------

/**
 * Convert flat form values into a CardDocument that the card pipeline can consume.
 * Maps form fields to typed slot values based on the template's slot definitions.
 */
export function formValuesToCardDocument(
  values: ComposeFormValues,
  template: TemplateDefinition,
  themeId?: string,
  slotVisibility?: Record<string, boolean>,
): CardDocument {
  const slotValues: Record<string, unknown> = {};

  for (const slot of template.slots) {
    const value = formFieldToSlotValue(slot, values);
    if (value !== undefined) {
      slotValues[slot.id] = value;
    }
  }

  return {
    templateId: template.id,
    themeId: themeId ?? values.themeId ?? DEFAULT_THEME_ID,
    slotValues,
    slotVisibility: slotVisibility ?? values.slotVisibility ?? {},
    cardPreference: 'template',
  };
}

/**
 * Map a single slot definition to its value from form fields.
 * Uses the slot's type to determine which form fields to read.
 */
function formFieldToSlotValue(
  slot: SlotDefinition,
  values: ComposeFormValues,
): unknown {
  switch (slot.type) {
    case 'heading': {
      const v: HeadingSlotValue = { text: values.headline ?? '' };
      return v;
    }
    case 'subheading': {
      // No dedicated form field — use secondary text as fallback
      const v: HeadingSlotValue = { text: '' };
      return v;
    }
    case 'bodyText': {
      const v: BodyTextSlotValue = { text: values.body ?? '' };
      return v;
    }
    case 'heroImage': {
      const v: HeroImageSlotValue = { url: values.imageLink ?? '' };
      return v;
    }
    case 'keyDetails': {
      const pairs = (values.keyDetails ?? []).map((kd) => ({
        label: kd.label,
        value: kd.value,
      }));
      const v: KeyDetailsSlotValue = { pairs };
      return v;
    }
    case 'linkButton': {
      const v: LinkButtonSlotValue = {
        title: values.buttonTitle ?? '',
        url: values.buttonLink ?? '',
      };
      return v;
    }
    case 'footer': {
      const v: FooterSlotValue = { text: values.secondaryText ?? '' };
      return v;
    }
    case 'divider':
      return undefined; // visual-only, no data
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// TemplateDefinition → initial form defaults (for template selection)
// ---------------------------------------------------------------------------

/**
 * Extract default form values from a template definition.
 * Called when the user selects a template in the picker.
 */
export function templateToFormDefaults(
  template: TemplateDefinition,
): Partial<ComposeFormValues> {
  const defaults: Partial<ComposeFormValues> = {
    templateId: template.id,
    themeId: DEFAULT_THEME_ID,
    cardPreference: 'Template',
    slotVisibility: {},
  };

  // Build initial slot visibility based on template slot definitions
  const visibility: Record<string, boolean> = {};
  for (const slot of template.slots) {
    if (slot.visibility === 'required') {
      visibility[slot.id] = true;
    } else if (slot.visibility === 'optionalOn') {
      visibility[slot.id] = true;
    } else {
      // optionalOff
      visibility[slot.id] = false;
    }
  }
  defaults.slotVisibility = visibility;

  // Extract default values from slots and map to form fields
  for (const slot of template.slots) {
    applySlotDefaultToForm(slot, defaults);
  }

  return defaults;
}

/**
 * Apply a slot's default value to the form defaults object.
 */
function applySlotDefaultToForm(
  slot: SlotDefinition,
  defaults: Partial<ComposeFormValues>,
): void {
  const dv = slot.defaultValue as Record<string, unknown> | undefined;

  switch (slot.type) {
    case 'heading':
      if (dv && typeof (dv as HeadingSlotValue).text === 'string') {
        defaults.headline = (dv as HeadingSlotValue).text;
      } else if (!defaults.headline) {
        defaults.headline = '';
      }
      break;
    case 'bodyText':
      if (dv && typeof (dv as BodyTextSlotValue).text === 'string') {
        defaults.body = (dv as BodyTextSlotValue).text;
      } else if (defaults.body === undefined) {
        defaults.body = '';
      }
      break;
    case 'heroImage':
      if (dv && typeof (dv as HeroImageSlotValue).url === 'string') {
        defaults.imageLink = (dv as HeroImageSlotValue).url;
      } else if (defaults.imageLink === undefined) {
        defaults.imageLink = '';
      }
      break;
    case 'keyDetails':
      if (dv && Array.isArray((dv as KeyDetailsSlotValue).pairs)) {
        defaults.keyDetails = (dv as KeyDetailsSlotValue).pairs.map((p) => ({
          label: p.label,
          value: p.value,
        }));
      } else if (defaults.keyDetails === undefined) {
        defaults.keyDetails = null;
      }
      break;
    case 'linkButton':
      if (dv) {
        const lbv = dv as LinkButtonSlotValue;
        if (typeof lbv.title === 'string') defaults.buttonTitle = lbv.title;
        if (typeof lbv.url === 'string') defaults.buttonLink = lbv.url;
      } else {
        if (defaults.buttonTitle === undefined) defaults.buttonTitle = '';
        if (defaults.buttonLink === undefined) defaults.buttonLink = '';
      }
      break;
    case 'footer':
      if (dv && typeof (dv as FooterSlotValue).text === 'string') {
        defaults.secondaryText = (dv as FooterSlotValue).text;
      } else if (defaults.secondaryText === undefined) {
        defaults.secondaryText = '';
      }
      break;
    // subheading, divider, etc. — no form field mapping needed
  }
}
