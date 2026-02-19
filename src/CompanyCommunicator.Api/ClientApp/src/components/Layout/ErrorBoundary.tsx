import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Button,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalXXL,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalL,
  },
});

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// eslint-disable-next-line react-refresh/only-export-components -- helper for class component
function ErrorDisplay({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}) {
  const styles = useStyles();
  return (
    <div className={styles.container}>
      <MessageBar intent="error" style={{ maxWidth: '600px', width: '100%' }}>
        <MessageBarBody>
          <MessageBarTitle>Something went wrong</MessageBarTitle>
          {error.message}
        </MessageBarBody>
      </MessageBar>
      <Button appearance="primary" onClick={onReset}>
        Try Again
      </Button>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorDisplay error={this.state.error} onReset={this.handleReset} />
      );
    }
    return this.props.children;
  }
}
