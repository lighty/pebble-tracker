# Pebble Tracker

Pebble Tracker is an Obsidian plugin for quickly logging user-defined events and reviewing them later with simple aggregate views. It is designed around fast mobile input, while keeping the recorded data accessible inside the vault.

## Current Scope

- Dedicated tracker tab for fast event logging
- GUI-based event creation, editing, and deletion
- Optional memo input per event type
- Aggregate views for daily, weekly, and monthly counts
- Bar chart and list views for the selected aggregation unit
- Record storage in a vault file at `PebbleTracker/records.csv.md`
- Automatic reload when `records.csv.md` is edited in the vault

## Aggregation Modes

- Daily: `30 days` or `All time`
- Weekly: `7 weeks` or `All time`
- Monthly: `12 months` or `All time`

## File Layout

- [manifest.json](/Users/lighty/ghq/github.com/lighty/pebble-tracker/manifest.json): Obsidian plugin manifest
- [main.js](/Users/lighty/ghq/github.com/lighty/pebble-tracker/main.js): Plugin implementation
- [styles.css](/Users/lighty/ghq/github.com/lighty/pebble-tracker/styles.css): UI styles
- [docs/mvp-spec.md](/Users/lighty/ghq/github.com/lighty/pebble-tracker/docs/mvp-spec.md): MVP specification
- [docs/technical-design.md](/Users/lighty/ghq/github.com/lighty/pebble-tracker/docs/technical-design.md): Technical design notes

## Data Storage

- Event definitions and the currently selected event are stored in Obsidian plugin data
- Event records are stored in the vault at `PebbleTracker/records.csv.md`

CSV header:

```csv
id,eventTypeId,timestamp,memo
```

The file uses a `.md` suffix so it stays visible and openable in Obsidian's file tree, while the content itself remains CSV-formatted.

## Usage

1. Enable the plugin in Obsidian Community Plugins
2. Open `Pebble Tracker` from the left ribbon or the `Open Pebble Tracker` command
3. Create one or more event types
4. Select an event, optionally add a memo, and tap the record button
5. Switch to the stats view to inspect daily, weekly, or monthly aggregates

## Local Check

There is no build pipeline yet. The current minimum validation step is:

```bash
node --check main.js
```
