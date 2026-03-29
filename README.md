# QuickQuill ✦

A clean, fast Markdown editor for macOS — split pane editor + preview, tabbed interface, line numbers, and a polished toolbar.

## Features

- **Split pane** — raw Markdown on the left, live preview on the right
- **Draggable divider** — resize the panes freely
- **Tabbed editing** — open multiple files at once with ⌘N or the + button
- **Line numbers** — in the gutter, always in sync
- **Toolbar** — Bold, Italic, Strikethrough, H1/H2/H3, Code, Code block, Link, Image, Lists, Blockquote, HR
- **Keyboard shortcuts** — ⌘B, ⌘I, ⌘S, ⌘O, ⌘N
- **Word wrap toggle**
- **System theme** — follows macOS Light / Dark mode automatically
- **Status bar** — live line, word, and character count; cursor position
- **Unsaved changes prompt** — never lose work accidentally

## Requirements

- **macOS 11+** (Big Sur or later)
- **Node.js 18+** — [download here](https://nodejs.org)

## Build & Install (one-time)

```bash
chmod +x setup.sh
./setup.sh
```

Then drag `QuickQuill.app` from the `dist/` folder to your `/Applications` folder.

## Manual build

```bash
npm install
npm run build      # produces .app in dist/
npm run dist       # produces .dmg installer
```

## File format support

Opens and saves `.md`, `.markdown`, and `.txt` files.

---

Built with Electron · MIT License
