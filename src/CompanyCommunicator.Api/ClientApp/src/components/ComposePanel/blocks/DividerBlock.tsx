import {
  makeStyles,
  tokens,
  Text,
} from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} 0`,
  },
  line: {
    flex: 1,
    height: '1px',
    backgroundColor: tokens.colorNeutralStroke2,
  },
});

export function DividerBlock() {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <div className={styles.line} />
      <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
        Divider
      </Text>
      <div className={styles.line} />
    </div>
  );
}
