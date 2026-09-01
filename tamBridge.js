(function () {
  const BRIDGE_SOURCE = "windchill-powertools-tam-bridge";
  const BRIDGE_TARGET = "windchill-powertools-content";

  const bridgeState = {
    runId: 0,
    cache: Object.create(null),
    detailFetchCache: Object.create(null)
  };

  const ACTIVATION_TIMEOUT_MS = 5000;
  const ACTIVATION_POLL_MS = 150;
  const MAX_EXCERPTS_PER_NODE = 6;

  // Only one node can be "active" in the shared detail panel at a time, so every
  // activate-then-read step is funneled through this lock. Deep Crawl processes
  // several tree branches concurrently for loading, but detail-panel reads must
  // stay serialized or they corrupt each other mid-read.
  let activationLock = Promise.resolve();
  function withActivationLock(task) {
    const run = activationLock.then(task, task);
    activationLock = run.then(() => {}, () => {});
    return run;
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window) {
      return;
    }

    const message = event.data;
    if (!message || message.source !== BRIDGE_TARGET) {
      return;
    }

    const { command, payload } = message;
    if (command === "search") {
      await handleSearch(payload || {});
      return;
    }

    if (command === "cancel") {
      bridgeState.runId = Math.max(bridgeState.runId, Number(payload?.runId) || 0);
      return;
    }

    if (command === "jump") {
      await handleJump(payload || {});
      return;
    }

    if (command === "export-report") {
      await handleExportReport();
      return;
    }

    if (command === "export-data-model") {
      await handleExportDataModel(payload || {});
    }
  });

  async function handleSearch(payload) {
    const query = String(payload.query || "").trim();
    const mode = String(payload.mode || "loaded");
    const runId = Number(payload.runId) || Date.now();
    bridgeState.runId = runId;

    const treeContext = getTreeContext();
    if (!treeContext) {
      post("tam-search-error", {
        runId,
        query,
        mode,
        scope: "Unavailable",
        message: "Could not find the Type and Attribute Manager ExtJS tree on this page."
      });
      return;
    }

    // Reading each type's attributes means selecting it, which silently moves
    // the real UI's selection as a side effect. Restore whatever the user had
    // selected before the search started so their screen looks unchanged and
    // an Export Report click right after a search doesn't export the wrong type.
    const originalNode = getCurrentSelectedNode(treeContext);

    try {
      post("tam-search-progress", {
        available: true,
        query,
        mode,
        results: [],
        count: 0,
        scope: mode === "deep" ? "Loaded + lazy branches" : "Loaded tree nodes",
        progress: mode === "deep" ? "Starting deep crawl..." : "Searching loaded nodes..."
      });

      const results = mode === "deep"
        ? await deepSearch(treeContext, query, runId)
        : await searchLoaded(treeContext, query, runId);

      if (runId !== bridgeState.runId) {
        return;
      }

      post("tam-search-results", {
        runId,
        available: true,
        query,
        mode,
        results: results.slice(0, 25),
        count: results.length,
        scope: mode === "deep" ? "Loaded + crawled lazy branches" : "Loaded tree nodes",
        progress: mode === "deep" ? "Deep crawl complete" : "Loaded-node search complete",
        emptyMessage: results.length ? "" : "No Type and Attribute Manager matches were found."
      });
    } catch (error) {
      if (runId !== bridgeState.runId) {
        return;
      }
      post("tam-search-error", {
        runId,
        query,
        mode,
        scope: mode === "deep" ? "Loaded + lazy branches" : "Loaded tree nodes",
        message: String(error?.message || error)
      });
    } finally {
      if (runId === bridgeState.runId && originalNode) {
        await withActivationLock(() => activateNode(originalNode)).catch(() => {});
      }
    }
  }

  async function handleJump(payload) {
    const nodeId = payload.nodeId;
    const treeContext = getTreeContext();
    if (!treeContext || !nodeId) {
      post("tam-jump-result", {
        ok: false,
        message: "Could not find that Type and Attribute Manager tree node."
      });
      return;
    }

    const node = findNodeById(treeContext.root, nodeId);
    if (!node) {
      post("tam-jump-result", {
        ok: false,
        message: "Could not find that Type and Attribute Manager node in the tree."
      });
      return;
    }

    await expandAncestors(node);
    await ensureNodeLoaded(node);
    node.select?.();

    const el = node.ui?.getEl?.();
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    } else if (treeContext.ext?.fly && el) {
      treeContext.ext.fly(el).scrollIntoView();
    }
    if (el) {
      flash(el);
    }

    post("tam-jump-result", { ok: true, nodeId });
  }

  async function handleExportReport() {
    const treeContext = getTreeContext();
    if (!treeContext) {
      post("tam-export-error", {
        message: "Could not find the Type and Attribute Manager ExtJS tree on this page."
      });
      return;
    }

    const node = getCurrentSelectedNode(treeContext);
    if (!node) {
      post("tam-export-error", {
        message: "Select a type in the Type and Attribute Manager first, then export again."
      });
      return;
    }

    await expandAncestors(node);
    await ensureNodeLoaded(node);

    const previousSignature = detailPanelSignature();
    const activated = await withActivationLock(() => activateNode(node));
    if (!activated) {
      post("tam-export-error", {
        message: "Could not activate the selected type before export."
      });
      return;
    }

    await waitForDetailPanelUpdate(previousSignature);
    const details = extractTypeMetadata();
    const grid = extractAttributeGrid();
    const fileName = buildExportFileName(getNodeLabel(node));
    const html = buildExcelHtmlReport({
      title: getNodeLabel(node),
      nodeId: node.id || "",
      details,
      grid
    });

    post("tam-export-report", {
      fileName,
      html
    });
  }

  // Full-tree data model export: visits every type in the tree, reads each
  // one's metadata and complete attribute grid (via the same serialized
  // activation pipeline the search uses, so the per-node cache is shared —
  // types already visited by a search export instantly), and builds a single
  // workbook. Honors the same runId cancellation as search.
  async function handleExportDataModel(payload) {
    const mode = String(payload.mode || "deep");
    const runId = Number(payload.runId) || Date.now();
    bridgeState.runId = runId;

    const treeContext = getTreeContext();
    if (!treeContext) {
      post("tam-export-error", {
        message: "Could not find the Type and Attribute Manager ExtJS tree on this page."
      });
      return;
    }

    const originalNode = getCurrentSelectedNode(treeContext);

    try {
      post("tam-datamodel-progress", {
        runId,
        phase: "discover",
        processed: 0,
        total: 0,
        message: mode === "deep"
          ? "Discovering all types (expanding lazy branches)..."
          : "Collecting loaded types..."
      });

      const collected = await collectAllTypeNodes(treeContext, mode, runId);
      if (runId !== bridgeState.runId) {
        post("tam-export-error", { message: "Data model export cancelled." });
        return;
      }

      const entries = [];
      for (let index = 0; index < collected.length; index += 1) {
        if (runId !== bridgeState.runId) {
          post("tam-export-error", { message: "Data model export cancelled." });
          return;
        }
        const { node, path } = collected[index];
        const details = await fetchNodeDetails(node);
        entries.push({
          label: getNodeLabel(node),
          path: path.join(" > "),
          nodeId: node.id || "",
          metadata: details.metadata || {},
          grid: details.grid || { headers: [], rows: [] }
        });
        post("tam-datamodel-progress", {
          runId,
          phase: "read",
          processed: index + 1,
          total: collected.length,
          message: `Reading type ${index + 1} / ${collected.length}: ${getNodeLabel(node)}`
        });
      }

      const attributeCount = entries.reduce((sum, entry) => sum + (entry.grid.rows || []).length, 0);
      post("tam-export-report", {
        fileName: buildDataModelFileName(),
        html: buildDataModelWorkbook(entries, attributeCount),
        summary: `Data model export complete: ${entries.length} types, ${attributeCount} attribute rows.`
      });
    } catch (error) {
      if (runId === bridgeState.runId) {
        post("tam-export-error", { message: String(error?.message || error) });
      }
    } finally {
      if (runId === bridgeState.runId && originalNode) {
        await withActivationLock(() => activateNode(originalNode)).catch(() => {});
      }
    }
  }

  async function collectAllTypeNodes(treeContext, mode, runId) {
    const collected = [];
    const seen = Object.create(null);
    const add = (node, path) => {
      const key = node.id || `${path.join(">")}|${getNodeLabel(node)}`;
      if (seen[key]) {
        return;
      }
      seen[key] = true;
      collected.push({ node, path });
    };

    if (mode !== "deep") {
      walkLoaded(treeContext.root, [], add);
      return collected;
    }

    const queue = Array.from(treeContext.root.childNodes || []).map((node) => ({ node, path: [] }));
    while (queue.length) {
      if (runId !== bridgeState.runId) {
        return collected;
      }
      const { node, path } = queue.shift();
      await ensureNodeLoaded(node);
      traverse(node, path, add, queue);
      if (collected.length % 20 === 0) {
        post("tam-datamodel-progress", {
          runId,
          phase: "discover",
          processed: 0,
          total: 0,
          message: `Discovered ${collected.length} types so far...`
        });
      }
    }
    return collected;
  }

  function buildDataModelFileName() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    return `windchill_data_model_${stamp}.xls`;
  }

  function buildDataModelWorkbook(entries, attributeCount) {
    const summaryLabels = ["Display Name", "Internal Name", "Description", "Instantiable", "Subtypeable"];

    // Attribute grids can have slightly different columns per type, so the flat
    // attribute table uses the union of all seen headers (first-seen order) and
    // maps each row's cells by its own grid's headers into those columns.
    const attributeHeaders = [];
    entries.forEach((entry) => {
      (entry.grid.headers || []).forEach((header) => {
        if (header && !attributeHeaders.includes(header)) {
          attributeHeaders.push(header);
        }
      });
    });

    const summaryRows = entries.map((entry) => {
      const cells = [
        entry.path || entry.label,
        ...summaryLabels.map((label) => entry.metadata[label] || ""),
        String((entry.grid.rows || []).length)
      ];
      return `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`;
    }).join("");

    const attributeRows = entries.map((entry) => {
      const headers = entry.grid.headers || [];
      return (entry.grid.rows || []).map((row) => {
        const byHeader = {};
        headers.forEach((header, index) => {
          byHeader[header] = row[index] || "";
        });
        const cells = [entry.path || entry.label, ...attributeHeaders.map((header) => byHeader[header] || "")];
        return `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`;
      }).join("");
    }).join("");

    const generatedAt = new Date().toLocaleString();

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; }
    h1, h2 { margin: 12px 0 8px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
    th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #ddebf7; }
    .footer { color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Windchill Data Model Report</h1>
  <p><strong>Generated:</strong> ${escapeHtml(generatedAt)} | <strong>Types:</strong> ${entries.length} | <strong>Attribute rows:</strong> ${attributeCount}</p>
  <h2>Type Summary</h2>
  <table>
    <thead><tr><th>Type Path</th>${summaryLabels.map((label) => `<th>${escapeHtml(label)}</th>`).join("")}<th>Attributes</th></tr></thead>
    <tbody>${summaryRows}</tbody>
  </table>
  <h2>All Attributes</h2>
  <table>
    <thead><tr><th>Type Path</th>${attributeHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${attributeRows}</tbody>
  </table>
  <p class="footer">Generated by Windchill PowerTools</p>
</body>
</html>`;
  }

  function getTreeContext() {
    const ext = window.Ext;
    if (!ext?.getCmp) {
      return null;
    }
    const tree = ext.getCmp("typeMgmntNavigation");
    const root = tree?.getRootNode?.();
    if (!tree || !root) {
      return null;
    }
    return { ext, tree, root };
  }

  function getCurrentSelectedNode(treeContext) {
    const selectionModel = treeContext.tree?.getSelectionModel?.();
    return selectionModel?.getSelectedNode?.() || selectionModel?.selNode || null;
  }

  async function searchLoaded(treeContext, query, runId) {
    const needle = query.toLowerCase();
    const nodes = [];
    walkLoaded(treeContext.root, [], (node, path) => {
      nodes.push({ node, path });
    });

    const results = [];
    const idCounter = { value: 1 };
    for (let index = 0; index < nodes.length; index += 1) {
      if (runId !== bridgeState.runId) {
        return [];
      }
      const { node, path } = nodes[index];
      const matches = await buildNodeMatches(node, path, needle, idCounter);
      results.push(...matches);
      post("tam-search-progress", {
        runId,
        available: true,
        query,
        mode: "loaded",
        results: results.slice(0, 25),
        count: results.length,
        scope: "Loaded tree nodes + loaded type details",
        progress: `Scanning ${index + 1} / ${nodes.length} loaded nodes...`
      });
    }

    return dedupe(results);
  }

  async function deepSearch(treeContext, query, runId) {
    const needle = query.toLowerCase();
    const results = [];
    const idCounter = { value: 1 };
    const queue = Array.from(treeContext.root.childNodes || []).map((node) => ({ node, path: [] }));
    let processed = 0;

    while (queue.length) {
      if (runId !== bridgeState.runId) {
        return [];
      }

      const batch = queue.splice(0, 5);
      await Promise.all(batch.map(async ({ node, path }) => {
        await ensureNodeLoaded(node);
        processed += 1;
        const localNodes = [];
        traverse(node, path, (currentNode, currentPath) => {
          localNodes.push({ node: currentNode, path: currentPath });
        }, queue);
        for (const entry of localNodes) {
          if (runId !== bridgeState.runId) {
            return;
          }
          const matches = await buildNodeMatches(entry.node, entry.path, needle, idCounter);
          results.push(...matches);
        }
      }));

      post("tam-search-progress", {
        runId,
        available: true,
        query,
        mode: "deep",
        results: results.slice(0, 25),
        count: results.length,
        scope: "Loaded + crawled lazy branches + type details",
        progress: `Scanning ${processed} branches...`
      });
    }

    return dedupe(results);
  }

  function walkLoaded(node, path, callback) {
    if (!node) {
      return;
    }
    const nextPath = node.parentNode ? [...path, getNodeLabel(node)] : path;
    if (node.parentNode) {
      callback(node, nextPath);
    }
    Array.from(node.childNodes || []).forEach((child) => {
      if (child.loaded !== false || (child.childNodes || []).length) {
        walkLoaded(child, nextPath, callback);
      }
    });
  }

  function traverse(node, path, callback, queue) {
    const nextPath = [...path, getNodeLabel(node)];
    callback(node, nextPath);
    Array.from(node.childNodes || []).forEach((child) => {
      if (child.loaded === false && child.isExpandable?.()) {
        queue.push({ node: child, path: nextPath });
      } else {
        traverse(child, nextPath, callback, queue);
      }
    });
  }

  function matchesNode(node, needle) {
    return `${getNodeLabel(node)} ${node.id || ""}`.toLowerCase().includes(needle);
  }

  // Powers "which types have attribute X" reverse lookups: walking every type
  // in the tree and, for each, matching directly against its attribute grid
  // rows (Name / Internal Name / Filterable / ...) rather than a flattened
  // text blob, so results read as clean per-attribute hits instead of raw
  // excerpts and don't miss a match just because it landed in an unrelated
  // column's text.
  async function buildNodeMatches(node, path, needle, idCounter) {
    const results = [];
    const pathText = path.join(" > ");
    if (matchesNode(node, needle)) {
      results.push({
        id: `tam-tree-${idCounter.value++}`,
        nodeId: node.id,
        text: `[Type] ${pathText}`
      });
    }

    const grid = await getNodeAttributeGrid(node);
    const attributeMatches = matchAttributeRows(grid, needle, MAX_EXCERPTS_PER_NODE);
    attributeMatches.forEach((match) => {
      results.push({
        id: `tam-tree-${idCounter.value++}`,
        nodeId: node.id,
        text: `[Attribute] ${pathText} | ${match}`
      });
    });

    const remaining = MAX_EXCERPTS_PER_NODE - attributeMatches.length;
    if (remaining > 0) {
      const metadataText = await getNodeMetadataText(node);
      extractExcerpts(metadataText, needle, remaining).forEach((excerpt) => {
        results.push({
          id: `tam-tree-${idCounter.value++}`,
          nodeId: node.id,
          text: `[Type Detail] ${pathText} | ${excerpt}`
        });
      });
    }

    return results;
  }

  function matchAttributeRows(grid, needle, limit) {
    const headers = Array.isArray(grid?.headers) ? grid.headers : [];
    const rows = Array.isArray(grid?.rows) ? grid.rows : [];
    const matches = [];

    for (const row of rows) {
      if (matches.length >= limit) {
        break;
      }
      const isMatch = row.some((cell) => String(cell || "").toLowerCase().includes(needle));
      if (!isMatch) {
        continue;
      }
      matches.push(row
        .map((cell, index) => (cell ? `${headers[index] ? `${headers[index]}: ` : ""}${cell}` : ""))
        .filter(Boolean)
        .join(" | "));
    }

    return matches;
  }

  function getNodeLabel(node) {
    return normalize(node?.text || node?.attributes?.text || node?.id || "Unnamed Type");
  }

  async function ensureNodeLoaded(node) {
    if (!node || node.loaded || !node.isExpandable?.()) {
      return;
    }
    const cacheKey = node.id || getNodeLabel(node);
    if (!bridgeState.cache[cacheKey]) {
      bridgeState.cache[cacheKey] = new Promise((resolve) => {
        let settled = false;
        const done = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };
        try {
          if (node.loader?.load) {
            node.loader.load(node, done);
          } else {
            node.expand?.(false, false, done);
          }
          window.setTimeout(done, 5000);
        } catch {
          done();
        }
      });
    }
    await bridgeState.cache[cacheKey];
  }

  // Fetches text, the structured attribute grid, and type metadata together
  // from a single activation. These must all be captured synchronously right
  // after the panel settles (no further awaits) so they reflect exactly the
  // node just activated, before the activation lock can hand the shared panel
  // to the next queued node.
  async function fetchNodeDetails(node) {
    const cacheKey = node.id || getNodeLabel(node);
    if (bridgeState.detailFetchCache[cacheKey] !== undefined) {
      return bridgeState.detailFetchCache[cacheKey];
    }

    // Cache the in-flight promise (not just the resolved value) so two callers
    // racing for the same node share one activation instead of both clicking it.
    const pending = withActivationLock(() => activateAndReadDetails(node));
    bridgeState.detailFetchCache[cacheKey] = pending;
    const details = await pending;
    bridgeState.detailFetchCache[cacheKey] = details;
    return details;
  }

  async function getNodeAttributeGrid(node) {
    const details = await fetchNodeDetails(node);
    return details.grid;
  }

  async function getNodeMetadataText(node) {
    const details = await fetchNodeDetails(node);
    return details.metadataText;
  }

  async function activateAndReadDetails(node) {
    const previousSignature = detailPanelSignature();
    const activated = await activateNode(node);
    if (!activated) {
      return { grid: { headers: [], rows: [] }, metadata: {}, metadataText: "" };
    }
    await waitForDetailPanelUpdate(previousSignature);

    // Captured synchronously (no awaits below) so all three reflect exactly the
    // node just activated, before the lock hands the panel to the next node.
    const grid = extractAttributeGrid();
    const metadata = extractTypeMetadata();
    const metadataText = normalize(Object.entries(metadata || {})
      .map(([label, value]) => (value ? `${label}: ${value}` : ""))
      .filter(Boolean)
      .join("\n"));

    return { grid, metadata, metadataText };
  }

  function detailPanelSignature() {
    const text = extractDetailPanelText();
    return `${text.length}:${text.slice(0, 120)}`;
  }

  // Windchill loads the attribute panel over AJAX after a click, and the delay
  // varies with server load. Instead of a blind fixed wait, poll until the panel
  // content actually differs from its pre-click state and has stopped changing.
  async function waitForDetailPanelUpdate(previousSignature) {
    const deadline = Date.now() + ACTIVATION_TIMEOUT_MS;
    let lastText = "";
    let lastSignature = "";

    while (Date.now() < deadline) {
      await waitFor(ACTIVATION_POLL_MS);
      const currentText = extractDetailPanelText();
      const currentSignature = `${currentText.length}:${currentText.slice(0, 120)}`;

      if (currentSignature === previousSignature) {
        continue;
      }

      if (currentSignature === lastSignature) {
        return currentText;
      }

      lastSignature = currentSignature;
      lastText = currentText;
    }

    return lastText || extractDetailPanelText();
  }

  async function activateNode(node) {
    try {
      node.select?.();
      const tree = getTreeContext()?.tree;
      tree?.getSelectionModel?.()?.select?.(node);

      const anchor = node.ui?.anchor || node.ui?.elNode?.querySelector?.("a");
      if (anchor?.dispatchEvent) {
        anchor.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window
        }));
      } else if (typeof node.ui?.onClick === "function") {
        node.ui.onClick({
          preventDefault() {},
          stopPropagation() {},
          stopEvent() {}
        });
      } else {
        // Loaded nodes under a collapsed ancestor (or scrolled out of view) have
        // no node.ui, so there is no DOM anchor to click and the branches above
        // silently do nothing. Fire the Ext component events directly instead,
        // which reaches the app's click listeners without needing a rendered node.
        const fakeEvent = {
          preventDefault() {},
          stopPropagation() {},
          stopEvent() {}
        };
        tree?.fireEvent?.("click", node, fakeEvent);
        node.fireEvent?.("click", node, fakeEvent);
      }
      return true;
    } catch {
      return false;
    }
  }

  function extractDetailPanelText() {
    const treeElement = document.getElementById("typeMgmntNavigation");
    const metadata = extractTypeMetadata();
    const grid = extractAttributeGrid(treeElement);
    const gridText = buildGridSearchText(grid);
    const fallbackText = extractDetailPanelFallback(treeElement);

    const composite = normalize([
      Object.entries(metadata || {}).map(([label, value]) => `${label}: ${value}`).join("\n"),
      gridText,
      fallbackText
    ].filter(Boolean).join("\n"));
    if (composite) {
      return composite;
    }

    const legacyGridText = extractAttributeGridText(treeElement);
    if (legacyGridText) {
      return legacyGridText;
    }

    return "";
  }

  function extractDetailPanelFallback(treeElement) {
    const targetedSelectors = [
      "[id*='attribute' i]",
      "[id*='typeInfo' i]",
      "[id*='infoPanel' i]",
      "[id*='layout' i]",
      "[id*='property' i]",
      "[class*='attribute' i]",
      "[class*='typeinfo' i]",
      "[class*='detail' i]",
      "[class*='property' i]",
      "[class*='layout' i]"
    ];
    const targeted = Array.from(document.body.querySelectorAll(targetedSelectors.join(",")));
    const candidates = targeted.length ? targeted : Array.from(document.body.querySelectorAll("div, td, section"));
    let bestText = "";
    let bestScore = 0;

    candidates.forEach((element) => {
      if (!element || treeElement?.contains(element)) {
        return;
      }
      const rect = element.getBoundingClientRect?.();
      if (!rect || rect.width < 180 || rect.height < 90) {
        return;
      }
      if (rect.left < window.innerWidth * 0.2) {
        return;
      }
      const text = normalize(element.textContent || "");
      if (text.length < 40) {
        return;
      }
      const attributeBias = /(attribute|attributes|data type|soft type|display name|required|constraints|internal name|description|properties|layouts)/i.test(text) ? 5000 : 0;
      const score = text.length + attributeBias;
      if (score > bestScore) {
        bestScore = score;
        bestText = text;
      }
    });

    return bestText;
  }

  function extractAttributeGridText(treeElement) {
    return buildGridSearchText(extractAttributeGrid(treeElement));
  }

  function extractTypeMetadata() {
    const labels = [
      "Internal Name",
      "Display Name",
      "Description",
      "Icon",
      "Instantiable",
      "Subtypeable"
    ];
    const metadata = {};
    const textNodes = Array.from(document.body.querySelectorAll("label, td, div, span"));

    labels.forEach((label) => {
      const matcher = `${label}:`.toLowerCase();
      const source = textNodes.find((element) => normalize(element.textContent || "").toLowerCase() === matcher);
      const value = source ? normalize(extractAdjacentValue(source)) : "";
      metadata[label] = value;
    });

    return metadata;
  }

  function extractAdjacentValue(source) {
    const row = source.closest("tr");
    if (row) {
      const rowCells = Array.from(row.querySelectorAll("td"));
      if (rowCells.length >= 2) {
        return rowCells.slice(1).map((cell) => {
          const formValue = extractFormValue(cell);
          return formValue || normalize(cell.textContent || "");
        }).filter(Boolean).join(" ");
      }
    }

    const sibling = source.nextElementSibling;
    if (sibling) {
      return extractFormValue(sibling) || normalize(sibling.textContent || "");
    }

    return "";
  }

  function extractFormValue(container) {
    const input = container.querySelector?.("input, textarea, select");
    if (!input) {
      return "";
    }
    if (input.tagName === "SELECT") {
      const selected = input.options?.[input.selectedIndex];
      return normalize(selected?.textContent || input.value || "");
    }
    if (input.type === "radio") {
      const radios = Array.from(container.querySelectorAll("input[type='radio']"));
      const checked = radios.find((radio) => radio.checked);
      if (checked) {
        return normalize(checked.parentElement?.textContent || checked.value || "");
      }
    }
    return normalize(input.value || "");
  }

  // The attribute grid is an ExtJS grid that only renders rows currently
  // scrolled into view (e.g. "Reason For Change" sitting mid-alphabet is not
  // in the DOM at all until scrolled to). Scraping visible <table> text can
  // only ever find whatever happens to be rendered at read time. Reading the
  // grid's underlying Ext Store instead returns every row regardless of
  // scroll/render state, so this is tried first and DOM scraping is kept only
  // as a fallback for pages where no such grid component can be found.
  function extractAttributeGrid(treeElement = document.getElementById("typeMgmntNavigation")) {
    const storeGrid = extractAttributeGridFromStore(treeElement);
    if (storeGrid) {
      return storeGrid;
    }

    const tables = Array.from(document.body.querySelectorAll("table"));
    let best = { headers: [], rows: [] };
    let bestScore = 0;

    tables.forEach((table) => {
      if (!table || treeElement?.contains(table)) {
        return;
      }
      const rect = table.getBoundingClientRect?.();
      if (!rect || rect.width < 180 || rect.height < 60 || rect.left < window.innerWidth * 0.2) {
        return;
      }

      const rows = Array.from(table.querySelectorAll("tr"));
      const parsedRows = rows.map((row) => Array.from(row.querySelectorAll("th, td"))
        .map((cell) => normalize(extractFormValue(cell) || cell.textContent || ""))
        .filter(Boolean))
        .filter((cells) => cells.length > 0);

      if (!parsedRows.length) {
        return;
      }

      const headerIndex = parsedRows.findIndex((cells) => cells.some((cell) => /name|internal name|display name|data type/i.test(cell)));
      if (headerIndex === -1) {
        return;
      }

      const headers = parsedRows[headerIndex];
      const dataRows = parsedRows.slice(headerIndex + 1).filter((cells) => cells.some(Boolean));
      const headerText = headers.join(" ");
      const matchingHeaderBonus = /internal name|display name|data type/i.test(headerText) ? 3000 : 0;
      const score = headerText.length + dataRows.length * 50 + matchingHeaderBonus;
      if (score > bestScore) {
        bestScore = score;
        best = { headers, rows: dataRows };
      }
    });

    return best;
  }

  function extractAttributeGridFromStore(treeElement) {
    const grid = findAttributeGridComponent(treeElement);
    const store = grid?.getStore?.();
    if (!grid || !store || typeof store.each !== "function") {
      return null;
    }

    const columns = getVisibleColumns(grid);
    if (!columns.length) {
      return null;
    }

    const headers = columns.map((column) => column.header || column.dataIndex || "");
    const rows = [];
    let rowIndex = 0;
    store.each((record) => {
      const row = columns.map((column) => readRecordCell(record, column, store, rowIndex));
      rowIndex += 1;
      if (row.some(Boolean)) {
        rows.push(row);
      }
    });

    if (!rows.length) {
      return null;
    }

    return { headers, rows };
  }

  // Store records hold raw field values, which in Windchill's TAM grids are
  // often objects (e.g. {displayValue, value}) — the human-readable text the
  // UI shows is produced by each column's renderer. So: try the column's own
  // renderer first (stripping any HTML it emits), and fall back to unwrapping
  // common display-value shapes from the raw object.
  function readRecordCell(record, column, store, rowIndex) {
    const raw = column.dataIndex
      ? (typeof record.get === "function" ? record.get(column.dataIndex) : record.data?.[column.dataIndex])
      : undefined;

    if (typeof column.renderer === "function") {
      try {
        const rendered = column.renderer(raw, {}, record, rowIndex, column.index, store);
        const text = normalize(stripHtml(rendered === undefined || rendered === null ? "" : String(rendered)));
        if (text && text !== "[object Object]") {
          return text;
        }
      } catch {
        // Renderer needed context we can't supply; fall through to raw value.
      }
    }

    return stringifyStoreValue(raw);
  }

  function stringifyStoreValue(raw) {
    if (raw === undefined || raw === null) {
      return "";
    }
    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      return normalize(String(raw));
    }
    if (raw instanceof Date) {
      return raw.toLocaleString();
    }
    if (Array.isArray(raw)) {
      return raw.map(stringifyStoreValue).filter(Boolean).join(", ");
    }
    if (typeof raw === "object") {
      const displayKeys = ["displayValue", "display", "label", "text", "name", "title", "value", "internalName", "id"];
      for (const key of displayKeys) {
        const value = raw[key];
        if (value !== undefined && value !== null && typeof value !== "object" && typeof value !== "function") {
          return normalize(String(value));
        }
      }
      for (const key of displayKeys) {
        if (raw[key] && typeof raw[key] === "object") {
          const nested = stringifyStoreValue(raw[key]);
          if (nested) {
            return nested;
          }
        }
      }
      return "";
    }
    return "";
  }

  function stripHtml(value) {
    const text = String(value === undefined || value === null ? "" : value);
    if (!/[<&]/.test(text)) {
      return text;
    }
    const container = document.createElement("div");
    container.innerHTML = text;
    return container.textContent || "";
  }

  function findAttributeGridComponent(treeElement) {
    const candidates = collectGridComponents().filter((cmp) => {
      try {
        if (typeof cmp.getStore !== "function") {
          return false;
        }
        const el = cmp.getEl?.()?.dom;
        if (!el || (treeElement && treeElement.contains(el))) {
          return false;
        }
        if (cmp.hidden || (cmp.rendered === false)) {
          return false;
        }
        return getColumnHeaders(cmp).length > 0;
      } catch {
        return false;
      }
    });

    if (!candidates.length) {
      return null;
    }

    const withAttributeColumns = candidates.filter((cmp) => {
      const headerText = getColumnHeaders(cmp).join(" ").toLowerCase();
      return /internal name|display name|data type|filterable/.test(headerText);
    });

    const withRows = (withAttributeColumns.length ? withAttributeColumns : candidates).filter((cmp) => {
      try {
        return (cmp.getStore().getCount?.() || 0) > 0;
      } catch {
        return false;
      }
    });

    return withRows[0] || withAttributeColumns[0] || candidates[0];
  }

  function collectGridComponents() {
    const ext = window.Ext;
    const components = [];

    if (ext?.ComponentMgr?.all?.each) {
      // ExtJS 3.x registry.
      ext.ComponentMgr.all.each((cmp) => components.push(cmp));
      return components;
    }

    if (typeof ext?.ComponentQuery?.query === "function") {
      // ExtJS 4+.
      try {
        components.push(...ext.ComponentQuery.query("gridpanel"));
      } catch {
        // Ignore query failures and fall through with whatever was collected.
      }
    }

    return components;
  }

  // One reader for header text, dataIndex, and renderer per visible column,
  // so the exported header row and each data row are always aligned 1:1
  // (separate header/dataIndex readers previously filtered differently and
  // could shift cells by a column).
  function getVisibleColumns(grid) {
    if (typeof grid.getColumnModel === "function") {
      // ExtJS 3.x column model.
      const columnModel = grid.getColumnModel();
      const count = columnModel.getColumnCount ? columnModel.getColumnCount() : 0;
      const columns = [];
      for (let index = 0; index < count; index += 1) {
        if (columnModel.isHidden?.(index)) {
          continue;
        }
        columns.push({
          index,
          header: normalize(stripHtml(columnModel.getColumnHeader?.(index) || "")),
          dataIndex: columnModel.getDataIndex?.(index) || "",
          renderer: typeof columnModel.getRenderer === "function" ? columnModel.getRenderer(index) : null
        });
      }
      return columns;
    }

    const gridColumns = grid.getView?.()?.getHeaderCt?.()?.getGridColumns?.();
    if (Array.isArray(gridColumns)) {
      // ExtJS 4+ header container.
      return gridColumns
        .filter((col) => !col.hidden)
        .map((col, index) => ({
          index,
          header: normalize(stripHtml(col.text || "")),
          dataIndex: col.dataIndex || "",
          renderer: typeof col.renderer === "function" ? col.renderer : null
        }));
    }

    return [];
  }

  function getColumnHeaders(grid) {
    return getVisibleColumns(grid).map((column) => column.header).filter(Boolean);
  }

  function buildGridSearchText(grid) {
    const headers = Array.isArray(grid?.headers) ? grid.headers : [];
    const rows = Array.isArray(grid?.rows) ? grid.rows : [];
    return normalize([
      headers.length ? `Grid Headers: ${headers.join(" | ")}` : "",
      rows.map((row) => row.join(" | ")).join("\n")
    ].filter(Boolean).join("\n"));
  }

  function buildExportFileName(typeLabel) {
    const safe = normalize(typeLabel)
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "type_attribute_report";
    return `${safe}_type_attributes.xls`;
  }

  function buildExcelHtmlReport(report) {
    const detailRows = Object.entries(report.details || {})
      .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || "")}</td></tr>`)
      .join("");
    const headerCells = (report.grid?.headers || []).map((header) => `<th>${escapeHtml(header)}</th>`).join("");
    const bodyRows = (report.grid?.rows || []).map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; }
    h1, h2 { margin: 12px 0 8px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
    th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #ddebf7; }
    .meta { width: 60%; }
  </style>
</head>
<body>
  <h1>Windchill Type and Attribute Report</h1>
  <p><strong>Type:</strong> ${escapeHtml(report.title || "")}</p>
  <p><strong>Node ID:</strong> ${escapeHtml(report.nodeId || "")}</p>
  <h2>Type Metadata</h2>
  <table class="meta">
    <tbody>${detailRows}</tbody>
  </table>
  <h2>Attributes</h2>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
  }

  function extractExcerpts(text, needle, limit) {
    if (!text || !needle) {
      return [];
    }
    const lower = text.toLowerCase();
    const excerpts = [];
    let cursor = 0;
    while (cursor < lower.length && excerpts.length < limit) {
      const matchIndex = lower.indexOf(needle, cursor);
      if (matchIndex === -1) {
        break;
      }
      const start = Math.max(0, matchIndex - 70);
      const end = Math.min(text.length, matchIndex + needle.length + 70);
      const excerpt = text.slice(start, end).trim();
      excerpts.push(excerpt.length > 170 ? `${excerpt.slice(0, 167)}...` : excerpt);
      cursor = matchIndex + needle.length;
    }
    return excerpts;
  }

  function dedupe(items) {
    const seen = Object.create(null);
    return items.filter((item) => {
      const key = `${item.nodeId}|${item.text}`;
      if (seen[key]) {
        return false;
      }
      seen[key] = true;
      return true;
    });
  }

  function findNodeById(root, nodeId) {
    if (!root || !nodeId) {
      return null;
    }
    if (root.id === nodeId) {
      return root;
    }
    for (const child of Array.from(root.childNodes || [])) {
      const found = findNodeById(child, nodeId);
      if (found) {
        return found;
      }
    }
    return null;
  }

  async function expandAncestors(node) {
    const lineage = [];
    let current = node.parentNode;
    while (current) {
      lineage.unshift(current);
      current = current.parentNode;
    }
    for (const ancestor of lineage) {
      if (!ancestor?.expand) {
        continue;
      }
      await new Promise((resolve) => {
        try {
          ancestor.expand(false, false, resolve);
        } catch {
          resolve();
        }
      });
    }
  }

  function flash(element) {
    const previousOutline = element.style.outline;
    const previousOffset = element.style.outlineOffset;
    element.style.outline = "2px solid #ff8a00";
    element.style.outlineOffset = "2px";
    window.setTimeout(() => {
      element.style.outline = previousOutline;
      element.style.outlineOffset = previousOffset;
    }, 1400);
  }

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function waitFor(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function post(type, payload) {
    window.postMessage({
      source: BRIDGE_SOURCE,
      type,
      payload
    }, window.location.origin);
  }
})();
