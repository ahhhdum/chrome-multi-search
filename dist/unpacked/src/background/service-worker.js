'use strict';

// Simple service worker - no bloat, just essentials

// Inject content script if needed
async function ensureContentScript(tabId) {
  try {
    // Check if content script is already injected
    await chrome.tabs.sendMessage(tabId, { action: 'PING' });
  } catch (error) {
    // Content script not injected, inject it now
    await chrome.scripting.executeScript({
      target: { tabId: tabId, allFrames: true },
      files: ['src/content/content.js']
    });
  }
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Route messages based on action
  switch (message.action) {
    case 'SEARCH':
    case 'CLEAR':
    case 'NAVIGATE':
      // Forward messages to the active tab's content script
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]) {
          try {
            await ensureContentScript(tabs[0].id);
            chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
              // Make sure we have a response before sending it back
              if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
              } else {
                sendResponse(response || { success: false });
              }
            });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      });
      return true; // Keep channel open for async response
    default:
      // Unknown action - do nothing
      return false;
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle_search') {
    // Toggle visibility of existing highlights
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'TOGGLE_VISIBILITY' });
      }
    });
  }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  // Extension installed successfully - no debug output in production
});