import {
  makeStyles,
  tokens,
  Caption1,
  mergeClasses,
} from '@fluentui/react-components';
import { Checkmark12Filled } from '@fluentui/react-icons';
import { BUILTIN_THEMES } from '@/lib/builtinThemes';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },

  swatch: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalXXS,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: tokens.spacingHorizontalXXS,
    borderRadius: tokens.borderRadiusMedium,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    ':focus-visible': {
      outlineWidth: '2px',
      outlineStyle: 'solid',
      outlineColor: tokens.colorStrokeFocus2,
      outlineOffset: '2px',
    },
  },

  circle: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transitionProperty: 'transform, box-shadow',
    transitionDuration: tokens.durationNormal,
    transitionTimingFunction: tokens.curveEasyEase,
    boxShadow: `0 0 0 2px ${tokens.colorNeutralBackground1}, 0 0 0 3px transparent`,
  },

  circleSelected: {
    transform: 'scale(1.15)',
    boxShadow: `0 0 0 2px ${tokens.colorNeutralBackground1}, 0 0 0 3px ${tokens.colorNeutralStrokeAccessible}`,
  },

  checkmark: {
    filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.4))',
  },

  label: {
    color: tokens.colorNeutralForeground2,
    textAlign: 'center',
    maxWidth: '48px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  labelSelected: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ThemePickerProps {
  selectedThemeId: string;
  onSelectTheme: (themeId: string) => void;
}

// ---------------------------------------------------------------------------
// ThemePicker
// ---------------------------------------------------------------------------

export function ThemePicker({ selectedThemeId, onSelectTheme }: ThemePickerProps) {
  const styles = useStyles();

  return (
    <div className={styles.root} role="radiogroup" aria-label="Card color theme">
      {BUILTIN_THEMES.map((theme) => {
        const isSelected = theme.id === selectedThemeId;
        return (
          <button
            key={theme.id}
            type="button"
            className={styles.swatch}
            role="radio"
            aria-checked={isSelected}
            aria-label={theme.name}
            onClick={() => { onSelectTheme(theme.id); }}
          >
            <div
              className={mergeClasses(styles.circle, isSelected && styles.circleSelected)}
              style={{ backgroundColor: theme.accentColor }}
            >
              {isSelected && <Checkmark12Filled className={styles.checkmark} style={{ color: theme.accentForeground }} />}
            </div>
            <Caption1 className={mergeClasses(styles.label, isSelected && styles.labelSelected)}>
              {theme.name}
            </Caption1>
          </button>
        );
      })}
    </div>
  );
}
