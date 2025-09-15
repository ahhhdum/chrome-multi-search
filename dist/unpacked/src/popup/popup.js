'use strict';

// Constants
const STATUS_MESSAGE_DURATION = 3000; // How long to show status messages

document.addEventListener('DOMContentLoaded', async () => {
  const searchTermsInput = document.getElementById('searchTerms');
  const caseSensitiveCheckbox = document.getElementById('caseSensitive');
  const searchModeSelect = document.getElementById('searchMode');
  const searchBtn = document.getElementById('searchBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusDiv = document.getElementById('status');
  const matchResultsDiv = document.getElementById('matchResults');
  const navigationControls = document.getElementById('navigationControls');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const navCounter = document.getElementById('navCounter');
  const helpToggle = document.getElementById('helpToggle');
  const helpSection = document.getElementById('helpSection');

  // Store match data for navigation tracking
  let totalMatches = 0;
  let currentPosition = 0;

  // Restore saved search terms and settings
  try {
    const saved = await chrome.storage.session.get(['searchTerms', 'caseSensitive', 'searchMode']);
    if (saved.searchTerms) {
      searchTermsInput.value = saved.searchTerms;
    }
    if (saved.caseSensitive !== undefined) {
      caseSensitiveCheckbox.checked = saved.caseSensitive;
    }
    if (saved.searchMode) {
      searchModeSelect.value = saved.searchMode;
    }
  } catch (error) {
    // Silent fail - not critical
  }

  // Smart placeholders based on search mode
  const placeholders = {
    'text': 'e.g., apple, google, microsoft\nquarterly report, sales data',
    'links': 'e.g., product names, company names\nannual report, documentation',
    'url_ids': 'e.g., 12345, 67890, 11111\n22222, 33333, 44444'
  };

  // Update placeholder based on search mode
  function updatePlaceholder() {
    const mode = searchModeSelect.value;
    searchTermsInput.placeholder = placeholders[mode] || placeholders['text'];
  }

  // Set initial placeholder
  updatePlaceholder();

  // Update placeholder when mode changes
  searchModeSelect.addEventListener('change', updatePlaceholder);

  // Handle help toggle with smooth animation
  let helpVisible = false;
  helpToggle.addEventListener('click', () => {
    helpVisible = !helpVisible;
    if (helpVisible) {
      helpSection.style.display = 'block';
      helpSection.style.opacity = '0';
      setTimeout(() => {
        helpSection.style.transition = 'opacity 0.3s ease';
        helpSection.style.opacity = '1';
      }, 10);
    } else {
      helpSection.style.opacity = '0';
      setTimeout(() => {
        helpSection.style.display = 'none';
      }, 300);
    }
    helpToggle.textContent = helpVisible ? '×' : '?';
    helpToggle.title = helpVisible ? 'Close help' : 'How to use this';
  });

  // Focus on textarea
  searchTermsInput.focus();

  // Parse search terms from input
  function parseSearchTerms(input) {
    if (!input.trim()) return [];

    // Split by comma or newline, trim each term, filter empty
    return input
      .split(/[,\n]+/)
      .map(term => term.trim())
      .filter(term => term.length > 0);
  }

  // Update status message
  function updateStatus(message, type = '') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;

    // Clear after 3 seconds
    if (message) {
      setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
      }, STATUS_MESSAGE_DURATION);
    }
  }

  // Display match results with colors
  function displayMatchResults(terms, matchCounts) {
    matchResultsDiv.innerHTML = '';

    if (!matchCounts) return;

    terms.forEach(term => {
      const matchData = matchCounts[term];
      if (!matchData) return;

      const itemDiv = document.createElement('div');
      itemDiv.className = 'match-item';

      // Color indicator
      const colorDiv = document.createElement('div');
      colorDiv.className = 'match-color';
      colorDiv.style.backgroundColor = matchData.color;

      // Term text (truncated if long)
      const termDiv = document.createElement('div');
      termDiv.className = 'match-term';
      termDiv.textContent = term.length > 30 ? term.substring(0, 30) + '...' : term;
      termDiv.title = term; // Full term on hover

      // Match count
      const countDiv = document.createElement('div');
      countDiv.className = matchData.count === 0 ? 'match-count zero' : 'match-count';
      countDiv.textContent = matchData.count;

      itemDiv.appendChild(colorDiv);
      itemDiv.appendChild(termDiv);
      itemDiv.appendChild(countDiv);
      matchResultsDiv.appendChild(itemDiv);
    });
  }

  // Clear match results display
  function clearMatchResults() {
    matchResultsDiv.innerHTML = '';
  }

  // Save search terms when they change
  searchTermsInput.addEventListener('input', () => {
    chrome.storage.session.set({ searchTerms: searchTermsInput.value });
  });

  // Save case sensitivity setting when it changes
  caseSensitiveCheckbox.addEventListener('change', () => {
    chrome.storage.session.set({ caseSensitive: caseSensitiveCheckbox.checked });
  });

  // Save search mode setting when it changes
  searchModeSelect.addEventListener('change', () => {
    chrome.storage.session.set({ searchMode: searchModeSelect.value });
  });

  // Handle search
  searchBtn.addEventListener('click', async () => {
    const terms = parseSearchTerms(searchTermsInput.value);

    if (terms.length === 0) {
      updateStatus('Please enter search terms', 'error');
      return;
    }

    const caseSensitive = caseSensitiveCheckbox.checked;
    const searchMode = searchModeSelect.value;

    // Validate URL IDs mode - check if all terms are numeric IDs
    if (searchMode === 'url_ids') {
      const invalidTerms = terms.filter(term => !/^\d{1,8}$/.test(term.trim()));
      if (invalidTerms.length > 0) {
        updateStatus(`URL IDs mode expects numeric IDs (1-8 digits). Invalid: ${invalidTerms.slice(0, 3).join(', ')}${invalidTerms.length > 3 ? '...' : ''}`, 'error');
        return;
      }
    }

    // Save current state
    await chrome.storage.session.set({
      searchTerms: searchTermsInput.value,
      caseSensitive: caseSensitive,
      searchMode: searchMode
    });

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'SEARCH',
        terms: terms,
        caseSensitive: caseSensitive,
        searchMode: searchMode
      });

      if (response && response.success) {
        const count = response.matchCount || 0;
        totalMatches = count;
        currentPosition = 0;
        updateStatus(`Found ${count} matches`, 'success');

        // Display per-term match counts
        displayMatchResults(terms, response.matchCounts);

        // Show navigation controls if we have matches
        if (count > 0) {
          navigationControls.style.display = 'block';
          navCounter.textContent = `Click Next to start navigating ${count} matches`;
          navCounter.className = 'nav-counter';

          // Don't auto-close popup anymore - let user navigate or close manually
          // setTimeout(() => {
          //   window.close(); // Close popup to return focus to page
          // }, 1500); // Show results for 1.5 seconds
        }
      } else {
        updateStatus('Search failed', 'error');
        clearMatchResults();
        totalMatches = 0;
        currentPosition = 0;
      }
    } catch (error) {
      updateStatus('Error: ' + error.message, 'error');
    }
  });

  // Handle clear
  clearBtn.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'CLEAR'
      });

      if (response && response.success) {
        updateStatus('Highlights cleared', 'success');
        // Don't clear the search terms, only the highlights
        clearMatchResults();
        navigationControls.style.display = 'none';
      } else {
        updateStatus('Clear failed', 'error');
      }
    } catch (error) {
      updateStatus('Error: ' + error.message, 'error');
    }
  });

  // Handle Enter key in textarea
  searchTermsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      searchBtn.click();
    }
  });

  // Navigation button handlers
  nextBtn.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'NAVIGATE', direction: 'next' });
      // Position will be updated by message listener
      // Optional: close popup to focus on page
      // window.close();
    } catch (error) {
      updateStatus('Navigation error', 'error');
    }
  });

  prevBtn.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'NAVIGATE', direction: 'previous' });
      // Position will be updated by message listener
      // Optional: close popup to focus on page
      // window.close();
    } catch (error) {
      updateStatus('Navigation error', 'error');
    }
  });

  // Listen for navigation updates from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'NAVIGATION_UPDATE') {
      currentPosition = message.position;
      totalMatches = message.total;
      const term = message.currentTerm || '';

      // Update counter with current position
      if (term) {
        // Truncate long terms for display
        const displayTerm = term.length > 20 ? term.substring(0, 20) + '...' : term;

        // Find the color for this term by comparing against full term
        const matchResultItems = matchResultsDiv.querySelectorAll('.match-item');
        let termColor = '#ffeb3b'; // Default to yellow if not found

        matchResultItems.forEach(item => {
          const termDiv = item.querySelector('.match-term');
          if (termDiv) {
            // Check both the displayed text and the title (full term)
            const fullTerm = termDiv.title || termDiv.textContent;
            if (fullTerm === term || termDiv.textContent === term) {
              const colorDiv = item.querySelector('.match-color');
              if (colorDiv && colorDiv.style.backgroundColor) {
                termColor = colorDiv.style.backgroundColor;
              }
            }
          }
        });

        // Create the counter display with the term badge
        navCounter.innerHTML = `
          <span style="font-weight: bold;">Match ${currentPosition} of ${totalMatches}</span>
          <span style="margin-left: 8px; padding: 2px 6px; background: ${termColor}; color: black; border-radius: 3px; font-size: 11px; display: inline-block; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;" title="${term.replace(/"/g, '&quot;')}">${displayTerm.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
        `;
      } else {
        navCounter.textContent = `Match ${currentPosition} of ${totalMatches}`;
      }
      navCounter.className = 'nav-counter active';
    }
  });
});