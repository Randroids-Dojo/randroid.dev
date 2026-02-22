/* ============================================
   RANDROID.DEV — Main Script
   ============================================ */

(function () {
  'use strict';

  // --- Navbar hide/show on scroll ---
  const nav = document.getElementById('nav');
  let lastScrollY = 0;
  let ticking = false;

  function updateNav() {
    const currentY = window.scrollY;
    if (currentY > lastScrollY && currentY > 100) {
      nav.classList.add('hidden');
    } else {
      nav.classList.remove('hidden');
    }
    lastScrollY = currentY;
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(updateNav);
      ticking = true;
    }
  });

  // --- Active nav link tracking ---
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a[data-section]');

  function updateActiveLink() {
    const scrollY = window.scrollY + 200;
    sections.forEach(function (section) {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');
      if (scrollY >= top && scrollY < top + height) {
        navLinks.forEach(function (link) {
          link.classList.remove('active');
          if (link.getAttribute('data-section') === id) {
            link.classList.add('active');
          }
        });
      }
    });
  }

  window.addEventListener('scroll', updateActiveLink);

  // --- Mobile menu ---
  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const menuClose = document.getElementById('menuClose');
  const mobileLinks = document.querySelectorAll('.mobile-link');

  menuToggle.addEventListener('click', function () {
    mobileMenu.classList.add('open');
    document.body.style.overflow = 'hidden';
  });

  menuClose.addEventListener('click', closeMobileMenu);

  mobileLinks.forEach(function (link) {
    link.addEventListener('click', closeMobileMenu);
  });

  function closeMobileMenu() {
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
  }

  // --- Scroll-triggered fade-in animations ---
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -60px 0px',
    threshold: 0.1
  };

  const fadeObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.fade-in, .playable-card, .story-card, .blog-card').forEach(function (el) {
    fadeObserver.observe(el);
  });

  // --- Hero stat counter animation ---
  const statNumbers = document.querySelectorAll('.hero-stat-number[data-count]');
  let statsAnimated = false;

  function animateStats() {
    if (statsAnimated) return;
    statsAnimated = true;

    statNumbers.forEach(function (el) {
      const target = parseInt(el.getAttribute('data-count'), 10);
      const duration = 1200;
      const startTime = performance.now();

      function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target);
        if (progress < 1) {
          requestAnimationFrame(tick);
        }
      }

      requestAnimationFrame(tick);
    });
  }

  const heroObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animateStats();
        heroObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) {
    heroObserver.observe(heroStats);
  }

  // --- Stagger story card animations ---
  const storyCards = document.querySelectorAll('.story-card');
  const storyObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        // Find the index within currently visible batch
        const card = entry.target;
        const allCards = Array.from(storyCards);
        const idx = allCards.indexOf(card);
        const delay = (idx % 3) * 100; // stagger within rows of 3
        card.style.transitionDelay = delay + 'ms';
        card.classList.add('visible');
        storyObserver.unobserve(card);
      }
    });
  }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });

  storyCards.forEach(function (card) {
    storyObserver.observe(card);
  });

  // --- Stagger playable card animations ---
  const playableCards = document.querySelectorAll('.playable-card');
  const playableObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        playableObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });

  playableCards.forEach(function (card) {
    playableObserver.observe(card);
  });

  // --- Blog reader overlay ---
  var blogReader = document.getElementById('blogReader');
  var blogReaderContent = document.getElementById('blogReaderContent');
  var blogReaderBackdrop = document.getElementById('blogReaderBackdrop');
  var blogReaderClose = document.getElementById('blogReaderClose');
  var blogCards = document.querySelectorAll('.blog-card[data-post]');

  function openBlogPost(postId) {
    var template = document.getElementById(postId);
    if (!template) return;

    blogReaderContent.innerHTML = template.innerHTML;
    blogReader.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Scroll the reader panel back to top
    var scrollEl = blogReader.querySelector('.blog-reader-scroll');
    if (scrollEl) scrollEl.scrollTop = 0;
  }

  function closeBlogReaderUI() {
    blogReader.classList.remove('open');
    document.body.style.overflow = '';
    // Wait for close animation to clear content
    setTimeout(function () {
      if (!blogReader.classList.contains('open')) {
        blogReaderContent.innerHTML = '';
      }
    }, 500);
  }

  blogCards.forEach(function (card) {
    card.addEventListener('click', function () {
      var postId = card.getAttribute('data-post');
      openBlogPost(postId);
      history.pushState(null, '', '#blog/' + postId);
    });
  });

  function closeBlogReader() {
    if (location.hash.indexOf('#blog/') === 0) {
      history.back();
    } else {
      closeBlogReaderUI();
    }
  }

  blogReaderClose.addEventListener('click', closeBlogReader);
  blogReaderBackdrop.addEventListener('click', closeBlogReader);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && blogReader.classList.contains('open')) {
      closeBlogReader();
    }
  });

  // Handle browser back/forward for blog post deep links
  window.addEventListener('popstate', function () {
    var match = location.hash.match(/^#blog\/(post-\d+)$/);
    if (match) {
      openBlogPost(match[1]);
    } else if (blogReader.classList.contains('open')) {
      closeBlogReaderUI();
    }
  });

  // Open blog post from URL hash on initial page load
  var initialMatch = location.hash.match(/^#blog\/(post-\d+)$/);
  if (initialMatch) {
    openBlogPost(initialMatch[1]);
  }

  // --- Floating feedback button ---
  var fab = document.getElementById('fab');
  var feedbackPanel = document.getElementById('feedbackPanel');
  var feedbackForm = document.getElementById('feedbackForm');

  function toggleFeedback() {
    var isOpen = fab.classList.toggle('open');
    feedbackPanel.classList.toggle('open', isOpen);
    if (isOpen) {
      document.getElementById('feedbackMessage').focus();
    }
  }

  fab.addEventListener('click', toggleFeedback);

  // Close feedback panel when clicking outside
  document.addEventListener('click', function (e) {
    if (!fab.contains(e.target) && !feedbackPanel.contains(e.target) && feedbackPanel.classList.contains('open')) {
      fab.classList.remove('open');
      feedbackPanel.classList.remove('open');
    }
  });

  // Close feedback panel on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && feedbackPanel.classList.contains('open')) {
      fab.classList.remove('open');
      feedbackPanel.classList.remove('open');
    }
  });

  var GITHUB_TOKEN = 'REPLACE_WITH_FINE_GRAINED_PAT';
  var GITHUB_REPO = 'Randroids-Dojo/randroid.dev';
  var feedbackSubmit = document.getElementById('feedbackSubmit');
  var feedbackSuccess = document.getElementById('feedbackSuccess');

  feedbackForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = document.getElementById('feedbackName').value.trim();
    var message = document.getElementById('feedbackMessage').value.trim();
    if (!message) return;

    var title = 'Site Feedback' + (name ? ' from ' + name : '');
    var body = message + (name ? '\n\n— ' + name : '');

    // Show sending state
    feedbackSubmit.disabled = true;
    feedbackSubmit.classList.add('sending');

    fetch('https://api.github.com/repos/' + GITHUB_REPO + '/issues', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + GITHUB_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: title,
        body: body,
        labels: ['feedback']
      })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('GitHub API returned ' + res.status);
      return res.json();
    })
    .then(function () {
      // Show success state
      feedbackForm.style.display = 'none';
      feedbackSuccess.classList.add('visible');
      feedbackForm.reset();

      // Reset after a delay
      setTimeout(function () {
        fab.classList.remove('open');
        feedbackPanel.classList.remove('open');
        // Reset states after close animation
        setTimeout(function () {
          feedbackForm.style.display = '';
          feedbackSuccess.classList.remove('visible');
          feedbackSubmit.disabled = false;
          feedbackSubmit.classList.remove('sending');
        }, 350);
      }, 2000);
    })
    .catch(function () {
      feedbackSubmit.disabled = false;
      feedbackSubmit.classList.remove('sending');
      feedbackSubmit.classList.add('error');
      var label = feedbackSubmit.querySelector('.feedback-submit-label');
      label.textContent = 'Failed — try again';
      setTimeout(function () {
        feedbackSubmit.classList.remove('error');
        label.textContent = 'Send Feedback';
      }, 3000);
    });
  });

  // --- Mouse glow effect on story cards ---
  storyCards.forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const glow = card.querySelector('.story-card-glow');
      if (glow) {
        glow.style.left = (x - rect.width) + 'px';
        glow.style.top = (y - rect.height) + 'px';
        glow.style.opacity = '0.06';
      }
    });
    card.addEventListener('mouseleave', function () {
      var glow = card.querySelector('.story-card-glow');
      if (glow) glow.style.opacity = '0';
    });
  });
})();

// --- Embed loader (global for onclick) ---
function loadEmbed(placeholder) {
  var container = placeholder.parentElement;
  var card = container.closest('.playable-card');
  var url = card.getAttribute('data-url');
  if (!url) return;

  placeholder.style.opacity = '0';
  placeholder.style.pointerEvents = 'none';

  var iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope');
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute('loading', 'lazy');
  iframe.style.opacity = '0';
  iframe.style.transition = 'opacity 0.5s ease';

  container.appendChild(iframe);

  iframe.addEventListener('load', function () {
    iframe.style.opacity = '1';
    placeholder.remove();
  });

  // Fallback: show iframe after 3s even if load event doesn't fire
  setTimeout(function () {
    iframe.style.opacity = '1';
  }, 3000);
}
