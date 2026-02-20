import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import {
  makeStyles,
  tokens,
  Switch,
  Text,
  Caption1,
  Spinner,
  InteractionTag,
  InteractionTagPrimary,
  InteractionTagSecondary,
  Combobox,
  Option,
  Field,
  Divider,
} from '@fluentui/react-components';
import {
  People24Regular,
  ChatMultiple24Regular,
  PersonCall24Regular,
} from '@fluentui/react-icons';
import type { ComposeFormValues } from '@/lib/validators';
import type { AudienceDto } from '@/types';
import { useSearchTeams } from '@/api/teams';
import { useSearchGroups } from '@/api/groups';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECENT_AUDIENCES_KEY = 'cc-recent-audiences';
const RECENT_AUDIENCES_MAX = 10;
const DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Internal state model
// ---------------------------------------------------------------------------

interface SelectedAudience {
  id: string;
  name: string;
  type: 'team' | 'group';
  deliveryMode: 'channel' | 'individual';
}

interface RecentAudienceEntry {
  id: string;
  name: string;
  type: 'team' | 'group';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toAudienceDtos(selected: SelectedAudience[]): AudienceDto[] {
  return selected.map((s) => {
    if (s.type === 'team' && s.deliveryMode === 'channel') {
      return { audienceType: 'Team', audienceId: s.id };
    }
    if (s.type === 'team' && s.deliveryMode === 'individual') {
      return { audienceType: 'Roster', audienceId: s.id };
    }
    // group — always individual
    return { audienceType: 'Group', audienceId: s.id };
  });
}

function loadRecentAudiences(): RecentAudienceEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_AUDIENCES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentAudienceEntry[];
  } catch {
    return [];
  }
}

function saveRecentAudiences(entries: RecentAudienceEntry[]): void {
  try {
    localStorage.setItem(RECENT_AUDIENCES_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage errors (e.g., private browsing with quota 0)
  }
}

function addToRecent(entry: RecentAudienceEntry): void {
  const existing = loadRecentAudiences().filter((r) => r.id !== entry.id);
  const updated = [entry, ...existing].slice(0, RECENT_AUDIENCES_MAX);
  saveRecentAudiences(updated);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    height: 0, // Force flex-allocated height; prevents content from inflating
  },

  // Left column: Search & Select (~50%)
  leftColumn: {
    flex: '0 0 50%',
    overflowY: 'auto',
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    minWidth: 0,
  },

  // Right column: Selection & Summary (~50%)
  rightColumn: {
    flex: '0 0 50%',
    overflowY: 'auto',
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    minWidth: 0,
  },

  // "Send to everyone" toggle row
  everyoneRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },

  everyoneSwitchRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  everyoneLabel: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },

  everyoneSublabel: {
    color: tokens.colorNeutralForeground3,
  },

  // Search section headers
  sectionHeader: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    marginBottom: tokens.spacingVerticalXS,
  },

  searchSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },

  // Right column section labels
  sectionLabel: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },

  chipList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },

  // Container for a single chip row
  chipRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },

  chipMeta: {
    paddingLeft: tokens.spacingHorizontalXS,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },

  // Link button (inline text link)
  linkBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    color: tokens.colorBrandForeground1,
    fontSize: tokens.fontSizeBase200,
    fontFamily: 'inherit',
    ':hover': {
      textDecoration: 'underline',
      color: tokens.colorBrandForeground2,
    },
  },

  emptySection: {
    color: tokens.colorNeutralForeground4,
    fontStyle: 'italic',
    fontSize: tokens.fontSizeBase200,
    padding: `${tokens.spacingVerticalXS} 0`,
  },

  // Recently used ghost chips
  recentSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },

  recentChipList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
  },

  // Summary card at the bottom
  summaryCard: {
    marginTop: 'auto',
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },

  summaryReachNumber: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase500,
  },

  summaryReachLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },

  summaryAudienceCount: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase300,
  },

  // Validation error text
  errorText: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: tokens.fontSizeBase200,
  },

  // Disabled overlay for search sections
  disabledSection: {
    opacity: 0.4,
    pointerEvents: 'none',
  },
});

// ---------------------------------------------------------------------------
// useDebounce hook
// ---------------------------------------------------------------------------

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => { setDebounced(value); }, delay);
    return () => { clearTimeout(id); };
  }, [value, delay]);
  return debounced;
}

// ---------------------------------------------------------------------------
// TeamSearch sub-component
// ---------------------------------------------------------------------------

interface TeamSearchProps {
  onSelect: (id: string, name: string) => void;
  disabled?: boolean;
}

function TeamSearch({ onSelect, disabled }: TeamSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const debouncedQuery = useDebounce(inputValue, DEBOUNCE_MS);
  const { data: teams, isFetching } = useSearchTeams(debouncedQuery);
  const styles = useStyles();

  const handleSelect = useCallback(
    (_e: React.SyntheticEvent, data: { optionValue?: string; optionText?: string }) => {
      if (!data.optionValue || !data.optionText) return;
      onSelect(data.optionValue, data.optionText);
      setInputValue('');
    },
    [onSelect],
  );

  return (
    <div className={disabled ? styles.disabledSection : undefined}>
      <Field label="Teams" hint="Search and add a team channel or roster.">
        <Combobox
          placeholder="Search teams..."
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); }}
          onOptionSelect={handleSelect}
          freeform
          disabled={disabled}
          expandIcon={isFetching ? <Spinner size="tiny" /> : undefined}
          aria-label="Search teams"
        >
          {(teams ?? []).map((team) => (
            <Option key={team.teamId} value={team.teamId} text={team.name ?? team.teamId}>
              {team.name ?? team.teamId}
            </Option>
          ))}
          {debouncedQuery.length >= 2 && !isFetching && (teams ?? []).length === 0 && (
            <Option value="" disabled>
              No teams found
            </Option>
          )}
          {debouncedQuery.length < 2 && (
            <Option value="" disabled>
              Type at least 2 characters to search
            </Option>
          )}
        </Combobox>
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupSearch sub-component
// ---------------------------------------------------------------------------

interface GroupSearchProps {
  onSelect: (id: string, name: string) => void;
  disabled?: boolean;
}

function GroupSearch({ onSelect, disabled }: GroupSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const debouncedQuery = useDebounce(inputValue, DEBOUNCE_MS);
  const { data: groups, isFetching } = useSearchGroups(debouncedQuery);
  const styles = useStyles();

  const handleSelect = useCallback(
    (_e: React.SyntheticEvent, data: { optionValue?: string; optionText?: string }) => {
      if (!data.optionValue || !data.optionText) return;
      onSelect(data.optionValue, data.optionText);
      setInputValue('');
    },
    [onSelect],
  );

  return (
    <div className={disabled ? styles.disabledSection : undefined}>
      <Field label="Groups" hint="Search and add a Microsoft 365 group.">
        <Combobox
          placeholder="Search groups..."
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); }}
          onOptionSelect={handleSelect}
          freeform
          disabled={disabled}
          expandIcon={isFetching ? <Spinner size="tiny" /> : undefined}
          aria-label="Search groups"
        >
          {(groups ?? []).map((group) => (
            <Option
              key={group.groupId}
              value={group.groupId}
              text={group.displayName ?? group.groupId}
            >
              {group.displayName ?? group.groupId}
            </Option>
          ))}
          {debouncedQuery.length >= 2 && !isFetching && (groups ?? []).length === 0 && (
            <Option value="" disabled>
              No groups found
            </Option>
          )}
          {debouncedQuery.length < 2 && (
            <Option value="" disabled>
              Type at least 2 characters to search
            </Option>
          )}
        </Combobox>
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChannelChip — a team in channel-post mode
// ---------------------------------------------------------------------------

interface ChannelChipProps {
  audience: SelectedAudience;
  onRemove: (id: string) => void;
  onMoveToIndividual: (id: string) => void;
}

function ChannelChip({ audience, onRemove, onMoveToIndividual }: ChannelChipProps) {
  const styles = useStyles();
  return (
    <div className={styles.chipRow}>
      <InteractionTag appearance="filled" shape="rounded" size="medium">
        <InteractionTagPrimary
          icon={<ChatMultiple24Regular />}
          hasSecondaryAction
        >
          {audience.name} · General
        </InteractionTagPrimary>
        <InteractionTagSecondary
          aria-label={`Remove ${audience.name}`}
          onClick={() => { onRemove(audience.id); }}
        />
      </InteractionTag>
      <div className={styles.chipMeta}>
        <button
          type="button"
          className={styles.linkBtn}
          onClick={() => { onMoveToIndividual(audience.id); }}
        >
          Send to members instead
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IndividualChip — a team or group in individual-message mode
// ---------------------------------------------------------------------------

interface IndividualChipProps {
  audience: SelectedAudience;
  onRemove: (id: string) => void;
  onMoveToChannel?: (id: string) => void;
}

function IndividualChip({ audience, onRemove, onMoveToChannel }: IndividualChipProps) {
  const styles = useStyles();

  const label =
    audience.type === 'group'
      ? audience.name
      : audience.name;

  const icon =
    audience.type === 'group' ? <People24Regular /> : <PersonCall24Regular />;

  return (
    <div className={styles.chipRow}>
      <InteractionTag
        appearance="filled"
        shape="rounded"
        size="medium"
        // Teams = brand color (default), Groups = slight visual difference via style
        style={
          audience.type === 'group'
            ? { '--fui-InteractionTag__primary--background': tokens.colorPalettePurpleBackground2 } as React.CSSProperties
            : undefined
        }
      >
        <InteractionTagPrimary icon={icon} hasSecondaryAction>
          {label}
        </InteractionTagPrimary>
        <InteractionTagSecondary
          aria-label={`Remove ${audience.name}`}
          onClick={() => { onRemove(audience.id); }}
        />
      </InteractionTag>
      {audience.type === 'team' && onMoveToChannel && (
        <div className={styles.chipMeta}>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => { onMoveToChannel(audience.id); }}
          >
            Send to channel instead
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecentGhostChip
// ---------------------------------------------------------------------------

interface RecentGhostChipProps {
  entry: RecentAudienceEntry;
  alreadyAdded: boolean;
  onClick: (entry: RecentAudienceEntry) => void;
}

function RecentGhostChip({ entry, alreadyAdded, onClick }: RecentGhostChipProps) {
  const icon = entry.type === 'group' ? <People24Regular /> : <ChatMultiple24Regular />;
  return (
    <InteractionTag
      appearance="outline"
      shape="rounded"
      size="small"
      style={{ opacity: alreadyAdded ? 0.5 : 1 }}
    >
      <InteractionTagPrimary
        icon={icon}
        onClick={alreadyAdded ? undefined : () => { onClick(entry); }}
        style={{ cursor: alreadyAdded ? 'default' : 'pointer' }}
      >
        {entry.name}
      </InteractionTagPrimary>
    </InteractionTag>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AudienceTabProps {
  form: UseFormReturn<ComposeFormValues>;
}

// ---------------------------------------------------------------------------
// AudienceTab
// ---------------------------------------------------------------------------

export function AudienceTab({ form }: AudienceTabProps) {
  const styles = useStyles();

  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const allUsers = watch('allUsers');
  const formAudiences = watch('audiences');

  // -------------------------------------------------------------------------
  // Internal selected-audiences state
  // -------------------------------------------------------------------------

  // Initialize from existing form audiences (e.g. when editing a draft)
  const initializedRef = useRef(false);
  const [selected, setSelected] = useState<SelectedAudience[]>([]);

  useEffect(() => {
    if (initializedRef.current) return;
    const existing = formAudiences ?? [];
    if (existing.length > 0) {
      const reconstructed: SelectedAudience[] = existing.map((a) => ({
        id: a.audienceId,
        name: a.audienceId, // Name not stored in AudienceDto; use ID as fallback
        type: a.audienceType === 'Group' ? 'group' : 'team',
        deliveryMode: a.audienceType === 'Team' ? 'channel' : 'individual',
      }));
      setSelected(reconstructed);
      initializedRef.current = true;
    }
  }, [formAudiences]);

  // -------------------------------------------------------------------------
  // Sync internal state -> form audiences
  // -------------------------------------------------------------------------

  const syncToForm = useCallback((next: SelectedAudience[]) => {
    setValue('audiences', toAudienceDtos(next), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [setValue]);

  // -------------------------------------------------------------------------
  // Recently used
  // -------------------------------------------------------------------------

  const [recentAudiences, setRecentAudiences] = useState<RecentAudienceEntry[]>(
    loadRecentAudiences,
  );

  // -------------------------------------------------------------------------
  // Add audience (from search or recent)
  // -------------------------------------------------------------------------

  const addAudience = useCallback(
    (id: string, name: string, type: 'team' | 'group') => {
      setSelected((prev) => {
        if (prev.some((s) => s.id === id)) return prev;
        const next: SelectedAudience[] = [
          ...prev,
          {
            id,
            name,
            type,
            // Teams default to channel, groups always individual
            deliveryMode: type === 'team' ? 'channel' : 'individual',
          },
        ];
        syncToForm(next);
        return next;
      });

      // Update recently used
      const entry: RecentAudienceEntry = { id, name, type };
      addToRecent(entry);
      setRecentAudiences(loadRecentAudiences());
    },
    [syncToForm],
  );

  // -------------------------------------------------------------------------
  // Remove audience
  // -------------------------------------------------------------------------

  const removeAudience = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = prev.filter((s) => s.id !== id);
        syncToForm(next);
        return next;
      });
    },
    [syncToForm],
  );

  // -------------------------------------------------------------------------
  // Move team between channel / individual
  // -------------------------------------------------------------------------

  const moveToIndividual = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = prev.map((s) =>
          s.id === id ? { ...s, deliveryMode: 'individual' as const } : s,
        );
        syncToForm(next);
        return next;
      });
    },
    [syncToForm],
  );

  const moveToChannel = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = prev.map((s) =>
          s.id === id ? { ...s, deliveryMode: 'channel' as const } : s,
        );
        syncToForm(next);
        return next;
      });
    },
    [syncToForm],
  );

  // -------------------------------------------------------------------------
  // Add from recently used
  // -------------------------------------------------------------------------

  const addFromRecent = useCallback(
    (entry: RecentAudienceEntry) => {
      addAudience(entry.id, entry.name, entry.type);
    },
    [addAudience],
  );

  // -------------------------------------------------------------------------
  // Derived lists
  // -------------------------------------------------------------------------

  const channelPosts = selected.filter(
    (s) => s.type === 'team' && s.deliveryMode === 'channel',
  );
  const individualMessages = selected.filter(
    (s) => s.deliveryMode === 'individual',
  );

  const selectedIds = new Set(selected.map((s) => s.id));

  // -------------------------------------------------------------------------
  // Estimated reach
  // -------------------------------------------------------------------------

  // Channel posts count as 1 per team (sends to channel).
  // Individual messages: no member count available from API, show per-audience.
  const estimatedReach = allUsers
    ? null
    : channelPosts.length + individualMessages.length;

  // -------------------------------------------------------------------------
  // Audience count
  // -------------------------------------------------------------------------

  const audienceCount = allUsers ? 1 : selected.length;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className={styles.root}>
      {/* -------------------------------------------------------------------- */}
      {/* Left column: Search & Select                                           */}
      {/* -------------------------------------------------------------------- */}
      <div className={styles.leftColumn}>
        {/* Send to everyone */}
        <div className={styles.everyoneRow}>
          <div className={styles.everyoneSwitchRow}>
            <Text className={styles.everyoneLabel}>Send to everyone</Text>
            <Controller
              name="allUsers"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onChange={(_e, data) => {
                    field.onChange(data.checked);
                    // When enabling allUsers, clear specific audiences
                    if (data.checked) {
                      setSelected([]);
                      setValue('audiences', [], {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                  aria-label="Send to everyone in the organization"
                />
              )}
            />
          </div>
          <Caption1 className={styles.everyoneSublabel}>
            All users in your organization.
          </Caption1>
        </div>

        {/* Teams search */}
        <div className={styles.searchSection}>
          <Text className={styles.sectionHeader}>Teams</Text>
          <TeamSearch
            onSelect={(id, name) => { addAudience(id, name, 'team'); }}
            disabled={allUsers}
          />
        </div>

        {/* Groups search */}
        <div className={styles.searchSection}>
          <Text className={styles.sectionHeader}>Groups</Text>
          <GroupSearch
            onSelect={(id, name) => { addAudience(id, name, 'group'); }}
            disabled={allUsers}
          />
        </div>

        {/* Audiences validation error */}
        {errors.audiences?.root?.message && (
          <Text className={styles.errorText}>
            {errors.audiences.root.message}
          </Text>
        )}
        {/* Zod root refine puts the message on audiences directly */}
        {'message' in (errors.audiences ?? {}) && (
          <Text className={styles.errorText}>
            {(errors.audiences as { message?: string } | undefined)?.message}
          </Text>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Right column: Selection & Summary                                     */}
      {/* -------------------------------------------------------------------- */}
      <div className={styles.rightColumn}>
        {/* ------------------------------------------------------------------ */}
        {/* Channel Posts section                                               */}
        {/* ------------------------------------------------------------------ */}
        <div>
          <Caption1 className={styles.sectionLabel}>Channel Posts</Caption1>
          <div className={styles.chipList} style={{ marginTop: tokens.spacingVerticalS }}>
            {channelPosts.length === 0 ? (
              <Text className={styles.emptySection}>
                No teams added yet. Teams default here.
              </Text>
            ) : (
              channelPosts.map((a) => (
                <ChannelChip
                  key={a.id}
                  audience={a}
                  onRemove={removeAudience}
                  onMoveToIndividual={moveToIndividual}
                />
              ))
            )}
          </div>
        </div>

        <Divider />

        {/* ------------------------------------------------------------------ */}
        {/* Individual Messages section                                         */}
        {/* ------------------------------------------------------------------ */}
        <div>
          <Caption1 className={styles.sectionLabel}>Individual Messages</Caption1>
          <div className={styles.chipList} style={{ marginTop: tokens.spacingVerticalS }}>
            {individualMessages.length === 0 ? (
              <Text className={styles.emptySection}>
                No audiences added. Groups always deliver here.
              </Text>
            ) : (
              individualMessages.map((a) => (
                <IndividualChip
                  key={a.id}
                  audience={a}
                  onRemove={removeAudience}
                  onMoveToChannel={a.type === 'team' ? moveToChannel : undefined}
                />
              ))
            )}
          </div>
        </div>

        <Divider />

        {/* ------------------------------------------------------------------ */}
        {/* Recently used                                                       */}
        {/* ------------------------------------------------------------------ */}
        {recentAudiences.length > 0 && (
          <div className={styles.recentSection}>
            <Caption1 className={styles.sectionLabel}>Recently used</Caption1>
            <div className={styles.recentChipList}>
              {recentAudiences.map((entry) => (
                <RecentGhostChip
                  key={entry.id}
                  entry={entry}
                  alreadyAdded={selectedIds.has(entry.id)}
                  onClick={addFromRecent}
                />
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Summary card                                                        */}
        {/* ------------------------------------------------------------------ */}
        <div className={styles.summaryCard}>
          {allUsers ? (
            <>
              <Text className={styles.summaryAudienceCount}>
                Sending to everyone
              </Text>
              <Text className={styles.summaryReachLabel}>
                All users in your organization will receive this message.
              </Text>
            </>
          ) : (
            <>
              <Text className={styles.summaryAudienceCount}>
                {audienceCount === 0
                  ? 'No audiences selected'
                  : audienceCount === 1
                  ? '1 audience selected'
                  : `${audienceCount} audiences selected`}
              </Text>
              {estimatedReach !== null && estimatedReach > 0 && (
                <>
                  <Text className={styles.summaryReachNumber}>
                    ~{estimatedReach}
                  </Text>
                  <Text className={styles.summaryReachLabel}>
                    estimated reach
                    {channelPosts.length > 0 && individualMessages.length > 0
                      ? ' (channels + individuals)'
                      : channelPosts.length > 0
                      ? ' (channel posts)'
                      : ' (individual messages)'}
                  </Text>
                </>
              )}
              {estimatedReach === 0 && (
                <Text className={styles.summaryReachLabel}>
                  Add audiences using the search fields on the left.
                </Text>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
