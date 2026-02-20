import { useRef } from 'react';
import { Controller, useFieldArray } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import {
  makeStyles,
  tokens,
  Field,
  Input,
  Textarea,
  Button,
  Caption1,
  Text,
} from '@fluentui/react-components';
import { Add16Regular, Delete16Regular } from '@fluentui/react-icons';
import type { SlotDefinition } from '@/types';
import type { ComposeFormValues } from '@/lib/validators';
import { VariableInsert } from './VariableInsert';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  charCount: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },

  bodyToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },

  bodyToolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },

  imageThumbnail: {
    marginTop: tokens.spacingVerticalXS,
    maxHeight: '80px',
    maxWidth: '180px',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    objectFit: 'cover',
    display: 'block',
  },

  keyDetailsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },

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

  ctaRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-start',
  },

  ctaField: {
    flex: 1,
    minWidth: 0,
  },

  dividerIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${tokens.spacingVerticalS} 0`,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function CharCount({ value, max }: { value: string | null | undefined; max: number }) {
  const styles = useStyles();
  const length = (value ?? '').length;
  const remaining = max - length;
  const nearLimit = remaining < max * 0.1;

  return (
    <Caption1
      className={styles.charCount}
      style={nearLimit ? { color: tokens.colorPaletteRedForeground1 } : undefined}
    >
      {length} / {max}
    </Caption1>
  );
}

function ImageThumbnail({ url }: { url: string | null | undefined }) {
  const styles = useStyles();
  if (!url || !url.startsWith('https://')) return null;
  try { new URL(url); } catch { return null; }
  return (
    <img
      src={url}
      alt="Hero image preview"
      className={styles.imageThumbnail}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SlotEditorProps {
  slot: SlotDefinition;
  form: UseFormReturn<ComposeFormValues>;
  onAddCustomVariable?: (name: string) => void;
}

// ---------------------------------------------------------------------------
// SlotEditor — dispatch component
// ---------------------------------------------------------------------------

export function SlotEditor({ slot, form, onAddCustomVariable }: SlotEditorProps) {
  switch (slot.type) {
    case 'heading':
      return <HeadingEditor form={form} />;
    case 'bodyText':
      return <BodyTextEditor form={form} onAddCustomVariable={onAddCustomVariable} />;
    case 'heroImage':
      return <HeroImageEditor form={form} />;
    case 'keyDetails':
      return <KeyDetailsEditor form={form} />;
    case 'linkButton':
      return <LinkButtonEditor form={form} />;
    case 'footer':
      return <FooterEditor form={form} />;
    case 'divider':
      return <DividerEditor />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// HeadingEditor
// ---------------------------------------------------------------------------

function HeadingEditor({ form }: { form: UseFormReturn<ComposeFormValues> }) {
  const { control, formState: { errors } } = form;
  return (
    <Controller
      name="headline"
      control={control}
      render={({ field }) => (
        <Field
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
          <CharCount value={field.value} max={200} />
        </Field>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// BodyTextEditor
// ---------------------------------------------------------------------------

function BodyTextEditor({
  form,
  onAddCustomVariable,
}: {
  form: UseFormReturn<ComposeFormValues>;
  onAddCustomVariable?: (name: string) => void;
}) {
  const styles = useStyles();
  const { control, watch, formState: { errors } } = form;
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const watchedValues = watch();

  const handleAddCustomVariable = (name: string) => {
    if (!onAddCustomVariable) return;
    const current = watchedValues.customVariables ?? [];
    if (current.some((v) => v.name === name)) return;
    onAddCustomVariable(name);
  };

  return (
    <Controller
      name="body"
      control={control}
      render={({ field }) => (
        <Field
          label={
            <div className={styles.bodyToolbar}>
              <div className={styles.bodyToolbarLeft}>
                <VariableInsert
                  textareaRef={bodyTextareaRef}
                  allUsers={watchedValues.allUsers}
                  audiences={watchedValues.audiences}
                  customVariables={watchedValues.customVariables}
                  onAddCustomVariable={handleAddCustomVariable}
                />
              </div>
              <CharCount value={field.value} max={4000} />
            </div>
          }
          validationMessage={errors.body?.message}
          validationState={errors.body ? 'error' : 'none'}
        >
          <Textarea
            {...field}
            ref={(el) => {
              bodyTextareaRef.current = el;
              if (typeof field.ref === 'function') field.ref(el);
            }}
            value={field.value ?? ''}
            placeholder="Write your message... Use {{variableName}} for dynamic content"
            rows={6}
            resize="vertical"
            maxLength={4000}
          />
        </Field>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// HeroImageEditor
// ---------------------------------------------------------------------------

function HeroImageEditor({ form }: { form: UseFormReturn<ComposeFormValues> }) {
  const { control, formState: { errors } } = form;
  return (
    <Controller
      name="imageLink"
      control={control}
      render={({ field }) => (
        <Field
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
  );
}

// ---------------------------------------------------------------------------
// KeyDetailsEditor
// ---------------------------------------------------------------------------

function KeyDetailsEditor({ form }: { form: UseFormReturn<ComposeFormValues> }) {
  const styles = useStyles();
  const { control, formState: { errors } } = form;

  const {
    fields: keyDetailFields,
    append: appendKeyDetail,
    remove: removeKeyDetail,
  } = useFieldArray({ control, name: 'keyDetails' });

  // Ensure at least one row exists
  if (keyDetailFields.length === 0) {
    appendKeyDetail({ label: '', value: '' });
  }

  return (
    <div className={styles.keyDetailsContainer}>
      {keyDetailFields.map((fieldItem, index) => (
        <div key={fieldItem.id} className={styles.keyDetailRow}>
          <div className={styles.keyDetailField}>
            <Controller
              name={`keyDetails.${index}.label`}
              control={control}
              render={({ field }) => (
                <Field
                  validationMessage={errors.keyDetails?.[index]?.label?.message}
                  validationState={errors.keyDetails?.[index]?.label ? 'error' : 'none'}
                >
                  <Input {...field} placeholder="Label" aria-label={`Key detail ${index + 1} label`} />
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
                  validationMessage={errors.keyDetails?.[index]?.value?.message}
                  validationState={errors.keyDetails?.[index]?.value ? 'error' : 'none'}
                >
                  <Input {...field} placeholder="Value" aria-label={`Key detail ${index + 1} value`} />
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
  );
}

// ---------------------------------------------------------------------------
// LinkButtonEditor
// ---------------------------------------------------------------------------

function LinkButtonEditor({ form }: { form: UseFormReturn<ComposeFormValues> }) {
  const styles = useStyles();
  const { control, formState: { errors } } = form;

  return (
    <div className={styles.ctaRow}>
      <div className={styles.ctaField}>
        <Controller
          name="buttonTitle"
          control={control}
          render={({ field }) => (
            <Field
              label="Label"
              validationMessage={errors.buttonTitle?.message}
              validationState={errors.buttonTitle ? 'error' : 'none'}
            >
              <Input {...field} value={field.value ?? ''} placeholder="Learn More" maxLength={200} />
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
              label="URL"
              validationMessage={errors.buttonLink?.message}
              validationState={errors.buttonLink ? 'error' : 'none'}
            >
              <Input {...field} value={field.value ?? ''} placeholder="https://..." type="url" />
            </Field>
          )}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FooterEditor
// ---------------------------------------------------------------------------

function FooterEditor({ form }: { form: UseFormReturn<ComposeFormValues> }) {
  const { control, formState: { errors } } = form;
  return (
    <Controller
      name="secondaryText"
      control={control}
      render={({ field }) => (
        <Field
          validationMessage={errors.secondaryText?.message}
          validationState={errors.secondaryText ? 'error' : 'none'}
        >
          <Textarea
            {...field}
            value={field.value ?? ''}
            placeholder="Add a footnote or disclaimer..."
            rows={3}
            resize="vertical"
            maxLength={2000}
          />
          <CharCount value={field.value} max={2000} />
        </Field>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// DividerEditor — no controls, just a visual indicator
// ---------------------------------------------------------------------------

function DividerEditor() {
  const styles = useStyles();
  return (
    <div className={styles.dividerIndicator}>
      <Text size={200}>--- Divider ---</Text>
    </div>
  );
}
