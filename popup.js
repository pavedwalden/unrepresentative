// Popup script for Unrepresentative extension

document.addEventListener('DOMContentLoaded', async () => {
  // Load official count from storage or default
  const officialCountEl = document.getElementById('official-count');
  const hiddenCountEl = document.getElementById('hidden-count');
  const enabledToggle = document.getElementById('enabled-toggle');

  // Set official count (hardcoded based on our list)
  officialCountEl.textContent = '585+';

  // Load settings
  const { enabled = true, hiddenCount = 0 } = await chrome.storage.local.get(['enabled', 'hiddenCount']);
  enabledToggle.checked = enabled;
  hiddenCountEl.textContent = hiddenCount.toString();

  // Toggle handler
  enabledToggle.addEventListener('change', async () => {
    const enabled = enabledToggle.checked;
    await chrome.storage.local.set({ enabled });

    // Notify content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'toggleEnabled', enabled });
    }
  });

  // Get current hidden count from active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && (tab.url?.includes('x.com') || tab.url?.includes('twitter.com'))) {
      chrome.tabs.sendMessage(tab.id, { type: 'getStats' }, (response) => {
        if (response?.hiddenCount !== undefined) {
          hiddenCountEl.textContent = response.hiddenCount.toString();
        }
      });
    }
  } catch (e) {
    // Tab might not have content script loaded
  }
});
