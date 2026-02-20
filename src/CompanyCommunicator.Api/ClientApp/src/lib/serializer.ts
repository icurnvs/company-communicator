// lib/serializer.ts
import type { CardElementNode } from '@/types';

/**
 * Serialize a CardElementNode tree into an Adaptive Card JSON payload.
 * Separates body elements from action elements by their `placement` field.
 */
export function serializeToAdaptiveCard(
  nodes: CardElementNode[],
  options?: { fullWidth?: boolean },
): object {
  const body: object[] = [];
  const actions: object[] = [];

  for (const node of nodes) {
    const serialized = serializeNode(node);
    if (!serialized) continue;

    if (node.placement === 'actions') {
      actions.push(serialized);
    } else {
      body.push(serialized);
    }
  }

  const card: Record<string, unknown> = {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body,
  };

  if (actions.length > 0) {
    card['actions'] = actions;
  }

  if (options?.fullWidth) {
    card['msteams'] = { width: 'Full' };
  }

  return card;
}

function serializeNode(node: CardElementNode): object | null {
  const { acType, properties, children } = node;

  // For action nodes, type is already in acType (e.g., "Action.OpenUrl")
  const result: Record<string, unknown> = {
    type: acType,
    ...properties,
  };

  // Handle child nodes: depends on the AC element type
  if (children?.length) {
    switch (acType) {
      case 'Container':
        result['items'] = children.map(serializeNode).filter(Boolean);
        break;

      case 'ColumnSet':
        result['columns'] = children.map(serializeNode).filter(Boolean);
        break;

      case 'Column':
        result['items'] = children.map(serializeNode).filter(Boolean);
        break;

      case 'ActionSet':
        // ActionSet.actions are already in properties
        break;

      case 'RichTextBlock':
        // RichTextBlock.inlines are already in properties — no child processing
        break;

      default:
        // For other types with children, put them in items
        result['items'] = children.map(serializeNode).filter(Boolean);
        break;
    }
  }

  return result;
}
