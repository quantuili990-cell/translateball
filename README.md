# Translateball

A selection & region translator userscript for Tampermonkey / Violentmonkey. Select any text on any page to see a translation bubble instantly, draw a box around images/canvas/charts to OCR-translate them, and keep a persistent translation panel docked at the bottom-right. The UI language follows the target language you pick.

## Features

- **Selection translation** - select 2-2000 characters, a translation bubble pops up next to it
- **Region select (OCR)** - press `Alt+Q`, drag a rectangle over any area; images, canvases and charts are recognized via OCR and translated
- **Persistent box** - press `Alt+A` to toggle a docked translation panel with input/history, draggable and resizable
- **Word dictionary mode** - select an English word to see phonetic, POS, meanings and example sentences
- **Streaming output** - the GLM engine streams results token by token
- **Multi-engine fallback** - if one engine fails, it automatically tries the next
- **Skips code** - `pre`, `code`, `.blob-code`, diff tables and other code blocks are never translated
- **Same-language skip** - detects the source language; no API call when source and target already match
- **Per-site switch** - enable/disable translation independently on each site
- **Sensitive-page guard** - banking, payment, mail and similar domains are skipped automatically
- **History & cache** - last 50 translations kept; repeated text served from local cache

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Open `translateball.user.js`, switch to **Raw** view, then click **Install** in the Tampermonkey install page.
3. Browse any page and select text to use it.

## Usage

| Action | Shortcut |
| --- | --- |
| Select text to translate | Select with mouse |
| Region / OCR mode | `Alt + Q` (drag a rectangle; `Esc` cancels) |
| Toggle persistent box | `Alt + A` |
| Close bubble | `Esc` or click x |

The floating ball (bottom-right) opens the settings panel: choose target language, engine mode, toggle the site on/off, clear history/cache. Panel, bubble and ball positions are remembered per domain.

## Target languages

Simplified Chinese | Traditional Chinese | English | Japanese | Korean

## Engines

| Mode | Chain |
| --- | --- |
| Fast | Edge free translation -> MyMemory -> GLM |
| Accurate | GLM (streaming) -> Edge -> MyMemory |

## Notes

- The script matches `*://*/*` globally but stays silent on sensitive domains and sites you disabled.
- OCR on a large image may be slow the first time; later requests are cached.
- Translations are for reference; double-check technical terms and long sentences against the original text.
