import { useState, useCallback, useMemo, useRef } from 'react';
import {
  makeStyles,
  tokens,
  Switch,
  Text,
  Badge,
  Button,
  Combobox,
  Option,
  Checkbox,
  Divider,
  Field,
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components';
import {
  Dismiss16Regular,
  People24Regular,
  Building24Regular,
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import { useSearchTeams } from '@/api/teams';
import { useSearchGroups } from '@/api/groups';
import type { AudienceDto } from '@/types';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  allUsersSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  allUsersSwitchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  selectionSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  sectionTitle: {
    fontWeight: tokens.fontWeightSemibold,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalXS,
  },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  combobox: {
    width: '100%',
    maxWidth: '400px',
  },
  teamItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  rosterSection: {
    marginTop: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
});

interface AudiencePickerProps {
  value: AudienceDto[];
  allUsers: boolean;
  onAllUsersChange: (value: boolean) => void;
  onAudiencesChange: (audiences: AudienceDto[]) => void;
  error?: string;
}

// Derive selected teams, rosters, groups from flat AudienceDto[]
function useAudienceState(
  audiences: AudienceDto[],
  onChange: (audiences: AudienceDto[]) => void,
) {
  const selectedTeamIds = useMemo(
    () =>
      new Set(
        audiences
          .filter((a) => a.audienceType === 'Team')
          .map((a) => a.audienceId),
      ),
    [audiences],
  );

  const selectedRosterIds = useMemo(
    () =>
      new Set(
        audiences
          .filter((a) => a.audienceType === 'Roster')
          .map((a) => a.audienceId),
      ),
    [audiences],
  );

  const selectedGroupIds = useMemo(
    () =>
      new Set(
        audiences
          .filter((a) => a.audienceType === 'Group')
          .map((a) => a.audienceId),
      ),
    [audiences],
  );

  const addTeam = useCallback(
    (teamId: string) => {
      if (!selectedTeamIds.has(teamId)) {
        onChange([
          ...audiences,
          { audienceType: 'Team', audienceId: teamId },
        ]);
      }
    },
    [audiences, selectedTeamIds, onChange],
  );

  const toggleRoster = useCallback(
    (teamId: string) => {
      if (selectedRosterIds.has(teamId)) {
        onChange(
          audiences.filter(
            (a) => !(a.audienceType === 'Roster' && a.audienceId === teamId),
          ),
        );
      } else {
        onChange([
          ...audiences,
          { audienceType: 'Roster', audienceId: teamId },
        ]);
      }
    },
    [audiences, selectedRosterIds, onChange],
  );

  const addGroup = useCallback(
    (groupId: string) => {
      if (!selectedGroupIds.has(groupId)) {
        onChange([
          ...audiences,
          { audienceType: 'Group', audienceId: groupId },
        ]);
      }
    },
    [audiences, selectedGroupIds, onChange],
  );

  const removeGroup = useCallback(
    (groupId: string) => {
      onChange(
        audiences.filter(
          (a) => !(a.audienceType === 'Group' && a.audienceId === groupId),
        ),
      );
    },
    [audiences, onChange],
  );

  const removeTeam = useCallback(
    (teamId: string) => {
      onChange(
        audiences.filter(
          (a) =>
            !(
              (a.audienceType === 'Team' || a.audienceType === 'Roster') &&
              a.audienceId === teamId
            ),
        ),
      );
    },
    [audiences, onChange],
  );

  return {
    selectedTeamIds,
    selectedRosterIds,
    selectedGroupIds,
    addTeam,
    toggleRoster,
    addGroup,
    removeGroup,
    removeTeam,
  };
}

export function AudiencePicker({
  value,
  allUsers,
  onAllUsersChange,
  onAudiencesChange,
  error,
}: AudiencePickerProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const [teamSearch, setTeamSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');

  const { data: teamSearchResults, isFetching: teamsSearching } =
    useSearchTeams(teamSearch);
  const { data: groupSearchResults, isFetching: groupsSearching } =
    useSearchGroups(groupSearch);

  const {
    selectedTeamIds,
    selectedRosterIds,
    selectedGroupIds,
    addTeam,
    toggleRoster,
    addGroup,
    removeGroup,
    removeTeam,
  } = useAudienceState(value, onAudiencesChange);

  // Persistent cache of team names across searches so selected teams
  // retain display names even when the search query changes.
  const teamNameCacheRef = useRef(new Map<string, string>());
  (teamSearchResults ?? []).forEach((t) => {
    teamNameCacheRef.current.set(t.teamId, t.name ?? t.teamId);
  });

  const getTeamName = useCallback(
    (id: string) => teamNameCacheRef.current.get(id) ?? id,
    [],
  );

  // Build display maps for selected groups
  const selectedGroupAudiences = value.filter(
    (a) => a.audienceType === 'Group',
  );

  const groupDisplayNames = useMemo(() => {
    const map = new Map<string, string>();
    (groupSearchResults ?? []).forEach((g) =>
      map.set(g.groupId, g.displayName ?? g.groupId),
    );
    return map;
  }, [groupSearchResults]);

  const selectedTeamList = Array.from(selectedTeamIds).map((id) => ({
    id,
    name: getTeamName(id),
    hasRoster: selectedRosterIds.has(id),
  }));

  return (
    <div className={styles.container} aria-label={t('audiencePicker.title')}>
      {/* All Users toggle */}
      <div className={styles.allUsersSection}>
        <div className={styles.allUsersSwitchRow}>
          <People24Regular />
          <Switch
            checked={allUsers}
            onChange={(_e, data) => { onAllUsersChange(data.checked); }}
            label={t('audiencePicker.allUsers.label')}
            aria-describedby="allUsersDescription"
          />
        </div>
        <Text
          id="allUsersDescription"
          size={200}
          style={{ color: tokens.colorNeutralForeground3 }}
        >
          {t('audiencePicker.allUsers.description')}
        </Text>
      </div>

      {!allUsers && (
        <>
          <Divider />

          <div className={styles.selectionSection}>
            {/* Teams section - search via Graph */}
            <Field
              label={
                <span className={styles.sectionTitle}>
                  <Building24Regular />
                  {t('audiencePicker.teams.label')}
                </span>
              }
            >
              <Combobox
                className={styles.combobox}
                placeholder={t('audiencePicker.teams.placeholder')}
                value={teamSearch}
                onChange={(e) => { setTeamSearch(e.target.value); }}
                onOptionSelect={(_e, data) => {
                  if (data.optionValue) {
                    addTeam(data.optionValue);
                    setTeamSearch('');
                  }
                }}
                aria-label={t('audiencePicker.teams.label')}
              >
                {teamsSearching ? (
                  <Option value="" disabled>
                    {t('audiencePicker.teams.searching')}
                  </Option>
                ) : (teamSearchResults ?? []).length === 0 &&
                  teamSearch.length >= 2 ? (
                  <Option value="" disabled>
                    {t('audiencePicker.teams.noTeams')}
                  </Option>
                ) : (
                  (teamSearchResults ?? [])
                    .filter((t) => !selectedTeamIds.has(t.teamId))
                    .map((team) => (
                      <Option key={team.teamId} value={team.teamId}>
                        {team.name ?? team.teamId}
                      </Option>
                    ))
                )}
              </Combobox>
            </Field>

            {/* Selected teams with roster option */}
            {selectedTeamList.length > 0 && (
              <div className={styles.rosterSection}>
                {selectedTeamList.map((team) => (
                  <div key={team.id}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text weight="semibold">{team.name}</Text>
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={<Dismiss16Regular />}
                        onClick={() => { removeTeam(team.id); }}
                        aria-label={t('audiencePicker.removeItem', {
                          name: team.name,
                        })}
                      />
                    </div>
                    <Checkbox
                      checked={team.hasRoster}
                      onChange={() => { toggleRoster(team.id); }}
                      label={t('audiencePicker.roster.label')}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Groups section */}
            <Field
              label={
                <span className={styles.sectionTitle}>
                  <People24Regular />
                  {t('audiencePicker.groups.label')}
                </span>
              }
            >
              <Combobox
                className={styles.combobox}
                placeholder={t('audiencePicker.groups.placeholder')}
                value={groupSearch}
                onChange={(e) => { setGroupSearch(e.target.value); }}
                onOptionSelect={(_e, data) => {
                  if (data.optionValue) {
                    addGroup(data.optionValue);
                    setGroupSearch('');
                  }
                }}
                aria-label={t('audiencePicker.groups.label')}
              >
                {groupsSearching ? (
                  <Option value="" disabled>
                    {t('audiencePicker.groups.searching')}
                  </Option>
                ) : (groupSearchResults ?? []).length === 0 &&
                  groupSearch.length >= 2 ? (
                  <Option value="" disabled>
                    {t('audiencePicker.groups.noGroups')}
                  </Option>
                ) : (
                  (groupSearchResults ?? [])
                    .filter((g) => !selectedGroupIds.has(g.groupId))
                    .map((group) => (
                      <Option key={group.groupId} value={group.groupId}>
                        {group.displayName ?? group.groupId}
                      </Option>
                    ))
                )}
              </Combobox>
            </Field>

            {/* Selected groups chips */}
            {selectedGroupAudiences.length > 0 && (
              <div className={styles.chipRow}>
                {selectedGroupAudiences.map((audience) => {
                  const name =
                    groupDisplayNames.get(audience.audienceId) ??
                    audience.audienceId;
                  return (
                    <Badge
                      key={audience.audienceId}
                      appearance="outline"
                      color="brand"
                      className={styles.chip}
                    >
                      {name}
                      <Button
                        appearance="transparent"
                        size="small"
                        icon={<Dismiss16Regular />}
                        onClick={() => { removeGroup(audience.audienceId); }}
                        aria-label={t('audiencePicker.removeItem', { name })}
                        style={{ minWidth: 'unset', padding: '0 2px' }}
                      />
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}
