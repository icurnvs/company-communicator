import { useState, useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Button,
  Textarea,
  Text,
  MessageBar,
  MessageBarBody,
  Card,
  CardHeader,
} from '@fluentui/react-components';

const DEV_TOKEN_KEY = 'CC_DEV_TOKEN';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: tokens.spacingHorizontalXXL,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  card: {
    maxWidth: '560px',
    width: '100%',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: `0 ${tokens.spacingHorizontalL} ${tokens.spacingVerticalL}`,
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalM,
  },
});

/** Check whether localStorage has a non-expired dev token. */
export function hasValidDevToken(): boolean {
  const token = localStorage.getItem(DEV_TOKEN_KEY);
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!)) as { exp?: number };
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(DEV_TOKEN_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Read the stored dev token (caller should check hasValidDevToken first). */
export function getDevToken(): string | null {
  return localStorage.getItem(DEV_TOKEN_KEY);
}

/**
 * Dev-only prompt shown when running outside Teams with no valid token.
 * Lets the developer paste a bearer token grabbed from the live app's Network tab.
 */
export function DevTokenPrompt() {
  const styles = useStyles();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Please paste a token.');
      return;
    }

    // Basic JWT structure check (3 dot-separated parts)
    const parts = trimmed.split('.');
    if (parts.length !== 3) {
      setError('That doesn\u2019t look like a JWT (expected 3 dot-separated parts).');
      return;
    }

    // Check expiry
    try {
      const payload = JSON.parse(atob(parts[1]!)) as { exp?: number };
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        setError('This token is already expired. Grab a fresh one.');
        return;
      }
    } catch {
      setError('Could not decode token payload. Make sure you copied the full token.');
      return;
    }

    localStorage.setItem(DEV_TOKEN_KEY, trimmed);
    window.location.reload();
  }, [value]);

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader
          header={
            <Text size={500} weight="semibold">
              Dev Mode — Bearer Token Required
            </Text>
          }
          description={
            <Text size={200}>
              Running outside Teams. Paste a token to authenticate API calls.
            </Text>
          }
        />
        <div className={styles.body}>
          <div className={styles.steps}>
            <Text size={200}>1. Open the live app inside Teams</Text>
            <Text size={200}>
              2. Open DevTools → Network tab → find any <code>/api/</code> request
            </Text>
            <Text size={200}>
              3. Copy the <code>Authorization</code> header value (without "Bearer ")
            </Text>
            <Text size={200}>4. Paste it below — it lasts ~1 hour</Text>
          </div>

          <Textarea
            placeholder="eyJhbGciOiJSUzI1NiIs..."
            value={value}
            onChange={(_e, d) => {
              setValue(d.value);
              setError(null);
            }}
            resize="vertical"
            style={{ minHeight: '80px', fontFamily: 'monospace', fontSize: '12px' }}
          />

          {error && (
            <MessageBar intent="error">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          )}

          <Button appearance="primary" onClick={handleSave}>
            Save &amp; Reload
          </Button>
        </div>
      </Card>
    </div>
  );
}
