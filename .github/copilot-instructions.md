# Copilot Instructions for OVERLORD

OVERLORD is a PWA for creating, managing, and sharing statblocks for Trespasser RPG.

## Architecture Overview

### Core Data Flow
The app uses a **single source of truth pattern** via `masterYamlData` (in `js/yamlDataState.mjs`):
1. User edits → UI Editor OR YAML textarea
2. Changes sync to `masterYamlData` object
3. `masterYamlData` triggers render updates and localStorage persistence

Three synchronized views of the same data:
- **UI Editor** (`#editorPanel`) - Form-based editing
- **YAML Editor** (`#yamlPanel`) - Raw YAML editing  
- **Statblock Render** (`#detailStatblock`) - Visual preview

### Module Responsibilities
| Module | Purpose |
|--------|---------|
| `main.js` | Entry point, event wiring, initialization |
| `yamlDataState.mjs` | Shared state: `masterYamlData`, `DEFAULT_STATS`, `hiddenStats` |
| `masterYamlData.mjs` | Sync logic between UI ↔ YAML ↔ render |
| `libraryData.mjs` | localStorage CRUD for statblocks, bundles, components |
| `libraryBrowser.mjs` | Library table rendering, filtering, sorting |
| `bundleManagement.mjs` | Bundle upload, create, merge, export (JSON/YAML) |
| `componentManagement.mjs` | Reusable statblock parts (features, deeds) |
| `statblockRender.mjs` | DOM rendering of statblock preview |
| `idManagement.mjs` | Content-hash based ID generation |
| `shareStatblocks.mjs` | LZ-string compression for share URLs |
| `uiControllers.mjs` | Sidebar toggling, panel switching |

### Storage Keys (localStorage)
- `trespasser_statblocks` - Library data + favorites
- `trespasser_uploadedBundles` - Bundle metadata
- `trespasser_statblockComponents` - Reusable YAML snippets

## Key Patterns

### ID Generation
IDs are **content-hashes**, not random UUIDs. See `js/idManagement.mjs`:
```javascript
// Statblock ID = hash of canonicalized content (excludes statblockID, bundleId)
generateStatblockID(statblockObj)
// Component ID = "comp-" prefix + hash
generateComponentID(componentObj)
```

### Event-Driven UI Refresh
Use custom events to trigger UI updates across modules:
```javascript
document.dispatchEvent(new CustomEvent('refreshUI'));      // Refresh all panels
document.dispatchEvent(new CustomEvent('saveLibraryChanges')); // Persist to localStorage
```

### Statblock Data Structure
```yaml
monsterName: "Goblin"
role: "Harrier"           # Archer|Enchanter|Enforcer|Guardian|Harrier|Hellion|Stalker|Sorcerer
template: "Underling"     # Underling|Paragon|Tyrant
level: 2
tr: "1/4"
hp: 10
init: 5
acc: 4
grd: 10
res: 8
roll: 3
spd: 6
customStats: [{name: "FLY", value: "4"}]
features: [{title: "Nimble", content: "Can disengage as a free action"}]
lightDeeds: [{title: "Stab", lines: [{title: "Hit", content: "1d6 damage"}]}]
# Also: heavyDeeds, mightyDeeds, tyrantDeeds, specialDeeds
```

### Bundle Format
Bundles contain statblocks AND components with shared `bundleId`:
```json
{
  "id": "abc123",
  "bundleName": "My Creatures",
  "active": true,
  "data": {
    "statblocks": [...],
    "components": [...]
  }
}
```

## Development Notes

### Running Locally
Serve with any static file server. The app is a PWA with offline support via `serviceworker.js`.

### External Dependencies (loaded via CDN)
- `js-yaml` - YAML parsing/serialization
- `fuse.js` - Fuzzy search for library
- `html2canvas` + `jspdf` - Export to PNG/PDF
- `jszip` - Backup export/import
- `lz-string` - URL compression for sharing

### Adding New Statblock Fields
1. Add field to `DEFAULT_STATS` in `yamlDataState.mjs` (if basic stat)
2. Update `updateUIFromMasterYaml()` in `masterYamlData.mjs`
3. Update `updateMasterYamlDataFromUI()` in `masterYamlData.mjs`
4. Update render in `statblockRender.mjs`
5. Add UI element in `index.html` editor panel

## Core Bundles

### File Structure
- `core-bundles/index.json` - Array of bundle filenames to load
- Bundle files are JSON arrays of statblock objects (not wrapped in metadata)

### Statblock Object Schema
```javascript
{
  // REQUIRED FIELDS
  "monsterName": "Goblin",           // String - creature name
  "statblockID": "6dd02709",         // String - 8-char hex hash (auto-generated from content)
  "bundleId": "ab3ed20f",            // String - 8-char hex hash identifying parent bundle

  // IDENTITY (all optional)
  "role": "Harrier",                 // Archer|Enchanter|Enforcer|Guardian|Harrier|Hellion|Stalker|Sorcerer
  "template": "Underling",           // Underling|Paragon|Tyrant (or empty string)
  "level": 2,                        // Number or String "2" - both work
  "tr": 20,                          // Threat Rating - Number or String

  // BASIC STATS (all optional, Number or String)
  "hp": 30,
  "init": 14,
  "acc": 16,
  "grd": 12,
  "res": 12,
  "roll": "+4",                      // Usually string with + prefix
  "spd": 5,

  // FEATURES - Object with title:content pairs OR title:array pairs
  "features": {
    "Fleet of Foot": "This creature has +2 bonus to speed.",
    "Belongings": ["Sword (d8)", "Shield (+1 AR)"]  // Arrays for item lists
  },

  // DEEDS - Multiline strings with \n separators
  // Format: DEED_NAME\nATTACK_LINE\nTarget: X | Range: X\nBase: ...\nHit: ...\nShadow: ...\n
  "lightDeeds": "SHORTSWORD\nMELEE ATTACK VS. GUARD\nTarget: 1 Creature | Range: 1\nHit: Deal 7 damage.\n",
  "heavyDeeds": "",                  // Empty string if none
  "mightyDeeds": "",
  "tyrantDeeds": "",                 // Only for Tyrant template creatures
  "specialDeeds": "",                // Conditional abilities (e.g., triggered when burrowed)

  // CUSTOM STATS (optional array)
  "customStats": [{ "name": "FLY", "value": "4" }]
}
```

### Deed String Format
Each deed block separated by `\n\n`, internal lines by `\n`:
```
DEED_NAME
ATTACK_TYPE VS. DEFENSE
[Start: ...] | [Area: ...] | Target: X | Range: X
Base: Effect text.
Hit: Additional effect.
[Shadow: Spark bonus effect.]
[After: Post-attack effect.]
```

### Key Conventions in Existing Bundles
- **IDs are content-hashes**: Changing content changes the ID. Keep `statblockID` and `bundleId` when editing unless content actually changes.
- **Type flexibility**: Numeric fields accept both `2` and `"2"` - the app handles both.
- **Empty deeds**: Use empty string `""` not null/undefined.
- **Features object vs empty**: Use `{}` for no features, not null.
- **Multiline in JSON**: Use `\n` for line breaks in deed strings.

### Updating Core Bundles
1. Edit the JSON file directly
2. If content changes, regenerate `statblockID` using `generateStatblockID()` from `idManagement.mjs`
3. Keep `bundleId` consistent across all statblocks in the same bundle
4. Add new bundles to `core-bundles/index.json` array

## Deployment
Deployed via GitHub Pages. The service worker (`serviceworker.js`) caches assets for offline PWA support. Increment `CACHE_VERSION` when deploying updates to force cache refresh.
