// lib/variableResolver.ts
import type { CardElementNode } from '@/types';
import { RECIPIENT_VARIABLES } from './variables';

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

interface VariableContext {
  recipientSamples: Record<string, string>;
  customVariables: Record<string, string>;
}

/**
 * Replace {{variable}} tokens in all text properties of the element tree.
 * Mutates in-place for performance. Returns the same array.
 */
export function resolveVariables(
  nodes: CardElementNode[],
  customVariables?: { name: string; value: string }[],
): CardElementNode[] {
  const ctx: VariableContext = {
    recipientSamples: Object.fromEntries(
      RECIPIENT_VARIABLES.map((v) => [v.name, v.sampleValue]),
    ),
    customVariables: Object.fromEntries(
      (customVariables ?? [])
        .filter((v) => v.name)
        .map((v) => [v.name, v.value || `{{${v.name}}}`]),
    ),
  };

  for (const node of nodes) {
    resolveNodeVariables(node, ctx);
  }

  return nodes;
}

function resolveNodeVariables(node: CardElementNode, ctx: VariableContext): void {
  // Resolve text-bearing properties
  for (const key of TEXT_PROPERTIES) {
    const val = node.properties[key];
    if (typeof val === 'string') {
      node.properties[key] = resolveText(val, ctx);
    }
  }

  // Resolve facts (FactSet)
  const facts = node.properties['facts'] as { title: string; value: string }[] | undefined;
  if (facts) {
    for (const fact of facts) {
      fact.title = resolveText(fact.title, ctx);
      fact.value = resolveText(fact.value, ctx);
    }
  }

  // Recurse into children
  if (node.children?.length) {
    for (const child of node.children) {
      resolveNodeVariables(child, ctx);
    }
  }
}

/** Properties on AC elements that can contain user text with variables. */
const TEXT_PROPERTIES = ['text', 'title', 'altText'] as const;

function resolveText(text: string, ctx: VariableContext): string {
  return text.replace(VARIABLE_PATTERN, (match, name: string) => {
    return ctx.recipientSamples[name]
      ?? ctx.customVariables[name]
      ?? match; // leave unresolved tokens as-is
  });
}
