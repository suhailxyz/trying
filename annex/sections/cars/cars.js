/**
 * Cars section: game-style selection screen + database UI.
 * Left: selectable car list (Garage). Right: detail panel with hero image,
 * specs grid, long description, and Thoughts link (modal).
 */
(function() {
  var Utils = window.AnnexUtils;
  if (!Utils || !Utils.escapeHtml) return;

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
      titleEl.textContent = carLabel(car) + ' \u2014 thoughts.exe';
      messageEl.textContent = car.thoughts || '';
      if (dialogEl) dialogEl.style.display = 'flex';
    }

    function hideThoughts() {
      if (dialogEl) dialogEl.style.display = 'none';
    }

    if (closeBtn) closeBtn.addEventListener('click', hideThoughts);
    if (cancelBtn) cancelBtn.addEventListener('click', hideThoughts);

    var baseIcon = '../assets/img/icons/';

    fetch('sections/cars/cars.json')
      .then(function(res) { return res.ok ? res.json() : Promise.reject(new Error('Failed to load cars')); })
      .then(function(list) {
        var cars = Array.isArray(list) ? list.slice() : [];
        cars.sort(function(a, b) {
          var af = a.yearOwnedFrom != null ? Number(a.yearOwnedFrom) : 0;
          var bf = b.yearOwnedFrom != null ? Number(b.yearOwnedFrom) : 0;
          return af - bf;
        });

        var layout = document.createElement('div');
        layout.className = 'cars-db-layout';
        layout.innerHTML =
          '<div class="cars-db-sidebar">' +
          '<div class="cars-db-panel">' +
          '<div class="cars-db-panel-title">Garage</div>' +
          '<div class="cars-db-panel-body cars-select-list"></div>' +
          '</div></div>' +
          '<div class="cars-db-main">' +
          '<div class="cars-db-panel">' +
          '<div class="cars-db-panel-title">Vehicle Profile</div>' +
          '<div class="cars-db-panel-body cars-detail-body">' +
          '<div class="cars-detail-hero-wrap"></div>' +
          '<div class="cars-detail-specs-wrap"></div>' +
          '<div class="cars-detail-description-wrap">' +
          '<div class="cars-detail-description-label">Profile</div>' +
          '<div class="cars-detail-description"></div>' +
          '</div>' +
          '<div class="cars-detail-actions"><a href="#" class="cars-thoughts-link">Thoughts</a></div>' +
          '</div></div></div>';
        entriesEl.appendChild(layout);

        var listEl = layout.querySelector('.cars-select-list');
        var heroWrap = layout.querySelector('.cars-detail-hero-wrap');
        var specsWrap = layout.querySelector('.cars-detail-specs-wrap');
        var descEl = layout.querySelector('.cars-detail-description');
        var thoughtsLink = layout.querySelector('.cars-detail-actions .cars-thoughts-link');

        var selectedIndex = 0;

        function renderDetail(car) {
          var imgSrc = (car.image || '').trim() || baseIcon + 'cars.png';
          var heroDiv = document.createElement('div');
          heroDiv.className = 'cars-hero';
          var pixelSize = 32;
          var img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = function() {
            try {
              var canvas = document.createElement('canvas');
              canvas.width = pixelSize;
              canvas.height = pixelSize;
              canvas.className = 'cars-hero-canvas';
              var ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, pixelSize, pixelSize);
              heroDiv.appendChild(canvas);
            } catch (e) {
              var fallback = document.createElement('img');
              fallback.src = imgSrc;
              fallback.alt = '';
              fallback.className = 'cars-hero-img';
              fallback.setAttribute('width', '24');
              fallback.setAttribute('height', '24');
              heroDiv.appendChild(fallback);
            }
          };
          img.onerror = function() {
            var fallback = document.createElement('img');
            fallback.src = imgSrc;
            fallback.alt = '';
            fallback.className = 'cars-hero-img';
            fallback.setAttribute('width', '24');
            fallback.setAttribute('height', '24');
            heroDiv.appendChild(fallback);
          };
          img.src = imgSrc;
          heroWrap.innerHTML = '';
          heroWrap.appendChild(heroDiv);
          var specRows = [
            ['Year', car.year != null ? String(car.year) : ''],
            ['Make', car.make || ''],
            ['Model', car.model || ''],
            ['Owned', ownedLabel(car)]
          ];
          var stats = car.stats || {};
          Object.keys(STAT_LABELS).forEach(function(key) {
            if (stats[key] != null && stats[key] !== '') specRows.push([STAT_LABELS[key], String(stats[key])]);
          });
          var specHtml = specRows.map(function(pair) {
            return '<tr><td class="cars-spec-label">' + Utils.escapeHtml(pair[0]) + '</td><td class="cars-spec-value">' + Utils.escapeHtml(pair[1]) + '</td></tr>';
          }).join('');
          specsWrap.innerHTML = '<table class="cars-specs-grid"><tbody>' + specHtml + '</tbody></table>';
          descEl.textContent = car.description || '';
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
          for (var i = 0; i < items.length; i++) items[i].classList.toggle('selected', i === index);
          if (cars[index]) renderDetail(cars[index]);
        }

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

        if (cars.length > 0) renderDetail(cars[0]);
      })
      .catch(function() {});
  }

  window.AnnexCarsInit = init;
})();
