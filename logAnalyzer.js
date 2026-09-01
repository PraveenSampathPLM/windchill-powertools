export function extractVisibleLogText(rootDocument) {
  const selectedText = getSelectedText(rootDocument);
  if (selectedText.length > 20) {
    return selectedText;
  }

  const activeSelection = getActiveControlSelection(rootDocument);
  if (activeSelection.length > 20) {
    return activeSelection;
  }

  const candidates = [
    ...Array.from(rootDocument.querySelectorAll("pre")),
    ...Array.from(rootDocument.querySelectorAll("textarea")),
    ...Array.from(rootDocument.querySelectorAll("[role='log']")),
    ...Array.from(rootDocument.querySelectorAll("[class*='log' i], [id*='log' i], [name*='log' i]")),
    ...Array.from(rootDocument.querySelectorAll("table")),
    rootDocument.body,
    ...getSameOriginFrameDocuments(rootDocument).flatMap((frameDocument) => [
      ...Array.from(frameDocument.querySelectorAll("pre")),
      ...Array.from(frameDocument.querySelectorAll("textarea")),
      ...Array.from(frameDocument.querySelectorAll("[role='log']")),
      ...Array.from(frameDocument.querySelectorAll("[class*='log' i], [id*='log' i], [name*='log' i]")),
      ...Array.from(frameDocument.querySelectorAll("table")),
      frameDocument.body
    ])
  ];

  const scored = candidates
    .map((node) => {
      const text = normalize(readNodeText(node));
      return {
        node,
        text,
        score: scoreLogCandidate(text)
      };
    })
    .filter((entry) => entry.text.length > 100)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.text || "";
}

export function extractErrorStackTrace(logText) {
  const lines = normalize(String(logText || "")).split(/\r?\n/);
  const firstErrorIndex = findBestErrorStart(lines);

  if (firstErrorIndex < 0) {
    return "";
  }

  const stackLines = [];
  for (let index = Math.max(0, firstErrorIndex - 2); index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const payload = getWindchillLogPayload(line);
    const isTraceLine =
      index <= firstErrorIndex ||
      isStackPayload(payload) ||
      isErrorLine(payload);

    if (!isTraceLine && stackLines.length > 3) {
      break;
    }

    if (trimmed || stackLines.length) {
      stackLines.push(line);
    }
  }

  const stackTrace = stackLines.join("\n").trim();
  if (stackTrace.split(/\r?\n/).length >= 2) {
    return stackTrace;
  }

  return extractErrorContext(lines, firstErrorIndex);
}

function readNodeText(node) {
  if (!node) {
    return "";
  }

  if ("value" in node && node.value) {
    return node.value;
  }

  return node.innerText || node.textContent || "";
}

function scoreLogCandidate(text) {
  const normalized = normalize(text);
  let score = normalized.length;
  if (/\b[\w.$]+(?:Exception|Error)\b/.test(normalized)) {
    score += 5000;
  }
  if (/^\s*at\s+[\w.$_]+/m.test(normalized)) {
    score += 4000;
  }
  if (/\b(?:ERROR|FATAL|SEVERE)\b/.test(normalized)) {
    score += 2000;
  }
  return score;
}

function getSelectedText(rootDocument) {
  try {
    return normalize(rootDocument.defaultView?.getSelection?.().toString() || "");
  } catch {
    return "";
  }
}

function getActiveControlSelection(rootDocument) {
  const activeElement = rootDocument.activeElement;
  if (!activeElement || !("value" in activeElement)) {
    return "";
  }

  const start = activeElement.selectionStart;
  const end = activeElement.selectionEnd;
  if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) {
    return "";
  }

  return normalize(activeElement.value.slice(start, end));
}

function getSameOriginFrameDocuments(rootDocument) {
  const documents = [];
  rootDocument.querySelectorAll("iframe, frame").forEach((frame) => {
    try {
      if (frame.contentDocument) {
        documents.push(frame.contentDocument);
      }
    } catch {
      // Cross-origin frames are intentionally skipped.
    }
  });
  return documents;
}

function isErrorLine(line) {
  return (
    /\b(?:exception|error|fatal|severe)\b/i.test(line) ||
    /\b[\w.$]+(?:Exception|Error|Throwable)\b/.test(line) ||
    /^\s*Caused by:/i.test(line)
  );
}

function findBestErrorStart(lines) {
  const stackFrameIndex = lines.findIndex((line) => isStackPayload(getWindchillLogPayload(line)));
  if (stackFrameIndex >= 0) {
    for (let index = stackFrameIndex - 1; index >= Math.max(0, stackFrameIndex - 8); index -= 1) {
      const payload = getWindchillLogPayload(lines[index]);
      if (isErrorLine(payload) || /\b(?:ERROR|FATAL|SEVERE)\b/.test(lines[index])) {
        return index;
      }
    }
    return stackFrameIndex;
  }

  return lines.findIndex((line) => isErrorLine(getWindchillLogPayload(line)) || isErrorLine(line));
}

function getWindchillLogPayload(line) {
  const value = String(line || "");
  const markerIndex = value.indexOf(" - ");
  if (markerIndex >= 0) {
    return value.slice(markerIndex + 3).trim();
  }
  return value.trim();
}

function isStackPayload(payload) {
  return (
    /^\s*at\s+[\w.$_]+/.test(payload) ||
    /^\s*Caused by:/i.test(payload) ||
    /^\s*Suppressed:/i.test(payload) ||
    /^\s*\.\.\. \d+ more/.test(payload) ||
    /^\s*(?:com|wt|org|java|javax|jdk)\.[\w.$_]+(?:Exception|Error|Throwable)?/.test(payload)
  );
}

function extractErrorContext(lines, firstErrorIndex) {
  const start = Math.max(0, firstErrorIndex - 3);
  const end = Math.min(lines.length, firstErrorIndex + 12);
  return lines.slice(start, end).join("\n").trim();
}

function normalize(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
