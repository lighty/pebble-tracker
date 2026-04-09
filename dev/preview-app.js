(function () {
  const STORAGE_KEY = "pebble-tracker-preview-state";
  const { renderPebbleTrackerView } = window.PebbleTrackerRenderer;

  const PRESETS = {
    sample: {
      name: "サンプル",
      data: {
        eventTypes: [
          {
            id: "event-toilet",
            name: "トイレ",
            icon: "circle",
            color: "#c46f30",
            allowMemo: false,
            createdAt: "2026-04-01T09:00:00.000Z",
          },
          {
            id: "event-water",
            name: "水分補給",
            icon: "circle",
            color: "#3f83b5",
            allowMemo: true,
            createdAt: "2026-04-02T09:00:00.000Z",
          },
        ],
        selectedEventTypeId: "event-water",
        records: [],
      },
    },
    empty: {
      name: "空の状態",
      data: {
        eventTypes: [],
        selectedEventTypeId: null,
        records: [],
      },
    },
  };

  function createSampleRecords() {
    const records = [];
    const now = new Date();

    for (let index = 0; index < 32; index += 1) {
      const timestamp = new Date(now);
      timestamp.setHours(now.getHours() - index * 6);
      records.push({
        id: `record-water-${index}`,
        eventTypeId: "event-water",
        timestamp: timestamp.toISOString(),
        memo: index % 3 === 0 ? "コップ1杯" : "",
      });
    }

    for (let index = 0; index < 18; index += 1) {
      const timestamp = new Date(now);
      timestamp.setHours(now.getHours() - index * 9);
      records.push({
        id: `record-toilet-${index}`,
        eventTypeId: "event-toilet",
        timestamp: timestamp.toISOString(),
        memo: "",
      });
    }

    return records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  PRESETS.sample.data.records = createSampleRecords();

  function cloneData(data) {
    return {
      eventTypes: [...(data.eventTypes || [])],
      records: [...(data.records || [])],
      selectedEventTypeId: data.selectedEventTypeId || null,
    };
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function loadState() {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return cloneData(PRESETS.sample.data);
    }

    try {
      return cloneData(JSON.parse(saved));
    } catch (error) {
      console.error("Failed to parse preview state", error);
      return cloneData(PRESETS.sample.data);
    }
  }

  function saveState() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }

  function getSelectedEventType() {
    return (
      state.data.eventTypes.find(
        (eventType) => eventType.id === state.data.selectedEventTypeId,
      ) || null
    );
  }

  function listRecordsByEventType(eventTypeId) {
    return state.data.records
      .filter((record) => record.eventTypeId === eventTypeId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  function listRecentRecords(eventTypeId, limit) {
    return listRecordsByEventType(eventTypeId).slice(0, limit);
  }

  function ensureSelectedEventType() {
    const exists = state.data.eventTypes.some(
      (eventType) => eventType.id === state.data.selectedEventTypeId,
    );
    if (!exists) {
      state.data.selectedEventTypeId = state.data.eventTypes[0]?.id ?? null;
    }
  }

  function setFeedback(message, type = "") {
    state.feedback = message;
    state.feedbackType = type;
  }

  function applyPreset(presetKey) {
    state.data = cloneData(PRESETS[presetKey].data);
    state.mode = "tracker";
    state.range = "30d";
    state.granularity = "day";
    state.selectedDate = null;
    state.chartScrollLeft = 0;
    state.hasInitializedChartScroll = false;
    saveState();
    setFeedback(`プリセット「${PRESETS[presetKey].name}」を読み込みました。`, "success");
    render();
  }

  function createEventType() {
    const name = state.draftEvent.name.trim();
    if (!name) {
      setFeedback("イベント名を入力してください。", "error");
      render();
      return;
    }

    const eventType = {
      id: createId("event"),
      name,
      icon: "circle",
      color: state.draftEvent.color,
      allowMemo: Boolean(state.draftEvent.allowMemo),
      createdAt: new Date().toISOString(),
    };

    state.data.eventTypes.push(eventType);
    state.data.selectedEventTypeId = eventType.id;
    state.draftEvent.name = "";
    saveState();
    setFeedback(`イベント「${eventType.name}」を追加しました。`, "success");
    render();
  }

  function deleteEventType(id) {
    const target = state.data.eventTypes.find((eventType) => eventType.id === id);
    if (!target) {
      return;
    }

    state.data.eventTypes = state.data.eventTypes.filter(
      (eventType) => eventType.id !== id,
    );
    state.data.records = state.data.records.filter(
      (record) => record.eventTypeId !== id,
    );
    ensureSelectedEventType();
    saveState();
    setFeedback(`イベント「${target.name}」を削除しました。`, "success");
    render();
  }

  function createElement(tagName, options = {}) {
    const element = document.createElement(tagName);

    if (options.className) {
      element.className = options.className;
    }

    if (options.text !== undefined) {
      element.textContent = options.text;
    }

    return element;
  }

  const state = {
    data: loadState(),
    mode: "tracker",
    range: "30d",
    granularity: "day",
    selectedDate: null,
    chartScrollLeft: 0,
    hasInitializedChartScroll: false,
    feedback: "",
    feedbackType: "",
    viewportWidth: "mobile",
    theme: "light",
    draftEvent: {
      name: "",
      color: "#c46f30",
      allowMemo: true,
    },
  };

  function renderControlPanel(parent) {
    const panel = createElement("aside", { className: "preview-panel" });

    const previewCard = createElement("section", { className: "preview-card" });
    previewCard.appendChild(
      createElement("div", { className: "preview-label", text: "Preview" }),
    );
    previewCard.appendChild(createElement("h2", { text: "開発プレビュー" }));
    previewCard.appendChild(
      createElement("p", {
        className: "preview-note",
        text: "左で状態を変えつつ、右で main.js と共有している描画コードを確認できます。",
      }),
    );

    const themeField = createElement("div", { className: "preview-field" });
    themeField.appendChild(createElement("label", { text: "テーマ" }));
    const themeSelect = createElement("select");
    for (const option of [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ]) {
      const element = createElement("option", { text: option.label });
      element.value = option.value;
      element.selected = state.theme === option.value;
      themeSelect.appendChild(element);
    }
    themeSelect.addEventListener("change", (event) => {
      state.theme = event.target.value;
      render();
    });
    themeField.appendChild(themeSelect);
    previewCard.appendChild(themeField);

    const widthField = createElement("div", { className: "preview-field" });
    widthField.appendChild(createElement("label", { text: "表示幅" }));
    const widthSelect = createElement("select");
    for (const option of [
      { value: "mobile", label: "Mobile" },
      { value: "desktop", label: "Desktop" },
    ]) {
      const element = createElement("option", { text: option.label });
      element.value = option.value;
      element.selected = state.viewportWidth === option.value;
      widthSelect.appendChild(element);
    }
    widthSelect.addEventListener("change", (event) => {
      state.viewportWidth = event.target.value;
      render();
    });
    widthField.appendChild(widthSelect);
    previewCard.appendChild(widthField);

    const presetField = createElement("div", { className: "preview-field" });
    presetField.appendChild(createElement("label", { text: "プリセット" }));
    const presetActions = createElement("div", { className: "preview-actions" });
    for (const presetKey of Object.keys(PRESETS)) {
      const button = createElement("button", { text: PRESETS[presetKey].name });
      button.addEventListener("click", () => applyPreset(presetKey));
      presetActions.appendChild(button);
    }
    presetField.appendChild(presetActions);
    previewCard.appendChild(presetField);

    previewCard.appendChild(
      createElement("div", {
        className: `preview-feedback${state.feedbackType ? ` is-${state.feedbackType}` : ""}`,
        text: state.feedback,
      }),
    );
    panel.appendChild(previewCard);

    const eventCard = createElement("section", { className: "preview-card" });
    eventCard.appendChild(
      createElement("div", { className: "preview-label", text: "Data" }),
    );
    eventCard.appendChild(createElement("h3", { text: "イベント管理" }));

    const list = createElement("div", { className: "preview-event-list" });
    if (state.data.eventTypes.length === 0) {
      list.appendChild(
        createElement("div", {
          className: "preview-empty",
          text: "イベントがありません。",
        }),
      );
    } else {
      for (const eventType of state.data.eventTypes) {
        const item = createElement("div", { className: "preview-event-item" });
        const name = createElement("div", { className: "preview-event-name" });
        const swatch = createElement("span", { className: "preview-event-swatch" });
        swatch.style.setProperty("--event-color", eventType.color);
        name.appendChild(swatch);

        const textBlock = createElement("div");
        textBlock.appendChild(createElement("div", { text: eventType.name }));
        textBlock.appendChild(
          createElement("div", {
            className: "preview-event-meta",
            text: eventType.allowMemo ? "メモあり" : "メモなし",
          }),
        );
        name.appendChild(textBlock);
        item.appendChild(name);

        const actions = createElement("div", { className: "preview-actions" });
        const selectButton = createElement("button", { text: "選択" });
        selectButton.addEventListener("click", () => {
          state.data.selectedEventTypeId = eventType.id;
          saveState();
          render();
        });
        actions.appendChild(selectButton);

        const deleteButton = createElement("button", {
          text: "削除",
          className: "mod-warning",
        });
        deleteButton.addEventListener("click", () => deleteEventType(eventType.id));
        actions.appendChild(deleteButton);
        item.appendChild(actions);
        list.appendChild(item);
      }
    }
    eventCard.appendChild(list);

    const nameField = createElement("div", { className: "preview-field" });
    nameField.appendChild(createElement("label", { text: "新しいイベント名" }));
    const nameInput = createElement("input");
    nameInput.value = state.draftEvent.name;
    nameInput.placeholder = "例: 服薬";
    nameInput.addEventListener("input", (event) => {
      state.draftEvent.name = event.target.value;
    });
    nameField.appendChild(nameInput);
    eventCard.appendChild(nameField);

    const options = createElement("div", { className: "preview-inline-actions" });
    const colorInput = createElement("input");
    colorInput.type = "color";
    colorInput.value = state.draftEvent.color;
    colorInput.addEventListener("input", (event) => {
      state.draftEvent.color = event.target.value;
    });
    options.appendChild(colorInput);

    const memoButton = createElement("button", {
      text: state.draftEvent.allowMemo ? "メモあり" : "メモなし",
    });
    memoButton.addEventListener("click", () => {
      state.draftEvent.allowMemo = !state.draftEvent.allowMemo;
      render();
    });
    options.appendChild(memoButton);
    eventCard.appendChild(options);

    const createButton = createElement("button", {
      text: "イベントを追加",
      className: "mod-cta",
    });
    createButton.addEventListener("click", createEventType);
    eventCard.appendChild(createButton);
    panel.appendChild(eventCard);

    parent.appendChild(panel);
  }

  function renderPreviewStage(parent) {
    const stage = createElement("section", { className: "preview-stage" });
    const device = createElement("div", { className: "preview-device" });
    device.dataset.width = state.viewportWidth;
    const screen = createElement("div", { className: "preview-screen" });
    screen.dataset.width = state.viewportWidth;

    const toolbar = createElement("div", { className: "preview-toolbar" });
    toolbar.appendChild(
      createElement("div", {
        className: "preview-toolbar-title",
        text: "Obsidian preview shell",
      }),
    );
    toolbar.appendChild(
      createElement("div", {
        className: "preview-toolbar-status",
        text: "Shared renderer",
      }),
    );
    screen.appendChild(toolbar);

    const app = createElement("main", { className: "preview-app" });
    ensureSelectedEventType();

    renderPebbleTrackerView({
      container: app,
      data: state.data,
      selectedEventType: getSelectedEventType(),
      viewState: state,
      getRecentRecords: listRecentRecords,
      getRecords: listRecordsByEventType,
      onOpenEventPicker: () => {
        if (state.data.eventTypes.length <= 1) {
          setFeedback("切り替え先のイベントがありません。左側で追加してください。", "error");
          render();
          return;
        }

        const currentIndex = state.data.eventTypes.findIndex(
          (eventType) => eventType.id === state.data.selectedEventTypeId,
        );
        const nextEvent =
          state.data.eventTypes[(currentIndex + 1) % state.data.eventTypes.length];
        state.data.selectedEventTypeId = nextEvent.id;
        saveState();
        setFeedback(`イベントを「${nextEvent.name}」へ切り替えました。`, "success");
        render();
      },
      onCreateFirstEvent: () => {
        applyPreset("sample");
      },
      onRecord: async (payload) => {
        state.data.records.push({
          id: createId("record"),
          eventTypeId: payload.eventTypeId,
          timestamp: new Date().toISOString(),
          memo: payload.memo?.trim() || "",
        });
        saveState();
      },
      onNotify: (message) => {
        setFeedback(message, "success");
      },
      onRequestRender: async () => {
        render();
      },
    });

    screen.appendChild(app);
    device.appendChild(screen);
    stage.appendChild(device);
    parent.appendChild(stage);
  }

  function render() {
    document.body.dataset.theme = state.theme;
    const root = document.getElementById("app");
    root.innerHTML = "";

    const shell = createElement("div", { className: "preview-shell" });
    const layout = createElement("div", { className: "preview-layout" });
    renderControlPanel(layout);
    renderPreviewStage(layout);
    shell.appendChild(layout);
    root.appendChild(shell);
  }

  function setupLiveReload() {
    const source = new EventSource("/__events");
    source.onmessage = () => {
      window.location.reload();
    };
  }

  setupLiveReload();
  render();
})();
