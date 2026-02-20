import { useDeferredValue, useState } from 'react';
import { Controller, useFieldArray } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import {
  makeStyles,
  tokens,
  Field,
  Input,
  Textarea,
  Button,
  Text,
  Caption1,
} from '@fluentui/react-components';
import { Add16Regular, Delete16Regular } from '@fluentui/react-icons';
import { AdaptiveCardPreview } from '@/components/AdaptiveCardPreview/AdaptiveCardPreview';
import type { CardData } from '@/lib/adaptiveCard';
import type { ComposeFormValues } from '@/lib/validators';
import { TemplatePicker } from './TemplatePicker';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },

  // Left: scrollable form area (~60%)
  formArea: {
    flex: '0 0 60%',
    overflowY: 'auto',
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    minWidth: 0,
  },

  // Right: live preview (~40%)
  previewArea: {
    flex: '0 0 40%',
    overflowY: 'auto',
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalM}`,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },

  // Inline character count displayed to the right of a field label
  charCount: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },

  // Thumbnail shown when a valid HTTPS image URL is entered
  imageThumbnail: {
    marginTop: tokens.spacingVerticalXS,
    maxHeight: '80px',
    maxWidth: '180px',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    objectFit: 'cover',
    display: 'block',
  },

  // "Expand" links for optional sections
  expandLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: tokens.colorBrandForeground1,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    ':hover': {
      color: tokens.colorBrandForeground2,
      textDecoration: 'underline',
    },
  },

  // Key Details container
  keyDetailsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },

  // Each label + value row inside the key details builder
  keyDetailRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },

  keyDetailField: {
    flex: 1,
    minWidth: 0,
  },

  keyDetailRemoveBtn: {
    flexShrink: 0,
    marginBottom: '2px',
  },

  // Call-to-action: label + URL side by side
  ctaRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-start',
  },

  ctaField: {
    flex: 1,
    minWidth: 0,
  },

  // Secondary text container
  secondaryTextContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ContentTabProps {
  form: UseFormReturn<ComposeFormValues>;
  /** When true (editing an existing message), the template picker starts collapsed. */
  isEdit?: boolean;
}

// ---------------------------------------------------------------------------
// ImageThumbnail — only renders when value is a valid HTTPS URL
// ---------------------------------------------------------------------------

function ImageThumbnail({ url }: { url: string | null | undefined }) {
  const styles = useStyles();

  if (!url || !url.startsWith('https://')) return null;

  // Very lightweight URL validity check — the zod schema provides the
  // authoritative validation; here we just want a quick guard before rendering.
  try {
    new URL(url);
  } catch {
    return null;
  }

  return (
    <img
      src={url}
      alt="Hero image preview"
      className={styles.imageThumbnail}
      onError={(e) => {
        // Hide broken image silently
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// CharCount — displays remaining characters beneath a field
// ---------------------------------------------------------------------------

function CharCount({ value, max }: { value: string | null | undefined; max: number }) {
  const styles = useStyles();
  const length = (value ?? '').length;
  const remaining = max - length;
  const nearLimit = remaining < max * 0.1; // within 10% of limit

  return (
    <Caption1
      className={styles.charCount}
      style={nearLimit ? { color: tokens.colorPaletteRedForeground1 } : undefined}
    >
      {length} / {max}
    </Caption1>
  );
}

// ---------------------------------------------------------------------------
// ContentTab
// ---------------------------------------------------------------------------

export function ContentTab({ form, isEdit = false }: ContentTabProps) {
  const styles = useStyles();

  const {
    control,
    watch,
    formState: { errors },
  } = form;

  const [showKeyDetails, setShowKeyDetails] = useState(false);
  const [showSecondaryText, setShowSecondaryText] = useState(false);

  // useFieldArray for the key details fact list
  const {
    fields: keyDetailFields,
    append: appendKeyDetail,
    remove: removeKeyDetail,
  } = useFieldArray({ control, name: 'keyDetails' });

  // Watch all form values for the live preview. Deferred so that heavy
  // Adaptive Card re-rendering does not block the form input response.
  const watchedValues = watch();
  const deferredValues = useDeferredValue(watchedValues);

  const cardData: CardData = {
    title: deferredValues.headline ?? '',
    summary: deferredValues.body,
    imageLink: deferredValues.imageLink,
    keyDetails: deferredValues.keyDetails,
    buttonTitle: deferredValues.buttonTitle,
    buttonLink: deferredValues.buttonLink,
    secondaryText: deferredValues.secondaryText,
    customVariables: deferredValues.customVariables,
    advancedBlocks: deferredValues.advancedBlocks,
  };

  // When the user reveals key details, ensure there is at least one row
  const handleRevealKeyDetails = () => {
    if (!showKeyDetails && keyDetailFields.length === 0) {
      appendKeyDetail({ label: '', value: '' });
    }
    setShowKeyDetails(true);
  };

  return (
    <div className={styles.root}>
      {/* ------------------------------------------------------------------ */}
      {/* Left: Form fields                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className={styles.formArea}>

        {/* Template picker — expanded for new messages, collapsed when editing */}
        <TemplatePicker form={form} defaultCollapsed={isEdit} />

        {/* Headline */}
        <Controller
          name="headline"
          control={control}
          render={({ field }) => (
            <Field
              label="Headline"
              required
              validationMessage={errors.headline?.message}
              validationState={errors.headline ? 'error' : 'none'}
            >
              <Input
                {...field}
                placeholder="What's the main message?"
                maxLength={200}
                aria-required="true"
              />
            </Field>
          )}
        />

        {/* Body */}
        <Controller
          name="body"
          control={control}
          render={({ field }) => (
            <Field
              label={
                <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span>Body</span>
                  <CharCount value={field.value} max={4000} />
                </span>
              }
              validationMessage={errors.body?.message}
              validationState={errors.body ? 'error' : 'none'}
            >
              <Textarea
                {...field}
                value={field.value ?? ''}
                placeholder="Write your message..."
                rows={6}
                resize="vertical"
                maxLength={4000}
              />
            </Field>
          )}
        />

        {/* Hero Image */}
        <Controller
          name="imageLink"
          control={control}
          render={({ field }) => (
            <Field
              label="Hero Image"
              hint="Use a publicly accessible HTTPS image URL."
              validationMessage={errors.imageLink?.message}
              validationState={errors.imageLink ? 'error' : 'none'}
            >
              <Input
                {...field}
                value={field.value ?? ''}
                placeholder="https://..."
                type="url"
              />
              <ImageThumbnail url={field.value} />
            </Field>
          )}
        />

        {/* Key Details (fact list) */}
        {!showKeyDetails ? (
          <button
            type="button"
            className={styles.expandLink}
            onClick={handleRevealKeyDetails}
            aria-expanded={false}
            aria-controls="key-details-section"
          >
            <Add16Regular />
            Add details
          </button>
        ) : (
          <div id="key-details-section">
            <Field label="Key Details">
              <div className={styles.keyDetailsContainer}>
                {keyDetailFields.map((fieldItem, index) => (
                  <div key={fieldItem.id} className={styles.keyDetailRow}>
                    <div className={styles.keyDetailField}>
                      <Controller
                        name={`keyDetails.${index}.label`}
                        control={control}
                        render={({ field }) => (
                          <Field
                            validationMessage={
                              errors.keyDetails?.[index]?.label?.message
                            }
                            validationState={
                              errors.keyDetails?.[index]?.label ? 'error' : 'none'
                            }
                          >
                            <Input
                              {...field}
                              placeholder="Label"
                              aria-label={`Key detail ${index + 1} label`}
                            />
                          </Field>
                        )}
                      />
                    </div>
                    <div className={styles.keyDetailField}>
                      <Controller
                        name={`keyDetails.${index}.value`}
                        control={control}
                        render={({ field }) => (
                          <Field
                            validationMessage={
                              errors.keyDetails?.[index]?.value?.message
                            }
                            validationState={
                              errors.keyDetails?.[index]?.value ? 'error' : 'none'
                            }
                          >
                            <Input
                              {...field}
                              placeholder="Value"
                              aria-label={`Key detail ${index + 1} value`}
                            />
                          </Field>
                        )}
                      />
                    </div>
                    <div className={styles.keyDetailRemoveBtn}>
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={<Delete16Regular />}
                        onClick={() => { removeKeyDetail(index); }}
                        aria-label={`Remove key detail row ${index + 1}`}
                      />
                    </div>
                  </div>
                ))}

                <Button
                  appearance="subtle"
                  size="small"
                  icon={<Add16Regular />}
                  onClick={() => { appendKeyDetail({ label: '', value: '' }); }}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Add row
                </Button>
              </div>
            </Field>
          </div>
        )}

        {/* Call to Action */}
        <div className={styles.ctaRow}>
          <div className={styles.ctaField}>
            <Controller
              name="buttonTitle"
              control={control}
              render={({ field }) => (
                <Field
                  label="Button Label (optional)"
                  validationMessage={errors.buttonTitle?.message}
                  validationState={errors.buttonTitle ? 'error' : 'none'}
                >
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    placeholder="Learn More"
                    maxLength={200}
                  />
                </Field>
              )}
            />
          </div>
          <div className={styles.ctaField}>
            <Controller
              name="buttonLink"
              control={control}
              render={({ field }) => (
                <Field
                  label="Button URL (optional)"
                  validationMessage={errors.buttonLink?.message}
                  validationState={errors.buttonLink ? 'error' : 'none'}
                >
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    placeholder="https://..."
                    type="url"
                  />
                </Field>
              )}
            />
          </div>
        </div>

        {/* Secondary Text */}
        {!showSecondaryText ? (
          <button
            type="button"
            className={styles.expandLink}
            onClick={() => { setShowSecondaryText(true); }}
            aria-expanded={false}
            aria-controls="secondary-text-section"
          >
            <Add16Regular />
            Add footnote
          </button>
        ) : (
          <div id="secondary-text-section" className={styles.secondaryTextContainer}>
            <Controller
              name="secondaryText"
              control={control}
              render={({ field }) => (
                <Field
                  label={
                    <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span>Footnote</span>
                      <CharCount value={field.value} max={2000} />
                    </span>
                  }
                  validationMessage={errors.secondaryText?.message}
                  validationState={errors.secondaryText ? 'error' : 'none'}
                >
                  <Textarea
                    {...field}
                    value={field.value ?? ''}
                    placeholder="Add a small footnote or disclaimer..."
                    rows={3}
                    resize="vertical"
                    maxLength={2000}
                  />
                </Field>
              )}
            />
            <Text>
              <button
                type="button"
                className={styles.expandLink}
                onClick={() => {
                  setShowSecondaryText(false);
                  form.setValue('secondaryText', null);
                }}
                style={{ fontSize: tokens.fontSizeBase200 }}
              >
                Remove footnote
              </button>
            </Text>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right: Live Preview                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className={styles.previewArea}>
        <AdaptiveCardPreview data={cardData} />
      </div>
    </div>
  );
}
