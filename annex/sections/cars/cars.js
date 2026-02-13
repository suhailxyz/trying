/**
 * Cars section: video-game-style "my garage" — list of cars I've owned.
 * Banner, left list + name/tagline/count, center hero, right stats with progress bars, bottom prompts.
 */
(function() {
  var Utils = window.AnnexUtils;
  if (!Utils || !Utils.escapeHtml) return;

  var DESC_MAX_LEN = 280;

  function carLabel(car) {
    var parts = [];
    if (car.year) parts.push(String(car.year));
    if (car.make) parts.push(car.make);
    if (car.model) parts.push(car.model);
    return parts.join(' ') || 'Car';
  }

  function ownedLabel(car) {
    var from = car.yearOwnedFrom;
    var to = car.yearOwnedTo;
    if (from != null && to != null && from !== to) return from + '\u2013' + to;
    if (from != null) return String(from);
    if (to != null) return String(to);
    return '';
  }

  function firstSentence(text) {
    if (!text || !String(text).trim()) return '';
    var s = String(text).trim();
    var dot = s.indexOf('.');
    if (dot >= 0) return s.slice(0, dot + 1).trim();
    return s.length > 80 ? s.slice(0, 80).trim() + '\u2026' : s;
  }

  function truncateDescription(text) {
    if (!text || !text.length) return '';
    text = String(text).trim();
    if (text.length <= DESC_MAX_LEN) return text;
    return text.slice(0, DESC_MAX_LEN).trim() + '\u2026';
  }

  function statToStars(stats, key) {
    var v = stats && stats[key];
    if (v == null || v === '') return null;
    var s = String(v).toUpperCase();
    var total = 5;
    if (key === 'coolFactor') {
      var match = s.match(/^(\d+)\s*\/\s*(\d+)$/);
      if (match) return { filled: Math.min(total, Math.max(0, Math.round(Number(match[1]) / Math.max(1, Number(match[2])) * total))), total: total };
      return { filled: 3, total: total };
    }
    if (key === 'handling' || key === 'reliability') {
      if (/^[A]$/i.test(s)) return { filled: 5, total: total };
      if (/^[B]$/i.test(s)) return { filled: 4, total: total };
      if (/^[C]$/i.test(s)) return { filled: 3, total: total };
      if (/^[D]$/i.test(s)) return { filled: 2, total: total };
      return { filled: 3, total: total };
    }
    if (key === 'topSpeed') {
      var num = parseFloat(s.replace(/[^\d.]/g, ''));
      if (!isNaN(num)) return { filled: Math.min(5, Math.max(1, Math.round((num / 200) * 5))), total: total };
      return { filled: 3, total: total };
    }
    return { filled: 3, total: total };
  }

  function starsHtml(filled, total, iconBase) {
    var src = (iconBase || '') + 'smallsmile.png';
    var html = '';
    for (var i = 0; i < filled; i++) html += '<img src="' + src + '" alt="" class="cars-star-icon">';
    for (var j = filled; j < total; j++) html += '<img src="' + src + '" alt="" class="cars-star-icon cars-star-empty">';
    return html;
  }

  var STAT_LABELS = {
    topSpeed: 'Top Speed',
    handling: 'Handling',
    reliability: 'Reliability',
    coolFactor: 'Cool Factor'
  };

  function init(container) {
    var entriesEl = container && container.querySelector ? container.querySelector('#cars-entries') : null;
    if (!entriesEl) return;

    var dialogEl = container.querySelector('#cars-thoughts-dialog');
    var titleEl = container.querySelector('#cars-thoughts-dialog-title');
    var messageEl = container.querySelector('#cars-thoughts-dialog-message');
    var closeBtn = container.querySelector('#cars-thoughts-dialog-close');
    var cancelBtn = container.querySelector('#cars-thoughts-dialog-cancel');

    function showThoughts(car) {
      if (!titleEl) return;
      if (!messageEl) return;
      titleEl.textContent = "PILOT'S LOG \u2014 " + carLabel(car);
      messageEl.textContent = car.thoughts || '';
      if (dialogEl) dialogEl.style.display = 'flex';
    }

    function hideThoughts() {
      if (dialogEl) dialogEl.style.display = 'none';
    }

    if (closeBtn) closeBtn.addEventListener('click', hideThoughts);
    if (cancelBtn) cancelBtn.addEventListener('click', hideThoughts);
    if (dialogEl) {
      dialogEl.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { hideThoughts(); e.preventDefault(); }
      });
    }

    var baseIcon = '../assets/img/icons/';

    entriesEl.innerHTML = '<div class="cars-loading">LOADING...</div>';

    fetch('sections/cars/cars.json')
      .then(function(res) { return res.ok ? res.json() : Promise.reject(new Error('Failed to load cars')); })
      .then(function(list) {
        var cars = Array.isArray(list) ? list.slice() : [];
        cars.sort(function(a, b) {
          var af = a.yearOwnedFrom != null ? Number(a.yearOwnedFrom) : 0;
          var bf = b.yearOwnedFrom != null ? Number(b.yearOwnedFrom) : 0;
          return af - bf;
        });

        entriesEl.innerHTML = '';
        var layout = document.createElement('div');
        layout.className = 'cars-overhaul';
        layout.innerHTML =
          '<div class="cars-banner">MY GARAGE</div>' +
          '<div class="cars-db-layout">' +
          '<div class="cars-db-sidebar">' +
          '<div class="cars-db-panel">' +
          '<div class="cars-left-info">' +
          '<div class="cars-car-name" aria-live="polite"></div>' +
          '<div class="cars-car-tagline" aria-live="polite"></div>' +
          '<div class="cars-car-count" aria-live="polite"></div>' +
          '</div>' +
          '<div class="cars-db-panel-body cars-select-list" tabindex="0" role="listbox" aria-label="Cars I\'ve owned"></div>' +
          '</div></div>' +
          '<div class="cars-db-main">' +
          '<div class="cars-db-panel">' +
          '<div class="cars-db-panel-body cars-detail-body">' +
          '<div class="cars-band-row">' +
          '<div class="cars-detail-hero-wrap"><div class="cars-hero-platform"></div></div>' +
          '<div class="cars-detail-specs-wrap"></div>' +
          '</div>' +
          '<div class="cars-detail-description-wrap">' +
          '<div class="cars-detail-description-label">ABOUT THIS CAR</div>' +
          '<div class="cars-detail-description"></div>' +
          '</div>' +
          '<div class="cars-detail-actions"><a href="#" class="cars-thoughts-link">NOTES</a></div>' +
          '<div class="cars-key-prompts" role="status" aria-live="polite">' +
          '<button type="button" class="cars-prompt-btn cars-prompt-back"><span class="cars-prompt-key">B</span> BACK</button>' +
          '<button type="button" class="cars-prompt-btn cars-prompt-notes"><span class="cars-prompt-key">Y</span> NOTES</button>' +
          '<button type="button" class="cars-prompt-btn cars-prompt-view"><span class="cars-prompt-key">A</span> VIEW</button>' +
          '</div>' +
          '</div></div></div>';
        entriesEl.appendChild(layout);

        var listEl = layout.querySelector('.cars-select-list');
        var carNameEl = layout.querySelector('.cars-car-name');
        var carTaglineEl = layout.querySelector('.cars-car-tagline');
        var carCountEl = layout.querySelector('.cars-car-count');
        var heroWrap = layout.querySelector('.cars-detail-hero-wrap');
        var specsWrap = layout.querySelector('.cars-detail-specs-wrap');
        var descEl = layout.querySelector('.cars-detail-description');
        var thoughtsLink = layout.querySelector('.cars-detail-actions .cars-thoughts-link');

        var selectedIndex = 0;

        function updateCarCount() {
          if (!carCountEl || !cars.length) return;
          carCountEl.textContent = (selectedIndex + 1) + ' / ' + cars.length;
        }

        function updateLeftInfo(car) {
          if (carNameEl) carNameEl.textContent = car ? carLabel(car) : '';
          if (carTaglineEl) carTaglineEl.textContent = car ? firstSentence(car.description) : '';
        }

        var heroDisplaySize = 180;

        function renderDetail(car) {
          var imgSrc = (car.image || '').trim() || baseIcon + 'cars.png';
          var heroDiv = document.createElement('div');
          heroDiv.className = 'cars-hero';
          var img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = function() {
            try {
              var canvas = document.createElement('canvas');
              canvas.width = heroDisplaySize;
              canvas.height = heroDisplaySize;
              canvas.className = 'cars-hero-canvas';
              var ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, heroDisplaySize, heroDisplaySize);
              heroDiv.appendChild(canvas);
            } catch (e) {
              var fallback = document.createElement('img');
              fallback.src = imgSrc;
              fallback.alt = '';
              fallback.className = 'cars-hero-img';
              heroDiv.appendChild(fallback);
            }
          };
          img.onerror = function() {
            var fallback = document.createElement('img');
            fallback.src = imgSrc;
            fallback.alt = '';
            fallback.className = 'cars-hero-img';
            heroDiv.appendChild(fallback);
          };
          img.src = imgSrc;
          var platform = heroWrap.querySelector('.cars-hero-platform');
          if (platform) {
            platform.innerHTML = '';
            platform.appendChild(heroDiv);
          } else {
            heroWrap.innerHTML = '';
            heroWrap.appendChild(heroDiv);
          }
          updateLeftInfo(car);
          var stats = car.stats || {};
          var specParts = [];
          specParts.push('<div class="cars-specs-header"><img src="' + baseIcon + 'smallsmile.png" alt="" class="cars-specs-icon"></div>');
          specParts.push('<div class="cars-spec-row cars-spec-row-text"><span class="cars-spec-label">Year</span><span class="cars-spec-value">' + Utils.escapeHtml(car.year != null ? String(car.year) : '') + '</span></div>');
          specParts.push('<div class="cars-spec-row cars-spec-row-text"><span class="cars-spec-label">Make</span><span class="cars-spec-value">' + Utils.escapeHtml(car.make || '') + '</span></div>');
          specParts.push('<div class="cars-spec-row cars-spec-row-text"><span class="cars-spec-label">Model</span><span class="cars-spec-value">' + Utils.escapeHtml(car.model || '') + '</span></div>');
          specParts.push('<div class="cars-spec-row cars-spec-row-text"><span class="cars-spec-label">Owned</span><span class="cars-spec-value">' + Utils.escapeHtml(ownedLabel(car)) + '</span></div>');
          Object.keys(STAT_LABELS).forEach(function(key) {
            var val = stats[key];
            if (val == null || val === '') return;
            var star = statToStars(stats, key);
            var valStr = Utils.escapeHtml(String(val));
            if (star) {
              specParts.push('<div class="cars-spec-row cars-spec-row-stars">' +
                '<span class="cars-spec-label">' + Utils.escapeHtml(STAT_LABELS[key]) + '</span>' +
                '<span class="cars-spec-value">' + valStr + '</span>' +
                '<span class="cars-stars" aria-label="' + star.filled + ' out of ' + star.total + '">' + starsHtml(star.filled, star.total, baseIcon) + '</span></div>');
            } else {
              specParts.push('<div class="cars-spec-row cars-spec-row-text"><span class="cars-spec-label">' + Utils.escapeHtml(STAT_LABELS[key]) + '</span><span class="cars-spec-value">' + valStr + '</span></div>');
            }
          });
          specsWrap.innerHTML = '<div class="cars-specs-list">' + specParts.join('') + '</div>';
          descEl.textContent = truncateDescription(car.description);
          if (thoughtsLink) {
            thoughtsLink.onclick = function(e) {
              e.preventDefault();
              showThoughts(car);
            };
          }
        }

        function setSelected(index) {
          selectedIndex = index;
          var items = listEl.querySelectorAll('.cars-select-item');
          for (var i = 0; i < items.length; i++) {
            items[i].classList.toggle('selected', i === index);
            items[i].setAttribute('aria-selected', i === index ? 'true' : 'false');
          }
          if (items[index]) items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          if (cars[index]) renderDetail(cars[index]);
          updateCarCount();
        }

        listEl.addEventListener('keydown', function(e) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (cars.length) setSelected(Math.min(selectedIndex + 1, cars.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cars.length) setSelected(Math.max(selectedIndex - 1, 0));
          }
        });

        var thumbSize = 12;
        cars.forEach(function(car, i) {
          var imgSrc = (car.image || '').trim() || baseIcon + 'cars.png';
          var item = document.createElement('button');
          item.type = 'button';
          item.className = 'cars-select-item' + (i === 0 ? ' selected' : '');
          item.setAttribute('role', 'option');
          item.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
          var thumbSpan = document.createElement('span');
          thumbSpan.className = 'cars-select-thumb';
          item.appendChild(thumbSpan);
          var labelSpan = document.createElement('span');
          labelSpan.className = 'cars-select-label';
          labelSpan.textContent = carLabel(car);
          item.appendChild(labelSpan);
          var thumbImg = new Image();
          thumbImg.crossOrigin = 'anonymous';
          thumbImg.onload = function() {
            try {
              var c = document.createElement('canvas');
              c.width = thumbSize;
              c.height = thumbSize;
              c.className = 'cars-select-thumb-canvas';
              var ctx = c.getContext('2d');
              ctx.drawImage(thumbImg, 0, 0, thumbSize, thumbSize);
              thumbSpan.innerHTML = '';
              thumbSpan.appendChild(c);
            } catch (err) {
              var fallback = document.createElement('img');
              fallback.src = imgSrc;
              fallback.alt = '';
              fallback.className = 'cars-select-thumb-img';
              thumbSpan.appendChild(fallback);
            }
          };
          thumbImg.onerror = function() {
            var fallback = document.createElement('img');
            fallback.src = imgSrc;
            fallback.alt = '';
            fallback.className = 'cars-select-thumb-img';
            thumbSpan.appendChild(fallback);
          };
          thumbImg.src = imgSrc;
          item.addEventListener('click', function() { setSelected(i); });
          listEl.appendChild(item);
        });

        var backBtn = layout.querySelector('.cars-prompt-back');
        var notesBtn = layout.querySelector('.cars-prompt-notes');
        var viewBtn = layout.querySelector('.cars-prompt-view');
        if (backBtn) {
          backBtn.addEventListener('click', function() {
            var annexBack = document.getElementById('annex-back-btn');
            if (annexBack) annexBack.click();
          });
        }
        if (notesBtn) {
          notesBtn.addEventListener('click', function() {
            if (cars[selectedIndex]) showThoughts(cars[selectedIndex]);
          });
        }
        if (viewBtn) {
          viewBtn.addEventListener('click', function() {
            if (listEl) listEl.focus();
          });
        }

        if (cars.length > 0) {
          renderDetail(cars[0]);
          updateCarCount();
          updateLeftInfo(cars[0]);
        }
      })
      .catch(function() {
        entriesEl.innerHTML = '<div class="cars-error">Could not load cars.</div>';
      });
  }

  window.AnnexCarsInit = init;
})();
