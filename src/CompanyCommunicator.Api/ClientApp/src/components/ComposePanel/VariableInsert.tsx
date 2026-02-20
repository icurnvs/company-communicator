import { useCallback, useRef, useState } from 'react';
import {
  makeStyles,
  tokens,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuGroup,
  MenuGroupHeader,
  MenuDivider,
  Button,
  Tooltip,
  Input,
  Field,
} from '@fluentui/react-components';
import {
  BracesVariable20Regular,
  Person16Regular,
  Building16Regular,
  Briefcase16Regular,
  Location16Regular,
  Add16Regular,
} from '@fluentui/react-icons';
import {
  RECIPIENT_VARIABLES,
  insertVariableAtCursor,
  allAudiencesAreChannelPosts,
} from '@/lib/variables';
import type { AudienceDto, CustomVariable } from '@/types';

const ICON_MAP = {
  Person: <Person16Regular />,
  Building: <Building16Regular />,
  Briefcase: <Briefcase16Regular />,
  Location: <Location16Regular />,
} as const;

const useStyles = makeStyles({
  newVarRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: tokens.spacingHorizontalXS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
  },
  newVarInput: {
    flex: 1,
    minWidth: '120px',
  },
  disabledHint: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground4,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
  },
});

export interface VariableInsertProps {
  /** Reference to the textarea this menu inserts variables into. */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Current audience settings (to determine if recipient vars are available). */
  allUsers: boolean;
  audiences: AudienceDto[] | null | undefined;
  /** Current custom variables for display. */
  customVariables: CustomVariable[] | null | undefined;
  /** Callback to add a new custom variable (name only — value set in panel). */
  onAddCustomVariable: (name: string) => void;
}

export function VariableInsert({
  textareaRef,
  allUsers,
  audiences,
  customVariables,
  onAddCustomVariable,
}: VariableInsertProps) {
  const styles = useStyles();
  const [newVarName, setNewVarName] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const channelOnly = allAudiencesAreChannelPosts(allUsers, audiences);

  const handleInsert = useCallback(
    (variableName: string) => {
      if (textareaRef.current) {
        insertVariableAtCursor(textareaRef.current, variableName);
      }
      setMenuOpen(false);
    },
    [textareaRef],
  );

  const handleAddCustomVar = useCallback(() => {
    const name = newVarName.trim().replace(/\s+/g, '_');
    if (!name) return;

    // Check for duplicates
    const exists =
      RECIPIENT_VARIABLES.some((v) => v.name === name) ||
      customVariables?.some((v) => v.name === name);
    if (exists) return;

    onAddCustomVariable(name);
    handleInsert(name);
    setNewVarName('');
  }, [newVarName, customVariables, onAddCustomVariable, handleInsert]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCustomVar();
      }
    },
    [handleAddCustomVar],
  );

  return (
    <Menu open={menuOpen} onOpenChange={(_e, data) => { setMenuOpen(data.open); }}>
      <MenuTrigger>
        <Tooltip content="Insert variable" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<BracesVariable20Regular />}
            aria-label="Insert variable"
          />
        </Tooltip>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {/* Recipient variables */}
          <MenuGroup>
            <MenuGroupHeader>Recipient Variables</MenuGroupHeader>
            {channelOnly && (
              <div className={styles.disabledHint}>
                Not available for channel posts
              </div>
            )}
            {RECIPIENT_VARIABLES.map((v) => (
              <MenuItem
                key={v.name}
                icon={ICON_MAP[v.icon]}
                disabled={channelOnly}
                onClick={() => { handleInsert(v.name); }}
                secondaryContent={`{{${v.name}}}`}
              >
                {v.label}
              </MenuItem>
            ))}
          </MenuGroup>

          <MenuDivider />

          {/* Custom variables */}
          <MenuGroup>
            <MenuGroupHeader>Custom Variables</MenuGroupHeader>
            {(customVariables ?? []).map((v) => (
              <MenuItem
                key={v.name}
                icon={<BracesVariable20Regular />}
                onClick={() => { handleInsert(v.name); }}
                secondaryContent={`{{${v.name}}}`}
              >
                {v.name}
              </MenuItem>
            ))}

            {/* Add new custom variable inline */}
            <div className={styles.newVarRow}>
              <Field className={styles.newVarInput}>
                <Input
                  ref={inputRef}
                  size="small"
                  value={newVarName}
                  onChange={(_e, data) => { setNewVarName(data.value); }}
                  onKeyDown={handleKeyDown}
                  placeholder="New variable name..."
                  // Prevent menu close on input interaction
                  onClick={(e) => { e.stopPropagation(); }}
                />
              </Field>
              <Button
                appearance="subtle"
                size="small"
                icon={<Add16Regular />}
                disabled={!newVarName.trim()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddCustomVar();
                }}
                aria-label="Add custom variable"
              />
            </div>
          </MenuGroup>
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
