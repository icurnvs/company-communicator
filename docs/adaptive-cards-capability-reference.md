# Adaptive Cards: Complete Capability Reference

> **Date**: 2026-02-20
> **Purpose**: Comprehensive reference of all Adaptive Cards capabilities for Teams, used to evaluate and plan improvements to our card builder.
> **Key insight**: Microsoft maintains TWO documentation ecosystems with different feature sets. The Teams-specific hub has nearly double the capabilities of the open-source spec.

## Documentation Ecosystems

| Site | Scope | Audience |
|------|-------|----------|
| [adaptivecards.io](https://adaptivecards.io/) | Open-source base schema (v1.0-1.5) | Developers using AC in any host app |
| [adaptivecards.microsoft.com](https://adaptivecards.microsoft.com/) | **Extended schema for Teams/Outlook/Copilot** | Developers building for Microsoft 365 |

The new hub was launched **February 25, 2025** and is now the authoritative source for Teams card development. Many MS Learn pages now redirect there. The open-source site does NOT document the extended elements (charts, icons, badges, carousels, layouts, etc.).

**We must target the Teams extended schema**, not just the open-source base.

---

## 1. Content Elements

### 1.1 TextBlock

The fundamental text display element. Supports markdown subset in Teams (bold, italic, lists, links).

| Property | Type | Values | Version |
|----------|------|--------|---------|
| `text` | string | Required. Supports markdown subset | 1.0 |
| `color` | enum | `default`, `dark`, `light`, `accent`, `good`, `warning`, `attention` | 1.0 |
| `fontType` | enum | `default`, `monospace` | 1.2 |
| `horizontalAlignment` | enum | `left`, `center`, `right` | 1.0 |
| `isSubtle` | boolean | Toned-down appearance | 1.0 |
| `maxLines` | number | Truncate after N lines | 1.0 |
| `size` | enum | `default`, `small`, `medium`, `large`, `extraLarge` | 1.0 |
| `weight` | enum | `default`, `lighter`, `bolder` | 1.0 |
| `wrap` | boolean | Allow text wrapping (always set `true` for Teams) | 1.0 |
| `style` | enum | `default`, `heading` (accessibility) | 1.5 |

**Inherited properties** (shared by all elements): `fallback`, `height` (auto/stretch), `separator`, `spacing` (none/small/default/medium/large/extraLarge/padding), `id`, `isVisible`, `requires`, `targetWidth`.

**Markdown supported in Teams**: `**bold**`, `_italic_`, `- bullet lists`, `1. numbered lists`, `[links](url)`, `\r` or `\n` newlines. **NOT supported**: headers, tables, images, preformatted text, blockquotes.

### 1.2 RichTextBlock

Enables inline formatting via TextRun segments. Each TextRun can independently have bold, italic, strikethrough, highlight, underline, and hyperlinks.

```json
{
  "type": "RichTextBlock",
  "inlines": [
    { "type": "TextRun", "text": "Normal " },
    { "type": "TextRun", "text": "bold", "weight": "Bolder" },
    { "type": "TextRun", "text": " and " },
    { "type": "TextRun", "text": "italic", "italic": true }
  ]
}
```

### 1.3 Image

| Property | Type | Values | Version |
|----------|------|--------|---------|
| `url` | uri | Required. Supports data URI in 1.2+ | 1.0 |
| `altText` | string | Accessibility description | 1.0 |
| `size` | enum | `auto`, `stretch`, `small`, `medium`, `large` | 1.0 |
| `style` | enum | `default`, `person` (circular crop), `RoundedCorners` | 1.0, ext |
| `width` | string | Pixel width e.g. `"50px"` | 1.1 |
| `height` | string | Pixel height or `auto`/`stretch` | 1.1 |
| `horizontalAlignment` | enum | `left`, `center`, `right` | 1.0 |
| `selectAction` | action | Tap action (not ShowCard) | 1.1 |
| `backgroundColor` | string | For transparent images | 1.1 |

**Teams-specific**: `msTeams.allowExpand: true` enables Stageview (zoom/expand on hover).

### 1.4 Media (Extended)

Inline video playback supporting YouTube, Vimeo, and Dailymotion. One of the 10 new features announced in the Teams extended schema.

### 1.5 Icon (Extended)

Inline icons from the [Fluent icon library](https://www.figma.com/community/file/836835755999342788).

| Property | Type | Values |
|----------|------|--------|
| `type` | string | `"Icon"` |
| `name` | string | Fluent icon name (e.g., `"Calendar"`, `"Camera"`) |
| `size` | enum | `xxSmall`, `xSmall`, `Small`, `Standard`, `Medium`, `Large`, `xLarge`, `xxLarge` |
| `color` | enum | `Default`, `Dark`, `Light`, `Accent`, `Good`, `Warning`, `Attention` |
| `style` | enum | `Regular`, `Filled` |
| `selectAction` | action | All types except ShowCard |

**Also usable on action buttons** via `iconUrl: "icon:FluentName,filled"`.

### 1.6 Badge (Extended)

Compact icon + text over a colored background. Useful for status indicators, tags, and labels.

### 1.7 CodeBlock (Extended)

Syntax-highlighted code snippets with line numbers.

| Property | Type | Description |
|----------|------|-------------|
| `codeSnippet` | string | The code to display |
| `language` | enum | 20+ languages: Bash, C, C++, C#, CSS, DOS, Go, GraphQL, HTML, Java, JavaScript, JSON, Perl, PHP, PowerShell, Python, SQL, TypeScript, Visual Basic, Verilog, VHDL, XML, PlainText |
| `startLineNumber` | number | Starting line number (default: 1) |

**Limitation**: Teams desktop/web only (not mobile). Read-only. First 10 lines shown, user clicks "Expand" for more.

### 1.8 Rating (Extended, read-only)

| Property | Type | Values |
|----------|------|--------|
| `type` | string | `"Rating"` |
| `value` | number | The rating value |
| `max` | number | Number of stars (default/max: 5) |
| `color` | enum | `Neutral`, `Marigold` |
| `count` | number | Number of "votes" shown |
| `style` | enum | `Default`, `Compact` (single star with number) |
| `size` | enum | `Medium`, `Large` |

### 1.9 CompoundButton (Extended)

A button with icon, title, and description. Replicates Copilot prompt starter appearance.

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | `"CompoundButton"` |
| `title` | string | Required. Button title |
| `icon` | object | `{name, size, style, color}` — Fluent icon |
| `badge` | string | Badge text |
| `description` | string | Description text |
| `selectAction` | action | All types except ShowCard |

---

## 2. Data Visualization (Charts)

All charts share common properties: `title`, `colorSet`, `grid.area`, `targetWidth`, `horizontalAlignment`, standard inherited properties.

### Color System

30 named colors across 3 palettes:

- **Semantic**: `good`, `warning`, `attention`, `neutral`
- **Categorical** (9): `categoricalRed`, `categoricalPurple`, `categoricalLavender`, `categoricalBlue`, `categoricalLightBlue`, `categoricalTeal`, `categoricalGreen`, `categoricalLime`, `categoricalMarigold`
- **Sequential** (8): `sequential1` through `sequential8`
- **Diverging** (9): `divergingBlue`, `divergingLightBlue`, `divergingCyan`, `divergingTeal`, `divergingYellow`, `divergingPeach`, `divergingLightRed`, `divergingRed`, `divergingMaroon`, `divergingGray`

`colorSet` property selects palette: `"categorical"`, `"sequential"`, `"diverging"`.

### 2.1 Chart.Donut / Chart.Pie

Simple value charts. Data: `{legend: string, value: number, color?: string}[]`

### 2.2 Chart.VerticalBar

Single-series bar chart. Data: `{x: string, y: number, color?: string}[]`

Extra property: `showBarValues` (boolean).

### 2.3 Chart.VerticalBar.Grouped

Multi-series bar chart. Data: `{legend: string, color?: string, values: [{x: string, y: number}]}[]`

Extra properties: `stacked` (boolean), `showBarValues`, `xAxisTitle`, `yAxisTitle`.

### 2.4 Chart.HorizontalBar

Single-series horizontal bars. Data: `{x: string, y: number, color?: string}[]`

Extra property: `displayMode` — `AbsoluteWithAxis` (default), `AbsoluteNoAxis`, `PartToWhole` (survey-style percentage bars).

### 2.5 Chart.HorizontalBar.Stacked

Multi-series stacked horizontal bars. Nested data structure:
```json
{
  "data": [
    {
      "title": "Series Name",
      "data": [
        { "legend": "Category", "value": 24, "color": "good" }
      ]
    }
  ]
}
```

### 2.6 Chart.Line

Multi-series line chart. Data: `{legend: string, color?: string, values: [{x: string|number, y: number}]}[]`

Extra properties: `xAxisTitle`, `yAxisTitle`.

### 2.7 Chart.Gauge

Circular gauge with colored segments.

| Property | Type | Description |
|----------|------|-------------|
| `value` | number | Current gauge value |
| `min` / `max` | number | Range |
| `valueFormat` | enum | `Percentage`, `Fraction` |
| `segments` | array | `{legend, size, color}[]` |
| `showLegend` | boolean | Show legend (default: true) |
| `showMinMax` | boolean | Show min/max labels |
| `subLabel` | string | Text below the value |

---

## 3. Containers

### 3.1 Container

| Property | Type | Values | Version |
|----------|------|--------|---------|
| `items` | Element[] | Required. Child elements | 1.0 |
| `style` | enum | `default`, `emphasis`, `good`, `attention`, `warning`, `accent` | 1.0 |
| `bleed` | boolean | Extend through parent padding | 1.2 |
| `backgroundImage` | uri/object | PNG, JPEG, GIF | 1.2 |
| `minHeight` | string | e.g. `"80px"` | 1.2 |
| `maxHeight` | string | e.g. `"100px"` — **enables scrollbar** | ext |
| `verticalContentAlignment` | enum | `top`, `center`, `bottom` | 1.1 |
| `selectAction` | action | Tap action | 1.1 |
| `showBorder` | boolean | Display border (color matches style) | ext |
| `roundedCorners` | boolean | Rounded corners | ext |
| `rtl` | boolean | Right-to-left | 1.5 |

### 3.2 ColumnSet / Column

**ColumnSet** groups columns horizontally. Properties: `style`, `bleed`, `minHeight`, `horizontalAlignment`, `showBorder`, `roundedCorners`.

**Column** properties:
- `width`: `"auto"`, `"stretch"`, `<number>` (proportional), `"<number>px"` (fixed)
- `style`, `bleed`, `backgroundImage`, `minHeight`, `showBorder`, `roundedCorners`
- `verticalContentAlignment`: `top`, `center`, `bottom`
- **Can hold ANY elements** — images, text, buttons, inputs, charts, nested containers

### 3.3 Table

| Property | Type | Description |
|----------|------|-------------|
| `columns` | TableColumnDefinition[] | Column widths |
| `rows` | TableRow[] | Row data |
| `firstRowAsHeader` | boolean | Accessibility (default: true) |
| `showGridLines` | boolean | Display grid lines (default: true) |
| `gridStyle` | enum | Same 6 container styles |
| `roundedCorners` | boolean | Rounded table corners |
| `horizontalCellContentAlignment` | enum | left/center/right |
| `verticalCellContentAlignment` | enum | top/center/bottom |

**TableCell** can hold any elements (not just text).

### 3.4 ActionSet

Inline action button group, placeable anywhere in card body. Not limited to the card's bottom action bar.

### 3.5 FactSet

Key-value pairs. `facts: [{title: string, value: string}]`. Supports markdown in both title and value.

### 3.6 ImageSet

Multiple images with shared `imageSize` control.

---

## 4. Layout System (Teams Extended)

Containers support a `layouts` array property. Multiple layouts can target different widths for responsive design.

### 4.1 Layout.Stack (Default)

Vertical stacking. The implicit default when no layout specified.

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | `"Layout.Stack"` |
| `targetWidth` | string | Width breakpoint |

### 4.2 Layout.Flow

Horizontal wrapping layout — like CSS flexbox `flex-wrap: wrap`.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `type` | string | | `"Layout.Flow"` |
| `itemWidth` | string | | Fixed width per item (e.g. `"150px"`). Mutually exclusive with min/max. |
| `maxItemWidth` | string | | Max width per item |
| `minItemWidth` | string | `"0"` | Min width per item |
| `itemFit` | enum | `"Fit"` | `Fit` or `Fill` (stretch items to fill row) |
| `horizontalItemsAlignment` | enum | `"Center"` | `Left`, `Center`, `Right` |
| `verticalItemsAlignment` | enum | `"Top"` | `Top`, `Center`, `Bottom` |
| `columnSpacing` | enum | `"Default"` | None/ExtraSmall/Small/Default/Medium/Large/ExtraLarge/Padding |
| `rowSpacing` | enum | `"Default"` | Same as above |
| `targetWidth` | string | | Width breakpoint |

**Use case**: Image galleries, badge lists, tag clouds.

### 4.3 Layout.AreaGrid

**CSS Grid-like** named-area layout. The most powerful layout primitive.

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | `"Layout.AreaGrid"` |
| `columns` | number[]|string[] | Column widths as % or `"<number>px"` |
| `areas` | GridArea[] | Named areas with row/column placement |
| `columnSpacing` | enum | Space between columns |
| `rowSpacing` | enum | Space between rows |
| `targetWidth` | string | Width breakpoint |

**GridArea** properties:
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | string | | Area name — matched by `grid.area` on elements |
| `column` | number | 1 | Start column (1-indexed) |
| `row` | number | 1 | Start row (1-indexed) |
| `columnSpan` | number | 1 | Columns to span |
| `rowSpan` | number | 1 | Rows to span |

**Responsive pattern**: Define multiple layouts with different `targetWidth` values on the same container. The runtime picks the best match.

```json
{
  "layouts": [
    {
      "type": "Layout.AreaGrid",
      "targetWidth": "atLeast:standard",
      "columns": [60],
      "areas": [
        { "name": "image" },
        { "name": "text", "column": 2 }
      ]
    }
  ],
  "body": [
    { "type": "Image", "grid.area": "image", "url": "..." },
    { "type": "Container", "grid.area": "text", "items": [...] }
  ]
}
```

When card width < standard, falls back to default Layout.Stack (image above text).

---

## 5. Actions

### 5.1 Action.OpenUrl

Opens a URL. Properties: `title`, `url`, `iconUrl`, `style` (default/positive/destructive), `tooltip`, `isEnabled`, `mode` (primary/secondary).

**Icon on action buttons**: Set `iconUrl` to `"icon:FluentIconName,filled"` for inline Fluent icons.

### 5.2 Action.Submit

Submits form input data back to the bot. Properties: `title`, `data` (object/string merged with inputs), `associatedInputs` (auto/none).

### 5.3 Action.Execute (v1.4+)

Universal Action model — works across Teams, Outlook, Copilot. Properties: `verb` (action identifier), `data`, `associatedInputs`.

Used with `refresh` on AdaptiveCard for auto-refresh and user-specific views.

### 5.4 Action.ShowCard

**Reveals a nested AdaptiveCard inline** when clicked. The sub-card can contain any elements including inputs and actions. Enables wizard-style multi-step flows, progressive disclosure, and inline forms.

```json
{
  "type": "Action.ShowCard",
  "title": "Comment",
  "card": {
    "type": "AdaptiveCard",
    "body": [
      { "type": "Input.Text", "id": "comment", "isMultiline": true, "placeholder": "Enter your comment" }
    ],
    "actions": [
      { "type": "Action.Submit", "title": "OK" }
    ]
  }
}
```

### 5.5 Action.ToggleVisibility

Toggles `isVisible` on target elements. Enables expand/collapse, accordions, show/hide sections without server round-trips.

```json
{
  "type": "Action.ToggleVisibility",
  "title": "Show details",
  "targetElements": ["detailsContainer"]
}
```

### 5.6 Overflow Menus

Set `mode: "secondary"` on any action to place it in an overflow `...` menu instead of as a visible button. Max 6 primary actions visible; additional go to overflow.

---

## 6. Inputs

All inputs share: `id` (required), `label`, `isRequired`, `errorMessage`, `labelPosition` (inline/above), `value` (default).

### 6.1 Input.Text

| Property | Type | Description |
|----------|------|-------------|
| `isMultiline` | boolean | Multi-line text area |
| `maxLength` | number | Character limit |
| `placeholder` | string | Placeholder text |
| `regex` | string | Validation pattern (v1.3+) |
| `style` | enum | `text`, `tel`, `url`, `email`, `password` |
| `inlineAction` | action | Action button beside input (v1.2+) |

### 6.2 Input.Number

Properties: `min`, `max`, `placeholder`.

### 6.3 Input.Date

Date picker. Properties: `min`, `max`, `placeholder`.

### 6.4 Input.Time

Time picker. Properties: `min`, `max`, `placeholder`.

### 6.5 Input.Toggle

Boolean switch. Properties: `title`, `value`, `valueOn`, `valueOff`, `wrap`.

### 6.6 Input.ChoiceSet

| Property | Type | Description |
|----------|------|-------------|
| `choices` | array | `{title, value}[]` |
| `isMultiSelect` | boolean | Checkbox mode |
| `style` | enum | `compact` (dropdown), `expanded` (radio/checkbox), `filtered` (typeahead) |
| `wrap` | boolean | Wrap choice text |
| `placeholder` | string | Placeholder for compact style |

**Dependent inputs** (new): Options in one ChoiceSet dynamically change based on another's selection.

### 6.7 Input.Rating (Extended)

| Property | Type | Description |
|----------|------|-------------|
| `allowHalfSteps` | boolean | Half-star selection |
| `color` | enum | `Neutral`, `Marigold` |
| `max` | number | Number of stars |
| `size` | enum | `Medium`, `Large` |
| `isRequired` | boolean | Validation |

---

## 7. Templating Language

Built on [Adaptive Expression Language (AEL)](https://learn.microsoft.com/en-us/azure/bot-service/bot-builder-concept-adaptive-expressions). Enables separation of data from layout.

### 7.1 Data Binding

```
${property}              — simple binding
${parent.child}          — dot notation
${array[0]}              — indexer
${$data}                 — current data context (useful for string arrays)
${$root}                 — root data object
${$index}                — current iteration index
```

### 7.2 Repeating (Loops)

When `$data` is bound to an array, the element repeats for each item:

```json
{
  "type": "TextBlock",
  "$data": "${peers}",
  "text": "${name} - ${title}"
}
```

### 7.3 Conditional Layout (`$when`)

Drop an entire element if condition is false:

```json
{
  "type": "TextBlock",
  "$when": "${price > 30}",
  "text": "This is expensive!",
  "color": "attention"
}
```

### 7.4 Expression Functions

| Category | Examples |
|----------|---------|
| Conditional | `if(expr, trueVal, falseVal)` |
| String | `concat()`, `length()`, `replace()`, `split()`, `substring()`, `toLower()`, `toUpper()`, `trim()` |
| Math | `add()`, `sub()`, `mul()`, `div()`, `mod()`, `min()`, `max()`, `round()`, `floor()`, `ceiling()` |
| Comparison | `equals()`, `less()`, `greater()`, `lessOrEquals()`, `greaterOrEquals()` |
| Logical | `and()`, `or()`, `not()`, `exists()` |
| Collection | `count()`, `first()`, `last()`, `contains()`, `where()`, `select()`, `sortBy()` |
| Date/Time | `formatDateTime()`, `addDays()`, `addHours()` |
| Conversion | `int()`, `float()`, `string()`, `bool()`, `json()` |

Full reference: [AEL Pre-built Functions](https://learn.microsoft.com/en-us/azure/bot-service/bot-builder-concept-adaptive-expressions)

### 7.5 Data Provision

**Option A — Inline**: Add `$data` to the root AdaptiveCard object.
**Option B — Separate**: Use the templating SDK at runtime (JS: `adaptivecards-templating`, .NET: `AdaptiveCards.Templating`).

---

## 8. Responsive Design (`targetWidth`)

Any element can have `targetWidth` to control visibility at different widths.

| Width | Typical Context |
|-------|----------------|
| `veryNarrow` | Meeting side panel |
| `narrow` | Mobile portrait |
| `standard` | Mobile landscape, tablet portrait, desktop chat |
| `wide` | Tablet landscape, desktop channel (with full-width) |

**Range prefixes**: `atLeast:standard` (standard and above), `atMost:narrow` (narrow and below).

**Full-width cards**: Set `msteams.width: "Full"` on the AdaptiveCard to use the full chat/channel width.

---

## 9. Teams-Specific Features

### 9.1 @Mentions

```json
{
  "type": "AdaptiveCard",
  "body": [{ "type": "TextBlock", "text": "Hi <at>John Doe</at>" }],
  "msteams": {
    "entities": [{
      "type": "mention",
      "text": "<at>John Doe</at>",
      "mentioned": { "id": "29:userId", "name": "John Doe" }
    }]
  }
}
```

Supports Teams user IDs, Microsoft Entra Object IDs, and UPNs.

### 9.2 Persona / PersonaSet

Display user profile photos and names using Microsoft Graph integration:

```json
{
  "type": "Component",
  "name": "graph.microsoft.com/user",
  "view": "compact",
  "properties": {
    "id": "entra-object-id",
    "displayName": "Name",
    "userPrincipalName": "user@domain.com"
  }
}
```

### 9.3 Image Stageview

```json
{ "type": "Image", "url": "...", "msTeams": { "allowExpand": true } }
```

Hover shows expand icon. Click opens full-size with zoom.

### 9.4 Information Masking

`Input.Text` with `style: "password"` masks input client-side.

### 9.5 Refresh & Authentication (v1.4+)

- `refresh`: Auto-refresh card via Action.Execute on load
- `authentication`: SSO token exchange or OAuth buttons

---

## 10. Design Best Practices (from Microsoft)

### Card Types

| Pattern | Use Case |
|---------|----------|
| **Hero** | Image-heavy stories, announcements |
| **Thumbnail** | Simple actionable messages |
| **List** | Item selection without heavy detail |
| **Digest** | News roundups, multiple items |
| **Media** | Text + audio/video |
| **People** | Team/individual communication |
| **Request/Ticket** | Quick input forms |

### Column Width Guidelines

- `"auto"`: Fit content. Use for buttons that must stay fully visible.
- `"stretch"`: Fill remaining space. Use when one column needs flexibility.
- `<number>`: Proportional (e.g., 1:4:5 = 10%:40%:50%).
- `"<number>px"`: Fixed pixel width for tables/thumbnails.

### Key Rules

1. **Always set `wrap: true`** on TextBlock — text truncates on mobile without it
2. **Design for narrow first** — cards scale up better than down
3. **1-3 primary actions** maximum per card (6 hard limit)
4. **Use `style` on containers** to create visual hierarchy (emphasis, accent)
5. **Use `selectAction`** on containers for clickable areas
6. **Use `Action.ToggleVisibility`** for collapsible sections
7. **Don't use containers without purpose** — only for grouping, emphasis, or interactivity
8. **High DPI images** — design 2x and display at 1x
9. **Transparent image backgrounds** — adapt to Teams themes

---

## 11. Our Current Builder vs Full Capability

### Coverage Summary

| Category | Our Builder | Full Teams Spec | Coverage |
|----------|------------|-----------------|----------|
| Content elements | 3 (TextBlock partial, Image basic, FactSet) | 9 (TextBlock, RichTextBlock, Image, Media, Icon, Badge, CodeBlock, Rating, CompoundButton) | ~25% |
| Charts | 0 | 8 types | 0% |
| Containers (user-configurable) | ~0 (implicit only) | 6 types with rich properties | ~5% |
| Layout system | 0 | 3 types (Stack, Flow, AreaGrid) | 0% |
| Actions | 1 (OpenUrl) | 6 types + overflow | ~10% |
| Inputs | 0 | 7 types | 0% |
| Templating | Simple `{{var}}` replacement | Full AEL expression language | ~5% |
| Teams extensions | 0 | @mentions, Persona, Stageview, full-width, responsive | 0% |
| Property exposure per element | ~15-20% of available properties | 100% | ~18% |

### What Our Builder Currently Supports

**Standard Mode** (guided form):
- Headline (TextBlock: size Large, weight Bolder)
- Author byline (TextBlock: size Small, isSubtle)
- Hero image (Image: full bleed, HTTPS only)
- Body text (TextBlock: wrapping, 4000 char max, basic `{{var}}` tokens)
- Key Details (FactSet in emphasis container, collapsible)
- Single CTA button (Action.OpenUrl, positive style)
- Secondary/footnote text (TextBlock: size Small, isSubtle)

**Advanced Mode** (block editor with 6 types):
- TextBlock (size + weight only)
- Divider (separator)
- ImageSet (URL list, no sizing/alt/captions)
- ColumnLayout (2-3 columns, text only)
- Table (2-4 columns, text cells, no formatting)
- ActionButton (title + URL only)

**Template system**: 9 built-in templates + custom user templates (CRUD via API).

**Preview**: Live AdaptiveCards.js renderer with Teams host config, 460px max width, debounced updates.

### Critical Gaps (Prioritized for Company Communicator)

#### Tier 1 — High Impact, Core to Communications

1. **Full TextBlock properties** — color, alignment, subtle, font type, maxLines. Users can't even center text or use semantic colors.
2. **Container styling** — showBorder, roundedCorners, style options. No visual grouping possible.
3. **Action.ToggleVisibility** — expand/collapse sections. Essential for long announcements.
4. **Rich column content** — columns should hold images, icons, badges, not just text.
5. **Image properties** — altText, size control, person style, Stageview expand.
6. **Action.ShowCard** — inline forms for feedback, acknowledgment, RSVP.

#### Tier 2 — Differentiating Features

7. **Input elements** — Input.Text, Input.ChoiceSet, Input.Date for surveys/RSVP/feedback.
8. **Icon element** — Fluent icons for visual polish.
9. **Badge element** — Status indicators, tags.
10. **Full-width cards** — `msteams.width: "Full"` for channel announcements.
11. **@mentions** — Tag specific people in announcements.
12. **Responsive layouts** — targetWidth for mobile-friendly cards.

#### Tier 3 — Power Features

13. **Charts** — Data visualization in announcements (Chart.HorizontalBar PartToWhole for survey results, Chart.Gauge for KPIs).
14. **Layout.AreaGrid** — Complex responsive layouts.
15. **Layout.Flow** — Image galleries, tag clouds.
16. **Templating with expressions** — `$when` conditionals, `$data` loops, AEL functions.
17. **CodeBlock** — Developer/IT audience communications.
18. **Carousel** — Multi-page card content.
19. **CompoundButton** — Rich action prompts.

#### Tier 4 — Enterprise Polish

20. **Persona/PersonaSet** — Graph-integrated people display.
21. **Rating/Input.Rating** — Feedback collection.
22. **Media** — Inline video in announcements.
23. **Action.Execute + Refresh** — Dynamic cards with user-specific views.
24. **Dependent inputs** — Smart forms.
25. **Overflow menus** — Clean action organization.

---

## Appendix: Useful Links

- [Adaptive Cards Documentation Hub](https://adaptivecards.microsoft.com/)
- [Adaptive Cards Designer (new)](https://adaptivecards.microsoft.com/designer)
- [Open-Source Schema Explorer](https://adaptivecards.io/explorer/)
- [Open-Source Samples](https://adaptivecards.io/samples/)
- [Charts in Adaptive Cards](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/charts-in-adaptive-cards)
- [Container Layouts](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/container-layouts)
- [Card Formatting Reference](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-format)
- [Design Effective Cards](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/design-effective-cards)
- [Templating Language](https://learn.microsoft.com/en-us/adaptive-cards/templating/language)
- [Templating SDK](https://learn.microsoft.com/en-us/adaptive-cards/templating/sdk)
- [AEL Functions Reference](https://learn.microsoft.com/en-us/azure/bot-service/bot-builder-concept-adaptive-expressions)
- [10 New Features Announcement](https://github.com/MicrosoftDocs/msteams-docs/discussions/12056)
- [Hub Launch Blog Post](https://devblogs.microsoft.com/microsoft365dev/introducing-the-adaptive-cards-documentation-hub-and-new-adaptive-cards-updates/)
