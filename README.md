# Windchill PowerTools

`Windchill PowerTools` is now a minimal browser-only Windchill debug helper. It requires no Windchill server changes and runs only on pages matching `*://*/Windchill/*`.

## Included Modules

- `manifest.json`: Manifest V3 configuration scoped to Windchill URLs
- `contentScript.js`: orchestrates all page-side features
- `uiOverlay.js`: floating bottom-right developer panel
- `customizationScanner.js`: parses likely JCA debug metadata and correlates hovered elements
- `logAnalyzer.js`: categorizes visible server log text locally and generates targeted resolution searches

## Features

- Toggle `jcaDebug=true` and `jsDebug=true` directly from the Windchill UI
- When `jcaDebug=true` is enabled, hover debug-marked Windchill UI elements and parse the component details
- Copy the parsed JCA details as JSON from the overlay
- Open Windchill System Health Monitoring tools from an expandable shortcuts section
- Show a `Need Help?` section with Plural Technology contact options
- On `logFiles.jsp`, analyze the visible log text and copy the analysis
- Generate online resolution searches from detected exceptions/findings and open PTC/community/web searches directly
- Switch between light and dark theme from an easier header toggle

## Installation

1. Open Chrome and go to `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the folder [windchill-powertools](/Users/PraveenSampath/Documents/New%20project/windchill-powertools).
5. Open a Windchill page matching `*://*/Windchill/*`.

## Usage Notes

- The panel is injected only on Windchill pages.
- The parser looks for `jcaDebug`-style metadata in rendered text and HTML comments, then correlates that metadata to the element you hover.
- Parsed details can be copied directly from the overlay.
- System Health shortcuts are generated from the standard JMX tool paths under `/Windchill/wtcore/jsp/jmx/`.
- The `Need Help?` section links to [Plural Technology](https://pluraltechnology.com) and `info@pluraltechnology.com`.
- Log analysis is local and non-billed; it categorizes the visible log and then generates resolution searches.
- After log analysis, the extension builds targeted resolution searches for PTC Support, PTC Community, and general web search.
- All parsing and export runs locally in the browser. No PLM data is transmitted externally.
