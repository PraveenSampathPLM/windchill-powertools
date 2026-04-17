export async function analyzeLogText(logText) {
  const normalized = String(logText || "").trim();
  if (!normalized) {
    return {
      mode: "empty",
      summary: "No visible log text was found on this page.",
      findings: [],
      nextSteps: []
    };
  }

  return analyzeHeuristically(normalized);
}

export function extractVisibleLogText(rootDocument) {
  const candidates = [
    ...Array.from(rootDocument.querySelectorAll("pre")),
    ...Array.from(rootDocument.querySelectorAll("textarea")),
    ...Array.from(rootDocument.querySelectorAll("table")),
    rootDocument.body
  ];

  const scored = candidates
    .map((node) => {
      const text = normalize(node?.textContent || node?.value || "");
      return {
        node,
        text,
        score: text.length
      };
    })
    .filter((entry) => entry.text.length > 100)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.text || "";
}

export function buildResolutionSearches(logText, analysis) {
  const signatures = extractSearchSignatures(logText, analysis);
  return signatures.slice(0, 4).map((signature) => ({
    label: signature,
    searches: [
      {
        name: "Google",
        url: `https://www.google.com/search?q=${encodeURIComponent(`Windchill ${signature}`)}`
      },
      {
        name: "PTC Support",
        url: `https://support.ptc.com/appserver/search/index.jsp?q=${encodeURIComponent(signature)}`
      },
      {
        name: "PTC Community",
        url: `https://community.ptc.com/t5/forums/searchpage/tab/message?advanced=false&allow_punctuation=false&q=${encodeURIComponent(signature)}`
      }
    ]
  }));
}

function analyzeHeuristically(logText) {
  const lines = logText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const errorLines = lines.filter((line) => /(error|exception|fatal|severe)/i.test(line));
  const warnLines = lines.filter((line) => /\bwarn(?:ing)?\b/i.test(line));
  const stackFrames = lines.filter((line) => /^\s*at\s+[\w.$_]+/.test(line));
  const timestamps = lines
    .map((line) => line.match(/\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}\b|\b\d{2}:\d{2}:\d{2}\b/))
    .filter(Boolean)
    .map((match) => match[0]);

  const topExceptions = topMatches(
    lines
      .map((line) => line.match(/\b[\w.$]+(?:Exception|Error)\b/))
      .filter(Boolean)
      .map((match) => match[0])
  );

  const findings = [];
  if (errorLines.length) {
    findings.push({
      category: "Errors",
      severity: "high",
      title: "Error and exception lines detected",
      explanation: "The visible log contains explicit error or exception markers.",
      evidence: `${errorLines.length} matching lines`
    });
  }
  if (warnLines.length) {
    findings.push({
      category: "Warnings",
      severity: errorLines.length ? "medium" : "low",
      title: "Warning lines detected",
      explanation: "Warnings may indicate a degraded path or a precursor to failures.",
      evidence: `${warnLines.length} warning lines`
    });
  }
  if (topExceptions.length) {
    findings.push({
      category: "Exceptions",
      severity: "high",
      title: "Top exception signatures identified",
      explanation: "The log shows repeated exception or error class names.",
      evidence: topExceptions.join(", ")
    });
  }
  if (stackFrames.length) {
    findings.push({
      category: "Stack Trace",
      severity: "medium",
      title: "Stack trace content detected",
      explanation: "At least one Java stack trace is visible in the current log text.",
      evidence: `${stackFrames.length} stack-frame lines`
    });
  }
  if (timestamps.length >= 2) {
    findings.push({
      category: "Time Range",
      severity: "info",
      title: "Visible time range detected",
      explanation: "The current log selection spans a measurable time window.",
      evidence: `${timestamps[0]} -> ${timestamps[timestamps.length - 1]}`
    });
  }

  const nextSteps = [];
  if (topExceptions.length) {
    nextSteps.push(`Start with the first occurrence of ${topExceptions[0]} and inspect the surrounding stack trace.`);
  }
  if (warnLines.length && !errorLines.length) {
    nextSteps.push("Review repeated warnings first to see whether they correlate with a specific request or background task.");
  }
  nextSteps.push("Search upward for the request, user, or method context immediately before the first critical line.");
  nextSteps.push("Use the generated Google/PTC searches to look for known resolutions.");

  return {
    mode: "heuristic",
    summary: buildSummary(errorLines.length, warnLines.length, topExceptions),
    findings,
    nextSteps
  };
}

function extractSearchSignatures(logText, analysis) {
  const signatures = new Set();

  (analysis?.findings || []).forEach((finding) => {
    [finding.title, finding.evidence].forEach((value) => {
      const exception = extractExceptionName(value);
      if (exception) {
        signatures.add(exception);
      } else if (value) {
        signatures.add(String(value).slice(0, 100));
      }
    });
  });

  const lines = String(logText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  lines.forEach((line) => {
    const exception = extractExceptionName(line);
    if (exception && signatures.size < 4) {
      signatures.add(exception);
    }
  });

  if (!signatures.size) {
    signatures.add("Windchill log error");
  }

  return Array.from(signatures)
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function extractExceptionName(value) {
  const match = String(value || "").match(/\b[\w.$]+(?:Exception|Error)\b/);
  return match?.[0] || "";
}

function topMatches(items) {
  const counts = new Map();
  items.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([item, count]) => `${item} (${count})`);
}

function buildSummary(errorCount, warnCount, topExceptions) {
  if (topExceptions.length) {
    return `The visible log is centered around ${topExceptions[0]}, with ${errorCount} error lines and ${warnCount} warning lines detected.`;
  }
  if (errorCount) {
    return `The visible log contains ${errorCount} error lines and ${warnCount} warning lines.`;
  }
  if (warnCount) {
    return `The visible log contains warnings but no obvious exception signature.`;
  }
  return "No strong error signatures were detected in the visible log text.";
}

function normalize(value) {
  return String(value || "").replace(/\s+\n/g, "\n").trim();
}
