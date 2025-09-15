// Content script - wrapped in IIFE to avoid global scope pollution
(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================

  // Debug flag - set to true during development, false for production
  const DEBUG = false;
  const DEBUG_COLORS = false; // Set to true to debug color issues
  const DEBUG_SEARCH = false; // Set to true to debug search issues
  const log = DEBUG ? console.log.bind(console) : () => {};
  const logColor = DEBUG_COLORS ? console.log.bind(console, '[Color Debug]') : () => {};
  const logSearch = DEBUG_SEARCH ? console.log.bind(console, '[Search Debug]') : () => {};

  // ============================================
  // CONSTANTS - Shared across extension
  // ============================================

  // Color palette - accessible, distinct colors
  const COLOR_PALETTE = [
    '#ffeb3b', // yellow - good contrast on white
    '#4caf50', // green
    '#ff9800', // orange
    '#03a9f4', // light blue
    '#e91e63', // pink
    '#9c27b0', // purple
    '#00bcd4', // cyan
    '#8bc34a', // light green
  ];

  // Colors that need dark text for better readability on light backgrounds
  const NEEDS_DARK_TEXT = new Set(['#ffeb3b', '#00bcd4', '#8bc34a']);

  // Colors that always need light text for readability
  const NEEDS_LIGHT_TEXT = new Set(['#9c27b0', '#03a9f4']);

  // CSS class names
  const HIGHLIGHT_CLASS = 'multi-search-highlight';
  const FOCUSED_CLASS = 'multi-search-focused';

  // Search modes configuration
  const SEARCH_MODES = {
    TEXT_ONLY: 'text',      // Current behavior - search text nodes only
    LINKS_AWARE: 'links',   // Highlight entire links when text matched
    URL_IDS: 'url_ids'      // Extract and match numeric IDs from URLs
  };

  // Interaction modes configuration (easily extensible)
  const INTERACTION_MODES = {
    DEFAULT: {
      'Enter': 'click',      // Click link/button
      ' ': 'checkbox',       // Toggle checkbox in row
    },
    LINK_ONLY: {
      'Enter': 'click',
      ' ': 'click',
    },
    CHECKBOX_PRIORITY: {
      'Enter': 'checkbox',
      ' ': 'checkbox',
    }
  };

  // Timeouts and delays
  const RE_HIGHLIGHT_DELAY = 1000; // Delay before re-highlighting after DOM changes (1 second)

  // ============================================
  // STATE VARIABLES
  // ============================================

  // Store for current highlights and search state
  let currentHighlights = [];
  let currentSearchTerms = [];
  let currentCaseSensitive = false;
  let mutationObserver = null;
  let reHighlightTimeout = null;

  // Navigation state
  let currentMatchIndex = -1;
  let navigationActive = false;

  // Current modes
  let currentInteractionMode = 'DEFAULT';
  let currentSearchMode = SEARCH_MODES.TEXT_ONLY;

  // Toggle visibility state
  let highlightsHidden = false;
  let savedHighlightStyles = new Map();

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  // Check if extension context is still valid
  function isExtensionContextValid() {
    try {
      return chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  // Determine if an element is on a dark background
  function isOnDarkBackground(element) {
    let currentElement = element;
    let maxDepth = 10; // Check up to 10 parent levels (increased from 5)
    let foundBackground = false;

    logColor('Checking dark background for element:', element.tagName, element.textContent?.substring(0, 30));

    // First check for dark theme classes
    let checkElement = element;
    for (let i = 0; i < 10 && checkElement; i++) {
      const classList = checkElement.className;
      if (typeof classList === 'string') {
        if (classList.includes('dark') || classList.includes('Dark') ||
            classList.includes('black') || classList.includes('Black')) {
          logColor('Found dark class:', classList);
          return true;
        }
      }
      checkElement = checkElement.parentElement;
    }

    // Check computed backgrounds
    while (currentElement && maxDepth > 0) {
      const style = window.getComputedStyle(currentElement);
      const bgColor = style.backgroundColor;

      logColor(`Checking element ${10 - maxDepth}:`, currentElement.tagName, 'bgcolor:', bgColor);

      // Parse rgb/rgba values
      const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);

        // Check if this is a real background (not transparent)
        if (bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
          // Calculate relative luminance
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          foundBackground = true;
          const isDark = luminance < 0.5;
          logColor(`Found background: rgb(${r},${g},${b}), luminance: ${luminance.toFixed(2)}, isDark: ${isDark}`);
          return isDark;
        }
      }

      currentElement = currentElement.parentElement;
      maxDepth--;
    }

    // Check body background as last resort
    if (!foundBackground && document.body) {
      const bodyStyle = window.getComputedStyle(document.body);
      const bodyBg = bodyStyle.backgroundColor;
      const match = bodyBg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const isDark = luminance < 0.5;
        logColor(`Using body background as fallback: isDark: ${isDark}`);
        return isDark;
      }
    }

    // Default to light background if we can't determine
    logColor('Could not determine background, defaulting to light');
    return false;
  }

  // Determine the best text color for a highlight
  function getTextColorForHighlight(color, element) {
    const isDarkBg = isOnDarkBackground(element);

    logColor(`Getting text color for highlight: color=${color}, isDarkBg=${isDarkBg}`);

    // ALWAYS return a color to ensure consistency
    let textColor;

    if (isDarkBg) {
      // On dark backgrounds, most colors need white text
      logColor('Dark background detected - using white text for most colors');
      textColor = '#ffffff'; // Default to white on dark backgrounds
    } else {
      // On light backgrounds, apply specific rules
      if (NEEDS_LIGHT_TEXT.has(color)) {
        // Purple and blue always need light text
        logColor(`Color ${color} always needs white text`);
        textColor = '#ffffff';
      } else if (NEEDS_DARK_TEXT.has(color)) {
        // Yellow, cyan, light green need dark text on light backgrounds
        logColor(`Color ${color} needs dark text on light background`);
        textColor = '#212121';
      } else if (color === '#4caf50') {
        // Green: dark text on light, white on dark
        logColor('Green color - using dark text on light background');
        textColor = '#000000'; // Use black for better contrast
      } else if (color === '#ff9800') {
        // Orange: usually readable, but white on dark
        logColor('Orange color - keeping default on light');
        textColor = '#000000'; // Use black for consistency
      } else {
        // Default for other colors on light backgrounds
        logColor('Other color on light background - using black');
        textColor = '#000000';
      }
    }

    logColor(`Final text color decision: ${textColor}`);
    return textColor; // Always return a color, never null
  }

  // Get appropriate text shadow for readability
  function getTextShadow(color, textColor, element) {
    const isDarkBg = isOnDarkBackground(element);

    // Green on dark background needs stronger shadow for contrast
    if (color === '#4caf50' && isDarkBg) {
      return '0 0 2px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.6)';
    }

    // Standard shadows based on text color
    if (textColor === '#ffffff') {
      return '0 0 2px rgba(0,0,0,0.7), 0 0 3px rgba(0,0,0,0.5)';
    } else if (textColor === '#212121') {
      return '0 0 1px rgba(255,255,255,0.5)';
    }

    return '';
  }

  // Extract numeric IDs from URLs (generic pattern)
  function extractUrlId(href) {
    if (!href) return [];

    // Match numeric IDs in various URL patterns
    // Examples: /edit/4836?, /tiers/31393/, /view/10557?, /ping-trees/4836/
    const ids = [];
    const matches = href.match(/\/(\d{1,5})(?:[?\/]|$)/g);

    if (matches) {
      matches.forEach(match => {
        const id = match.match(/\d+/);
        if (id) {
          ids.push(id[0]);
        }
      });
    }

    return ids;
  }

  // Find related checkbox for a highlighted element
  function findRelatedCheckbox(element) {
    // MUI DataGrid structure: Try to find the row and its checkbox
    const row = element.closest('[role="row"][data-id]');
    if (row) {
      // First try the specific MUI DataGrid checkbox selector
      let checkbox = row.querySelector('input[name="select_row"]');
      if (checkbox) {
        log('[Multi-Search] Found MUI DataGrid checkbox by name');
        return checkbox;
      }

      // Try the __check__ field selector
      checkbox = row.querySelector('[data-field="__check__"] input[type="checkbox"]');
      if (checkbox) {
        log('[Multi-Search] Found MUI DataGrid checkbox in __check__ field');
        return checkbox;
      }

      // Fallback to any checkbox in the row
      checkbox = row.querySelector('input[type="checkbox"]');
      if (checkbox) {
        log('[Multi-Search] Found checkbox in DataGrid row');
        return checkbox;
      }
    }

    // List structure (manage-campaigns): Try parent containers
    const listItem = element.closest('li.MuiBox-root');
    if (listItem) {
      const checkbox = listItem.querySelector('input[type="checkbox"]');
      if (checkbox) {
        log('[Multi-Search] Found checkbox in list item');
        return checkbox;
      }
    }

    // Generic: Look for checkbox in parent containers
    let parent = element.parentElement;
    let levelsUp = 0;
    const maxLevels = 5; // Don't go too far up the DOM

    while (parent && levelsUp < maxLevels) {
      const checkbox = parent.querySelector('input[type="checkbox"]');
      if (checkbox) {
        log('[Multi-Search] Found checkbox in parent at level', levelsUp);
        return checkbox;
      }
      parent = parent.parentElement;
      levelsUp++;
    }

    log('[Multi-Search] No related checkbox found');
    return null;
  }

  // ============================================
  // DOM TRAVERSAL FUNCTIONS
  // ============================================

  // Walk through all text nodes in the document
  function walkTextNodes(node, callback) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Skip if parent is already a highlight or script/style
      const parent = node.parentNode;
      if (parent.classList && parent.classList.contains(HIGHLIGHT_CLASS)) {
        return;
      }
      if (parent.nodeName === 'SCRIPT' || parent.nodeName === 'STYLE' ||
          parent.nodeName === 'NOSCRIPT' || parent.nodeName === 'IFRAME') {
        return;
      }
      callback(node);
    } else {
      // Recursively walk child nodes
      for (let i = 0; i < node.childNodes.length; i++) {
        walkTextNodes(node.childNodes[i], callback);
      }
    }
  }

  // Walk through all link elements on the page
  function walkLinkElements(callback) {
    // Get all links on the page
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
      // Skip already highlighted links
      if (!link.classList.contains(HIGHLIGHT_CLASS)) {
        callback(link);
      }
    });
  }

  // ============================================
  // CSS INJECTION FOR STRONGER OVERRIDES
  // ============================================

  // Inject CSS rules to ensure our highlights override all link states
  function injectHighlightStyles() {
    // Check if we've already injected styles
    if (document.getElementById('multi-search-highlight-styles')) {
      return;
    }

    const styleElement = document.createElement('style');
    styleElement.id = 'multi-search-highlight-styles';

    // Create CSS rules that override all link pseudo-classes
    let css = `
      /* Override all link states for highlighted elements */
      .multi-search-highlight,
      .multi-search-highlight:link,
      .multi-search-highlight:visited,
      .multi-search-highlight:hover,
      .multi-search-highlight:active,
      .multi-search-highlight:focus {
        color: inherit !important;
      }

      /* Ensure inline styles take precedence */
      a.multi-search-highlight[style*="color"] {
        color: var(--highlight-text-color) !important;
      }
    `;

    // Add specific rules for each color to ensure proper text color
    COLOR_PALETTE.forEach((bgColor, index) => {
      // Determine text colors for this background
      const lightBgTextColor = NEEDS_LIGHT_TEXT.has(bgColor) ? '#ffffff' :
                               NEEDS_DARK_TEXT.has(bgColor) ? '#212121' :
                               bgColor === '#4caf50' ? '#000000' :
                               bgColor === '#ff9800' ? '#000000' :
                               '#000000';

      const darkBgTextColor = '#ffffff'; // Always white on dark backgrounds

      css += `
        /* Rules for color ${index}: ${bgColor} */
        .multi-search-highlight[data-color="${bgColor}"],
        .multi-search-highlight[data-color="${bgColor}"]:link,
        .multi-search-highlight[data-color="${bgColor}"]:visited,
        .multi-search-highlight[data-color="${bgColor}"]:hover {
          background-color: ${bgColor} !important;
        }
      `;
    });

    styleElement.textContent = css;
    document.head.appendChild(styleElement);
    logColor('Injected highlight CSS styles');
  }

  // ============================================
  // HIGHLIGHTING FUNCTIONS
  // ============================================

  // Highlight an entire link element
  function highlightLinkElement(link, term, color) {
    // Skip icon-only buttons (edit, delete, etc.)
    const textContent = link.textContent.trim();
    const hasIcon = link.querySelector('svg');
    const isIconOnly = hasIcon && textContent.length < 2;

    if (isIconOnly) {
      return false;
    }

    // Add highlight class and color
    link.classList.add(HIGHLIGHT_CLASS);
    link.style.backgroundColor = color;
    link.style.borderRadius = '2px';
    link.setAttribute('data-color', color); // Add for CSS targeting

    // Apply appropriate text color based on highlight and background
    const textColor = getTextColorForHighlight(color, link);

    // ALWAYS set the color since we always return one now
    logColor(`Applying text color ${textColor} to link with bg ${color}`);
    link.style.setProperty('color', textColor, 'important');

    // Add appropriate shadow for better legibility
    const textShadow = getTextShadow(color, textColor, link);
    if (textShadow) {
      link.style.setProperty('text-shadow', textShadow, 'important');
    }

    link.setAttribute('data-search-term', term);

    // Track this highlight
    currentHighlights.push(link);
    return true;
  }

  // Highlight text within a text node
  function highlightTextNode(textNode, term, caseSensitive, color) {
    const text = textNode.textContent;
    const flags = caseSensitive ? 'g' : 'gi';

    // Escape special regex characters in the search term
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, flags);

    const matches = text.match(regex);
    if (!matches) return 0;

    // Create document fragment to hold the new nodes
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    regex.lastIndex = 0; // Reset regex
    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.substring(lastIndex, match.index))
        );
      }

      // Create highlighted span
      const span = document.createElement('span');
      span.className = HIGHLIGHT_CLASS;
      span.style.backgroundColor = color;
      span.style.borderRadius = '2px';
      span.style.display = 'inline'; // Force inline display
      span.style.whiteSpace = 'nowrap'; // Prevent wrapping within the highlight

      // Apply appropriate text color based on highlight and background
      const textColor = getTextColorForHighlight(color, textNode.parentElement);

      // ALWAYS set the color since we always return one now
      span.style.setProperty('color', textColor, 'important');

      // Add appropriate shadow for better legibility
      const textShadow = getTextShadow(color, textColor, textNode.parentElement);
      if (textShadow) {
        span.style.setProperty('text-shadow', textShadow, 'important');
      }

      span.textContent = match[0];
      span.setAttribute('data-search-term', term);

      fragment.appendChild(span);
      currentHighlights.push(span);

      lastIndex = regex.lastIndex;
    }

    // Add remaining text after last match
    if (lastIndex < text.length) {
      fragment.appendChild(
        document.createTextNode(text.substring(lastIndex))
      );
    }

    // Replace the original text node with the fragment
    textNode.parentNode.replaceChild(fragment, textNode);

    return matches.length;
  }

  // Clear all highlights
  function clearHighlights() {
    log('[Multi-Search] Clearing highlights, count:', currentHighlights.length);

    // Remove all highlighted elements
    currentHighlights.forEach(element => {
      if (element.tagName === 'SPAN') {
        // For text highlights, replace with text content
        const text = document.createTextNode(element.textContent);
        element.parentNode.replaceChild(text, element);
      } else if (element.tagName === 'A') {
        // For link highlights, just remove the styling
        element.classList.remove(HIGHLIGHT_CLASS);
        element.classList.remove(FOCUSED_CLASS);
        element.style.backgroundColor = '';
        element.style.borderRadius = '';
        element.style.boxShadow = '';
        element.style.removeProperty('color'); // Remove text color override with important
        element.style.removeProperty('text-shadow'); // Remove text shadow with important
        element.removeAttribute('data-search-term');
        element.removeAttribute('data-color');
      }
    });

    // Clear the array
    currentHighlights = [];
    currentMatchIndex = -1;
    navigationActive = false;
    savedHighlightStyles.clear();
    highlightsHidden = false;
  }

  // Toggle visibility of all highlights
  function toggleHighlightVisibility() {
    highlightsHidden = !highlightsHidden;
    currentHighlights.forEach(element => {
      if (highlightsHidden) {
        // Save current styles and remove all highlighting
        savedHighlightStyles.set(element, {
          backgroundColor: element.style.backgroundColor,
          boxShadow: element.style.boxShadow,
          borderRadius: element.style.borderRadius,
          color: element.style.color,
          textShadow: element.style.textShadow
        });
        element.style.backgroundColor = '';
        element.style.boxShadow = '';
        element.style.borderRadius = '';
        element.style.removeProperty('color');
        element.style.removeProperty('text-shadow');
        element.classList.remove(HIGHLIGHT_CLASS);
        element.classList.remove(FOCUSED_CLASS);
      } else {
        // Restore saved styles
        const saved = savedHighlightStyles.get(element);
        if (saved) {
          element.style.backgroundColor = saved.backgroundColor;
          element.style.boxShadow = saved.boxShadow;
          element.style.borderRadius = saved.borderRadius;
          if (saved.color) {
            element.style.setProperty('color', saved.color, 'important');
          }
          if (saved.textShadow) {
            element.style.setProperty('text-shadow', saved.textShadow, 'important');
          }
        }
        element.classList.add(HIGHLIGHT_CLASS);
      }
    });
  }

  // ============================================
  // SEARCH FUNCTIONS
  // ============================================

  // Search in container elements for text that might be split across nodes
  function searchContainerElements(terms, caseSensitive) {
    // Target common text containers
    const containers = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, td, th, li, figcaption, caption, blockquote');

    logSearch(`Searching ${containers.length} container elements for split text`);

    containers.forEach(container => {
      // Skip if already contains highlights (avoid duplicates)
      if (container.querySelector('.' + HIGHLIGHT_CLASS)) {
        return;
      }

      // Skip script/style elements
      if (container.closest('script, style, noscript')) {
        return;
      }

      // Get the full text content (combines all child text nodes)
      const fullText = container.textContent;
      if (!fullText || !fullText.trim()) {
        return;
      }

      // Check each search term
      terms.forEach((term, index) => {
        const color = COLOR_PALETTE[index % COLOR_PALETTE.length];
        const flags = caseSensitive ? 'g' : 'gi';
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedTerm, flags);

        // Check if term exists in the combined text
        if (regex.test(fullText)) {
          logSearch(`Found "${term}" in container element <${container.tagName}> with combined text`);

          // Try to highlight text nodes within this container
          let highlighted = false;
          walkTextNodes(container, (textNode) => {
            const nodeHighlighted = highlightTextNode(textNode, term, caseSensitive, color);
            if (nodeHighlighted > 0) {
              highlighted = true;
            }
          });

          // If we couldn't highlight in individual nodes but know it's there
          if (!highlighted) {
            logSearch(`Term "${term}" found in container but split across nodes - attempting fallback highlight`);
            // For now, we'll highlight all text nodes that might contain parts
            highlightSplitText(container, term, caseSensitive, color);
          }
        }
      });
    });
  }

  // Fallback highlight for text split across nodes
  function highlightSplitText(container, term, caseSensitive, color) {
    // This is a simple approach: if we know the container has the text but
    // individual nodes don't, we highlight all text nodes in the container
    // that contain any part of the search term's words

    // Split search term into words for partial matching
    const words = term.split(/\s+/).filter(w => w.length > 2); // Only words with 3+ chars

    walkTextNodes(container, (textNode) => {
      const text = textNode.textContent;

      // Check if this node contains any significant part of the search
      const hasPartialMatch = words.some(word => {
        const wordRegex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? '' : 'i');
        return wordRegex.test(text);
      });

      if (hasPartialMatch && text.trim().length > 0) {
        // Highlight the entire text node since it's part of the match
        const span = document.createElement('span');
        span.className = HIGHLIGHT_CLASS;
        span.style.backgroundColor = color;
        span.style.borderRadius = '2px';
        span.setAttribute('data-search-term', term);

        // Apply text color for readability
        const textColor = getTextColorForHighlight(color, textNode.parentElement);
        span.style.setProperty('color', textColor, 'important');

        const textShadow = getTextShadow(color, textColor, textNode.parentElement);
        if (textShadow) {
          span.style.setProperty('text-shadow', textShadow, 'important');
        }

        span.textContent = text;
        textNode.parentNode.replaceChild(span, textNode);
        currentHighlights.push(span);

        logSearch(`Highlighted partial match in split text: "${text}"`);
      }
    });
  }

  // ============================================

  // Count matches for a term (includes overlapping)
  function countMatches(term, caseSensitive) {
    let count = 0;
    const flags = caseSensitive ? 'g' : 'gi';
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, flags);

    walkTextNodes(document.body, (textNode) => {
      const matches = textNode.textContent.match(regex);
      if (matches) {
        count += matches.length;
      }
    });

    return count;
  }

  // Perform search and highlight
  function performSearch(terms, caseSensitive, searchMode = SEARCH_MODES.TEXT_ONLY) {
    let totalHighlighted = 0;
    const matchCounts = {}; // Track matches per term

    // Inject CSS styles for stronger overrides
    injectHighlightStyles();

    // Explicitly clear highlights array before rebuilding
    currentHighlights = [];

    // Reset navigation state for new search
    currentMatchIndex = -1;
    navigationActive = false;

    // Handle different search modes
    if (searchMode === SEARCH_MODES.URL_IDS) {
      // URL IDs mode: Search in both link text and URL IDs
      terms.forEach((term, index) => {
        const color = COLOR_PALETTE[index % COLOR_PALETTE.length];
        let count = 0;

        walkLinkElements((link) => {
          // Check if term matches any ID in the URL
          const urlIds = extractUrlId(link.href);
          const matchesUrlId = urlIds.includes(term);

          // Check if term matches link text
          const linkText = link.textContent;
          const flags = caseSensitive ? 'g' : 'gi';
          const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escapedTerm, flags);
          const matchesText = regex.test(linkText);

          // Highlight if either URL ID or text matches
          if (matchesUrlId || matchesText) {
            const highlighted = highlightLinkElement(link, term, color);
            if (highlighted) {
              count++;
            }
          }
        });

        matchCounts[term] = {
          count: count,
          color: color
        };
      });
    } else if (searchMode === SEARCH_MODES.LINKS_AWARE) {
      // Links aware mode: Highlight entire links when text matches
      terms.forEach((term, index) => {
        const color = COLOR_PALETTE[index % COLOR_PALETTE.length];
        let count = 0;

        walkLinkElements((link) => {
          const linkText = link.textContent;
          const flags = caseSensitive ? 'g' : 'gi';
          const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escapedTerm, flags);

          // Debug: Log what we're searching for in links
          if (linkText && linkText.includes('PingLogix')) {
            logSearch(`Found link with PingLogix. Full text: "${linkText}"`);
            logSearch(`Searching for term: "${term}"`);
            logSearch(`Regex test result: ${regex.test(linkText)}`);
          }

          if (regex.test(linkText)) {
            const highlighted = highlightLinkElement(link, term, color);
            if (highlighted) {
              const matches = linkText.match(regex);
              count += matches ? matches.length : 0;
            }
          }
        });

        // Also highlight non-link text
        walkTextNodes(document.body, (textNode) => {
          // Skip if inside a link
          let parent = textNode.parentElement;
          while (parent) {
            if (parent.tagName === 'A') return;
            parent = parent.parentElement;
          }
          highlightTextNode(textNode, term, caseSensitive, color);
        });

        // Count all matches (links + text)
        const totalCount = countMatches(term, caseSensitive);
        matchCounts[term] = {
          count: totalCount,
          color: color
        };
      });
    } else {
      // Default TEXT_ONLY mode: Original behavior
      // First pass: count ALL matches for each term (including overlaps)
      terms.forEach((term, index) => {
        const color = COLOR_PALETTE[index % COLOR_PALETTE.length];
        const actualCount = countMatches(term, caseSensitive);

        matchCounts[term] = {
          count: actualCount,
          color: color
        };
      });

      // Second pass: highlight terms (first match wins for overlaps)
      terms.forEach((term, index) => {
        const color = COLOR_PALETTE[index % COLOR_PALETTE.length];

        walkTextNodes(document.body, (textNode) => {
          totalHighlighted += highlightTextNode(textNode, term, caseSensitive, color);
        });
      });

      // Third pass: check containers for text split across nodes
      // This catches cases where React/frameworks split text into multiple nodes
      searchContainerElements(terms, caseSensitive);
    }

    // Sort highlights by their position in the document for consistent navigation
    currentHighlights.sort((a, b) => {
      const position = a.compareDocumentPosition(b);
      // If a comes before b in the document
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1;
      }
      // If a comes after b in the document
      if (position & Node.DOCUMENT_POSITION_PRECEDING) {
        return 1;
      }
      return 0;
    });

    // Calculate total from actual counts, not highlighted
    const totalMatches = Object.values(matchCounts).reduce((sum, data) => sum + data.count, 0);

    return {
      total: totalMatches,
      perTerm: matchCounts
    };
  }

  // Re-highlight with current search terms
  function reHighlight() {
    if (currentSearchTerms.length === 0) return;

    log('[Multi-Search] Re-highlighting triggered');

    // Clear existing highlights first
    clearHighlights();

    // Re-apply search
    performSearch(currentSearchTerms, currentCaseSensitive, currentSearchMode);
  }

  // ============================================
  // NAVIGATION FUNCTIONS
  // ============================================

  // Remove focus from all highlights
  function removeFocus() {
    currentHighlights.forEach(element => {
      element.classList.remove(FOCUSED_CLASS);
      element.style.boxShadow = '';
    });
  }

  // Focus on a specific match
  function focusMatch(index) {
    log('[Multi-Search] focusMatch called with index:', index, {
      totalHighlights: currentHighlights.length,
      matchExists: index >= 0 && index < currentHighlights.length && currentHighlights[index],
      currentStateBefore: { currentMatchIndex, navigationActive }
    });

    if (index < 0 || index >= currentHighlights.length) {
      log('[Multi-Search] Index out of bounds, aborting focus');
      return;
    }

    const matchElement = currentHighlights[index];
    if (!matchElement) {
      log('[Multi-Search] Match element is null!');
      return;
    }

    // Check if element is still in DOM
    if (!document.body.contains(matchElement)) {
      log('[Multi-Search] Match element not in DOM anymore!', {
        element: matchElement,
        parent: matchElement.parentNode
      });
      return;
    }

    log('[Multi-Search] Focusing on match:', {
      index: index,
      element: matchElement,
      term: matchElement.getAttribute('data-search-term'),
      isVisible: true
    });

    // Remove previous focus
    removeFocus();

    // Add focus to current match
    matchElement.classList.add(FOCUSED_CLASS);
    matchElement.style.boxShadow = '0 0 0 3px rgba(255, 0, 0, 0.5), 0 0 10px 3px rgba(255, 0, 0, 0.3)';

    // Scroll into view
    matchElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });

    // Update current index
    currentMatchIndex = index;
    navigationActive = true;

    log('[Multi-Search] State after focus:', {
      currentMatchIndex: currentMatchIndex,
      navigationActive: navigationActive,
      focusedElement: document.querySelector('.' + FOCUSED_CLASS)
    });

    // Send update to popup with term info
    try {
      if (isExtensionContextValid()) {
        const term = matchElement.getAttribute('data-search-term') || matchElement.getAttribute('data-term') || '';
        chrome.runtime.sendMessage({
          action: 'NAVIGATION_UPDATE',
          position: index + 1,
          total: currentHighlights.length,
          currentTerm: term
        });
      }
    } catch (error) {
      log('[Multi-Search] Could not send navigation update to popup');
    }
  }

  // Navigate to next match
  function nextMatch() {
    log('[Multi-Search] nextMatch called:', {
      currentHighlightsLength: currentHighlights.length,
      currentMatchIndex: currentMatchIndex,
      navigationActive: navigationActive
    });

    if (currentHighlights.length === 0) {
      log('[Multi-Search] No highlights to navigate');
      return;
    }

    // Verify currentMatchIndex is valid
    if (currentMatchIndex >= currentHighlights.length) {
      log('[Multi-Search] Index out of bounds, resetting');
      currentMatchIndex = -1;
    }

    let nextIndex;
    if (!navigationActive || currentMatchIndex === -1) {
      log('[Multi-Search] Starting navigation from beginning');
      nextIndex = 0;
    } else {
      // Move to next, wrap around if needed
      nextIndex = (currentMatchIndex + 1) % currentHighlights.length;
      log('[Multi-Search] Moving to next index:', nextIndex);
    }

    focusMatch(nextIndex);
  }

  // Navigate to previous match
  function previousMatch() {
    if (currentHighlights.length === 0) return;

    let prevIndex;
    if (!navigationActive || currentMatchIndex === -1) {
      // Start from the end when going backwards
      prevIndex = currentHighlights.length - 1;
    } else {
      // Move to previous, wrap around if needed
      prevIndex = currentMatchIndex - 1;
      if (prevIndex < 0) {
        prevIndex = currentHighlights.length - 1;
      }
    }

    focusMatch(prevIndex);
  }

  // ============================================
  // INTERACTION HANDLERS
  // ============================================

  // Execute click on focused element
  function executeClick(focused) {
    if (focused.click) {
      // Visual feedback for click
      const originalBg = focused.style.backgroundColor;
      focused.style.backgroundColor = '#03a9f4';

      setTimeout(() => {
        focused.style.backgroundColor = originalBg;
      }, 200);

      focused.click();
      return true;
    }
    return false;
  }

  // ============================================
  // MUTATION OBSERVER
  // ============================================

  let lastReHighlightTime = 0;
  const MIN_REHIGHLIGHT_INTERVAL = 2000; // Minimum 2 seconds between re-highlights

  // Schedule a re-highlight after DOM changes
  function scheduleReHighlight() {
    const now = Date.now();
    if (now - lastReHighlightTime < MIN_REHIGHLIGHT_INTERVAL) {
      log('[Multi-Search] Skipping re-highlight (too soon)');
      return;
    }

    if (reHighlightTimeout) {
      clearTimeout(reHighlightTimeout);
    }
    reHighlightTimeout = setTimeout(() => {
      lastReHighlightTime = Date.now();
      reHighlight();
    }, RE_HIGHLIGHT_DELAY);
  }

  // Start observing DOM mutations
  function startObservingMutations() {
    if (mutationObserver) return; // Already observing

    mutationObserver = new MutationObserver((mutations) => {
      // Check if any mutation is significant
      let hasSignificantChange = false;

      for (const mutation of mutations) {
        // Check for added nodes with actual content
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            // Skip text nodes and our own highlights
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if it's not our highlight
              if (!node.classList || !node.classList.contains(HIGHLIGHT_CLASS)) {
                // Check if the node has text content
                const text = node.textContent;
                if (text && text.trim().length > 0) {
                  // Check if any search term might be in this content
                  const hasSearchTerm = currentSearchTerms.some(term => {
                    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                    return regex.test(text);
                  });

                  if (hasSearchTerm) {
                    hasSignificantChange = true;
                    break;
                  }
                }
              }
            }
          }
        }

        if (hasSignificantChange) break;
      }

      if (hasSignificantChange) {
        log('[Multi-Search] Relevant content detected, scheduling re-highlight');
        scheduleReHighlight();
      }
    });

    // Only observe what we need
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: false,
      attributes: false
    });
  }

  // Stop observing DOM mutations
  function stopObservingMutations() {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    if (reHighlightTimeout) {
      clearTimeout(reHighlightTimeout);
      reHighlightTimeout = null;
    }
  }

  // ============================================
  // MESSAGE HANDLERS
  // ============================================

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'PING') {
      // Respond to ping to indicate content script is loaded
      sendResponse({ status: 'ready' });
      return true;
    }

    if (message.action === 'SEARCH') {
      // Store search state for re-highlighting
      currentSearchTerms = message.terms;
      currentCaseSensitive = message.caseSensitive;
      currentSearchMode = message.searchMode || SEARCH_MODES.TEXT_ONLY;

      // Clear existing highlights first
      clearHighlights();

      // Perform search with mode
      const matchData = performSearch(message.terms, message.caseSensitive, currentSearchMode);

      log('[Multi-Search] Search complete:', {
        totalHighlights: currentHighlights.length,
        matchData: matchData,
        currentMatchIndex: currentMatchIndex,
        navigationActive: navigationActive
      });

      // Start observing DOM changes
      startObservingMutations();

      // Send initial navigation state to popup (with error handling)
      if (currentHighlights.length > 0) {
        try {
          chrome.runtime.sendMessage({
            action: 'NAVIGATION_UPDATE',
            position: 0,
            total: currentHighlights.length,
            currentTerm: ''  // No term selected yet
          });
        } catch (error) {
          log('[Multi-Search] Could not send initial state to popup');
        }
      }

      sendResponse({
        success: true,
        matchCount: matchData.total,
        matchCounts: matchData.perTerm
      });
    }

    if (message.action === 'CLEAR') {
      clearHighlights();
      stopObservingMutations();
      currentSearchTerms = [];
      sendResponse({ success: true });
    }

    if (message.action === 'NAVIGATE') {
      if (message.direction === 'next') {
        nextMatch();
      } else if (message.direction === 'previous') {
        previousMatch();
      }
      sendResponse({ success: true });
    }

    if (message.action === 'TOGGLE_VISIBILITY') {
      toggleHighlightVisibility();
      sendResponse({ success: true });
    }

    return true; // Keep channel open for async response
  });

  // ============================================
  // KEYBOARD EVENT HANDLERS
  // ============================================

  // Listen for keyboard events
  document.addEventListener('keydown', (e) => {
    // Tab navigation through highlights
    if (e.key === 'Tab' && currentHighlights.length > 0) {
      // Check if we should handle this tab press
      const activeElement = document.activeElement;
      const isInInput = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      );

      // Don't interfere with form navigation
      if (isInInput) {
        return;
      }

      // Prevent default tab behavior
      e.preventDefault();
      e.stopPropagation();

      if (currentHighlights.length === 0) {
        log('[Multi-Search] Tab pressed but no highlights to navigate');
        return;
      }

      if (e.shiftKey) {
        // Shift+Tab: Previous match
        log('[Multi-Search] Shift+Tab key pressed for previous match');
        previousMatch();
      } else {
        // Tab: Next match
        log('[Multi-Search] Tab key pressed for next match');
        nextMatch();
      }
    }

    // Interaction keys
    const interactionKey = e.key;
    const mode = INTERACTION_MODES[currentInteractionMode];

    if (mode && mode[interactionKey] && navigationActive && currentMatchIndex >= 0) {
      const focused = currentHighlights[currentMatchIndex];
      if (!focused) return;

      const action = mode[interactionKey];

      if (action === 'checkbox') {
        // Try to find and toggle related checkbox
        const checkbox = findRelatedCheckbox(focused);
        if (checkbox) {
          e.preventDefault();
          e.stopPropagation();

          // Visual feedback
          const originalBg = focused.style.backgroundColor;
          focused.style.backgroundColor = '#4caf50'; // Green flash

          setTimeout(() => {
            focused.style.backgroundColor = originalBg;
          }, 200);

          // Simply click the checkbox - this handles both toggling and events
          checkbox.click();

          // For React/MUI compatibility, also dispatch a change event
          const event = new Event('change', { bubbles: true, cancelable: true });
          checkbox.dispatchEvent(event);
        } else if (interactionKey === 'Enter' && focused.tagName === 'A') {
          // If no checkbox found and Enter pressed on a link, click it
          e.preventDefault();
          e.stopPropagation();
          executeClick(focused);
        }
      } else if (action === 'click') {
        // Click the element
        e.preventDefault();
        e.stopPropagation();
        executeClick(focused);
      }
    }

    // Escape key to clear highlights
    if (e.key === 'Escape' && currentHighlights.length > 0) {
      e.preventDefault();
      log('[Multi-Search] Escape key pressed to clear');
      clearHighlights();
      stopObservingMutations();
      currentSearchTerms = [];

      // Notify popup if it's open
      try {
        if (isExtensionContextValid()) {
          chrome.runtime.sendMessage({ action: 'HIGHLIGHTS_CLEARED' });
        }
      } catch (error) {
        // Popup might not be open
      }
      return;
    }
  }, true); // Use capture phase to get events before page

})();