# Multi-Search Chrome Extension

## Project Context
Chrome extension for searching/highlighting multiple terms simultaneously on web pages. Supports bulk selection and navigation of search results.

## Quick Setup
```bash
# Project structure
mkdir -p popup utils
touch manifest.json background.js content.js
touch popup/{popup.html,popup.css,popup.js}
touch utils/{highlighter.js,storage.js}
```

## Core Implementation Focus

### 1. Start with manifest.json (v3)
- Set permissions: activeTab, storage, scripting
- Define popup action
- Configure service worker

### 2. Build Search Engine (content.js)
- Parse comma/newline separated terms
- Find & highlight matches with unique colors
- Track matches in Map structure
- Handle keyboard navigation (Tab/Shift+Tab)

### 3. Key Technical Decisions
- Use MutationObserver for dynamic content
- Store terms in sessionStorage (not sync)
- Limit to 8 concurrent highlight colors
- Support multiple search modes (text, links, URL IDs)

## Search Mode Logic
```javascript
// Extract numeric IDs from URLs like:
// /items/edit/12345
// /products/view/67890
const numericId = href.match(/\/(\d+)/)?.[1];

// Find related interactive elements:
const row = element.closest('tr');
const checkbox = row?.querySelector('input[type="checkbox"]');
```

## Testing Checklist
- [ ] 50+ search terms performance
- [ ] Case sensitivity toggle works
- [ ] Highlights persist on scroll
- [ ] Navigation wraps correctly
- [ ] Session storage clears on tab close

## Next Steps Priority
1. Get basic multi-highlight working
2. Add keyboard navigation
3. Implement session persistence
4. Optimize for 50+ terms
5. (Future) Add regex support