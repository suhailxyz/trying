(function() {
  'use strict';

  var isAnimating = false;

  function changeImage() {
    var image = document.getElementById('pfp');
    if (!image) return;
    if (isAnimating) return;
    if (image.src.match('assets/img/jerry.jpg')) {
      isAnimating = true;
      image.src = 'assets/img/jerryeats.gif';
      image.alt = 'Jerry eats a big cheese';
      setTimeout(function() {
        image.src = 'assets/img/jerry.jpg';
        image.alt = 'Cheeky Jerry';
        isAnimating = false;
      }, 2500);
    }
  }

  function closeApplet() {
    var applet = document.querySelector('.profile-applet');
    if (applet) applet.remove();
  }

  function flyCheese() {
    var waitButton = document.getElementById('wait-button');
    var jerryImage = document.getElementById('pfp');
    if (!waitButton || !jerryImage) return;

    var buttonRect = waitButton.getBoundingClientRect();
    var jerryRect = jerryImage.getBoundingClientRect();

    var cheese = document.createElement('img');
    cheese.src = 'assets/img/32CheeseCursor.png';
    cheese.style.position = 'fixed';
    cheese.style.width = '32px';
    cheese.style.height = '32px';
    cheese.style.zIndex = '10000';
    cheese.style.pointerEvents = 'none';
    cheese.style.left = (buttonRect.left + buttonRect.width / 2 - 16) + 'px';
    cheese.style.top = (buttonRect.top + buttonRect.height / 2 - 16) + 'px';
    cheese.style.transition = 'all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    document.body.appendChild(cheese);

    cheese.offsetHeight;

    var targetX = jerryRect.left + jerryRect.width / 2 - 16;
    var targetY = jerryRect.top + jerryRect.height / 2 - 16;
    cheese.style.left = targetX + 'px';
    cheese.style.top = targetY + 'px';
    cheese.style.transform = 'rotate(360deg)';

    setTimeout(function() {
      cheese.remove();
      if (jerryImage.src.match('assets/img/jerry.jpg')) {
        changeImage();
      }
    }, 1000);
  }

  window.changeImage = changeImage;
  window.closeApplet = closeApplet;
  window.flyCheese = flyCheese;
})();

(function() {
  'use strict';

  var LOADING_PRESETS = {
    default: { flashDuration: 800, flashCountMin: 2, flashCountMax: 5, delay: 100, startIndex: 0, stuckAt: -2 },
    slow: { flashDuration: 1200, flashCountMin: 3, flashCountMax: 6, delay: 150, startIndex: 0, stuckAt: -2 }
  };

  function initLoadingBar(container) {
    var presetName = (container.dataset.loadingPreset || 'default').toLowerCase();
    var opts = LOADING_PRESETS[presetName] || LOADING_PRESETS.default;
    var segments = container.querySelectorAll('.win98-loading-bar-segment');
    var currentIndex = opts.startIndex;
    var stuckAt = opts.stuckAt >= 0 ? opts.stuckAt : segments.length + opts.stuckAt;

    for (var i = 0; i < currentIndex && i < segments.length; i++) {
      segments[i].classList.add('visible');
    }

    function loadNextSegment() {
      if (currentIndex === stuckAt) {
        var segment = segments[currentIndex];
        if (segment) {
          segment.classList.add('visible', 'flashing');
          return;
        }
      }

      if (currentIndex >= segments.length) {
        for (var i = 0; i < segments.length; i++) {
          segments[i].classList.remove('visible', 'flashing');
        }
        currentIndex = opts.startIndex;
        for (var j = 0; j < currentIndex && j < segments.length; j++) {
          segments[j].classList.add('visible');
        }
      }

      var segment = segments[currentIndex];
      if (!segment) return;

      segment.classList.add('visible', 'flashing');

      var flashCountRange = opts.flashCountMax - opts.flashCountMin + 1;
      var flashCount = opts.flashCountMin + Math.floor(Math.random() * flashCountRange);
      var totalFlashTime = flashCount * opts.flashDuration;

      setTimeout(function() {
        segment.classList.remove('flashing');
        currentIndex++;
        setTimeout(loadNextSegment, opts.delay);
      }, totalFlashTime);
    }

    loadNextSegment();
  }

  function initAll() {
    document.querySelectorAll('.win98-loading').forEach(initLoadingBar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
