(function (root, factory) {
  const exported = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }

  if (typeof root !== "undefined") {
    root.PebbleTrackerRenderer = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function emptyElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
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

  function appendElement(parent, tagName, options) {
    const element = createElement(tagName, options);
    parent.appendChild(element);
    return element;
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

    if (granularity === "day" || granularity === "week") {
      const date = getBucketStartFromKey(key, granularity);
      const previousDate = previousKey
        ? getBucketStartFromKey(previousKey, granularity)
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
      "14w": 98,
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

  function getAvailableRanges(granularity) {
    if (granularity === "hour") {
      return ["24h", "all"];
    }
    if (granularity === "week") {
      return ["14w", "all"];
    }
    if (granularity === "month") {
      return ["12m", "all"];
    }
    return ["30d", "all"];
  }

  function renderPebbleTrackerView(options) {
    const {
      container,
      data,
      selectedEventType,
      viewState,
      getRecentRecords,
      getRecords,
      onOpenEventPicker,
      onCreateFirstEvent,
      onRecord,
      onNotify,
      onRequestRender,
      requestAnimationFrame = window.requestAnimationFrame.bind(window),
    } = options;

    emptyElement(container);
    container.classList.add("pebble-root");

    const headerEl = appendElement(container, "div", { className: "pebble-header" });
    const titleBlockEl = appendElement(headerEl, "div");
    appendElement(titleBlockEl, "div", {
      text: "Pebble Tracker",
      className: "pebble-eyebrow",
    });
    appendElement(titleBlockEl, "h1", {
      text: selectedEventType?.name ?? "イベント未選択",
      className: "pebble-title",
    });

    const headerActionsEl = appendElement(headerEl, "div", {
      className: "pebble-header-actions",
    });
    const pickerButton = appendElement(headerActionsEl, "button", {
      text: "イベント切替",
    });
    pickerButton.addEventListener("click", () => {
      onOpenEventPicker();
    });

    const modeButton = appendElement(headerActionsEl, "button", {
      text: viewState.mode === "tracker" ? "集計" : "記録",
    });
    modeButton.addEventListener("click", () => {
      viewState.mode = viewState.mode === "tracker" ? "stats" : "tracker";
      void onRequestRender();
    });

    if (data.eventTypes.length === 0) {
      const emptyEl = appendElement(container, "div", {
        className: "pebble-empty-state",
      });
      appendElement(emptyEl, "p", {
        text: "まだイベントがありません。最初のイベントを追加してください。",
      });
      const addButton = appendElement(emptyEl, "button", {
        text: "最初のイベントを追加",
        className: "mod-cta",
      });
      addButton.addEventListener("click", () => {
        onCreateFirstEvent();
      });
      return;
    }

    if (viewState.mode === "tracker") {
      const cardEl = appendElement(container, "div", {
        className: "pebble-card pebble-tracker-card",
      });
      appendElement(cardEl, "div", {
        text: "すばやく記録",
        className: "pebble-section-title",
      });

      let memoInputEl = null;
      if (selectedEventType?.allowMemo) {
        const fieldEl = appendElement(cardEl, "div", { className: "pebble-field" });
        appendElement(fieldEl, "label", { text: "メモ" });
        memoInputEl = appendElement(fieldEl, "textarea", {
          className: "pebble-memo-input",
        });
        memoInputEl.placeholder = "必要ならメモを残す";
        memoInputEl.rows = 3;
      }

      const recordButton = appendElement(cardEl, "button", {
        text: `${selectedEventType?.name ?? "イベント"} を記録する`,
        className: "mod-cta pebble-record-button",
      });
      recordButton.addEventListener("click", async () => {
        if (!selectedEventType) {
          onNotify("イベントを選択してください");
          return;
        }

        await onRecord({
          eventTypeId: selectedEventType.id,
          memo: memoInputEl?.value ?? "",
        });

        if (memoInputEl) {
          memoInputEl.value = "";
        }

        viewState.selectedDate = getBucketKey(
          new Date().toISOString(),
          viewState.granularity,
        );
        onNotify(`${selectedEventType.name} を記録しました`);
        void onRequestRender();
      });

      const recentEl = appendElement(container, "div", {
        className: "pebble-card",
      });
      appendElement(recentEl, "div", {
        text: "直近の記録",
        className: "pebble-section-title",
      });

      const recentRecords = selectedEventType
        ? getRecentRecords(selectedEventType.id, 5)
        : [];

      if (recentRecords.length === 0) {
        appendElement(recentEl, "p", {
          text: "まだ記録がありません。",
          className: "pebble-empty-text",
        });
        return;
      }

      const listEl = appendElement(recentEl, "div", {
        className: "pebble-record-list",
      });
      for (const record of recentRecords) {
        const rowEl = appendElement(listEl, "div", {
          className: "pebble-record-row",
        });
        appendElement(rowEl, "span", {
          text: `${formatDateLabel(record.timestamp)} ${formatTimeLabel(record.timestamp)}`,
          className: "pebble-record-time",
        });
        appendElement(rowEl, "span", {
          text: record.memo || "メモなし",
          className: "pebble-record-memo",
        });
      }
      return;
    }

    const previousChartScrollLeft = viewState.chartScrollLeft;
    const statsCardEl = appendElement(container, "div", { className: "pebble-card" });
    appendElement(statsCardEl, "div", {
      text:
        viewState.granularity === "hour"
          ? "時間別集計"
          : viewState.granularity === "day"
            ? "日別集計"
            : viewState.granularity === "week"
              ? "週別集計"
              : "月別集計",
      className: "pebble-section-title",
    });

    const granularityEl = appendElement(statsCardEl, "div", {
      className: "pebble-range-switcher",
    });
    for (const granularity of ["hour", "day", "week", "month"]) {
      const button = appendElement(granularityEl, "button", {
        text:
          granularity === "hour"
            ? "時間別"
            : granularity === "day"
              ? "日別"
              : granularity === "week"
                ? "週別"
                : "月別",
      });
      if (viewState.granularity === granularity) {
        button.classList.add("is-active");
      }
      button.addEventListener("click", () => {
        viewState.granularity = granularity;
        viewState.selectedDate = null;
        viewState.chartScrollLeft = 0;
        viewState.hasInitializedChartScroll = false;
        void onRequestRender();
      });
    }

    const availableRanges = getAvailableRanges(viewState.granularity);
    const rangeEl = appendElement(statsCardEl, "div", {
      className: "pebble-range-switcher",
    });
    if (!availableRanges.includes(viewState.range)) {
      viewState.range = availableRanges[0];
      viewState.selectedDate = null;
      viewState.chartScrollLeft = 0;
      viewState.hasInitializedChartScroll = false;
    }

    for (const range of availableRanges) {
      const button = appendElement(rangeEl, "button", {
        text:
          range === "24h"
            ? "24時間"
            : range === "30d"
              ? "30日"
              : range === "14w"
                ? "14週"
                : range === "12m"
                  ? "12か月"
                  : "全期間",
      });
      if (viewState.range === range) {
        button.classList.add("is-active");
      }
      button.addEventListener("click", () => {
        viewState.range = range;
        viewState.chartScrollLeft = 0;
        viewState.hasInitializedChartScroll = false;
        void onRequestRender();
      });
    }

    const records = selectedEventType ? getRecords(selectedEventType.id) : [];
    const aggregatedCounts = aggregateCounts(
      records,
      viewState.range,
      viewState.granularity,
    );

    if (!viewState.selectedDate && aggregatedCounts.length > 0) {
      viewState.selectedDate = aggregatedCounts[aggregatedCounts.length - 1].key;
    }
    if (
      viewState.selectedDate &&
      !aggregatedCounts.some((bucket) => bucket.key === viewState.selectedDate)
    ) {
      viewState.selectedDate = aggregatedCounts[aggregatedCounts.length - 1]?.key ?? null;
    }

    const maxCount =
      aggregatedCounts.reduce((max, item) => Math.max(max, item.count), 0) || 1;

    const chartEl = appendElement(statsCardEl, "div", {
      className: "pebble-chart",
    });
    chartEl.addEventListener("scroll", () => {
      viewState.chartScrollLeft = chartEl.scrollLeft;
    });
    if (aggregatedCounts.length === 0) {
      appendElement(chartEl, "p", {
        text: "対象期間の記録がありません。",
        className: "pebble-empty-text",
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

      const canvasEl = appendElement(chartEl, "div", {
        className: "pebble-line-chart-canvas",
      });
      canvasEl.style.width = `${svgWidth}px`;

      const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svgEl.setAttribute("class", "pebble-line-chart-svg");
      svgEl.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);
      svgEl.setAttribute("width", String(svgWidth));
      svgEl.setAttribute("height", String(svgHeight));

      const areaEl = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      areaEl.setAttribute("class", "pebble-line-chart-area");
      areaEl.setAttribute(
        "points",
        [
          `${linePoints[0].x},${chartPadding + chartHeight}`,
          ...linePoints.map((point) => `${point.x},${point.y}`),
          `${linePoints[linePoints.length - 1].x},${chartPadding + chartHeight}`,
        ].join(" "),
      );
      svgEl.appendChild(areaEl);

      const lineEl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      lineEl.setAttribute("class", "pebble-line-chart-line");
      lineEl.setAttribute(
        "points",
        linePoints.map((point) => `${point.x},${point.y}`).join(" "),
      );
      svgEl.appendChild(lineEl);

      for (const point of linePoints) {
        const dotEl = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dotEl.setAttribute("class", "pebble-line-chart-dot");
        if (point.key === viewState.selectedDate) {
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

      const markersEl = appendElement(chartEl, "div", {
        className: "pebble-line-chart-markers",
      });
      markersEl.style.width = `${svgWidth}px`;
      const labelsEl = appendElement(chartEl, "div", {
        className: "pebble-line-chart-labels",
      });
      labelsEl.style.width = `${svgWidth}px`;
      for (const [index, point] of linePoints.entries()) {
        const markerEl = appendElement(markersEl, "div", {
          className: "pebble-line-chart-marker",
        });
        if (point.key === viewState.selectedDate) {
          markerEl.classList.add("is-selected");
        }
        markerEl.style.left = `${point.x}px`;
        markerEl.style.top = `${point.y}px`;
        markerEl.addEventListener("click", () => {
          viewState.selectedDate = point.key;
          void onRequestRender();
        });

        const countEl = appendElement(markerEl, "span", {
          text: String(point.count),
          className: "pebble-chart-count",
        });
        if (point.count === 0) {
          countEl.classList.add("is-zero");
        }

        const labelSlotEl = appendElement(labelsEl, "div", {
          className: "pebble-line-chart-label-slot",
        });
        labelSlotEl.style.left = `${point.x}px`;
        if (point.key === viewState.selectedDate) {
          labelSlotEl.classList.add("is-selected");
        }

        const [primaryLabel, secondaryLabel] = getChartLabelParts(
          point.key,
          viewState.granularity,
          linePoints[index - 1]?.key ?? null,
        );
        appendElement(labelSlotEl, "span", {
          text: primaryLabel,
          className: "pebble-chart-label-primary",
        });
        if (secondaryLabel) {
          appendElement(labelSlotEl, "span", {
            text: secondaryLabel,
            className: "pebble-chart-label-secondary",
          });
        }
      }

      requestAnimationFrame(() => {
        if (viewState.hasInitializedChartScroll) {
          chartEl.scrollLeft = previousChartScrollLeft;
          return;
        }

        const targetKey =
          viewState.selectedDate ?? aggregatedCounts[aggregatedCounts.length - 1]?.key;
        const targetPoint = linePoints.find((point) => point.key === targetKey);
        const viewportWidth = chartEl.clientWidth;
        const targetScrollLeft = Math.max(
          0,
          (targetPoint?.x ?? svgWidth) - viewportWidth * 0.7,
        );
        chartEl.scrollLeft = targetScrollLeft;
        viewState.chartScrollLeft = targetScrollLeft;
        viewState.hasInitializedChartScroll = true;
      });
    }

    const tableEl = appendElement(container, "div", { className: "pebble-card" });
    appendElement(tableEl, "div", {
      text:
        viewState.granularity === "hour"
          ? "時間別一覧"
          : viewState.granularity === "day"
            ? "日別一覧"
            : viewState.granularity === "week"
              ? "週別一覧"
              : "月別一覧",
      className: "pebble-section-title",
    });

    if (aggregatedCounts.length === 0) {
      appendElement(tableEl, "p", {
        text: "表示できる集計がありません。",
        className: "pebble-empty-text",
      });
    } else {
      const listEl = appendElement(tableEl, "div", {
        className: "pebble-daily-list",
      });
      for (const item of [...aggregatedCounts].reverse()) {
        const rowEl = appendElement(listEl, "div", {
          className: "pebble-daily-row",
        });
        if (item.key === viewState.selectedDate) {
          rowEl.classList.add("is-selected");
        }
        rowEl.addEventListener("click", () => {
          viewState.selectedDate = item.key;
          void onRequestRender();
        });
        appendElement(rowEl, "span", { text: item.label });
        appendElement(rowEl, "span", { text: `${item.count}回` });
      }
    }

    const detailEl = appendElement(container, "div", { className: "pebble-card" });
    appendElement(detailEl, "div", {
      text: viewState.selectedDate
        ? `${formatBucketLabel(viewState.selectedDate, viewState.granularity)} の記録`
        : "記録一覧",
      className: "pebble-section-title",
    });

    const recordsForDay = records.filter((record) =>
      isRecordInBucket(record, viewState.selectedDate, viewState.granularity),
    );

    if (recordsForDay.length === 0) {
      appendElement(detailEl, "p", {
        text:
          viewState.granularity === "hour"
            ? "この時間帯の記録はありません。"
            : "この日の記録はありません。",
        className: "pebble-empty-text",
      });
      return;
    }

    const detailListEl = appendElement(detailEl, "div", {
      className: "pebble-record-list",
    });
    for (const record of recordsForDay) {
      const rowEl = appendElement(detailListEl, "div", {
        className: "pebble-record-row",
      });
      appendElement(rowEl, "span", {
        text:
          viewState.granularity === "hour"
            ? `${formatDateLabel(record.timestamp)} ${formatTimeLabel(record.timestamp)}`
            : formatTimeLabel(record.timestamp),
        className: "pebble-record-time",
      });
      appendElement(rowEl, "span", {
        text: record.memo || "メモなし",
        className: "pebble-record-memo",
      });
    }
  }

  return {
    aggregateCounts,
    formatBucketLabel,
    getAvailableRanges,
    getBucketKey,
    renderPebbleTrackerView,
  };
});
