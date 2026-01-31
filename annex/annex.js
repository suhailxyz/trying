(function() {
  const gridEl = document.getElementById('annex-grid');
  const detailEl = document.getElementById('annex-detail');
  const detailContentEl = document.getElementById('annex-detail-content');
  const rightPaneEl = document.getElementById('annex-right-pane');
  const loadingEl = document.getElementById('annex-loading');
  const errorEl = document.getElementById('annex-error');
  const addressValueEl = document.getElementById('annex-address-value');
  const statusCountEl = document.getElementById('annex-status-count');
  const statusLocationEl = document.getElementById('annex-status-location');
  const leftIconEl = document.getElementById('annex-left-icon');
  const leftTitleEl = document.getElementById('annex-left-title');
  const leftDescEl = document.getElementById('annex-left-desc');
  const homeBtn = document.getElementById('annex-home-btn');
  const backBtn = document.getElementById('annex-back-btn');
  const forwardBtn = document.getElementById('annex-forward-btn');
  const aboutBtn = document.getElementById('annex-about-btn');
  const backLink = document.getElementById('annex-back-link');

  const ICONS_BASE = '../assets/img/icons/';

  let applets = [];
  let currentSectionLabel = null;
  let historyStack = [];

  function getSlug(applet) {
    var f = applet.file;
    return f.indexOf('/') >= 0 ? f.split('/')[0] : f.replace(/\.html?$/i, '');
  }

  function getAppletBySlug(slug) {
    if (!slug) return null;
    return applets.find(function(a) { return getSlug(a) === slug; }) || null;
  }

  function setLeftPanel(title, desc, icon) {
    if (leftTitleEl) leftTitleEl.textContent = title || 'Annex';
    if (leftDescEl) leftDescEl.textContent = desc || 'Select an item to view its description.';
    if (leftIconEl) leftIconEl.src = icon ? (ICONS_BASE + icon) : '../assets/img/icons/annex.png';
  }

  function showGrid() {
    gridEl.style.display = 'grid';
    detailEl.classList.remove('annex-detail-visible');
    rightPaneEl.classList.remove('annex-showing-detail');
    loadingEl.style.display = 'none';
    errorEl.style.display = 'none';
    addressValueEl.textContent = 'Annex';
    statusLocationEl.textContent = 'Annex';
    currentSectionLabel = null;
    setLeftPanel('Annex', 'Select an item to view its description.', null);
    if (history.replaceState) {
      history.replaceState(null, '', location.pathname + location.search);
    } else {
      location.hash = '';
    }
  }

  function showDetail(html, applet) {
    var label = applet ? applet.label : null;
    gridEl.style.display = 'none';
    detailContentEl.innerHTML = html;
    detailEl.classList.add('annex-detail-visible');
    rightPaneEl.classList.add('annex-showing-detail');
    loadingEl.style.display = 'none';
    errorEl.style.display = 'none';
    addressValueEl.textContent = label ? 'Annex - ' + label : 'Annex';
    statusLocationEl.textContent = label || 'Annex';
    currentSectionLabel = label;
    if (applet && (applet.panelTitle || applet.panelDesc || applet.panelIcon)) {
      setLeftPanel(applet.panelTitle || label, applet.panelDesc, applet.panelIcon);
    } else {
      setLeftPanel(label, 'Select an item to view its description.', applet ? applet.icon : null);
    }

    if (applet && applet.programDesc) {
      var programDescEl = detailContentEl.querySelector('.annex-program-desc');
      if (programDescEl) programDescEl.textContent = applet.programDesc;
    }

    detailContentEl.querySelectorAll('img[src^="../../"]').forEach(function(img) {
      img.src = img.src.replace('../../', '../');
    });

    if (applet && getSlug(applet) === 'library') {
      var container = detailContentEl.querySelector('#library-entries');
      if (container) {
        fetch('sections/library/library.json')
          .then(function(res) { return res.ok ? res.json() : Promise.reject(new Error('Failed to load library')); })
          .then(function(entries) {
            var base = '../assets/img/icons/';
            (Array.isArray(entries) ? entries : []).forEach(function(entry) {
              var formats = normalizeFormats(entry);
              var formatLabel = formats.map(function(f) { return f.format; }).join(', ');
              var blurbHtml = entry.note
                ? '<p class="library-entry-blurb"><img src="' + base + 'notes16.png" alt="" class="library-entry-icon">' + escapeHtml(entry.note) + '</p>'
                : '';
              var div = document.createElement('div');
              div.className = 'library-entry';
              var borrowHtml;
              if (formats.length === 1) {
                var oneFilename = downloadFilename(entry.title, formats[0].format);
                borrowHtml = '<a href="' + escapeHtml(formats[0].file) + '" download="' + escapeHtml(oneFilename) + '" class="library-entry-download" title="Borrow ' + escapeHtml(formats[0].format) + '">' +
                  '<img src="' + base + 'download16.png" alt="" class="win98-icon">Borrow</a>';
              } else {
                borrowHtml = '<div class="library-entry-borrow">' +
                  '<button type="button" class="library-entry-borrow-btn">' +
                  '<img src="' + base + 'download16.png" alt="" class="win98-icon">Borrow</button></div>';
              }
              var supportHtml = entry.supportAuthor
                ? '<a href="' + escapeHtml(entry.supportAuthor) + '" class="library-entry-support" title="Support the author" target="_blank" rel="noopener noreferrer">' +
                  '<img src="' + base + 'support16.png" alt="" class="win98-icon">Support</a>'
                : '';
              var actionsHtml = '<div class="library-entry-actions">' + borrowHtml + supportHtml + '</div>';
              div.innerHTML =
                '<div class="library-entry-info">' +
                  '<div class="library-entry-title-row">' +
                    '<img src="' + base + 'book16.png" alt="" class="library-entry-icon">' +
                    '<span class="library-entry-title">' + escapeHtml(entry.title) + '</span>' +
                    '<span class="library-entry-format">' + escapeHtml(formatLabel) + '</span>' +
                  '</div>' +
                  '<div class="library-entry-author-row">' +
                    '<img src="' + base + 'user16.png" alt="" class="library-entry-icon">' +
                    '<span class="library-entry-author">' + escapeHtml(entry.author || '') + '</span>' +
                  '</div>' +
                  blurbHtml +
                '</div>' +
                actionsHtml;
              container.appendChild(div);
              if (formats.length === 1) {
                var singleLink = div.querySelector('.library-entry-download');
                if (singleLink && isExternalUrl(formats[0].file)) {
                  singleLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    triggerDownload(formats[0].file, downloadFilename(entry.title, formats[0].format));
                  });
                }
              } else {
                var btn = div.querySelector('.library-entry-borrow-btn');
                btn.addEventListener('click', function() {
                  showLibraryFormatDialog(formats, entry.title);
                });
              }
            });
          })
          .catch(function() {});
      }
    }
  }

  function escapeHtml(str) {
    if (str == null) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function downloadFilename(title, format) {
    var ext = (format || 'pdf').toLowerCase();
    var slug = (title || 'download').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 60);
    return (slug || 'download') + '.' + ext;
  }

  function isExternalUrl(url) {
    if (!url || url.indexOf('http') !== 0) return false;
    try {
      var u = new URL(url, location.href);
      return u.origin !== location.origin;
    } catch (e) {
      return false;
    }
  }

  function triggerDownload(url, filename, onClose) {
    if (isExternalUrl(url)) {
      fetch(url, { mode: 'cors' })
        .then(function(r) {
          if (!r.ok) throw new Error('Fetch failed');
          return r.blob();
        })
        .then(function(blob) {
          var u = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = u;
          link.download = filename;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(u);
          if (onClose) onClose();
        })
        .catch(function() {
          window.open(url, '_blank');
          if (onClose) onClose();
        });
    } else {
      var link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (onClose) onClose();
    }
  }

  function normalizeFormats(entry) {
    if (Array.isArray(entry.formats) && entry.formats.length > 0) {
      return entry.formats.map(function(f) {
        return { format: f.format || '', file: f.file || '#' };
      });
    }
    if (entry.downloadFile && (entry.format != null || entry.file != null)) {
      return [{ format: entry.format || 'Download', file: entry.downloadFile }];
    }
    return [];
  }

  var LIBRARY_LOADING_OPTIONS = {
    flashDuration: 400,
    flashCountMin: 1,
    flashCountMax: 2,
    delay: 50,
    startIndex: 7,
    stuckAt: -2
  };

  var formatDialogLoadingBarRunId = 0;

  function runFormatDialogLoadingBarLoop(container, options, runId) {
    if (runId == null) runId = ++formatDialogLoadingBarRunId;
    var opts = options || {};
    var flashDuration = opts.flashDuration !== undefined ? opts.flashDuration : 800;
    var flashCountMin = opts.flashCountMin !== undefined ? opts.flashCountMin : 2;
    var flashCountMax = opts.flashCountMax !== undefined ? opts.flashCountMax : 5;
    var delay = opts.delay !== undefined ? opts.delay : 100;
    var startIndex = opts.startIndex !== undefined ? opts.startIndex : 0;
    var segments = container.querySelectorAll('.win98-loading-bar-segment');
    var stuckAt = opts.stuckAt >= 0 ? opts.stuckAt : segments.length + (opts.stuckAt || -2);
    var currentIndex = startIndex;

    for (var i = 0; i < currentIndex && i < segments.length; i++) {
      segments[i].classList.add('visible');
    }

    function loadNextSegment() {
      if (runId !== formatDialogLoadingBarRunId) return;
      if (currentIndex === stuckAt) {
        var segment = segments[currentIndex];
        if (segment) {
          segment.classList.add('visible', 'flashing');
          return;
        }
      }
      if (currentIndex >= segments.length) {
        if (runId !== formatDialogLoadingBarRunId) return;
        for (var i = 0; i < segments.length; i++) {
          segments[i].classList.remove('visible', 'flashing');
        }
        currentIndex = startIndex;
        for (var j = 0; j < currentIndex && j < segments.length; j++) {
          segments[j].classList.add('visible');
        }
      }
      if (runId !== formatDialogLoadingBarRunId) return;
      var segment = segments[currentIndex];
      if (!segment) return;
      segment.classList.add('visible', 'flashing');
      var flashCountRange = flashCountMax - flashCountMin + 1;
      var flashCount = flashCountMin + Math.floor(Math.random() * flashCountRange);
      var totalFlashTime = flashCount * flashDuration;
      setTimeout(function() {
        if (runId !== formatDialogLoadingBarRunId) return;
        segment.classList.remove('flashing');
        currentIndex++;
        setTimeout(function() { loadNextSegment(); }, delay);
      }, totalFlashTime);
    }
    loadNextSegment();
  }

  function showLibraryFormatDialog(formats, bookTitle) {
    var dialog = document.getElementById('library-format-dialog');
    if (!dialog) return;
    var titleEl = dialog.querySelector('#library-format-dialog-title');
    var messageEl = dialog.querySelector('#library-format-dialog-message');
    var buttonsEl = dialog.querySelector('#library-format-dialog-buttons');
    var loadingEl = dialog.querySelector('.dialog-loading');
    if (!titleEl || !messageEl || !buttonsEl) return;
    titleEl.textContent = 'Choose format';
    messageEl.textContent = 'Choose a format to borrow:';
    if (loadingEl) {
      formatDialogLoadingBarRunId++;
      loadingEl.querySelectorAll('.win98-loading-bar-segment').forEach(function(seg) {
        seg.classList.remove('visible', 'flashing');
      });
      runFormatDialogLoadingBarLoop(loadingEl, LIBRARY_LOADING_OPTIONS, formatDialogLoadingBarRunId);
    }
    buttonsEl.innerHTML = '';
    var iconBase = '../assets/img/icons/';
    formats.forEach(function(f) {
      var a = document.createElement('a');
      a.href = f.file;
      a.download = downloadFilename(bookTitle, f.format);
      a.className = 'dialog-button';
      var img = document.createElement('img');
      img.src = iconBase + 'formatselect16.png';
      img.alt = '';
      img.className = 'dialog-button-icon';
      a.appendChild(img);
      a.appendChild(document.createTextNode(f.format));
      a.addEventListener('click', function(e) {
        e.preventDefault();
        triggerDownload(f.file, downloadFilename(bookTitle, f.format), hideLibraryFormatDialog);
      });
      buttonsEl.appendChild(a);
    });
    dialog.style.display = 'flex';
  }

  function hideLibraryFormatDialog() {
    formatDialogLoadingBarRunId++;
    var dialog = document.getElementById('library-format-dialog');
    if (dialog) dialog.style.display = 'none';
  }

  function showAnnexExitDialog() {
    var dialog = document.getElementById('annex-exit-dialog');
    if (dialog) dialog.style.display = 'flex';
  }

  function hideAnnexExitDialog() {
    var dialog = document.getElementById('annex-exit-dialog');
    if (dialog) dialog.style.display = 'none';
  }

  function navigateToIndex() {
    window.location.href = '../index.html';
  }

  function showLoading() {
    gridEl.style.display = 'none';
    detailEl.classList.remove('annex-detail-visible');
    rightPaneEl.classList.remove('annex-showing-detail');
    loadingEl.style.display = 'block';
    loadingEl.textContent = 'Loading...';
    errorEl.style.display = 'none';
  }

  function showError(msg) {
    gridEl.style.display = 'none';
    detailEl.classList.remove('annex-detail-visible');
    rightPaneEl.classList.remove('annex-showing-detail');
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.textContent = msg || 'Something went wrong. Try again?';
  }

  function goBack() {
    if (currentSectionLabel) {
      historyStack.push(currentSectionLabel);
      showGrid();
    }
  }

  function openSection(applet) {
    showLoading();
    fetch('sections/' + applet.file)
      .then(function(res) {
        if (!res.ok) throw new Error('Failed to load ' + applet.file);
        return res.text();
      })
      .then(function(html) {
        showDetail(html, applet);
        var slug = getSlug(applet);
        if (history.replaceState) {
          history.replaceState(null, '', location.pathname + location.search + (slug ? '#' + slug : ''));
        } else {
          location.hash = slug || '';
        }
      })
      .catch(function(err) {
        console.error('Error loading section:', err);
        showError('Couldn\'t load "' + applet.label + '". Try again?');
      });
  }

  function buildGrid() {
    gridEl.innerHTML = '';
    applets.forEach(function(applet) {
      var cell = document.createElement('a');
      cell.href = '#';
      cell.className = 'annex-grid-cell';
      cell.addEventListener('click', function(e) {
        e.preventDefault();
        openSection(applet);
      });
      var icon = document.createElement('img');
      icon.src = ICONS_BASE + applet.icon;
      icon.alt = '';
      icon.className = 'annex-grid-icon';
      var label = document.createElement('span');
      label.className = 'annex-grid-label';
      label.textContent = applet.label;
      cell.appendChild(icon);
      cell.appendChild(label);
      gridEl.appendChild(cell);
    });
    statusCountEl.textContent = applets.length + ' object(s)';
  }

  function openSectionFromHash() {
    var hash = location.hash ? location.hash.slice(1) : '';
    var applet = getAppletBySlug(hash);
    if (applet) openSection(applet);
  }

  homeBtn.addEventListener('click', showAnnexExitDialog);
  backBtn.addEventListener('click', goBack);
  aboutBtn.addEventListener('click', function() {
    var aboutApplet = applets.find(function(a) { return getSlug(a) === 'about'; });
    if (aboutApplet) openSection(aboutApplet);
  });
  backLink.addEventListener('click', function(e) {
    e.preventDefault();
    goBack();
  });

  detailContentEl.addEventListener('click', function(e) {
    if (e.target.closest('.annex-back-link')) {
      e.preventDefault();
      goBack();
    }
    if (e.target.closest('.annex-section-close')) {
      e.preventDefault();
      goBack();
    }
  });

  forwardBtn.addEventListener('click', function() {
    if (historyStack.length > 0) {
      var label = historyStack.pop();
      var applet = applets.find(function(a) { return a.label === label; });
      if (applet) openSection(applet);
    }
  });

  document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('click', function(e) {
      var dialog = document.getElementById('library-format-dialog');
      if (!dialog || dialog.style.display !== 'flex') return;
      if (e.target.id === 'library-format-dialog-close' || e.target.id === 'library-format-dialog-cancel' || e.target === dialog) {
        hideLibraryFormatDialog();
      }
    });
    var mainClose = document.getElementById('annex-main-close');
    var exitDialog = document.getElementById('annex-exit-dialog');
    var exitDialogClose = document.getElementById('annex-exit-dialog-close');
    var exitDialogYes = document.getElementById('annex-exit-dialog-yes');
    var exitDialogNo = document.getElementById('annex-exit-dialog-no');
    if (mainClose) mainClose.addEventListener('click', showAnnexExitDialog);
    if (exitDialogClose) exitDialogClose.addEventListener('click', hideAnnexExitDialog);
    if (exitDialogYes) exitDialogYes.addEventListener('click', function() {
      hideAnnexExitDialog();
      navigateToIndex();
    });
    if (exitDialogNo) exitDialogNo.addEventListener('click', hideAnnexExitDialog);
    if (exitDialog) exitDialog.addEventListener('click', function(e) {
      if (e.target === exitDialog) hideAnnexExitDialog();
    });
    fetch('index.json')
      .then(function(res) {
        if (!res.ok) throw new Error('Failed to load index.json');
        return res.json();
      })
      .then(function(data) {
        applets = Array.isArray(data) ? data : [];
        buildGrid();
        if (applets.length === 0) {
          showError('No applets yet. Check back soon!');
        } else {
          openSectionFromHash();
        }
      })
      .catch(function(err) {
        console.error('Error loading annex index:', err);
        showError('Couldn\'t load annex. Try again?');
      });
  });

  window.addEventListener('hashchange', function() {
    var hash = location.hash ? location.hash.slice(1) : '';
    if (!hash) {
      showGrid();
      return;
    }
    var applet = getAppletBySlug(hash);
    if (!applet) return;
    var currentApplet = currentSectionLabel ? applets.find(function(a) { return a.label === currentSectionLabel; }) : null;
    if (currentApplet && getSlug(currentApplet) === hash) return;
    openSection(applet);
  });
})();
