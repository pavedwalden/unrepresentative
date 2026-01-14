// Unrepresentative - Hide posts from US elected officials on X.com

(function() {
  'use strict';

  // State
  let hiddenCount = 0;
  let enabled = true;
  let observer = null;

  // Check if a username belongs to a US official
  function isOfficialHandle(username) {
    if (!username) return false;
    return window.US_OFFICIALS.has(username.toLowerCase());
  }

  // Extract username from a tweet/post element
  function extractUsername(article) {
    // Try to find the username in the tweet
    // X.com uses various selectors for usernames
    const usernameSelectors = [
      'a[href^="/"][role="link"] span',
      '[data-testid="User-Name"] a[href^="/"]',
      'a[tabindex="-1"][href^="/"]'
    ];

    for (const selector of usernameSelectors) {
      const elements = article.querySelectorAll(selector);
      for (const el of elements) {
        const href = el.closest('a')?.getAttribute('href');
        if (href && href.startsWith('/') && !href.includes('/status/')) {
          const username = href.split('/')[1];
          if (username && !['home', 'explore', 'notifications', 'messages', 'search', 'settings', 'i'].includes(username)) {
            return username;
          }
        }
      }
    }

    // Alternative: look for @ mentions in the user name area
    const userNameArea = article.querySelector('[data-testid="User-Name"]');
    if (userNameArea) {
      const text = userNameArea.textContent;
      const match = text.match(/@(\w+)/);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  // Hide a post if it's from an official
  function processPost(article) {
    if (!enabled) return;
    if (article.dataset.unrepProcessed === 'hidden') return;

    const username = extractUsername(article);

    if (username && isOfficialHandle(username)) {
      article.style.display = 'none';
      article.dataset.unrepProcessed = 'hidden';
      article.dataset.unrepUsername = username;
      hiddenCount++;
      console.log(`[Unrepresentative] Hidden post from @${username} (Total hidden: ${hiddenCount})`);
    } else {
      article.dataset.unrepProcessed = 'visible';
    }
  }

  // Process all visible posts
  function processAllPosts() {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    articles.forEach(processPost);
  }

  // Show all hidden posts (when disabled)
  function showAllPosts() {
    const articles = document.querySelectorAll('article[data-unrep-processed="hidden"]');
    articles.forEach(article => {
      article.style.display = '';
    });
  }

  // Re-hide posts from officials (when re-enabled)
  function rehidePosts() {
    const articles = document.querySelectorAll('article[data-unrep-processed="hidden"]');
    articles.forEach(article => {
      article.style.display = 'none';
    });
    // Also process any new posts
    processAllPosts();
  }

  // Set up MutationObserver to catch dynamically loaded posts
  function setupObserver() {
    observer = new MutationObserver((mutations) => {
      if (!enabled) return;

      let shouldProcess = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldProcess = true;
          break;
        }
      }

      if (shouldProcess) {
        // Use requestAnimationFrame to batch DOM reads
        requestAnimationFrame(processAllPosts);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return observer;
  }

  // Handle messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'toggleEnabled') {
      enabled = message.enabled;
      if (enabled) {
        rehidePosts();
        console.log('[Unrepresentative] Filtering enabled');
      } else {
        showAllPosts();
        console.log('[Unrepresentative] Filtering disabled');
      }
    } else if (message.type === 'getStats') {
      sendResponse({ hiddenCount });
    }
    return true;
  });

  // Initialize
  async function init() {
    // Load enabled state from storage
    try {
      const result = await chrome.storage.local.get(['enabled']);
      if (result.enabled !== undefined) {
        enabled = result.enabled;
      }
    } catch (e) {
      // Storage might not be available
    }

    console.log('[Unrepresentative] Extension loaded - hiding posts from US officials');
    console.log(`[Unrepresentative] Monitoring ${window.US_OFFICIALS.size} official accounts`);
    console.log(`[Unrepresentative] Filtering ${enabled ? 'enabled' : 'disabled'}`);

    if (enabled) {
      // Process existing posts
      processAllPosts();
    }

    // Watch for new posts
    setupObserver();

    // Also process on scroll (backup for infinite scroll)
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      if (!enabled) return;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(processAllPosts, 100);
    }, { passive: true });
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
