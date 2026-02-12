/**
 * Share section: loads share.json, shows folder list then image list (file explorer view),
 * and a Win98-style image viewer with details panel and thumbnail strip.
 * Uses window.AnnexUtils from annex.js.
 */
(function() {
  var Utils = window.AnnexUtils;
  if (!Utils) return;

  var ICONS_BASE = '../assets/img/icons/';
  var SHARE_IMAGES_PREFIX = '../assets/files/share';

  var IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp)$/i;

  function getFileTypeLabel(name) {
    if (!name) return 'Unknown';
    var ext = name.split('.').pop().toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg') return 'JPEG image';
    if (ext === 'png') return 'PNG image';
    if (ext === 'gif') return 'GIF image';
    if (ext === 'webp') return 'WebP image';
    return ext ? ext.toUpperCase() + ' image' : 'Unknown';
  }

  function isImageFilename(name) {
    return typeof name === 'string' && IMAGE_EXTENSIONS.test(name);
  }

  function init(container) {
    if (!container || !container.querySelector) return;
    var sectionEl = container.querySelector('.annex-section');
    if (sectionEl) sectionEl.classList.add('annex-share-open');
    var listEl = container.querySelector('#share-list');
    var contentPanel = container.querySelector('#share-content-panel');
    var galleryView = container.querySelector('#share-gallery-view');
    var viewerImage = container.querySelector('#share-viewer-image');
    var viewerTitle = container.querySelector('#share-viewer-title');
    var viewerDownloadAll = container.querySelector('#share-viewer-download-all');
    var viewerDownload = container.querySelector('#share-viewer-download');
    var detailType = container.querySelector('#share-detail-type');
    var detailDimensions = container.querySelector('#share-detail-dimensions');
    var detailSize = container.querySelector('#share-detail-size');
    var detailDate = container.querySelector('#share-detail-date');
    var thumbsStatus = container.querySelector('#share-thumbs-status');
    var thumbsStrip = container.querySelector('#share-viewer-thumbs-strip');
    var prevBtn = container.querySelector('#share-viewer-prev');
    var nextBtn = container.querySelector('#share-viewer-next');
    var addressPathEl = container.querySelector('#share-address-path');
    var statusLeftEl = container.querySelector('#share-status-left');
    var statusRightEl = container.querySelector('#share-status-right');
    var treeEl = container.querySelector('#share-tree');
    var downloadAllDialog = container.querySelector('#share-download-all-dialog');
    var downloadAllDialogClose = container.querySelector('#share-download-all-dialog-close');
    var downloadAllDialogYes = container.querySelector('#share-download-all-dialog-yes');
    var downloadAllDialogNo = container.querySelector('#share-download-all-dialog-no');
    var downloadAllDialogMessage = container.querySelector('#share-download-all-dialog-message');
    var menuReturnBtn = container.querySelector('#share-menu-return');
    if (!listEl || !galleryView || !viewerImage || !treeEl) return;

    var currentFolder = null;
    var currentPath = [];
    var rootItems = [];
    var currentViewerImages = [];
    var currentViewerIndex = 0;
    var selectedTreeNode = null; /* 'root' | folder item */
    var unlockedProtectedFolders = new Set();
    var expandedTreePaths = new Set(); /* path strings e.g. "Inka's..." or "Inka's...|Kodak Moments" */
    var shareBackHistory = [];   /* folder navigation within Share */
    var shareForwardStack = [];

    function showPasswordDialog(folderName, expectedPassword, callback) {
      var overlay = document.createElement('div');
      overlay.className = 'share-password-overlay';
      var box = document.createElement('div');
      box.className = 'share-password-dialog';
      box.innerHTML =
        '<div class="share-password-title"><img src="' + ICONS_BASE + 'locked16.png" alt="" class="share-password-title-icon">Protected Folder</div>' +
        '<div class="share-password-body">' +
          '<label class="share-password-label">Enter password for "' + Utils.escapeHtml(folderName) + '":</label>' +
          '<input type="password" class="share-password-input" autocomplete="off" placeholder="Password">' +
          '<div class="share-password-buttons">' +
            '<button type="button" class="share-password-btn share-password-ok">OK</button>' +
            '<button type="button" class="share-password-btn share-password-cancel">Cancel</button>' +
          '</div>' +
        '</div>';
      overlay.appendChild(box);
      var explorer = container.querySelector('.share-explorer');
      (explorer || container).appendChild(overlay);
      var input = box.querySelector('.share-password-input');
      var finish = function(ok) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        callback(!!ok);
      };
      var trySubmit = function() {
        var value = (input.value || '').trim();
        if (value === expectedPassword) {
          finish(true);
        } else {
          input.select();
          input.placeholder = 'Wrong password';
        }
      };
      box.querySelector('.share-password-ok').addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        trySubmit();
      });
      box.querySelector('.share-password-cancel').addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      });
      box.addEventListener('click', function(e) { e.stopPropagation(); });
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) finish(false);
      });
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          trySubmit();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          finish(false);
        }
      });
      input.focus();
    }

    function isFolderProtected(folder) {
      return !!(folder && folder.protected && typeof folder.password === 'string' && folder.password.length > 0);
    }

    function tryOpenProtectedFolder(folder, onSuccess) {
      if (!isFolderProtected(folder) || unlockedProtectedFolders.has(folder.name)) {
        onSuccess();
        return;
      }
      showPasswordDialog(folder.name, folder.password, function(ok) {
        if (ok) {
          unlockedProtectedFolders.add(folder.name);
          onSuccess();
        }
      });
    }

    function setPathFromRoot(items, pathSoFar) {
      if (!Array.isArray(items)) return;
      pathSoFar = pathSoFar || [];
      items.forEach(function(item) {
        if (item.type === 'folder') {
          item._pathFromRoot = pathSoFar.concat([item.name]);
          setPathFromRoot(item.children, item._pathFromRoot);
        }
      });
    }

    function getFolderItems(folder, callback) {
      var children = folder.children || [];
      var subfolders = children.filter(function(x) { return x.type === 'folder'; });
      var images = children.filter(function(x) { return x.type === 'image'; });
      callback(subfolders.concat(images));
    }

    function showList() {
      if (galleryView) galleryView.style.display = 'none';
      if (contentPanel) contentPanel.style.display = '';
    }

    function formatFileSize(bytes) {
      if (typeof bytes !== 'number' || bytes < 0) return null;
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function formatModifiedDate(isoString) {
      if (typeof isoString !== 'string' || !isoString) return null;
      try {
        var d = new Date(isoString);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      } catch (_) {
        return null;
      }
    }

    function updateDetails(name, path, item) {
      if (detailType) detailType.textContent = getFileTypeLabel(name || '');
      if (detailDimensions) detailDimensions.textContent = '—';
      if (detailSize) detailSize.textContent = (item && formatFileSize(item.size)) || '—';
      if (detailDate) detailDate.textContent = (item && formatModifiedDate(item.mtime)) || '—';
    }

    function scrollThumbIntoView(index, immediate) {
      if (!thumbsStrip) return;
      var thumbs = thumbsStrip.querySelectorAll('.share-thumb');
      var el = thumbs[index];
      if (!el) return;
      el.scrollIntoView({
        behavior: immediate ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }

    function updateViewerToIndex(i, immediateScroll) {
      var n = currentViewerImages.length;
      if (n === 0) return;
      i = Math.max(0, Math.min(i, n - 1));
      currentViewerIndex = i;
      var item = currentViewerImages[i];
      var path = item.path || '#';
      var name = item.name || 'image';

      viewerImage.decoding = 'async';
      viewerImage.src = path;
      viewerTitle.textContent = name;
      updateDetails(name, path, item);

      viewerImage.onload = function() {
        var w = viewerImage.naturalWidth;
        var h = viewerImage.naturalHeight;
        if (detailDimensions) detailDimensions.textContent = (w && h) ? w + ' \u00D7 ' + h : '—';
      };
      viewerImage.onerror = function() {
        if (detailDimensions) detailDimensions.textContent = '—';
      };

      if (thumbsStatus) thumbsStatus.textContent = 'Image ' + (i + 1) + ' of ' + n;
      var thumbs = thumbsStrip ? thumbsStrip.querySelectorAll('.share-thumb') : [];
      for (var t = 0; t < thumbs.length; t++) {
        thumbs[t].classList.toggle('share-thumb-selected', t === i);
      }
      scrollThumbIntoView(i, !!immediateScroll);
      updateShareHash();
    }

    function renderThumbnails() {
      if (!thumbsStrip) return;
      thumbsStrip.innerHTML = '';
      var n = currentViewerImages.length;
      for (var i = 0; i < n; i++) {
        (function(idx) {
          var item = currentViewerImages[idx];
          var path = item.path || '#';
          var name = item.name || 'image';
          var wrap = document.createElement('button');
          wrap.type = 'button';
          wrap.className = 'share-thumb' + (idx === currentViewerIndex ? ' share-thumb-selected' : '');
          var img = document.createElement('img');
          img.loading = 'lazy';
          img.src = path;
          img.alt = name;
          img.className = 'share-thumb-img';
          wrap.appendChild(img);
          wrap.addEventListener('click', function() {
            updateViewerToIndex(idx);
          });
          thumbsStrip.appendChild(wrap);
        })(i);
      }
    }

    function showViewer(imageItems, index) {
      currentViewerImages = Array.isArray(imageItems) ? imageItems.slice() : [];
      currentViewerIndex = Math.max(0, Math.min(index || 0, Math.max(0, currentViewerImages.length - 1)));
      if (contentPanel) contentPanel.style.display = 'none';
      if (galleryView) galleryView.style.display = 'flex';
      renderThumbnails();
      updateViewerToIndex(currentViewerIndex, true);
      if (prevBtn) prevBtn.style.display = currentViewerImages.length > 1 ? 'inline-flex' : 'none';
      if (nextBtn) nextBtn.style.display = currentViewerImages.length > 1 ? 'inline-flex' : 'none';
      updateExplorerStatus(currentViewerImages);
      updateShareHash();
    }

    function hideViewer() {
      if (galleryView) galleryView.style.display = 'none';
      if (contentPanel) contentPanel.style.display = '';
      currentViewerImages = [];
      currentViewerIndex = 0;
      updateShareHash();
    }

    function updateExplorerStatus(items) {
      if (statusLeftEl) statusLeftEl.textContent = (items ? items.length : 0) + ' object(s)';
      if (statusRightEl) statusRightEl.textContent = getDisplayPathString();
      renderAddressBar();
    }

    function treePath(folder) {
      return (folder && folder._pathFromRoot) ? folder._pathFromRoot.join('\u001f') : '';
    }

    /** Given an array of folder names from root, returns the folder object at that path or null. */
    function getFolderAtPath(pathNames) {
      if (!Array.isArray(pathNames) || pathNames.length === 0) return null;
      var items = rootItems;
      var folder = null;
      for (var i = 0; i < pathNames.length; i++) {
        var name = pathNames[i];
        folder = (items || []).find(function(x) { return x.type === 'folder' && x.name === name; });
        if (!folder) return null;
        items = folder.children;
      }
      return folder;
    }

    /** Build current state as path segments for the hash (folder path or folder path + image name). */
    function getCurrentDeeplinkPath() {
      if (galleryView && galleryView.style.display !== 'none' && currentViewerImages.length > 0 && currentFolder) {
        var path = currentFolder._pathFromRoot ? currentFolder._pathFromRoot.slice() : [];
        var item = currentViewerImages[currentViewerIndex];
        if (item && item.name) path.push(item.name);
        return path;
      }
      if (currentFolder && currentFolder._pathFromRoot) return currentFolder._pathFromRoot.slice();
      return [];
    }

    /** Parse hash into path segments (after "share/"). Returns [] if not a share deeplink. */
    function parseShareHash() {
      var hash = location.hash ? location.hash.slice(1) : '';
      if (hash.indexOf('share') !== 0) return null;
      var rest = hash.length > 5 && hash.charAt(5) === '/' ? hash.slice(6) : (hash === 'share' ? '' : null);
      if (rest === null) return null;
      if (!rest) return [];
      return rest.split('/').map(function(s) { return decodeURIComponent(s); });
    }

    /** Navigate and optionally open viewer from current location.hash. Call after share.json is loaded. */
    function applyDeeplinkFromHash() {
      var segments = parseShareHash();
      if (segments === null) return;
      var current = getCurrentDeeplinkPath();
      if (current.length === segments.length && current.every(function(s, i) { return segments[i] === s; })) return;
      if (segments.length === 0) {
        setTreeSelection('root');
        currentFolder = null;
        currentPath = [];
        renderTree();
        renderList(rootItems);
        renderAddressBar();
        updateShareNavButtons();
        updateExplorerStatus(rootItems);
        return;
      }
      var pathNames = segments;
      var imageName = null;
      if (segments.length > 0 && isImageFilename(segments[segments.length - 1])) {
        imageName = segments.pop();
        pathNames = segments;
      }
      if (pathNames.length === 0 && imageName) {
        return;
      }
      var folder = pathNames.length > 0 ? getFolderAtPath(pathNames) : null;
      if (pathNames.length > 0 && !folder) return;
      if (pathNames.length === 0) {
        setTreeSelection('root');
        currentFolder = null;
        currentPath = [];
        renderTree();
        renderList(rootItems);
        renderAddressBar();
        updateShareNavButtons();
        updateExplorerStatus(rootItems);
        return;
      }
      currentPath = [];
      for (var j = 1; j <= pathNames.length; j++) {
        var f = getFolderAtPath(pathNames.slice(0, j));
        if (f) {
          currentPath.push(f);
          expandedTreePaths.add(treePath(f));
        }
      }
      currentFolder = folder;
      setTreeSelection(folder);
      renderTree();
      renderAddressBar();
      updateShareNavButtons();
      if (imageName) {
        function openViewerAtImage() {
          var images = getFolderImages(currentFolder);
          var idx = -1;
          for (var k = 0; k < images.length; k++) {
            if (images[k].name === imageName) { idx = k; break; }
          }
          if (idx >= 0) {
            updateExplorerStatus(images);
            showViewer(images, idx);
          } else {
            getFolderItems(currentFolder, function(items) {
              renderList(items);
              updateExplorerStatus(items);
            });
          }
        }
        if (isFolderProtected(folder) && !unlockedProtectedFolders.has(folder.name)) {
          tryOpenProtectedFolder(folder, function() {
            unlockedProtectedFolders.add(folder.name);
            openViewerAtImage();
          });
        } else {
          openViewerAtImage();
        }
      } else {
        getFolderItems(folder, function(items) {
          renderList(items);
          updateExplorerStatus(items);
        });
      }
    }

    /** Update location hash to current folder/viewer state (for shareable deeplinks). */
    function updateShareHash() {
      var path = getCurrentDeeplinkPath();
      var hashPart = 'share';
      if (path.length > 0) {
        hashPart = 'share/' + path.map(function(s) { return encodeURIComponent(s); }).join('/');
      }
      var url = location.pathname + location.search + (hashPart ? '#' + hashPart : '');
      if (history.replaceState) history.replaceState(null, '', url);
      else location.hash = hashPart || '';
    }

    function getFullPathLabels() {
      return currentFolder && currentFolder._pathFromRoot && currentFolder._pathFromRoot.length > 0
        ? ['Share://'].concat(currentFolder._pathFromRoot)
        : ['Share://'];
    }

    var MAX_PATH_SEGMENT_LENGTH = 16;

    /** Returns path string with each segment shortened (same as address bar segments). */
    function getDisplayPathString() {
      var labels = getFullPathLabels();
      if (!labels || labels.length === 0) return 'Share://';
      return labels.map(function(label) {
        return label.length > MAX_PATH_SEGMENT_LENGTH
          ? label.slice(0, MAX_PATH_SEGMENT_LENGTH) + '\u2026'
          : label;
      }).join(' \u203A ');
    }

    function navigateToAddressSegment(index) {
      if (galleryView && galleryView.style.display !== 'none') hideViewer();
      showList();
      pushCurrentToBackHistory();
      if (index === 0) {
        setTreeSelection('root');
        currentFolder = null;
        currentPath = [];
        renderList(rootItems);
        updateExplorerStatus(rootItems);
        renderAddressBar();
        updateShareNavButtons();
        updateShareHash();
        return;
      }
      var pathNames = currentFolder && currentFolder._pathFromRoot ? currentFolder._pathFromRoot.slice(0, index) : [];
      if (pathNames.length === 0) return;
      var folder = getFolderAtPath(pathNames);
      if (!folder) return;
      currentPath = [];
      for (var j = 1; j <= pathNames.length; j++) {
        var f = getFolderAtPath(pathNames.slice(0, j));
        if (f) currentPath.push(f);
      }
      currentFolder = folder;
      setTreeSelection(folder);
      expandedTreePaths.add(treePath(folder));
      renderTree();
      getFolderItems(folder, function(items) {
        renderList(items);
        updateExplorerStatus(items);
        renderAddressBar();
        updateShareNavButtons();
        updateShareHash();
      });
    }

    function renderAddressBar() {
      if (!addressPathEl) return;
      var labels = getFullPathLabels();
      if (!labels || labels.length === 0) labels = ['Share://'];
      addressPathEl.innerHTML = '';
      var pathWrap = addressPathEl.closest('.share-address-path-wrap');
      labels.forEach(function(label, index) {
        if (index > 0) {
          var sep = document.createElement('span');
          sep.className = 'share-address-chevron';
          sep.setAttribute('aria-hidden', 'true');
          sep.textContent = ' \u203A ';
          addressPathEl.appendChild(sep);
        }
        var displayLabel = label.length > MAX_PATH_SEGMENT_LENGTH
          ? label.slice(0, MAX_PATH_SEGMENT_LENGTH) + '\u2026'
          : label;
        var isCurrent = index === labels.length - 1;
        var seg = document.createElement('span');
        seg.className = 'share-address-segment' + (isCurrent ? ' share-address-segment-current' : '');
        seg.setAttribute('data-segment-index', String(index));
        if (displayLabel !== label) seg.title = label;
        var icon = document.createElement('img');
        icon.src = isCurrent ? ICONS_BASE + 'openfolder16.png' : ICONS_BASE + 'folder16.png';
        icon.alt = '';
        icon.className = 'share-address-folder-icon';
        icon.setAttribute('aria-hidden', 'true');
        seg.appendChild(icon);
        seg.appendChild(document.createTextNode(displayLabel));
        addressPathEl.appendChild(seg);
      });
      if (pathWrap && !pathWrap._addressBarClickBound) {
        pathWrap._addressBarClickBound = true;
        pathWrap.addEventListener('click', function(e) {
          var seg = e.target.closest('.share-address-segment');
          if (!seg || seg.classList.contains('share-address-segment-current')) return;
          var idx = seg.getAttribute('data-segment-index');
          if (idx === null || idx === '') return;
          var i = parseInt(idx, 10);
          if (i !== i) return;
          e.preventDefault();
          e.stopPropagation();
          navigateToAddressSegment(i);
        });
      }
    }

    function getFolderIcon(folder) {
      if (!folder) return ICONS_BASE + 'folder16.png';
      if (selectedTreeNode === folder) return ICONS_BASE + 'openfolder16.png';
      if (isFolderProtected(folder) && !unlockedProtectedFolders.has(folder.name)) return ICONS_BASE + 'protectedfolder16.png';
      return ICONS_BASE + 'folder16.png';
    }

    function setTreeSelection(node) {
      selectedTreeNode = node;
      if (!treeEl) return;
      treeEl.querySelectorAll('.share-tree-node').forEach(function(n) {
        var isRoot = n.getAttribute('data-node') === 'root';
        var item = n._folderItem;
        var selected = (node === 'root' && isRoot) || (node && item === node);
        n.classList.toggle('share-tree-node-selected', !!selected);
      });
    }

    function renderTreeFolder(folder, parentEl) {
      var subfolders = (folder.children || []).filter(function(x) { return x.type === 'folder'; });
      var protectedAndLocked = isFolderProtected(folder) && !unlockedProtectedFolders.has(folder.name);
      var canExpand = subfolders.length > 0 && !protectedAndLocked;
      var path = treePath(folder);
      var isExpanded = canExpand && (expandedTreePaths.has(path) || selectedTreeNode === folder || (currentPath && currentPath.indexOf(folder) !== -1));
      if (canExpand && isExpanded) expandedTreePaths.add(path);
      var wrap = document.createElement('div');
      wrap.className = 'share-tree-node' + (selectedTreeNode === folder ? ' share-tree-node-selected' : '') +
        (canExpand && !isExpanded ? ' share-tree-collapsed' : '');
      wrap.setAttribute('data-folder', folder.name);
      wrap._folderItem = folder;
      var expandHtml = canExpand
        ? '<span class="share-tree-expand share-tree-expand-open">−</span><span class="share-tree-expand share-tree-expand-closed">+</span>'
        : '<span class="share-tree-expand share-tree-leaf" aria-hidden="true">◦</span>';
      wrap.innerHTML = '<span class="share-tree-indent"></span>' + expandHtml + '<img src="' + getFolderIcon(folder) + '" alt="" class="share-tree-icon"><span class="share-tree-label">' + Utils.escapeHtml(folder.name) + '</span>';
      parentEl.appendChild(wrap);
      if (canExpand && isExpanded) {
        var childrenWrap = document.createElement('div');
        childrenWrap.className = 'share-tree-children';
        subfolders.forEach(function(sub) { renderTreeFolder(sub, childrenWrap); });
        parentEl.appendChild(childrenWrap);
      }
    }

    function renderTree() {
      if (!treeEl) return;
      if (selectedTreeNode && selectedTreeNode !== 'root' && selectedTreeNode._pathFromRoot) {
        for (var i = 1; i <= selectedTreeNode._pathFromRoot.length; i++) {
          expandedTreePaths.add(selectedTreeNode._pathFromRoot.slice(0, i).join('\u001f'));
        }
      }
      treeEl.innerHTML = '';
      var rootNode = document.createElement('div');
      rootNode.className = 'share-tree-node' + (selectedTreeNode === 'root' ? ' share-tree-node-selected' : '');
      rootNode.setAttribute('data-node', 'root');
      rootNode.innerHTML = '<span class="share-tree-expand share-tree-expand-open">−</span><img src="' + (selectedTreeNode === 'root' ? ICONS_BASE + 'openfolder16.png' : ICONS_BASE + 'folder16.png') + '" alt="" class="share-tree-icon"><span class="share-tree-label">Share://</span>';
      treeEl.appendChild(rootNode);
      var childrenWrap = document.createElement('div');
      childrenWrap.className = 'share-tree-children';
      rootItems.forEach(function(item) {
        if (item.type !== 'folder') return;
        renderTreeFolder(item, childrenWrap);
      });
      treeEl.appendChild(childrenWrap);
    }

    function folderIsUnlocked(folder) {
      return !folder || !isFolderProtected(folder) || unlockedProtectedFolders.has(folder.name);
    }

    function getFolderImages(folder) {
      if (!folder) return [];
      if (folder._loadedImages && folder._loadedImages.length > 0) return folder._loadedImages;
      return (folder.children || []).filter(function(x) { return x.type === 'image'; });
    }

    function getFirstDownloadableImage() {
      if (currentViewerImages.length > 0) {
        var item = currentViewerImages[currentViewerIndex];
        return (item && item.path && item.name) ? item : null;
      }
      if (currentFolder && folderIsUnlocked(currentFolder)) {
        var images = getFolderImages(currentFolder);
        var first = images[0];
        return (first && first.path && first.name) ? first : null;
      }
      if (rootItems.length > 0) {
        for (var i = 0; i < rootItems.length; i++) {
          var folder = rootItems[i];
          if (!folderIsUnlocked(folder)) continue;
          var images = getFolderImages(folder);
          if (images.length > 0 && images[0].path && images[0].name) return images[0];
        }
      }
      return null;
    }

    function getCurrentFolderImages() {
      if (!currentFolder || !folderIsUnlocked(currentFolder)) return [];
      return getFolderImages(currentFolder);
    }


    var addressBackBtn = container.querySelector('#share-address-back');
    var addressForwardBtn = container.querySelector('#share-address-forward');

    function getCurrentState() {
      var inViewer = galleryView && galleryView.style.display !== 'none' && currentViewerImages.length > 0;
      return {
        folder: currentFolder,
        path: currentPath.slice(),
        inViewer: inViewer,
        viewerImages: inViewer ? currentViewerImages.slice() : [],
        viewerIndex: inViewer ? currentViewerIndex : 0
      };
    }

    function pushCurrentToBackHistory() {
      shareBackHistory.push(getCurrentState());
      shareForwardStack = [];
    }

    function updateShareNavButtons() {
      var back = container.querySelector('#share-address-back');
      var fwd = container.querySelector('#share-address-forward');
      if (back) back.disabled = shareBackHistory.length === 0;
      if (fwd) fwd.disabled = shareForwardStack.length === 0;
    }

    function restoreFolderState(state) {
      currentFolder = state.folder;
      currentPath = state.path ? state.path.slice() : [];
      if (state.inViewer && state.viewerImages && state.viewerImages.length > 0) {
        if (currentFolder === null) {
          setTreeSelection('root');
        } else {
          setTreeSelection(currentFolder);
          expandedTreePaths.add(treePath(currentFolder));
          renderTree();
        }
        renderAddressBar();
        updateExplorerStatus(state.viewerImages);
        showViewer(state.viewerImages, state.viewerIndex);
      } else {
        showList();
        if (currentFolder === null) {
          setTreeSelection('root');
          renderList(rootItems);
          updateExplorerStatus(rootItems);
        } else {
          setTreeSelection(currentFolder);
          expandedTreePaths.add(treePath(currentFolder));
          renderTree();
          getFolderItems(currentFolder, function(items) {
            renderList(items);
            updateExplorerStatus(items);
          });
        }
        renderAddressBar();
      }
      updateShareNavButtons();
      updateShareHash();
    }

    function shareGoBack() {
      if (shareBackHistory.length === 0) return;
      var state = shareBackHistory.pop();
      shareForwardStack.push(getCurrentState());
      restoreFolderState(state);
    }

    function shareGoForward() {
      if (shareForwardStack.length === 0) return;
      var state = shareForwardStack.pop();
      shareBackHistory.push(getCurrentState());
      restoreFolderState(state);
    }

    function renderList(items) {
      listEl.innerHTML = '';
      if (!Array.isArray(items)) return;
      updateExplorerStatus(items);
      var imageItems = items.filter(function(x) { return x.type === 'image'; });
      items.forEach(function(item) {
        var row = document.createElement('div');
        row.className = 'share-row share-row-' + (item.type || 'file');
        if (item.type === 'folder') {
          var children = item.children || [];
          var numItems = children.length;
          var allFolders = numItems > 0 && children.every(function(x) { return x.type === 'folder'; });
          var countText = allFolders
            ? (numItems === 1 ? '1 folder' : numItems + ' folders')
            : (numItems === 1 ? '1 item' : numItems + ' items');
          row.innerHTML =
            '<img src="' + getFolderIcon(item) + '" alt="" class="share-row-icon">' +
            '<span class="share-row-name">' + Utils.escapeHtml(item.name) + '</span>' +
            '<span class="share-row-info">' + countText + '</span>';
          row.addEventListener('click', function() {
            tryOpenProtectedFolder(item, function() {
              pushCurrentToBackHistory();
              setTreeSelection(item);
              expandedTreePaths.add(treePath(item));
              renderTree();
              currentFolder = item;
              currentPath.push(item);
              updateShareNavButtons();
              getFolderItems(item, function(items) {
                var folderImages = items.filter(function(x) { return x.type === 'image'; });
                var subfolders = items.filter(function(x) { return x.type === 'folder'; });
                if (folderImages.length > 0 && subfolders.length === 0) {
                  showViewer(folderImages, 0);
                } else {
                  showList();
                  renderList(items);
                }
                updateShareNavButtons();
                updateShareHash();
              });
            });
          });
        } else if (item.type === 'image') {
          var path = item.path || '#';
          var name = item.name || 'image';
          var imgIndex = imageItems.indexOf(item);
          row.innerHTML =
            '<img src="' + ICONS_BASE + 'jpg16.png" alt="" class="share-row-icon">' +
            '<span class="share-row-name">' + Utils.escapeHtml(name) + '</span>' +
            '<button type="button" class="share-download-btn win98-button">' +
            '<img src="' + ICONS_BASE + 'download16.png" alt="" class="win98-icon"> Download</button>';
          var nameEl = row.querySelector('.share-row-name');
          var downloadBtn = row.querySelector('.share-download-btn');
          if (nameEl) {
            nameEl.addEventListener('click', function(e) {
              e.stopPropagation();
              showViewer(imageItems, imgIndex);
            });
          }
          row.addEventListener('click', function(e) {
            if (e.target.closest('.share-download-btn')) return;
            showViewer(imageItems, imgIndex);
          });
          if (downloadBtn) {
            downloadBtn.addEventListener('click', function(e) {
              e.stopPropagation();
              Utils.triggerDownload(path, name);
            });
          }
        }
        listEl.appendChild(row);
      });
    }

    function doDownloadCurrent() {
      var item = currentViewerImages[currentViewerIndex];
      if (item && item.path && item.name) Utils.triggerDownload(item.path, item.name);
    }
    if (viewerDownload) viewerDownload.addEventListener('click', doDownloadCurrent);

    function showDownloadAllConfirm(callbackOnYes) {
      var images = getCurrentFolderImages();
      var n = images.length;
      if (n === 0) return;
      if (downloadAllDialogMessage) {
        downloadAllDialogMessage.textContent = n === 1
          ? 'Download 1 file from this folder as a ZIP?'
          : 'Download all ' + n + ' files from this folder as a ZIP?';
      }
      if (downloadAllDialog) downloadAllDialog.style.display = 'flex';
      function finish(ok) {
        if (downloadAllDialog) downloadAllDialog.style.display = 'none';
        if (ok && typeof callbackOnYes === 'function') callbackOnYes();
        if (downloadAllDialogClose) downloadAllDialogClose.removeEventListener('click', onClose);
        if (downloadAllDialogNo) downloadAllDialogNo.removeEventListener('click', onClose);
        if (downloadAllDialogYes) downloadAllDialogYes.removeEventListener('click', onYes);
        if (downloadAllDialog) downloadAllDialog.removeEventListener('click', onOverlay);
      }
      function onClose() { finish(false); }
      function onYes() { finish(true); }
      function onOverlay(e) { if (e.target === downloadAllDialog) finish(false); }
      if (downloadAllDialogClose) downloadAllDialogClose.addEventListener('click', onClose);
      if (downloadAllDialogNo) downloadAllDialogNo.addEventListener('click', onClose);
      if (downloadAllDialogYes) downloadAllDialogYes.addEventListener('click', onYes);
      if (downloadAllDialog) downloadAllDialog.addEventListener('click', onOverlay);
    }

    function doDownloadAll(buttonEl) {
      if (!window.JSZip) {
        alert('Download all is unavailable. Try reloading the page.');
        return;
      }
      var images = getCurrentFolderImages();
      if (images.length === 0) return;
      var labelEl = buttonEl ? buttonEl.querySelector('.share-viewer-download-all-text') : null;
      var originalText = labelEl ? labelEl.textContent : (buttonEl ? buttonEl.textContent : '');
      if (buttonEl) {
        buttonEl.disabled = true;
        if (labelEl) labelEl.textContent = 'Preparing…';
        else buttonEl.textContent = 'Preparing…';
      }
      var zip = new window.JSZip();
      var base = (currentFolder && currentFolder.name ? currentFolder.name : 'Share').replace(/[^a-zA-Z0-9-_]/g, '-') || 'Share';
      var zipFilename = base + '.zip';
      Promise.all(images.map(function(item) {
        return fetch(item.path).then(function(r) { return r.ok ? r.blob() : Promise.reject(new Error('Fetch failed')); }).then(function(blob) {
          return { name: item.name, blob: blob };
        });
      })).then(function(entries) {
        entries.forEach(function(e) { zip.file(e.name, e.blob); });
        return zip.generateAsync({ type: 'blob' });
      }).then(function(blob) {
        var url = URL.createObjectURL(blob);
        Utils.triggerDownload(url, zipFilename, function() { URL.revokeObjectURL(url); });
      }).catch(function() {
        alert('Could not build download. Check your connection and try again.');
      }).then(function() {
        if (buttonEl) {
          buttonEl.disabled = false;
          if (labelEl) labelEl.textContent = originalText;
          else buttonEl.textContent = originalText;
        }
      });
    }
    if (viewerDownloadAll) viewerDownloadAll.addEventListener('click', function() {
      var images = getCurrentFolderImages();
      if (images.length === 0) return;
      showDownloadAllConfirm(function() { doDownloadAll(viewerDownloadAll); });
    });
    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        updateViewerToIndex(currentViewerIndex - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        updateViewerToIndex(currentViewerIndex + 1);
      });
    }
    if (menuReturnBtn) {
      menuReturnBtn.addEventListener('click', function() {
        var closeBtn = container.querySelector('.annex-section-close');
        if (closeBtn) closeBtn.click();
      });
    }

    /* Single delegated click handler so tree clicks work after re-renders */
    if (treeEl) {
      treeEl.addEventListener('click', function(e) {
        var node = e.target.closest('.share-tree-node');
        if (!node) return;
        e.stopPropagation();
        if (node.getAttribute('data-node') === 'root') {
          pushCurrentToBackHistory();
          setTreeSelection('root');
          currentFolder = null;
          currentPath = [];
          showList();
          renderList(rootItems);
          updateShareNavButtons();
          return;
        }
        var folder = node._folderItem;
        if (!folder) return;
        if (e.target.closest('.share-tree-expand')) {
          var subfolders = (folder.children || []).filter(function(x) { return x.type === 'folder'; });
          var protectedAndLocked = isFolderProtected(folder) && !unlockedProtectedFolders.has(folder.name);
          var canExpand = subfolders.length > 0 && !protectedAndLocked;
          if (canExpand) {
            var path = treePath(folder);
            if (expandedTreePaths.has(path)) expandedTreePaths.delete(path);
            else expandedTreePaths.add(path);
            renderTree();
          }
          return;
        }
        tryOpenProtectedFolder(folder, function() {
          pushCurrentToBackHistory();
          setTreeSelection(folder);
          expandedTreePaths.add(treePath(folder));
          renderTree();
          currentFolder = folder;
          currentPath = [];
          if (folder._pathFromRoot) {
            for (var j = 1; j <= folder._pathFromRoot.length; j++) {
              var f = getFolderAtPath(folder._pathFromRoot.slice(0, j));
              if (f) currentPath.push(f);
            }
          }
          updateShareNavButtons();
          getFolderItems(folder, function(items) {
            var folderImages = items.filter(function(x) { return x.type === 'image'; });
            var subs = items.filter(function(x) { return x.type === 'folder'; });
            if (folderImages.length > 0 && subs.length === 0) {
              showViewer(folderImages, 0);
            } else {
              showList();
              renderList(items);
            }
            updateShareNavButtons();
            updateShareHash();
          });
        });
      });
    }

    if (addressBackBtn) {
      addressBackBtn.addEventListener('click', function(e) {
        e.preventDefault();
        shareGoBack();
      });
    }
    if (addressForwardBtn) {
      addressForwardBtn.addEventListener('click', function(e) {
        e.preventDefault();
        shareGoForward();
      });
    }

    fetch('sections/share/share.json')
      .then(function(res) { return res.ok ? res.json() : Promise.reject(new Error('Failed to load share')); })
      .then(function(data) {
        rootItems = Array.isArray(data) ? data : [];
        setPathFromRoot(rootItems);
        selectedTreeNode = 'root';
        renderTree();
        renderList(rootItems);
        updateShareNavButtons();
        applyDeeplinkFromHash();
      })
      .catch(function() {
        listEl.innerHTML = '<p class="share-error">Could not load shared files.</p>';
      });

    window.addEventListener('hashchange', function() {
      if (location.hash.slice(1).indexOf('share') === 0) applyDeeplinkFromHash();
    });
  }

  window.AnnexShareInit = init;
})();
