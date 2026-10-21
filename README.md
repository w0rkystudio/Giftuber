# Giftuber

**GIFs for YouTube comments.** Giftuber is a Chrome extension that adds a **Gifs** button to the YouTube comment box. Search Tenor, pick a GIF from an endless 3-column grid, and post it. Anyone with Giftuber sees the GIF right in the comment section.

- 🔍 Search box plus trending GIFs, with infinite scroll
- 🖼️ The GIF shows up inside the comment box before you post, not as text
- 💬 GIFs in comments are rendered as real GIFs for everyone using Giftuber
- 🌗 Matches YouTube's light and dark themes
- 🔑 No API key or account needed
- ⚡ Small, fast previews and cached results

## How it works

YouTube comments can only hold text. When you pick a GIF, Giftuber posts a short code such as:

```
[gif:X3bBf.OHMMw]
```

| Viewer | What they see |
|---|---|
| Has Giftuber | The animated GIF |
| Doesn't have Giftuber | The short code `[gif:...]` |

There is no way for an extension to change what people *without* it see, so share Giftuber with your friends!

## Installation

Giftuber isn't on the Chrome Web Store yet, so you install it manually. It takes about a minute.

1. Go to the [**Releases**](https://github.com/tabprogames7-cell/Giftuber/releases/latest) page and download the latest **`Giftuber-*.zip`**.
2. Unzip it to a folder you'll keep (for example `Documents\Giftuber`). Don't delete this folder, because Chrome loads the extension from it.
3. Open `chrome://extensions` in Chrome.
4. Turn on **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the unzipped folder, the one that contains `manifest.json`.
6. **Refresh any open YouTube tabs** (F5). Extensions don't run in tabs that were open before they were installed.

It also works in other Chromium browsers, such as Edge (`edge://extensions`), Brave, Opera, and Vivaldi.

## Usage

1. Open any YouTube video and click the comment box.
2. Click the **Gifs** button next to the emoji button.
3. Search for something, or scroll through the trending GIFs.
4. Click a GIF. It appears in the comment box. Press Backspace to remove it.
5. Click **Comment**.

## Updating

Download the new release, replace the files in your Giftuber folder, then click the ↻ reload button on Giftuber in `chrome://extensions` and refresh YouTube.

## Troubleshooting

- **No Gifs button:** Reload the extension in `chrome://extensions` and press F5 on the YouTube tab.
- **"Couldn't load GIFs":** Check your connection. Giftuber reads Tenor's public web configuration, and it will retry automatically if that changes.
- **Comment didn't appear for others:** YouTube sometimes holds comments for review. This is YouTube's spam filter, not the extension.

## Privacy

Giftuber has no servers and collects nothing. It only talks to:

- `tenor.com` / `tenor.googleapis.com` to search for GIFs
- `media.tenor.com` to display GIFs

## Disclaimer

Giftuber is not affiliated with YouTube, Google, or Tenor. GIF search uses the same public endpoints as Tenor's own website, so it may stop working if Tenor changes them.

## Project structure

```
manifest.json   Extension manifest (MV3)
background.js   Tenor search (service worker)
content.js      Gifs button, picker, and comment rendering
content.css     Styles
icons/          Extension icons
```
