import { useState } from 'react';
import { Controller, useFieldArray } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import {
  makeStyles,
  tokens,
  Button,
  Input,
  Field,
  Text,
  Caption1,
} from '@fluentui/react-components';
import {
  Add16Regular,
  Delete16Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  BracesVariable20Regular,
} from '@fluentui/react-icons';
import type { ComposeFormValues } from '@/lib/validators';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },

  header: {
    display: 'flex',
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

  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },

  row: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },

  nameField: {
    flex: '0 0 35%',
    minWidth: 0,
  },

  valueField: {
    flex: 1,
    minWidth: 0,
  },

  removeBtn: {
    flexShrink: 0,
    marginBottom: '2px',
  },

  hint: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground3,
  },
});

export interface CustomVariablesPanelProps {
  form: UseFormReturn<ComposeFormValues>;
}

export function CustomVariablesPanel({ form }: CustomVariablesPanelProps) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);

  const {
    control,
    formState: { errors },
  } = form;

  const {
    fields,
    append,
    remove,
  } = useFieldArray({ control, name: 'customVariables' });

  const count = fields.length;

  const handleAddVariable = () => {
    append({ name: '', value: '' });
    if (!expanded) setExpanded(true);
  };

  // If no custom variables and panel is collapsed, show add link
  if (count === 0 && !expanded) {
    return (
      <button
        type="button"
        className={styles.header}
        onClick={() => {
          handleAddVariable();
        }}
      >
        <BracesVariable20Regular />
        Add custom variables
      </button>
    );
  }

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.header}
        onClick={() => { setExpanded(!expanded); }}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
        Custom Variables
        {count > 0 && (
          <Caption1 style={{ fontWeight: 'normal' }}>
            ({count})
          </Caption1>
        )}
      </button>

      {expanded && (
        <div className={styles.container}>
          <Text className={styles.hint}>
            Define variables to use in your message. Insert them as {'{{variableName}}'} in any text field.
          </Text>

          {fields.length === 0 ? (
            <div className={styles.emptyState}>
              <BracesVariable20Regular />
              <Caption1>No custom variables yet</Caption1>
            </div>
          ) : (
            fields.map((field, index) => (
              <div key={field.id} className={styles.row}>
                <div className={styles.nameField}>
                  <Controller
                    name={`customVariables.${index}.name`}
                    control={control}
                    render={({ field: f }) => (
                      <Field
                        validationMessage={
                          errors.customVariables?.[index]?.name?.message
                        }
                        validationState={
                          errors.customVariables?.[index]?.name ? 'error' : 'none'
                        }
                      >
                        <Input
                          {...f}
                          size="small"
                          placeholder="Variable name"
                          aria-label={`Custom variable ${index + 1} name`}
                        />
                      </Field>
                    )}
                  />
                </div>
                <div className={styles.valueField}>
                  <Controller
                    name={`customVariables.${index}.value`}
                    control={control}
                    render={({ field: f }) => (
                      <Field
                        validationMessage={
                          errors.customVariables?.[index]?.value?.message
                        }
                        validationState={
                          errors.customVariables?.[index]?.value ? 'error' : 'none'
                        }
                      >
                        <Input
                          {...f}
                          size="small"
                          placeholder="Value"
                          aria-label={`Custom variable ${index + 1} value`}
                        />
                      </Field>
                    )}
                  />
                </div>
                <div className={styles.removeBtn}>
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<Delete16Regular />}
                    onClick={() => { remove(index); }}
                    aria-label={`Remove variable ${index + 1}`}
                  />
                </div>
              </div>
            ))
          )}

          <Button
            appearance="subtle"
            size="small"
            icon={<Add16Regular />}
            onClick={handleAddVariable}
            style={{ alignSelf: 'flex-start' }}
          >
            Add variable
          </Button>
        </div>
      )}
    </div>
  );
}
