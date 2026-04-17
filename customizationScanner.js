const DEBUG_FIELD_PATTERNS = {
  JSP: [/(\/(?:netmarkets|Windchill)\/[A-Za-z0-9_./-]+\.jsp)/i],
  "MVC Builder": [/(?:mvc(?:\s+component)?\s+builder|builder class)\s*[:=]\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)/i],
  ComponentConfigBuilder: [/component\s*config\s*builder\s*[:=]\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)/i],
  TableBuilder: [/table\s*builder\s*[:=]\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)/i],
  "Data Builder": [/data\s*builder\s*[:=]\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)/i],
  ComponentDataBuilder: [/component\s*data\s*builder\s*[:=]\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)/i],
  DataUtility: [/data\s*utility\s*[:=]\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)/i],
  Validator: [/validator\s*[:=]\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)/i],
  FormProcessor: [/form\s*processor\s*[:=]\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)/i],
  ActionModel: [/action\s*model\s*[:=]\s*([A-Za-z0-9_.-]+)/i],
  "Resource Bundle": [/resource\s*bundle\s*[:=]\s*([A-Za-z0-9_./-]+)/i],
  "Component Id": [/component\s*(?:id|name)\s*[:=]\s*([A-Za-z0-9_.:-]+)/i],
  "Column Id": [/column\s*id\s*[:=]\s*([A-Za-z0-9_.:-]+)/i],
  "Attribute Name": [/(?:attribute|internal)\s*name\s*[:=]\s*([A-Za-z0-9_.:-]+)/i],
  VariableRowHeights: [/variable\s*row\s*heights\s*[:=]\s*(true|false)/i],
  "Default Column Freeze Index": [/default\s*column\s*freeze\s*index\s*[:=]\s*(-?\d+)/i]
};

const CONTAINER_SELECTORS = [
  "[data-component-id]",
  "[data-jca-component]",
  "[data-column]",
  "[data-attribute]",
  "table",
  "form",
  ".tableView",
  ".x-grid3",
  ".x-panel",
  ".x-form-item",
  ".attributePanel",
  ".wizard",
  ".pageSection",
  ".tableContainer",
  "section",
  "td",
  "div"
].join(",");

export function scanJcaDebug(rootDocument) {
  const blocks = parseJcaDebugBlocks(rootDocument);
  return {
    blocks,
    count: blocks.length
  };
}

export function parseJcaDebugBlocks(rootDocument) {
  const candidates = [];

  const commentWalker = rootDocument.createTreeWalker(rootDocument, NodeFilter.SHOW_COMMENT);
  let commentNode;
  while ((commentNode = commentWalker.nextNode())) {
    const text = normalizeText(commentNode.textContent || "");
    if (!looksLikeDebugMetadata(text)) {
      continue;
    }

    candidates.push({
      sourceType: "comment",
      sourceText: normalizeMultilineText(commentNode.textContent || ""),
      anchorNode: commentNode.parentElement || rootDocument.body
    });
  }

  const elements = Array.from(rootDocument.querySelectorAll("pre, code, td, th, div, span, li, section"))
    .filter((element) => looksLikeDebugMetadata(normalizeText(element.textContent || "")));

  elements.forEach((element) => {
    candidates.push({
      sourceType: "element",
      sourceText: normalizeMultilineText(element.textContent || ""),
      anchorNode: element
    });
  });

  return dedupeBlocks(
    candidates
      .map((candidate, index) => {
        const analysis = parseDebugText(candidate.sourceText);
        if (!Object.keys(analysis).length) {
          return null;
        }

        const anchorNode = findDebugContainer(candidate.anchorNode) || candidate.anchorNode;
        return {
          id: `jca-debug-${index + 1}`,
          sourceType: candidate.sourceType,
          sourceText: candidate.sourceText,
          analysis,
          anchorNode,
          anchorPath: buildDomPath(anchorNode),
          anchorTokens: collectTokens(anchorNode)
        };
      })
      .filter(Boolean)
  );
}

export function parseDebugText(text) {
  const analysis = parseStructuredDebugLines(text);
  const flattenedText = normalizeText(text);

  Object.entries(DEBUG_FIELD_PATTERNS).forEach(([label, patterns]) => {
    patterns.forEach((pattern) => {
      if (analysis[label]) {
        return;
      }
      const match = flattenedText.match(pattern);
      if (match?.[1]) {
        analysis[label] = match[1];
      }
    });
  });

  return analysis;
}

export function correlateHoverTarget(element, debugBlocks) {
  const container = findDebugContainer(element);
  const target = container || element;
  const targetTokens = collectTokens(target);

  const ranked = debugBlocks
    .map((block) => ({
      block,
      score: scoreBlock(target, targetTokens, block)
    }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  return {
    container: target,
    matchedBlock: best?.score > 8 ? best.block : null,
    score: best?.score || 0
  };
}

export function formatParsedDetails(block, score = "") {
  if (!block) {
    return null;
  }

  return {
    "Match Score": score || "",
    "Debug Source": block.sourceType,
    "Anchor Path": block.anchorPath,
    ...block.analysis
  };
}

function looksLikeDebugMetadata(text) {
  if (!text || text.length < 20 || text.length > 5000) {
    return false;
  }

  const lower = text.toLowerCase();
  return (
    lower.includes("table builder") ||
    lower.includes("tablebuilder") ||
    lower.includes("data utility") ||
    lower.includes("validator") ||
    lower.includes("form processor") ||
    lower.includes("action model") ||
    lower.includes("resource bundle") ||
    lower.includes("component id") ||
    lower.includes(".jsp")
  );
}

function parseStructuredDebugLines(text) {
  const analysis = {};
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) {
      continue;
    }

    const rawKey = match[1].trim();
    let value = match[2].trim();

    if (!value && index + 1 < lines.length && !/^[^:]+:\s*/.test(lines[index + 1])) {
      value = lines[index + 1].trim();
      index += 1;
    }

    if (!value) {
      continue;
    }

    const key = canonicalizeDebugKey(rawKey);
    analysis[key] = value;
  }

  return analysis;
}

function canonicalizeDebugKey(rawKey) {
  const normalized = rawKey.toLowerCase().replace(/\s+/g, "");
  const aliases = {
    componentid: "Component Id",
    componentname: "Component Id",
    componentconfigbuilder: "ComponentConfigBuilder",
    componentdatabuilder: "ComponentDataBuilder",
    mvcbuilder: "MVC Builder",
    tablebuilder: "TableBuilder",
    databuilder: "Data Builder",
    datautility: "DataUtility",
    validator: "Validator",
    formprocessor: "FormProcessor",
    actionmodel: "ActionModel",
    resourcebundle: "Resource Bundle",
    columnid: "Column Id",
    attributename: "Attribute Name",
    internalname: "Attribute Name",
    variablerowheights: "VariableRowHeights",
    defaultcolumnfreezeindex: "Default Column Freeze Index"
  };

  return aliases[normalized] || rawKey;
}

function findDebugContainer(element) {
  if (!(element instanceof Element)) {
    return null;
  }
  return element.closest(CONTAINER_SELECTORS);
}

function scoreBlock(target, targetTokens, block) {
  let score = 0;

  if (block.anchorNode === target) {
    score += 40;
  }

  if (block.anchorNode instanceof Element && target instanceof Element) {
    if (block.anchorNode.contains(target) || target.contains(block.anchorNode)) {
      score += 20;
    }
  }

  const blockText = `${block.sourceText} ${Object.values(block.analysis).join(" ")}`.toLowerCase();
  targetTokens.forEach((token) => {
    if (blockText.includes(token)) {
      score += 3;
    }
  });

  if (String(block.analysis["Component Id"] || "").toLowerCase() && targetTokens.includes(String(block.analysis["Component Id"]).toLowerCase())) {
    score += 15;
  }

  if (String(block.analysis["Column Id"] || "").toLowerCase() && targetTokens.includes(String(block.analysis["Column Id"]).toLowerCase())) {
    score += 15;
  }

  return score;
}

function collectTokens(element) {
  if (!(element instanceof Element)) {
    return [];
  }

  const tokens = new Set();
  const sources = [
    element.id,
    element.className,
    element.getAttribute("name"),
    element.getAttribute("data-component-id"),
    element.getAttribute("data-column"),
    element.getAttribute("data-attribute"),
    element.getAttribute("data-jca-component"),
    normalizeText(element.textContent || "").split(" ").slice(0, 12).join(" ")
  ];

  sources.forEach((source) => {
    String(source || "")
      .split(/[^A-Za-z0-9_.:-]+/)
      .filter((token) => token.length > 2)
      .forEach((token) => tokens.add(token.toLowerCase()));
  });

  return Array.from(tokens);
}

function dedupeBlocks(blocks) {
  const seen = new Set();
  return blocks.filter((block) => {
    const key = JSON.stringify(block.analysis);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildDomPath(element) {
  if (!(element instanceof Element)) {
    return "";
  }

  const segments = [];
  let current = element;
  while (current && segments.length < 6) {
    let segment = current.tagName.toLowerCase();
    if (current.id) {
      segment += `#${current.id}`;
    } else if (current.classList.length) {
      segment += `.${Array.from(current.classList).slice(0, 2).join(".")}`;
    }
    segments.unshift(segment);
    current = current.parentElement;
  }

  return segments.join(" > ");
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeMultilineText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}
