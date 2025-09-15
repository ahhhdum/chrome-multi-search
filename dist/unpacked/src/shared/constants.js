'use strict';

// Color palette - accessible, distinct colors for highlighting
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
const DEBOUNCE_DELAY = 100; // Delay for debounced operations
const RE_HIGHLIGHT_DELAY = 100; // Delay before re-highlighting after DOM changes
const STATUS_MESSAGE_DURATION = 3000; // How long to show status messages in popup

// Limits
const MAX_TERMS = 100; // Maximum number of search terms
const MAX_TERM_LENGTH = 100; // Maximum length of a single search term

// Export everything for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    COLOR_PALETTE,
    HIGHLIGHT_CLASS,
    FOCUSED_CLASS,
    SEARCH_MODES,
    INTERACTION_MODES,
    DEBOUNCE_DELAY,
    RE_HIGHLIGHT_DELAY,
    STATUS_MESSAGE_DURATION,
    MAX_TERMS,
    MAX_TERM_LENGTH
  };
}