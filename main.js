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

function formatDateLabel(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function formatTimeLabel(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatDateTimeHourKey(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:00`;
}

function normalizeDateKey(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(dateInput) {
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekStart(dateInput) {
  const date = startOfDay(dateInput);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function getMonthStart(dateInput) {
  const date = startOfDay(dateInput);
  date.setDate(1);
  return date;
}

function startOfHour(dateInput) {
  const date = new Date(dateInput);
  date.setMinutes(0, 0, 0);
  return date;
}

function formatMonthKey(dateInput) {
  const date = new Date(dateInput);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatWeekKey(dateInput) {
  const weekStart = getWeekStart(dateInput);
  const thursday = new Date(weekStart);
  thursday.setDate(weekStart.getDate() + 3);
  const isoYear = thursday.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  const firstWeekStart = getWeekStart(firstThursday);
  const diffDays = Math.round(
    (weekStart.getTime() - firstWeekStart.getTime()) / 86400000,
  );
  const weekNumber = Math.floor(diffDays / 7) + 1;
  return `${isoYear}-W${String(weekNumber).padStart(2, "0")}`;
}

function getBucketKey(timestamp, granularity) {
  if (granularity === "hour") {
    return formatDateTimeHourKey(timestamp);
  }
  if (granularity === "week") {
    return formatWeekKey(timestamp);
  }
  if (granularity === "month") {
    return formatMonthKey(timestamp);
  }
  return normalizeDateKey(timestamp);
}

function getBucketStartFromKey(key, granularity) {
  if (granularity === "hour") {
    const [datePart, timePart] = key.split(" ");
    const [year, month, day] = datePart.split("-").map(Number);
    const hour = Number(timePart.split(":")[0]);
    return new Date(year, month - 1, day, hour, 0, 0, 0);
  }

  if (granularity === "month") {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }

  if (granularity === "week") {
    const [yearPart, weekPart] = key.split("-W");
    const year = Number(yearPart);
    const week = Number(weekPart);
    const firstThursday = new Date(year, 0, 4);
    const firstWeekStart = getWeekStart(firstThursday);
    const result = new Date(firstWeekStart);
    result.setDate(firstWeekStart.getDate() + (week - 1) * 7);
    return result;
  }

  return new Date(`${key}T00:00:00`);
}

function formatBucketLabel(key, granularity) {
  if (granularity === "hour") {
    const date = getBucketStartFromKey(key, "hour");
    const dateLabel = new Intl.DateTimeFormat(undefined, {
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    const timeLabel = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
    return `${dateLabel} ${timeLabel}`;
  }

  if (granularity === "month") {
    return key;
  }

  if (granularity === "week") {
    const start = getBucketStartFromKey(key, "week");
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startLabel = new Intl.DateTimeFormat(undefined, {
      month: "2-digit",
      day: "2-digit",
    }).format(start);
    const endLabel = new Intl.DateTimeFormat(undefined, {
      month: "2-digit",
      day: "2-digit",
    }).format(end);
    return `${startLabel}-${endLabel}`;
  }

  return key;
}

function getChartLabelParts(key, granularity, previousKey = null) {
  if (granularity === "hour") {
    const date = getBucketStartFromKey(key, "hour");
    const hour = date.getHours();
    const hourLabel = String(hour).padStart(2, "0");

    if (hour === 0) {
      const dateLabel = new Intl.DateTimeFormat(undefined, {
        month: "2-digit",
        day: "2-digit",
      }).format(date);
      return [dateLabel, hourLabel];
    }

    return ["", hourLabel];
  }

  if (granularity === "day") {
    const date = getBucketStartFromKey(key, "day");
    const previousDate = previousKey
      ? getBucketStartFromKey(previousKey, "day")
      : null;
    const dayLabel = new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
    }).format(date);
    const shouldShowMonth =
      !previousDate ||
      previousDate.getFullYear() !== date.getFullYear() ||
      previousDate.getMonth() !== date.getMonth();
    const yearMonthLabel = `${date.getFullYear()}/${String(
      date.getMonth() + 1,
    ).padStart(2, "0")}`;

    return [shouldShowMonth ? yearMonthLabel : "", dayLabel];
  }

  if (granularity === "week") {
    const date = getBucketStartFromKey(key, "week");
    const previousDate = previousKey
      ? getBucketStartFromKey(previousKey, "week")
      : null;
    const dayLabel = new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
    }).format(date);
    const shouldShowMonth =
      !previousDate ||
      previousDate.getFullYear() !== date.getFullYear() ||
      previousDate.getMonth() !== date.getMonth();
    const yearMonthLabel = `${date.getFullYear()}/${String(
      date.getMonth() + 1,
    ).padStart(2, "0")}`;

    return [shouldShowMonth ? yearMonthLabel : "", dayLabel];
  }

  if (granularity === "month") {
    const date = getBucketStartFromKey(key, "month");
    const previousDate = previousKey
      ? getBucketStartFromKey(previousKey, "month")
      : null;
    const monthLabel = String(date.getMonth() + 1).padStart(2, "0");
    const shouldShowYear =
      !previousDate || previousDate.getFullYear() !== date.getFullYear();

    return [shouldShowYear ? String(date.getFullYear()) : "", monthLabel];
  }

  return ["", formatBucketLabel(key, granularity)];
}

function isRecordInBucket(record, bucketKey, granularity) {
  return getBucketKey(record.timestamp, granularity) === bucketKey;
}

function getRangeStart(range) {
  if (range === "all") {
    return null;
  }

  const days = {
    "24h": 1,
    "30d": 30,
    "7w": 49,
    "12m": 365,
  }[range];

  const start = new Date();
  if (range === "24h") {
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() - 23);
    return start;
  }

  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
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

function aggregateCounts(records, range, granularity) {
  const rangeStart = getRangeStart(range);
  const filtered = records
    .filter((record) => {
      if (!rangeStart) {
        return true;
      }
      return new Date(record.timestamp) >= rangeStart;
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const counts = new Map();
  for (const record of filtered) {
    const bucketKey = getBucketKey(record.timestamp, granularity);
    counts.set(bucketKey, (counts.get(bucketKey) ?? 0) + 1);
  }

  if (rangeStart) {
    const cursor =
      granularity === "hour"
        ? startOfHour(rangeStart)
        : granularity === "month"
        ? getMonthStart(rangeStart)
        : granularity === "week"
          ? getWeekStart(rangeStart)
          : startOfDay(rangeStart);
    const today =
      granularity === "hour"
        ? startOfHour(new Date())
        : granularity === "month"
        ? getMonthStart(new Date())
        : granularity === "week"
          ? getWeekStart(new Date())
          : startOfDay(new Date());

    while (cursor <= today) {
      const key = getBucketKey(cursor, granularity);
      if (!counts.has(key)) {
        counts.set(key, 0);
      }

      if (granularity === "hour") {
        cursor.setHours(cursor.getHours() + 1);
      } else if (granularity === "month") {
        cursor.setMonth(cursor.getMonth() + 1);
      } else if (granularity === "week") {
        cursor.setDate(cursor.getDate() + 7);
      } else {
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => ({
      key,
      count,
      label: formatBucketLabel(key, granularity),
    }));
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
    this.memoInputEl = null;
    this.recentRecordsLimit = 5;
    this.recentRecordsBatchSize = 10;
    this.recentRecordsEventTypeId = null;
    this.recentRecordsScrollTop = 0;
    this.isLoadingMoreRecentRecords = false;
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
    container.empty();
    container.addClass("pebble-root");

    const data = this.plugin.store.getData();
    const selectedEventType = this.plugin.store.getSelectedEventType();

    const headerEl = container.createDiv({ cls: "pebble-header" });
    const titleBlockEl = headerEl.createDiv();
    titleBlockEl.createEl("div", {
      text: "Pebble Tracker",
      cls: "pebble-eyebrow",
    });
    titleBlockEl.createEl("h1", {
      text: selectedEventType?.name ?? "イベント未選択",
      cls: "pebble-title",
    });

    const headerActionsEl = headerEl.createDiv({ cls: "pebble-header-actions" });
    const pickerButton = headerActionsEl.createEl("button", { text: "イベント切替" });
    pickerButton.addEventListener("click", () => {
      new EventPickerModal(this.app, this.plugin).open();
    });

    const modeButton = headerActionsEl.createEl("button", {
      text: this.mode === "tracker" ? "集計" : "記録",
    });
    modeButton.addEventListener("click", async () => {
      this.mode = this.mode === "tracker" ? "stats" : "tracker";
      await this.render();
    });

    if (data.eventTypes.length === 0) {
      this.renderEmptyState(container);
      return;
    }

    if (this.mode === "tracker") {
      this.renderTracker(container, selectedEventType);
      return;
    }

    this.renderStats(container, selectedEventType);
  }

  renderEmptyState(container) {
    const emptyEl = container.createDiv({ cls: "pebble-empty-state" });
    emptyEl.createEl("p", {
      text: "まだイベントがありません。最初のイベントを追加してください。",
    });

    const addButton = emptyEl.createEl("button", {
      text: "最初のイベントを追加",
      cls: "mod-cta",
    });
    addButton.addEventListener("click", () => {
      new EventFormModal(this.app, {
        mode: "create",
        onSubmit: async (payload) => {
          await this.plugin.store.createEventType(payload);
          this.plugin.refreshViews();
        },
      }).open();
    });
  }

  renderTracker(container, selectedEventType) {
    const cardEl = container.createDiv({ cls: "pebble-card pebble-tracker-card" });
    cardEl.createEl("div", {
      text: "すばやく記録",
      cls: "pebble-section-title",
    });

    if (selectedEventType?.allowMemo) {
      const fieldEl = cardEl.createDiv({ cls: "pebble-field" });
      fieldEl.createEl("label", { text: "メモ" });
      this.memoInputEl = fieldEl.createEl("textarea", {
        cls: "pebble-memo-input",
      });
      this.memoInputEl.placeholder = "必要ならメモを残す";
      this.memoInputEl.rows = 3;
    } else {
      this.memoInputEl = null;
    }

    const recordButton = cardEl.createEl("button", {
      text: `${selectedEventType?.name ?? "イベント"} を記録する`,
      cls: "mod-cta pebble-record-button",
    });
    recordButton.addEventListener("click", async () => {
      if (!selectedEventType) {
        new Notice("イベントを選択してください");
        return;
      }

      await this.plugin.store.createRecord({
        eventTypeId: selectedEventType.id,
        memo: this.memoInputEl?.value ?? "",
      });

      if (this.memoInputEl) {
        this.memoInputEl.value = "";
      }

      new Notice(`${selectedEventType.name} を記録しました`);
      this.selectedDate = getBucketKey(new Date().toISOString(), this.granularity);
      this.plugin.refreshViews();
    });

    const recentEl = container.createDiv({ cls: "pebble-card" });
    recentEl.createEl("div", {
      text: "直近の記録",
      cls: "pebble-section-title",
    });

    const selectedEventTypeId = selectedEventType?.id ?? null;
    if (this.recentRecordsEventTypeId !== selectedEventTypeId) {
      this.recentRecordsEventTypeId = selectedEventTypeId;
      this.recentRecordsLimit = 5;
      this.recentRecordsScrollTop = 0;
    }

    const recentRecords = selectedEventType
      ? this.plugin.store.listRecentRecords(
          selectedEventType.id,
          this.recentRecordsLimit,
        )
      : [];
    const totalRecentRecordCount = selectedEventType
      ? this.plugin.store.listRecordsByEventType(selectedEventType.id).length
      : 0;

    if (recentRecords.length === 0) {
      recentEl.createEl("p", {
        text: "まだ記録がありません。",
        cls: "pebble-empty-text",
      });
      return;
    }

    const listScrollEl = recentEl.createDiv({ cls: "pebble-record-list-scroll" });
    listScrollEl.addEventListener("scroll", () => {
      this.recentRecordsScrollTop = listScrollEl.scrollTop;
    });
    if (recentRecords.length < totalRecentRecordCount) {
      listScrollEl.addEventListener("scroll", async () => {
        const remainingScroll =
          listScrollEl.scrollHeight - listScrollEl.scrollTop - listScrollEl.clientHeight;
        if (remainingScroll > 24 || this.isLoadingMoreRecentRecords) {
          return;
        }

        this.isLoadingMoreRecentRecords = true;
        try {
          this.recentRecordsScrollTop = listScrollEl.scrollTop;
          this.recentRecordsLimit += this.recentRecordsBatchSize;
          await this.render();
        } finally {
          this.isLoadingMoreRecentRecords = false;
        }
      });
    }

    const listEl = listScrollEl.createDiv({ cls: "pebble-record-list" });
    for (const record of recentRecords) {
      const rowEl = listEl.createDiv({ cls: "pebble-record-row" });
      rowEl.createSpan({
        text: `${formatDateLabel(record.timestamp)} ${formatTimeLabel(record.timestamp)}`,
        cls: "pebble-record-time",
      });
      rowEl.createSpan({
        text: record.memo || "メモなし",
        cls: "pebble-record-memo",
      });
    }

    window.requestAnimationFrame(() => {
      listScrollEl.scrollTop = this.recentRecordsScrollTop;
    });

  }

  renderStats(container, selectedEventType) {
    const previousChartScrollLeft = this.chartScrollLeft;
    const cardEl = container.createDiv({ cls: "pebble-card" });
    cardEl.createEl("div", {
      text:
        this.granularity === "hour"
          ? "時間別集計"
          : this.granularity === "day"
            ? "日別集計"
            : this.granularity === "week"
              ? "週別集計"
              : "月別集計",
      cls: "pebble-section-title",
    });

    const granularityEl = cardEl.createDiv({ cls: "pebble-range-switcher" });
    for (const granularity of ["hour", "day", "week", "month"]) {
      const button = granularityEl.createEl("button", {
        text:
          granularity === "hour"
            ? "時間別"
            : granularity === "day"
            ? "日別"
            : granularity === "week"
              ? "週別"
              : "月別",
      });
      if (this.granularity === granularity) {
        button.addClass("is-active");
      }
      button.addEventListener("click", async () => {
        this.granularity = granularity;
        this.selectedDate = null;
        this.chartScrollLeft = 0;
        this.hasInitializedChartScroll = false;
        await this.render();
      });
    }

    const availableRanges =
      this.granularity === "hour"
        ? ["24h", "all"]
        : this.granularity === "day"
        ? ["30d", "all"]
        : this.granularity === "week"
          ? ["7w", "all"]
          : ["12m", "all"];

    const rangeEl = cardEl.createDiv({ cls: "pebble-range-switcher" });
    if (!availableRanges.includes(this.range)) {
      this.range = availableRanges[0];
      this.selectedDate = null;
      this.chartScrollLeft = 0;
      this.hasInitializedChartScroll = false;
    }

    for (const range of availableRanges) {
      const button = rangeEl.createEl("button", {
        text:
          range === "24h"
            ? "24時間"
            : range === "30d"
            ? "30日"
            : range === "7w"
              ? "7週"
              : range === "12m"
                ? "12か月"
                : "全期間",
      });
      if (this.range === range) {
        button.addClass("is-active");
      }
      button.addEventListener("click", async () => {
        this.range = range;
        this.chartScrollLeft = 0;
        this.hasInitializedChartScroll = false;
        await this.render();
      });
    }

    const records = selectedEventType
      ? this.plugin.store.listRecordsByEventType(selectedEventType.id)
      : [];
    const aggregatedCounts = aggregateCounts(records, this.range, this.granularity);

    if (!this.selectedDate && aggregatedCounts.length > 0) {
      this.selectedDate = aggregatedCounts[aggregatedCounts.length - 1].key;
    }
    if (
      this.selectedDate &&
      !aggregatedCounts.some((bucket) => bucket.key === this.selectedDate)
    ) {
      this.selectedDate = aggregatedCounts[aggregatedCounts.length - 1]?.key ?? null;
    }

    const maxCount =
      aggregatedCounts.reduce((max, item) => Math.max(max, item.count), 0) || 1;

    const chartEl = cardEl.createDiv({ cls: "pebble-chart" });
    chartEl.addEventListener("scroll", () => {
      this.chartScrollLeft = chartEl.scrollLeft;
    });
    if (aggregatedCounts.length === 0) {
      chartEl.createEl("p", {
        text: "対象期間の記録がありません。",
        cls: "pebble-empty-text",
      });
    } else {
      const pointGap = 44;
      const chartHeight = 132;
      const chartPadding = 24;
      const lineWidth = Math.max(
        aggregatedCounts.length * pointGap,
        chartEl.clientWidth || 0,
      );
      const svgWidth = lineWidth + chartPadding * 2;
      const svgHeight = chartHeight + chartPadding * 2;
      const linePoints = aggregatedCounts.map((item, index) => {
        const x = chartPadding + index * pointGap + pointGap / 2;
        const y =
          chartPadding + chartHeight - (item.count / maxCount) * chartHeight;
        return { ...item, x, y };
      });

      const canvasEl = chartEl.createDiv({ cls: "pebble-line-chart-canvas" });
      canvasEl.style.width = `${svgWidth}px`;

      const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svgEl.setAttribute("class", "pebble-line-chart-svg");
      svgEl.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);
      svgEl.setAttribute("width", String(svgWidth));
      svgEl.setAttribute("height", String(svgHeight));

      const areaPoints = [
        `${linePoints[0].x},${chartPadding + chartHeight}`,
        ...linePoints.map((point) => `${point.x},${point.y}`),
        `${linePoints[linePoints.length - 1].x},${chartPadding + chartHeight}`,
      ].join(" ");
      const polylinePoints = linePoints
        .map((point) => `${point.x},${point.y}`)
        .join(" ");

      const areaEl = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polygon",
      );
      areaEl.setAttribute("class", "pebble-line-chart-area");
      areaEl.setAttribute("points", areaPoints);
      svgEl.appendChild(areaEl);

      const lineEl = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polyline",
      );
      lineEl.setAttribute("class", "pebble-line-chart-line");
      lineEl.setAttribute("points", polylinePoints);
      svgEl.appendChild(lineEl);

      for (const point of linePoints) {
        const dotEl = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle",
        );
        dotEl.setAttribute("class", "pebble-line-chart-dot");
        if (point.key === this.selectedDate) {
          dotEl.classList.add("is-selected");
        }
        if (point.count === 0) {
          dotEl.classList.add("is-zero");
        }
        dotEl.setAttribute("cx", String(point.x));
        dotEl.setAttribute("cy", String(point.y));
        dotEl.setAttribute("r", "6");
        svgEl.appendChild(dotEl);
      }

      canvasEl.appendChild(svgEl);

      const markersEl = chartEl.createDiv({ cls: "pebble-line-chart-markers" });
      markersEl.style.width = `${svgWidth}px`;
      const labelsEl = chartEl.createDiv({ cls: "pebble-line-chart-labels" });
      labelsEl.style.width = `${svgWidth}px`;
      for (const [index, point] of linePoints.entries()) {
        const markerEl = markersEl.createDiv({ cls: "pebble-line-chart-marker" });
        if (point.key === this.selectedDate) {
          markerEl.addClass("is-selected");
        }
        markerEl.style.left = `${point.x}px`;
        markerEl.style.top = `${point.y}px`;
        markerEl.addEventListener("click", async () => {
          this.selectedDate = point.key;
          await this.render();
        });

        const countEl = markerEl.createSpan({
          text: String(point.count),
          cls: "pebble-chart-count",
        });
        if (point.count === 0) {
          countEl.addClass("is-zero");
        }

        const labelSlotEl = labelsEl.createDiv({ cls: "pebble-line-chart-label-slot" });
        labelSlotEl.style.left = `${point.x}px`;
        if (point.key === this.selectedDate) {
          labelSlotEl.addClass("is-selected");
        }

        const [primaryLabel, secondaryLabel] = getChartLabelParts(
          point.key,
          this.granularity,
          linePoints[index - 1]?.key ?? null,
        );
        labelSlotEl.createSpan({
          text: primaryLabel,
          cls: "pebble-chart-label-primary",
        });
        if (secondaryLabel) {
          labelSlotEl.createSpan({
            text: secondaryLabel,
            cls: "pebble-chart-label-secondary",
          });
        }
      }

      window.requestAnimationFrame(() => {
        if (this.hasInitializedChartScroll) {
          chartEl.scrollLeft = previousChartScrollLeft;
          return;
        }

        const targetKey = this.selectedDate ?? aggregatedCounts[aggregatedCounts.length - 1]?.key;
        const targetPoint = linePoints.find((point) => point.key === targetKey);
        const viewportWidth = chartEl.clientWidth;
        const targetScrollLeft = Math.max(
          0,
          (targetPoint?.x ?? svgWidth) - viewportWidth * 0.7,
        );
        chartEl.scrollLeft = targetScrollLeft;
        this.chartScrollLeft = targetScrollLeft;
        this.hasInitializedChartScroll = true;
      });
    }

    const tableEl = container.createDiv({ cls: "pebble-card" });
    tableEl.createEl("div", {
      text:
        this.granularity === "hour"
          ? "時間別一覧"
          : this.granularity === "day"
          ? "日別一覧"
          : this.granularity === "week"
            ? "週別一覧"
            : "月別一覧",
      cls: "pebble-section-title",
    });

    if (aggregatedCounts.length === 0) {
      tableEl.createEl("p", {
        text: "表示できる集計がありません。",
        cls: "pebble-empty-text",
      });
    } else {
      const listEl = tableEl.createDiv({ cls: "pebble-daily-list" });
      for (const item of [...aggregatedCounts].reverse()) {
        const rowEl = listEl.createDiv({ cls: "pebble-daily-row" });
        if (item.key === this.selectedDate) {
          rowEl.addClass("is-selected");
        }
        rowEl.addEventListener("click", async () => {
          this.selectedDate = item.key;
          await this.render();
        });
        rowEl.createSpan({ text: item.label });
        rowEl.createSpan({ text: `${item.count}回` });
      }
    }

    const detailEl = container.createDiv({ cls: "pebble-card" });
    detailEl.createEl("div", {
      text: this.selectedDate
        ? `${formatBucketLabel(this.selectedDate, this.granularity)} の記録`
        : "記録一覧",
      cls: "pebble-section-title",
    });

    const recordsForDay = records.filter(
      (record) => isRecordInBucket(record, this.selectedDate, this.granularity),
    );

    if (recordsForDay.length === 0) {
      detailEl.createEl("p", {
        text: this.granularity === "hour" ? "この時間帯の記録はありません。" : "この日の記録はありません。",
        cls: "pebble-empty-text",
      });
      return;
    }

    const detailListEl = detailEl.createDiv({ cls: "pebble-record-list" });
    for (const record of recordsForDay) {
      const rowEl = detailListEl.createDiv({ cls: "pebble-record-row" });
      rowEl.createSpan({
        text:
          this.granularity === "hour"
            ? `${formatDateLabel(record.timestamp)} ${formatTimeLabel(record.timestamp)}`
            : formatTimeLabel(record.timestamp),
        cls: "pebble-record-time",
      });
      rowEl.createSpan({
        text: record.memo || "メモなし",
        cls: "pebble-record-memo",
      });
    }
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
