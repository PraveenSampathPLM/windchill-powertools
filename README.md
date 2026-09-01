# Windchill PowerTools

`Windchill PowerTools` is now a minimal browser-only Windchill debug helper. It requires no Windchill server changes and runs only on the Windchill URLs you explicitly allow in the extension settings.

## Included Modules

- `manifest.json`: Manifest V3 configuration scoped to Windchill URLs
- `background.js`: registers the content script only for the Windchill sites you approve
- `contentScript.js`: orchestrates all page-side features
- `uiOverlay.js`: floating bottom-right developer panel
- `customizationScanner.js`: parses likely JCA debug metadata and correlates hovered elements
- `logAnalyzer.js`: extracts visible server log text and copies the first detected error stack trace
- `options.html` / `options.js`: configure allowed Windchill URLs

## Features

- Toggle `jcaDebug=true` and `jsDebug=true` directly from the Windchill UI
- When `jcaDebug=true` is enabled, hover debug-marked Windchill UI elements and parse the component details
- Copy the parsed JCA details as JSON from the overlay
- Open Windchill System Health Monitoring tools from an expandable shortcuts section
- Capture a screenshot of the current Windchill page and save it with object number and timestamp
- Show a `Need Help?` section with Praveen Sampath contact information
- Search the Type and Attribute Manager tree for types and attributes, including "which types have attribute X" reverse lookups
- Export the entire Windchill data model (every type with all its attributes) to a single Excel workbook in one click
- On `logFiles.jsp` or `viewLogFile.jsp`, copy the visible error stack trace
- Open the static PTC Support page from the overlay
- Switch between light and dark theme from an easier header toggle

## Installation

1. Open Chrome and go to `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the folder [windchill-powertools](/Users/PraveenSampath/Documents/New%20project/windchill-powertools).
5. Open the extension `Details` page or click the extension icon and open settings.
6. Add one or more Windchill URLs such as `https://your-windchill-server.example.com/Windchill/`.
7. Grant access when Chrome prompts for that exact site.
8. Refresh the Windchill page.

## Usage Notes

- The panel is injected only on Windchill pages whose site access you explicitly configured in Settings.
- The parser looks for `jcaDebug`-style metadata in rendered text and HTML comments, then correlates that metadata to the element you hover.
- Parsed details can be copied directly from the overlay.
- System Health shortcuts are generated from the standard JMX tool paths under `/Windchill/wtcore/jsp/jmx/`.
- The `Need Help?` section links to `pravincee@gmail.com`.
- Log tools are intentionally simple: the extension copies the first visible error stack trace and does not interpret the log.
- The overlay includes a static PTC Support link: `https://www.ptc.com/en/support`.
- All parsing and export runs locally in the browser. No PLM data is transmitted externally.
