# Pebble Tracker

Pebble Tracker is an Obsidian plugin for quickly logging user-defined events and reviewing them later with simple aggregate views. It is designed around fast mobile input, while keeping the recorded data accessible inside the vault.

## Current Scope

- Dedicated tracker tab for fast event logging
- GUI-based event creation, editing, and deletion
- Optional memo input per event type
- Aggregate views for hourly, daily, weekly, and monthly counts
- Bar chart and list views for the selected aggregation unit
- Shared event definitions through a vault settings file
- Record storage in a vault file at `PebbleTracker/records.csv.md`
- Automatic reload when `settings.json.md` or `records.csv.md` is edited in the vault

## Aggregation Modes

- Daily: `30 days` or `All time`
- Weekly: `14 weeks` or `All time`
- Monthly: `12 months` or `All time`
- Hourly: `24 hours` or `All time`

## File Layout

- [src/manifest.json](/Users/lighty/ghq/github.com/lighty/pebble-tracker/src/manifest.json): source manifest
- [src/main.js](/Users/lighty/ghq/github.com/lighty/pebble-tracker/src/main.js): source plugin implementation
- [src/pebble-renderer.js](/Users/lighty/ghq/github.com/lighty/pebble-tracker/src/pebble-renderer.js): shared renderer source
- [src/styles.css](/Users/lighty/ghq/github.com/lighty/pebble-tracker/src/styles.css): source UI styles
- `dist/`: build output for Obsidian installation and releases
- `release/`: prepared release assets for GitHub upload
- [docs/mvp-spec.md](/Users/lighty/ghq/github.com/lighty/pebble-tracker/docs/mvp-spec.md): MVP specification
- [docs/technical-design.md](/Users/lighty/ghq/github.com/lighty/pebble-tracker/docs/technical-design.md): Technical design notes

## Data Storage

- Event definitions and the currently selected event are stored in the vault at `PebbleTracker/settings.json.md`
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
5. Switch to the stats view to inspect hourly, daily, weekly, or monthly aggregates

## Installation

### Install with BRAT

1. Install the `BRAT` plugin from Obsidian Community Plugins
2. Open `BRAT` settings
3. Choose `Add Beta plugin`
4. Enter `https://github.com/lighty/pebble-tracker`
5. Install and enable `Pebble Tracker`

BRAT expects this repository to publish GitHub Releases. If installation fails, make sure you are using a released version instead of an unreleased commit.

### Manual install

Build first:

```bash
npm run build
```

Then copy these files from `dist/` into your vault at `.obsidian/plugins/pebble-tracker/`:

- `manifest.json`
- `main.js`
- `styles.css`

## Releases

This repository publishes GitHub Releases for BRAT and future Community Plugins distribution. Each release includes these assets:

- `manifest.json`
- `main.js`
- `styles.css`
- `versions.json`

## Local Check

For plugin syntax and the browser preview tool:

```bash
npm run check
```

Build distributable files:

```bash
npm run build
```

Prepare release upload assets under `release/<version>/`:

```bash
npm run release:prepare
```

## UI Preview

You can preview the plugin UI in a browser without copying files into an Obsidian vault on every edit.

```bash
npm run dev
```

Then open `http://127.0.0.1:4173`.

What the preview supports:

- Uses the source [src/styles.css](/Users/lighty/ghq/github.com/lighty/pebble-tracker/src/styles.css)
- Uses the shared renderer from [src/pebble-renderer.js](/Users/lighty/ghq/github.com/lighty/pebble-tracker/src/pebble-renderer.js)
- Lets you switch theme, viewport width, and sample data
- Reloads automatically when preview files or `src/` source files change

Preview files:

- [src/pebble-renderer.js](/Users/lighty/ghq/github.com/lighty/pebble-tracker/src/pebble-renderer.js): shared UI rendering and aggregation logic
- [scripts/build.js](/Users/lighty/ghq/github.com/lighty/pebble-tracker/scripts/build.js): builds `src/` into `dist/`
- [scripts/prepare-release.js](/Users/lighty/ghq/github.com/lighty/pebble-tracker/scripts/prepare-release.js): creates release upload assets
- [dev/server.js](/Users/lighty/ghq/github.com/lighty/pebble-tracker/dev/server.js): local development server with live reload
- [dev/index.html](/Users/lighty/ghq/github.com/lighty/pebble-tracker/dev/index.html): preview entry page
- [dev/preview-app.js](/Users/lighty/ghq/github.com/lighty/pebble-tracker/dev/preview-app.js): browser-side preview logic
- [dev/preview.css](/Users/lighty/ghq/github.com/lighty/pebble-tracker/dev/preview.css): preview shell styling
