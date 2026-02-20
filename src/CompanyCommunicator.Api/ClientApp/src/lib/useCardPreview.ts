// lib/useCardPreview.ts
import { useMemo } from 'react';
import type { CardDocument, ThemeDefinition, TemplateDefinition, TeamsTheme } from '@/types';
import { buildCard, type CardBuildResult } from './cardPipeline';

/**
 * Hook that builds a card from a CardDocument using the new pipeline.
 * Returns the AC JSON payload and themed HostConfig, memoized.
 */
export function useCardPreview(
  document: CardDocument | null,
  template: TemplateDefinition | null,
  theme: ThemeDefinition,
  recipientTheme: TeamsTheme = 'default',
  customVariables?: { name: string; value: string }[],
): CardBuildResult | null {
  return useMemo(() => {
    if (!document) return null;

    return buildCard(
      { document, template, theme, customVariables },
      recipientTheme,
    );
  }, [document, template, theme, recipientTheme, customVariables]);
}
