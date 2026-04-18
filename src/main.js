const {
  App,
  ItemView,
  Modal,
  Notice,
  Plugin,
  Setting,
  normalizePath,
  setIcon,
} = require("obsidian");
const { renderPebbleTrackerView } = require("./pebble-renderer");

const VIEW_TYPE_PEBBLE_TRACKER = "pebble-tracker-view";
const RECORDS_CSV_PATH = "PebbleTracker/records.csv.md";
const SETTINGS_JSON_PATH = "PebbleTracker/settings.json.md";
const RECORDS_CSV_HEADERS = ["id", "eventTypeId", "timestamp", "memo"];
const DEFAULT_DATA = {
  eventTypes: [],
  selectedEventTypeId: null,
};

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneData(data) {
  return {
    eventTypes: [...(data.eventTypes ?? [])],
    records: [...(data.records ?? [])],
    selectedEventTypeId: data.selectedEventTypeId ?? null,
  };
}

function escapeCsvCell(value) {
  const stringValue = String(value ?? "");
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function serializeRecordsCsv(records) {
  const rows = [
    RECORDS_CSV_HEADERS.join(","),
    ...records.map((record) =>
      RECORDS_CSV_HEADERS.map((header) => escapeCsvCell(record[header] ?? "")).join(","),
    ),
  ];
  return `${rows.join("\n")}\n`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      insideQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.length > 1 || candidate[0] !== "");
}

function deserializeRecordsCsv(text) {
  if (!text.trim()) {
    return [];
  }

  const rows = parseCsv(text);
  if (rows.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  const headerIndex = Object.fromEntries(
    headerRow.map((header, index) => [header, index]),
  );

  return dataRows
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => ({
      id: row[headerIndex.id] ?? createId("record"),
      eventTypeId: row[headerIndex.eventTypeId] ?? "",
      timestamp: row[headerIndex.timestamp] ?? new Date().toISOString(),
      memo: row[headerIndex.memo] ?? "",
    }))
    .filter((record) => record.eventTypeId);
}

function serializeSettingsJson(data) {
  return `${JSON.stringify(
    {
      eventTypes: data.eventTypes ?? [],
      selectedEventTypeId: data.selectedEventTypeId ?? null,
    },
    null,
    2,
  )}\n`;
}

function deserializeSettingsJson(text) {
  if (!text.trim()) {
    return cloneData(DEFAULT_DATA);
  }

  const parsed = JSON.parse(text);
  return {
    eventTypes: Array.isArray(parsed?.eventTypes) ? parsed.eventTypes : [],
    records: [],
    selectedEventTypeId:
      typeof parsed?.selectedEventTypeId === "string"
        ? parsed.selectedEventTypeId
        : null,
  };
}

class PebbleTrackerStore {
  constructor(plugin) {
    this.plugin = plugin;
    this.data = { ...cloneData(DEFAULT_DATA), records: [] };
  }

  async load() {
    const settingsFromVault = await this.loadSettingsFromVault();
    this.data = {
      eventTypes: settingsFromVault?.eventTypes ?? [],
      records: await this.loadRecordsFromCsv(),
      selectedEventTypeId: settingsFromVault?.selectedEventTypeId ?? null,
    };

    this.ensureSelectedEventType();
  }

  async reloadRecords() {
    this.data.records = await this.loadRecordsFromCsv();
  }

  async reloadSettings() {
    const loaded = await this.loadSettingsFromVault();
    this.data.eventTypes = loaded?.eventTypes ?? [];
    this.data.selectedEventTypeId = loaded?.selectedEventTypeId ?? null;
    this.ensureSelectedEventType();
  }

  async saveSettingsToVault() {
    const vault = this.plugin.app.vault;
    const filePath = normalizePath(SETTINGS_JSON_PATH);
    await this.ensureStorageDirectory();
    const content = serializeSettingsJson(this.data);
    const existingFile = vault.getAbstractFileByPath(filePath);

    if (existingFile) {
      await vault.modify(existingFile, content);
      return;
    }

    await vault.create(filePath, content);
  }

  getData() {
    return cloneData(this.data);
  }

  getEventTypes() {
    return [...this.data.eventTypes].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }

  getSelectedEventType() {
    return (
      this.data.eventTypes.find(
        (eventType) => eventType.id === this.data.selectedEventTypeId,
      ) ?? null
    );
  }

  async setSelectedEventType(id) {
    this.data.selectedEventTypeId = id;
    this.ensureSelectedEventType();
    await this.saveSettingsToVault();
  }

  async createEventType(input) {
    const eventType = {
      id: createId("event"),
      name: input.name.trim(),
      icon: input.icon.trim() || "circle",
      color: input.color.trim() || "#4f46e5",
      allowMemo: Boolean(input.allowMemo),
      createdAt: new Date().toISOString(),
    };
    this.data.eventTypes.push(eventType);
    if (!this.data.selectedEventTypeId) {
      this.data.selectedEventTypeId = eventType.id;
    }
    await this.saveSettingsToVault();
    return eventType;
  }

  async updateEventType(id, patch) {
    const eventType = this.data.eventTypes.find((item) => item.id === id);
    if (!eventType) {
      throw new Error("Event type not found");
    }

    eventType.name = patch.name.trim();
    eventType.icon = patch.icon.trim() || "circle";
    eventType.color = patch.color.trim() || "#4f46e5";
    eventType.allowMemo = Boolean(patch.allowMemo);
    await this.saveSettingsToVault();
    return eventType;
  }

  async deleteEventType(id) {
    this.data.eventTypes = this.data.eventTypes.filter((item) => item.id !== id);
    this.data.records = this.data.records.filter(
      (record) => record.eventTypeId !== id,
    );
    if (this.data.selectedEventTypeId === id) {
      this.data.selectedEventTypeId = this.data.eventTypes[0]?.id ?? null;
    }
    this.ensureSelectedEventType();
    await this.saveSettingsToVault();
    await this.saveRecordsToCsv();
  }

  async createRecord(input) {
    const record = {
      id: createId("record"),
      eventTypeId: input.eventTypeId,
      timestamp: new Date().toISOString(),
      memo: input.memo?.trim() || "",
    };
    this.data.records.push(record);
    await this.saveRecordsToCsv();
    return record;
  }

  listRecordsByEventType(eventTypeId) {
    return this.data.records
      .filter((record) => record.eventTypeId === eventTypeId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  listRecentRecords(eventTypeId, limit = 5) {
    return this.listRecordsByEventType(eventTypeId).slice(0, limit);
  }

  ensureSelectedEventType() {
    if (
      this.data.selectedEventTypeId &&
      this.data.eventTypes.some(
        (eventType) => eventType.id === this.data.selectedEventTypeId,
      )
    ) {
      return;
    }

    this.data.selectedEventTypeId = this.data.eventTypes[0]?.id ?? null;
  }

  async ensureStorageDirectory() {
    const vault = this.plugin.app.vault;
    const segments = normalizePath(RECORDS_CSV_PATH).split("/").slice(0, -1);
    let currentPath = "";

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      if (!vault.getAbstractFileByPath(currentPath)) {
        await vault.createFolder(currentPath);
      }
    }
  }

  async loadRecordsFromCsv() {
    const vault = this.plugin.app.vault;
    const file = vault.getAbstractFileByPath(normalizePath(RECORDS_CSV_PATH));
    if (!file) {
      return [];
    }

    const text = await vault.cachedRead(file);
    return deserializeRecordsCsv(text);
  }

  async saveRecordsToCsv() {
    const vault = this.plugin.app.vault;
    const filePath = normalizePath(RECORDS_CSV_PATH);
    await this.ensureStorageDirectory();
    const content = serializeRecordsCsv(this.data.records);
    const existingFile = vault.getAbstractFileByPath(filePath);

    if (existingFile) {
      await vault.modify(existingFile, content);
      return;
    }

    await vault.create(filePath, content);
  }

  async loadSettingsFromVault() {
    const vault = this.plugin.app.vault;
    const file = vault.getAbstractFileByPath(normalizePath(SETTINGS_JSON_PATH));
    if (!file) {
      return null;
    }

    const text = await vault.cachedRead(file);
    return deserializeSettingsJson(text);
  }
}

class EventFormModal extends Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
    this.name = options.initialValue?.name ?? "";
    this.icon = options.initialValue?.icon ?? "circle";
    this.color = options.initialValue?.color ?? "#4f46e5";
    this.allowMemo = options.initialValue?.allowMemo ?? true;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pebble-modal");

    contentEl.createEl("h2", {
      text: this.options.mode === "edit" ? "イベントを編集" : "イベントを追加",
    });

    new Setting(contentEl)
      .setName("名前")
      .setDesc("記録したいイベント名")
      .addText((text) =>
        text.setPlaceholder("例: トイレ").setValue(this.name).onChange((value) => {
          this.name = value;
        }),
      );

    new Setting(contentEl)
      .setName("アイコン")
      .setDesc("Obsidian のアイコン名")
      .addText((text) =>
        text.setPlaceholder("例: bath").setValue(this.icon).onChange((value) => {
          this.icon = value;
        }),
      );

    new Setting(contentEl)
      .setName("色")
      .setDesc("イベントを識別する色")
      .addColorPicker((picker) =>
        picker.setValue(this.color).onChange((value) => {
          this.color = value;
        }),
      );

    new Setting(contentEl)
      .setName("メモを許可")
      .setDesc("記録時にメモ欄を表示する")
      .addToggle((toggle) =>
        toggle.setValue(this.allowMemo).onChange((value) => {
          this.allowMemo = value;
        }),
      );

    const actionsEl = contentEl.createDiv({ cls: "pebble-modal-actions" });
    const cancelButton = actionsEl.createEl("button", { text: "キャンセル" });
    cancelButton.addEventListener("click", () => this.close());

    const saveButton = actionsEl.createEl("button", {
      text: this.options.mode === "edit" ? "更新" : "追加",
      cls: "mod-cta",
    });
    saveButton.addEventListener("click", async () => {
      if (!this.name.trim()) {
        new Notice("イベント名を入力してください");
        return;
      }

      await this.options.onSubmit({
        name: this.name,
        icon: this.icon,
        color: this.color,
        allowMemo: this.allowMemo,
      });
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class ConfirmDeleteModal extends Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pebble-modal");

    contentEl.createEl("h2", { text: "イベントを削除" });
    contentEl.createEl("p", {
      text: `「${this.options.name}」を削除します。関連する記録もすべて削除されます。`,
    });

    const actionsEl = contentEl.createDiv({ cls: "pebble-modal-actions" });
    const cancelButton = actionsEl.createEl("button", { text: "キャンセル" });
    cancelButton.addEventListener("click", () => this.close());

    const deleteButton = actionsEl.createEl("button", {
      text: "削除する",
      cls: "mod-warning",
    });
    deleteButton.addEventListener("click", async () => {
      await this.options.onConfirm();
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class EventPickerModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    this.render();
  }

  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pebble-modal");

    contentEl.createEl("h2", { text: "イベントを切り替え" });

    const listEl = contentEl.createDiv({ cls: "pebble-event-list" });
    const eventTypes = this.plugin.store.getEventTypes();

    if (eventTypes.length === 0) {
      listEl.createEl("p", {
        text: "イベントがありません。最初のイベントを追加してください。",
        cls: "pebble-empty-text",
      });
    }

    for (const eventType of eventTypes) {
      const rowEl = listEl.createDiv({ cls: "pebble-event-row" });
      rowEl.style.setProperty("--pebble-event-color", eventType.color);

      const mainButton = rowEl.createEl("button", {
        cls: "pebble-event-select-button",
      });
      const iconEl = mainButton.createSpan({ cls: "pebble-event-icon" });
      setIcon(iconEl, eventType.icon || "circle");
      iconEl.style.color = eventType.color;
      mainButton.createSpan({ text: eventType.name });
      mainButton.addEventListener("click", async () => {
        await this.plugin.store.setSelectedEventType(eventType.id);
        this.plugin.refreshViews();
        this.close();
      });

      const actionEl = rowEl.createDiv({ cls: "pebble-event-row-actions" });

      const editButton = actionEl.createEl("button", { text: "編集" });
      editButton.addEventListener("click", () => {
        new EventFormModal(this.app, {
          mode: "edit",
          initialValue: eventType,
          onSubmit: async (payload) => {
            await this.plugin.store.updateEventType(eventType.id, payload);
            this.plugin.refreshViews();
            this.render();
          },
        }).open();
      });

      const deleteButton = actionEl.createEl("button", {
        text: "削除",
        cls: "mod-warning",
      });
      deleteButton.addEventListener("click", () => {
        new ConfirmDeleteModal(this.app, {
          name: eventType.name,
          onConfirm: async () => {
            await this.plugin.store.deleteEventType(eventType.id);
            this.plugin.refreshViews();
            this.render();
          },
        }).open();
      });
    }

    const footerEl = contentEl.createDiv({ cls: "pebble-modal-actions" });
    const addButton = footerEl.createEl("button", {
      text: "イベントを追加",
      cls: "mod-cta",
    });
    addButton.addEventListener("click", () => {
      new EventFormModal(this.app, {
        mode: "create",
        onSubmit: async (payload) => {
          await this.plugin.store.createEventType(payload);
          this.plugin.refreshViews();
          this.render();
        },
      }).open();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class PebbleTrackerView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.mode = "tracker";
    this.range = "30d";
    this.granularity = "day";
    this.selectedDate = null;
    this.chartScrollLeft = 0;
    this.hasInitializedChartScroll = false;
  }

  getViewType() {
    return VIEW_TYPE_PEBBLE_TRACKER;
  }

  getDisplayText() {
    return "Pebble Tracker";
  }

  getIcon() {
    return "activity";
  }

  async onOpen() {
    await this.render();
  }

  async onClose() {}

  async render() {
    const container = this.containerEl.children[1];
    const data = this.plugin.store.getData();
    const selectedEventType = this.plugin.store.getSelectedEventType();
    renderPebbleTrackerView({
      container,
      data,
      selectedEventType,
      viewState: this,
      getRecentRecords: (eventTypeId, limit) =>
        this.plugin.store.listRecentRecords(eventTypeId, limit),
      getRecords: (eventTypeId) => this.plugin.store.listRecordsByEventType(eventTypeId),
      onOpenEventPicker: () => {
        new EventPickerModal(this.app, this.plugin).open();
      },
      onCreateFirstEvent: () => {
        new EventFormModal(this.app, {
          mode: "create",
          onSubmit: async (payload) => {
            await this.plugin.store.createEventType(payload);
            this.plugin.refreshViews();
          },
        }).open();
      },
      onRecord: async (payload) => {
        await this.plugin.store.createRecord(payload);
      },
      onNotify: (message) => {
        new Notice(message);
      },
      onRequestRender: async () => {
        await this.render();
      },
    });
  }
}

module.exports = class PebbleTrackerPlugin extends Plugin {
  async onload() {
    this.store = new PebbleTrackerStore(this);
    this.storeLoaded = false;
    this.storeLoadPromise = null;

    this.registerView(
      VIEW_TYPE_PEBBLE_TRACKER,
      (leaf) => new PebbleTrackerView(leaf, this),
    );

    this.addCommand({
      id: "open-pebble-tracker",
      name: "Open Pebble Tracker",
      callback: async () => {
        await this.activateView();
      },
    });

    this.addRibbonIcon("activity", "Open Pebble Tracker", async () => {
      await this.activateView();
    });

    this.app.workspace.onLayoutReady(() => {
      window.setTimeout(() => {
        void this.ensureStoreLoaded();
      }, 300);
    });

    const isRecordsFile = (file) =>
      file && normalizePath(file.path) === normalizePath(RECORDS_CSV_PATH);
    const isSettingsFile = (file) =>
      file && normalizePath(file.path) === normalizePath(SETTINGS_JSON_PATH);

    this.registerEvent(
      this.app.vault.on("modify", async (file) => {
        if (isRecordsFile(file)) {
          await this.store.reloadRecords();
          this.refreshViews();
          return;
        }
        if (isSettingsFile(file)) {
          await this.store.reloadSettings();
          this.refreshViews();
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on("create", async (file) => {
        if (isRecordsFile(file)) {
          await this.store.reloadRecords();
          this.refreshViews();
          return;
        }
        if (isSettingsFile(file)) {
          await this.store.reloadSettings();
          this.refreshViews();
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on("delete", async (file) => {
        if (isRecordsFile(file)) {
          await this.store.reloadRecords();
          this.refreshViews();
          return;
        }
        if (isSettingsFile(file)) {
          await this.store.reloadSettings();
          this.refreshViews();
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        const normalizedOldPath = normalizePath(oldPath);
        if (
          isRecordsFile(file) ||
          normalizedOldPath === normalizePath(RECORDS_CSV_PATH)
        ) {
          await this.store.reloadRecords();
          this.refreshViews();
          return;
        }
        if (
          isSettingsFile(file) ||
          normalizedOldPath === normalizePath(SETTINGS_JSON_PATH)
        ) {
          await this.store.reloadSettings();
          this.refreshViews();
        }
      }),
    );
  }

  async onunload() {
    await this.app.workspace.detachLeavesOfType(VIEW_TYPE_PEBBLE_TRACKER);
  }

  async ensureStoreLoaded() {
    if (this.storeLoaded) {
      return;
    }

    if (this.storeLoadPromise) {
      await this.storeLoadPromise;
      return;
    }

    this.storeLoadPromise = (async () => {
      try {
        await this.store.load();
        this.storeLoaded = true;
        this.refreshViews();
      } catch (error) {
        console.error("Pebble Tracker: failed to load data", error);
      } finally {
        this.storeLoadPromise = null;
      }
    })();

    await this.storeLoadPromise;
  }

  async activateView() {
    await this.ensureStoreLoaded();

    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_PEBBLE_TRACKER)[0];

    if (!leaf) {
      leaf = workspace.getLeaf(true);
      await leaf.setViewState({
        type: VIEW_TYPE_PEBBLE_TRACKER,
        active: true,
      });
    }

    workspace.revealLeaf(leaf);
    this.refreshViews();
  }

  refreshViews() {
    this.app.workspace
      .getLeavesOfType(VIEW_TYPE_PEBBLE_TRACKER)
      .forEach((leaf) => {
        if (leaf.view instanceof PebbleTrackerView) {
          void leaf.view.render();
        }
      });
  }
};
