// types/cardBuilder.ts

// ---------------------------------------------------------------------------
// Slot types — the user-facing "section" vocabulary
// ---------------------------------------------------------------------------

/** Core sections available in all templates */
export type CoreSlotType =
  | 'heading'
  | 'subheading'
  | 'bodyText'
  | 'heroImage'
  | 'keyDetails'
  | 'linkButton'
  | 'footer'
  | 'divider';

/** Extended sections available via "Add Section" menu */
export type ExtendedSlotType =
  | 'imageGallery'
  | 'statsRow'
  | 'quoteCallout'
  | 'columns'
  | 'table'
  | 'expandableSection'
  | 'iconTextRow';

/** Advanced-only block types (Tier 2) */
export type AdvancedBlockType =
  | 'richText'
  | 'icon'
  | 'badge'
  | 'codeBlock'
  | 'ratingDisplay'
  | 'compoundButton'
  | 'gridLayout'
  | 'flowLayout'
  | 'donutChart'
  | 'verticalBar'
  | 'groupedBar'
  | 'horizontalBar'
  | 'stackedBar'
  | 'lineChart'
  | 'gauge';

export type SlotType = CoreSlotType | ExtendedSlotType;
export type AnyBlockType = SlotType | AdvancedBlockType;

// ---------------------------------------------------------------------------
// Slot definitions — template structure
// ---------------------------------------------------------------------------

export type SlotVisibility = 'required' | 'optionalOn' | 'optionalOff';

export interface SlotDefinition {
  id: string;
  type: SlotType;
  label: string;
  helpText?: string;
  defaultValue?: unknown;
  visibility: SlotVisibility;
  order: number;
  /** AC properties locked by template (user can't change in Tier 1) */
  lockedProperties?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

export type TemplateCategory =
  | 'announcement'
  | 'event'
  | 'alert'
  | 'general'
  | 'feedback'
  | 'onboarding'
  | 'policy'
  | 'celebration';

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  iconName: string; // Fluent icon name (resolved at render time)
  category: TemplateCategory;
  accentColor: string; // Default accent (theme can override)
  isBuiltIn: boolean;
  slots: SlotDefinition[];
}

// ---------------------------------------------------------------------------
// Theme definitions
// ---------------------------------------------------------------------------

export interface ThemeDefinition {
  id: string;
  name: string;
  accentColor: string;
  accentForeground: string;
  emphasisBackground: string;
  borderColor: string;
  semanticOverrides?: {
    good?: string;
    warning?: string;
    attention?: string;
  };
  isBuiltIn: boolean;
}

// ---------------------------------------------------------------------------
// Card-level settings (Advanced mode)
// ---------------------------------------------------------------------------

export interface CardSettings {
  fullWidth?: boolean;
  accentColorOverride?: string | null;
}

// ---------------------------------------------------------------------------
// Card document — what gets saved per notification
// ---------------------------------------------------------------------------

export interface CardDocument {
  templateId: string | null; // null = advanced freeform
  themeId: string;
  slotValues: Record<string, unknown>; // slotId → user content
  slotVisibility: Record<string, boolean>; // slotId → on/off toggle
  slotOrder?: Record<string, number>; // slotId → user-defined order
  additionalSlots?: AdditionalSlot[]; // sections added beyond template
  advancedOverrides?: Record<string, Record<string, unknown>>; // slotId → prop overrides
  cardSettings?: CardSettings; // card-level settings (Advanced mode)
  cardPreference: 'template' | 'advanced';
}

export interface AdditionalSlot {
  id: string;
  type: AnyBlockType;  // was: SlotType
  order: number;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Slot value shapes — typed data for each slot type
// ---------------------------------------------------------------------------

export interface HeadingSlotValue {
  text: string;
  alignment?: 'left' | 'center';
}

export interface SubheadingSlotValue {
  text: string;
}

export interface BodyTextSlotValue {
  text: string;
}

export interface HeroImageSlotValue {
  url: string;
  altText?: string;
}

export interface KeyDetailPairValue {
  label: string;
  value: string;
}

export interface KeyDetailsSlotValue {
  pairs: KeyDetailPairValue[];
}

export interface LinkButtonSlotValue {
  title: string;
  url: string;
}

export interface FooterSlotValue {
  text: string;
}

export interface ImageGallerySlotValue {
  images: { url: string; altText?: string }[];
  imageSize?: 'small' | 'medium' | 'large';
}

export interface StatsRowSlotValue {
  stats: { value: string; label: string }[];
}

export interface QuoteCalloutSlotValue {
  text: string;
  style: 'default' | 'good' | 'warning' | 'attention' | 'accent';
}

export interface ColumnsSlotValue {
  columns: { content: string; imageUrl?: string }[];
}

export interface TableSlotValue {
  headers: string[];
  rows: string[][];
}

export interface ExpandableSectionSlotValue {
  title: string;
  body: string;
}

export interface IconTextRowSlotValue {
  iconName: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Content block value shapes (Phase C2)
// ---------------------------------------------------------------------------

export interface RichTextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  highlight?: boolean;
  color?: string;
}

export interface RichTextSlotValue {
  segments: RichTextSegment[];
}

export interface IconSlotValue {
  name: string;
  size?: 'xxSmall' | 'xSmall' | 'Small' | 'Standard' | 'Medium' | 'Large' | 'xLarge' | 'xxLarge';
  color?: 'Default' | 'Dark' | 'Light' | 'Accent' | 'Good' | 'Warning' | 'Attention';
  style?: 'Regular' | 'Filled';
}

export interface BadgeSlotValue {
  text: string;
  icon?: string;
  appearance?: string;
}

export interface CodeBlockSlotValue {
  code: string;
  language: string;
  startLineNumber?: number;
}

export interface RatingDisplaySlotValue {
  value: number;
  max?: number;
  color?: 'Neutral' | 'Marigold';
  style?: 'Default' | 'Compact';
  count?: number;
}

export interface CompoundButtonSlotValue {
  title: string;
  description?: string;
  icon?: string;
  badge?: string;
  url?: string;
}

// ---------------------------------------------------------------------------
// Layout block value shapes (Phase C2)
// ---------------------------------------------------------------------------

export interface FlowLayoutSlotValue {
  items: { text: string; icon?: string }[];
  itemWidth?: string;
  columnSpacing?: string;
}

export interface GridLayoutSlotValue {
  columns: number[];
  areas: { name: string; content: string; imageUrl?: string }[];
}

// ---------------------------------------------------------------------------
// Chart block value shapes (Phase C2)
// ---------------------------------------------------------------------------

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartSeriesData {
  legend: string;
  color?: string;
  values: { x: string; y: number }[];
}

export interface DonutChartSlotValue {
  title?: string;
  data: ChartDataPoint[];
  colorSet?: 'categorical' | 'sequential' | 'diverging';
}

export interface VerticalBarSlotValue {
  title?: string;
  data: ChartDataPoint[];
  showBarValues?: boolean;
}

export interface GroupedBarSlotValue {
  title?: string;
  series: ChartSeriesData[];
  stacked?: boolean;
  showBarValues?: boolean;
  xAxisTitle?: string;
  yAxisTitle?: string;
}

export interface HorizontalBarSlotValue {
  title?: string;
  data: ChartDataPoint[];
  displayMode?: 'AbsoluteWithAxis' | 'AbsoluteNoAxis' | 'PartToWhole';
}

export interface StackedBarSlotValue {
  title?: string;
  series: { title: string; data: ChartDataPoint[] }[];
}

export interface LineChartSlotValue {
  title?: string;
  series: ChartSeriesData[];
  xAxisTitle?: string;
  yAxisTitle?: string;
}

export interface GaugeSlotValue {
  value: number;
  min?: number;
  max?: number;
  valueFormat?: 'Percentage' | 'Fraction';
  segments?: { legend: string; size: number; color?: string }[];
  subLabel?: string;
}

// Map from slot type to its value shape
export interface SlotValueMap {
  heading: HeadingSlotValue;
  subheading: SubheadingSlotValue;
  bodyText: BodyTextSlotValue;
  heroImage: HeroImageSlotValue;
  keyDetails: KeyDetailsSlotValue;
  linkButton: LinkButtonSlotValue;
  footer: FooterSlotValue;
  divider: undefined;
  imageGallery: ImageGallerySlotValue;
  statsRow: StatsRowSlotValue;
  quoteCallout: QuoteCalloutSlotValue;
  columns: ColumnsSlotValue;
  table: TableSlotValue;
  expandableSection: ExpandableSectionSlotValue;
  iconTextRow: IconTextRowSlotValue;
  // Phase C2 — Content blocks
  richText: RichTextSlotValue;
  icon: IconSlotValue;
  badge: BadgeSlotValue;
  codeBlock: CodeBlockSlotValue;
  ratingDisplay: RatingDisplaySlotValue;
  compoundButton: CompoundButtonSlotValue;
  // Phase C2 — Layout blocks
  flowLayout: FlowLayoutSlotValue;
  gridLayout: GridLayoutSlotValue;
  // Phase C2 — Chart blocks
  donutChart: DonutChartSlotValue;
  verticalBar: VerticalBarSlotValue;
  groupedBar: GroupedBarSlotValue;
  horizontalBar: HorizontalBarSlotValue;
  stackedBar: StackedBarSlotValue;
  lineChart: LineChartSlotValue;
  gauge: GaugeSlotValue;
}

// ---------------------------------------------------------------------------
// Card Element Tree — intermediate representation
// ---------------------------------------------------------------------------

/** Where in the AC card this element should be placed */
export type ElementPlacement = 'body' | 'actions';

export interface CardElementNode {
  /** Unique ID for this node (matches slotId or generated) */
  id: string;
  /** Slot type that generated this node (for template editor) */
  sourceType: AnyBlockType;
  /** Where to place in the AC card (body or actions) */
  placement: ElementPlacement;
  /** The AC element type (TextBlock, Container, ColumnSet, etc.) */
  acType: string;
  /** AC element properties (varies by type) */
  properties: Record<string, unknown>;
  /** Nested child nodes (e.g., Container.items, ColumnSet.columns) */
  children?: CardElementNode[];
  /** Theme color tokens to be resolved (e.g., { backgroundColor: 'accent' }) */
  themeTokens?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Pipeline input — what the full pipeline accepts
// ---------------------------------------------------------------------------

export interface CardBuildInput {
  document: CardDocument;
  template: TemplateDefinition | null;
  theme: ThemeDefinition;
  customVariables?: { name: string; value: string }[];
}
