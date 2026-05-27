---
name: docs-iopool-card
description: Writing, updating, and structuring documentation pages for hass-iopool-card. Covers MDX format, frontmatter, docs.page components, docs.json navigation registration, and when to update docs after code changes.
user-invocable: false
---

# Skill: Documentation — hass-iopool-card

Use this skill for any task that creates, modifies, or reviews files under `docs/`.

---

## 1. File Format and Location

- All doc files use **MDX** (`.mdx` extension)
- Language: **English**, clear and concise
- Location: `docs/` hierarchy (see §6 for structure)
- Documentation is published with **[docs.page](https://use.docs.page/)** — consult the official docs for the full component catalogue and configuration options

---

## 2. Required Frontmatter

Every `.mdx` file needs at minimum:

```mdx
---
title: Page Title
description: One-sentence description for SEO / nav tooltips
---
```

Pages that are part of a sequence must also include navigation links:

```mdx
---
title: Page Title
description: ...
previous: /previous-page
previousTitle: Previous Page
next: /next-page
nextTitle: Next Page
---
```

Special pages (like FAQ) can use `summary` instead of `description`:

```mdx
---
title: FAQ
summary: Frequently Asked Questions
---
```

---

## 3. MDX Components (docs.page)

> **The list below is non-exhaustive.** docs.page supports many more components.
> Before using a component or checking its props, **look it up via Context7 or a web search** on [use.docs.page](https://use.docs.page/) to get up-to-date documentation.

### 3.1 Callout components (examples)

| Component | Use for |
|-----------|---------|
| `<Info>` | General informational notes |
| `<Warning>` | Important caveats or breaking changes |
| `<Tip>` | Optional best practices / helpful hints |
| `<Success>` | Positive confirmation or completion state |

```mdx
<Info>
The card is installed automatically with the `hass-iopool` integration.
</Info>

<Warning>
Requires Home Assistant >= 2026.5.
</Warning>
```

### 3.2 `<Card>` (example)

Used to display structured data examples (e.g. YAML config snippets):

```mdx
<Card title="Minimal YAML configuration" icon="newspaper">
```yaml
type: custom:iopool-card
device_id: 0a1b2c3d4e5f...
```
</Card>
```

### 3.3 `<Accordion>` (example)

Collapsible FAQ-style entries:

```mdx
<Accordion title="Card not showing in card picker?" icon="question" defaultOpen>
Clear the browser cache (Ctrl+F5) and verify HA >= 2026.5.
</Accordion>
```

### 3.4 `<Property>` (example)

Documents a configuration parameter:

```mdx
<Property name="device_id" type="string" required>
The iopool device ID. Select via the visual editor device picker.
</Property>

<Property name="pump_entity" type="string">
Optional pump switch entity (e.g. `switch.my_pump`).
</Property>
```

### 3.5 `<Steps>` / `<Step>` (example)

Sequential numbered steps (e.g. first-card guide):

```mdx
<Steps>
  <Step title="Open your dashboard">
    Click the pencil icon to enter edit mode.
  </Step>
  <Step title="Add a new card">
    Search for "iopool" in the card picker.
  </Step>
</Steps>
```

### 3.6 `<Image>` (example)

Displays images under `docs/assets/screenshots/`:

```mdx
<Image src="/assets/screenshots/card-standard-light.png" alt="iopool card — standard mode, light theme" />
```

Use the placeholder convention (see §7) while real screenshots are not available.

### 3.7 `<Badges>` (example)

Used on the homepage to display GitHub status badges:

```mdx
<Badges>
  <Image src="https://img.shields.io/github/license/mguyard/hass-iopool-card?style=default&color=0080ff" alt="License" />
</Badges>
```

---

## 4. Code Blocks

Always specify the language:

````mdx
```yaml
```typescript
```bash
```json
```mdx
````

To highlight specific lines inside a code block, use `// [!code highlight]` at the end of the line:

```yaml
type: custom:iopool-card  # [!code highlight]
device_id: 0a1b2c3d...   # [!code highlight]
pump_entity: switch.pump
```

---

## 5. docs.json — Navigation Registration

When adding a new page, register it in `docs.json` under the correct `group`.

### 5.1 Sidebar structure reference

```json
{
  "sidebar": [
    {
      "group": "Getting started",
      "pages": [
        "introduction",
        "installation",
        "first-card"
      ]
    },
    {
      "group": "Configuration",
      "pages": [
        "configuration/overview",
        "configuration/device",
        "configuration/pump",
        "configuration/thresholds",
        "configuration/chart",
        "configuration/actions"
      ]
    },
    {
      "group": "Visual modes",
      "pages": [
        "modes/standard",
        "modes/active-winter",
        "modes/passive-winter",
        "modes/maintenance"
      ]
    },
    {
      "group": "Troubleshooting",
      "pages": [
        "troubleshooting/debug-mode",
        "troubleshooting/common-issues"
      ]
    }
  ]
}
```

- `href` must match the file path relative to `docs/` (without `.mdx`)
- Icons come from the Font Awesome icon library (e.g. `sitemap`, `cog`, `wrench`, `chart-line`)

### 5.2 Commit type for docs changes

All `docs/` and `docs.json` changes must use:

```
docs(<scope>): 📝 <description>
```

Examples:
- `docs(installation): 📝 Document cache clearing step`
- `docs(thresholds): 📝 Add spa temperature preset example`
- `docs(debug-mode): 📝 Document console output format`

---

## 6. Directory Structure

```
docs/
├── introduction.mdx            # What is iopool-card, screenshots, compatibility
├── installation.mdx            # Installation (via hass-iopool integration), cache clearing
├── first-card.mdx              # Step-by-step: add card in Lovelace
├── docs.json                   # Navigation config (sidebar + anchors)
├── assets/
│   └── screenshots/            # Screenshots (placeholders until real ones available)
│       ├── placeholder-card-standard-light.png
│       ├── placeholder-card-standard-dark.png
│       └── ...
├── configuration/
│   ├── overview.mdx            # All options table + minimal/full YAML example
│   ├── device.mdx              # Device picker, device renaming
│   ├── pump.mdx                # pump_entity field, on/off display
│   ├── thresholds.mdx          # Pool defaults, spa presets
│   ├── chart.mdx               # show_chart, chart_period, tooltip
│   └── actions.mdx             # section_actions, tap/hold/double_tap examples
├── modes/
│   ├── standard.mdx            # STANDARD mode — all sections visible
│   ├── active-winter.mdx       # ACTIVE_WINTER — reduced display
│   ├── passive-winter.mdx      # WINTER — minimal display
│   └── maintenance.mdx         # MAINTENANCE / INITIALIZATION — grayed + banner
└── troubleshooting/
    ├── debug-mode.mdx          # How to enable debug: true, what gets logged
    └── common-issues.mdx       # Card not in picker, title shows "iopool", etc.
```

---

## 7. Screenshot Placeholder Convention

All screenshots use placeholders in `docs/assets/screenshots/` until Marc replaces them with real screenshots before public release.

| Placeholder filename | Content |
|---|---|
| `placeholder-card-standard-light.png` | 800×600 labeled image |
| `placeholder-card-standard-dark.png` | 800×600 labeled image |
| `placeholder-card-active-winter.png` | 800×600 labeled image |
| `placeholder-card-passive-winter.png` | 800×600 labeled image |
| `placeholder-card-maintenance.png` | 800×600 labeled image |
| `placeholder-editor-device-picker.png` | 800×600 labeled image |
| `placeholder-editor-thresholds.png` | 800×600 labeled image |
| `placeholder-debug-console.png` | 800×600 labeled image |

Reference placeholders as if they were real images — docs build must succeed with placeholders in place.

---

## 8. When to Update Documentation

After **any code change** (new config option, changed behavior, new visual mode, renamed field…), apply this process before considering the task complete:

1. **Scan `docs/`** — identify pages that cover the changed area (configuration, modes, troubleshooting).
2. **Update only what changed** — add, edit, or remove the relevant sentences, rows, or sections.
3. **Match the existing style** — tone, table format, MDX components, and heading levels must stay consistent with the surrounding content.
4. **When in doubt, ask the developer** — if it is unclear whether documentation needs updating, ask via `vscode_askQuestions` before writing or skipping it.
