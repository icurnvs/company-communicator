// lib/builtinThemes.ts
import type { ThemeDefinition } from '@/types';

export const BUILTIN_THEMES: readonly ThemeDefinition[] = [
  {
    id: 'theme-default',
    name: 'Default',
    accentColor: '#5B5FC7',       // Teams indigo
    accentForeground: '#FFFFFF',
    emphasisBackground: '#F5F5F5',
    borderColor: '#E0E0E0',
    isBuiltIn: true,
  },
  {
    id: 'theme-corporate',
    name: 'Corporate',
    accentColor: '#1B2A4A',       // Dark navy
    accentForeground: '#FFFFFF',
    emphasisBackground: '#EEF0F4',
    borderColor: '#C8CCD4',
    isBuiltIn: true,
  },
  {
    id: 'theme-warm',
    name: 'Warm',
    accentColor: '#C4652A',       // Terracotta
    accentForeground: '#FFFFFF',
    emphasisBackground: '#FDF5F0',
    borderColor: '#E8D5C4',
    isBuiltIn: true,
  },
  {
    id: 'theme-fresh',
    name: 'Fresh',
    accentColor: '#0E8A7B',       // Teal
    accentForeground: '#FFFFFF',
    emphasisBackground: '#EDF7F6',
    borderColor: '#B8DDD9',
    isBuiltIn: true,
  },
  {
    id: 'theme-bold',
    name: 'Bold',
    accentColor: '#7C3AED',       // Deep purple
    accentForeground: '#FFFFFF',
    emphasisBackground: '#F3EEFB',
    borderColor: '#D4C4F0',
    isBuiltIn: true,
  },
  {
    id: 'theme-subtle',
    name: 'Subtle',
    accentColor: '#64748B',       // Slate gray
    accentForeground: '#FFFFFF',
    emphasisBackground: '#F1F5F9',
    borderColor: '#CBD5E1',
    isBuiltIn: true,
  },
] as const;

export const DEFAULT_THEME_ID = 'theme-default';

/** Look up a theme by ID. Returns the Default theme if not found. */
export function getThemeById(id: string): ThemeDefinition {
  return BUILTIN_THEMES.find((t) => t.id === id) ?? BUILTIN_THEMES[0]!;
}
