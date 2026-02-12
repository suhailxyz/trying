(function() {
  const gridEl = document.getElementById('annex-grid');
  const detailEl = document.getElementById('annex-detail');
  const detailContentEl = document.getElementById('annex-detail-content');
  const rightPaneEl = document.getElementById('annex-right-pane');
  const contentAreaEl = document.querySelector('.annex-content-area');
  const leftPanelExtraEl = document.getElementById('annex-left-panel-extra');
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
  const leftPanelEl = document.getElementById('annex-left-panel');
  const leftPanelToggleEl = document.getElementById('annex-left-panel-toggle');

  const ICONS_BASE = '../assets/img/icons/';

  const MOBILE_LEFT_PANEL_AUTOHIDE_MS = 4000;
  var mobileLeftPanelAutohideTimer = null;

  let applets = [];
  let currentSectionLabel = null;
  let historyStack = [];
  let sectionWindowHtmlCache = null;
  var libraryScriptLoaded = false;
  var carsScriptLoaded = false;
  var shareScriptLoaded = false;

  function getSlug(applet) {
    var f = applet.contentFile;
    return f && f.indexOf('/') >= 0 ? f.split('/')[0] : (f ? f.replace(/\.html?$/i, '') : '');
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
    if (leftPanelExtraEl) leftPanelExtraEl.innerHTML = '';
    var programWindowTitle = applet ? applet.programWindowTitle : null;
    gridEl.style.display = 'none';
    detailContentEl.innerHTML = html;
    detailEl.classList.add('annex-detail-visible');
    rightPaneEl.classList.add('annex-showing-detail');
    loadingEl.style.display = 'none';
    errorEl.style.display = 'none';
    addressValueEl.textContent = programWindowTitle ? 'Annex - ' + programWindowTitle : 'Annex';
    statusLocationEl.textContent = programWindowTitle || 'Annex';
    currentSectionLabel = programWindowTitle;
    var gridIcon = applet && applet.gridIcon;
    var programWindowIcon = applet && (applet.programWindowIcon || applet.gridIcon);
    var infoPanelTitle = applet && applet.infoPanelTitle;
    var infoPanelDesc = applet && applet.infoPanelDesc;
    if (applet && (infoPanelTitle || infoPanelDesc)) {
      setLeftPanel(infoPanelTitle || programWindowTitle, infoPanelDesc, gridIcon || null);
    } else {
      setLeftPanel(programWindowTitle, 'Select an item to view its description.', applet ? gridIcon : null);
    }

    /* Fill shared section window chrome from applet */
    var titleIcon = detailContentEl.querySelector('#annex-section-title-icon');
    if (titleIcon && applet) titleIcon.src = ICONS_BASE + (programWindowIcon || 'annex.png');
    var titleText = detailContentEl.querySelector('#annex-section-title-text');
    if (titleText && applet) titleText.textContent = programWindowTitle || '';
    var subjectEl = detailContentEl.querySelector('.annex-subject');
    if (subjectEl && applet) subjectEl.textContent = infoPanelTitle || programWindowTitle || '';
    var sectionHeaderDesc = applet && applet.sectionHeaderDesc;
    if (sectionHeaderDesc) {
      var programDescEl = detailContentEl.querySelector('.annex-program-desc');
      if (programDescEl) programDescEl.textContent = sectionHeaderDesc;
    }

    detailContentEl.querySelectorAll('img[src^="../../"]').forEach(function(img) {
      img.src = img.src.replace('../../', '../');
    });

    if (applet && getSlug(applet) === 'library') {
      function runLibraryInit() {
        if (window.AnnexLibraryInit) window.AnnexLibraryInit(detailContentEl);
      }
      if (libraryScriptLoaded) {
        runLibraryInit();
      } else {
        var script = document.createElement('script');
        script.src = 'sections/library/library.js';
        script.onload = function() {
          libraryScriptLoaded = true;
          runLibraryInit();
        };
        document.head.appendChild(script);
      }
    }

    if (applet && getSlug(applet) === 'cars') {
      function runCarsInit() {
        if (window.AnnexCarsInit) window.AnnexCarsInit(detailContentEl);
      }
      if (carsScriptLoaded) {
        runCarsInit();
      } else {
        var script = document.createElement('script');
        script.src = 'sections/cars/cars.js';
        script.onload = function() {
          carsScriptLoaded = true;
          runCarsInit();
        };
        document.head.appendChild(script);
      }
    }

    if (applet && getSlug(applet) === 'share') {
      function runShareInit() {
        if (window.AnnexShareInit) window.AnnexShareInit(detailContentEl);
      }
      function loadShareScript() {
        var script = document.createElement('script');
        script.src = 'sections/share/share.js';
        script.onload = function() {
          shareScriptLoaded = true;
          runShareInit();
        };
        document.head.appendChild(script);
      }
      if (shareScriptLoaded) {
        runShareInit();
      } else if (window.JSZip) {
        loadShareScript();
      } else {
        var jszip = document.createElement('script');
        jszip.src = 'https://cdn.jsdelivr.net/npm/jszip@3/dist/jszip.min.js';
        jszip.onload = loadShareScript;
        document.head.appendChild(jszip);
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
    var wrapperPromise = sectionWindowHtmlCache
      ? Promise.resolve(sectionWindowHtmlCache)
      : fetch('sections/section-window.html').then(function(res) {
          if (!res.ok) throw new Error('Failed to load section window');
          return res.text();
        }).then(function(html) {
          sectionWindowHtmlCache = html;
          return html;
        });
    var contentFile = applet.contentFile;
    var contentPromise = fetch('sections/' + contentFile).then(function(res) {
      if (!res.ok) throw new Error('Failed to load ' + contentFile);
      return res.text();
    });
    Promise.all([wrapperPromise, contentPromise])
      .then(function(results) {
        var wrapperHtml = results[0];
        var contentHtml = results[1];
        var wrapDiv = document.createElement('div');
        wrapDiv.innerHTML = wrapperHtml;
        var slot = wrapDiv.querySelector('#annex-section-body');
        if (slot) slot.innerHTML = contentHtml;
        showDetail(wrapDiv.innerHTML, applet);
        var slug = getSlug(applet);
        var hashPart = (location.hash && location.hash.indexOf('/') !== -1 && slug === 'share')
          ? location.hash.slice(1)
          : (slug || '');
        if (history.replaceState) {
          history.replaceState(null, '', location.pathname + location.search + (hashPart ? '#' + hashPart : ''));
        } else {
          location.hash = hashPart || '';
        }
      })
      .catch(function(err) {
        console.error('Error loading section:', err);
        showError('Couldn\'t load "' + applet.programWindowTitle + '". Try again?');
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
      var iconPath = applet.gridIcon ? (ICONS_BASE + applet.gridIcon) : (ICONS_BASE + 'annex.png');
      var icon = document.createElement('img');
      icon.src = iconPath;
      icon.alt = '';
      icon.className = 'annex-grid-icon';
      var labelEl = document.createElement('span');
      labelEl.className = 'annex-grid-label';
      labelEl.textContent = applet.gridLabel || applet.infoPanelTitle || applet.programWindowTitle;
      cell.appendChild(icon);
      cell.appendChild(labelEl);
      gridEl.appendChild(cell);
    });
    statusCountEl.textContent = applets.length + ' object(s)';
  }

  function openSectionFromHash() {
    var hash = location.hash ? location.hash.slice(1) : '';
    var slug = hash.split('/')[0] || '';
    var applet = getAppletBySlug(slug);
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

  function doForward() {
    if (historyStack.length > 0) {
      var programWindowTitle = historyStack.pop();
      var applet = applets.find(function(a) { return a.programWindowTitle === programWindowTitle; });
      if (applet) openSection(applet);
    }
  }

  if (contentAreaEl) {
    contentAreaEl.addEventListener('click', function(e) {
      if (e.target.closest('.annex-back-link')) {
        e.preventDefault();
        goBack();
      }
      if (e.target.closest('.annex-forward-btn')) {
        e.preventDefault();
        doForward();
      }
    });
  }

  detailContentEl.addEventListener('click', function(e) {
    if (e.target.closest('.annex-section-close')) {
      e.preventDefault();
      goBack();
    }
  });

  forwardBtn.addEventListener('click', doForward);

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

    function clearMobileLeftPanelAutohide() {
      if (mobileLeftPanelAutohideTimer !== null) {
        clearTimeout(mobileLeftPanelAutohideTimer);
        mobileLeftPanelAutohideTimer = null;
      }
    }

    function startMobileLeftPanelAutohide() {
      clearMobileLeftPanelAutohide();
      if (!leftPanelEl || !window.matchMedia('(max-width: 768px)').matches) return;
      mobileLeftPanelAutohideTimer = setTimeout(function() {
        leftPanelEl.classList.add('annex-left-panel-collapsed');
        mobileLeftPanelAutohideTimer = null;
        if (leftPanelToggleEl) {
          leftPanelToggleEl.classList.remove('annex-left-panel-toggle-open');
          leftPanelToggleEl.setAttribute('aria-expanded', 'false');
        }
      }, MOBILE_LEFT_PANEL_AUTOHIDE_MS);
    }

    function setMobileLeftPanelCollapsed(collapsed) {
      if (!leftPanelEl) return;
      if (collapsed) {
        clearMobileLeftPanelAutohide();
        leftPanelEl.classList.add('annex-left-panel-collapsed');
      } else {
        leftPanelEl.classList.remove('annex-left-panel-collapsed');
        startMobileLeftPanelAutohide();
      }
      if (leftPanelToggleEl) {
        leftPanelToggleEl.classList.toggle('annex-left-panel-toggle-open', !collapsed);
        leftPanelToggleEl.setAttribute('aria-expanded', !collapsed);
      }
    }

    if (leftPanelToggleEl && leftPanelEl) {
      leftPanelToggleEl.addEventListener('click', function() {
        if (!window.matchMedia('(max-width: 768px)').matches) return;
        var isCollapsed = leftPanelEl.classList.contains('annex-left-panel-collapsed');
        setMobileLeftPanelCollapsed(!isCollapsed);
      });

      window.matchMedia('(max-width: 768px)').addEventListener('change', function(mq) {
        if (!mq.matches) {
          clearMobileLeftPanelAutohide();
          leftPanelEl.classList.remove('annex-left-panel-collapsed');
          if (leftPanelToggleEl) {
            leftPanelToggleEl.classList.remove('annex-left-panel-toggle-open');
            leftPanelToggleEl.setAttribute('aria-expanded', 'false');
          }
        }
      });

      if (window.matchMedia('(max-width: 768px)').matches) {
        startMobileLeftPanelAutohide();
      }
    }

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
    var slug = hash.split('/')[0] || '';
    var applet = getAppletBySlug(slug);
    if (!applet) return;
    var currentApplet = currentSectionLabel ? applets.find(function(a) { return a.programWindowTitle === currentSectionLabel; }) : null;
    if (currentApplet && getSlug(currentApplet) === slug) return;
    openSection(applet);
  });

  window.AnnexUtils = { escapeHtml: escapeHtml, downloadFilename: downloadFilename, normalizeFormats: normalizeFormats, triggerDownload: triggerDownload, isExternalUrl: isExternalUrl };
  window.showLibraryFormatDialog = showLibraryFormatDialog;
  window.hideLibraryFormatDialog = hideLibraryFormatDialog;
})();
