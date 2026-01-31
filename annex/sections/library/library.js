/**
 * Library section: loads library.json and renders entries into #library-entries.
 * Uses window.AnnexUtils and window.showLibraryFormatDialog from annex.js.
 */
(function() {
  var Utils = window.AnnexUtils;
  var showFormatDialog = window.showLibraryFormatDialog;
  if (!Utils || !showFormatDialog) return;

  function init(container) {
    var el = container && container.querySelector ? container.querySelector('#library-entries') : null;
    if (!el) return;
    fetch('sections/library/library.json')
      .then(function(res) { return res.ok ? res.json() : Promise.reject(new Error('Failed to load library')); })
      .then(function(entries) {
        var base = '../assets/img/icons/';
        (Array.isArray(entries) ? entries : []).forEach(function(entry) {
          var formats = Utils.normalizeFormats(entry);
          var formatLabel = formats.map(function(f) { return f.format; }).join(', ');
          var blurbHtml = entry.note
            ? '<p class="library-entry-blurb"><img src="' + base + 'notes16.png" alt="" class="library-entry-icon">' + Utils.escapeHtml(entry.note) + '</p>'
            : '';
          var div = document.createElement('div');
          div.className = 'library-entry';
          var borrowHtml;
          if (formats.length === 1) {
            var oneFilename = Utils.downloadFilename(entry.title, formats[0].format);
            borrowHtml = '<a href="' + Utils.escapeHtml(formats[0].file) + '" download="' + Utils.escapeHtml(oneFilename) + '" class="library-entry-download" title="Borrow ' + Utils.escapeHtml(formats[0].format) + '">' +
              '<img src="' + base + 'download16.png" alt="" class="win98-icon">Borrow</a>';
          } else {
            borrowHtml = '<div class="library-entry-borrow">' +
              '<button type="button" class="library-entry-borrow-btn">' +
              '<img src="' + base + 'download16.png" alt="" class="win98-icon">Borrow</button></div>';
          }
          var supportHtml = entry.supportAuthor
            ? '<a href="' + Utils.escapeHtml(entry.supportAuthor) + '" class="library-entry-support" title="Support the author" target="_blank" rel="noopener noreferrer">' +
              '<img src="' + base + 'support16.png" alt="" class="win98-icon">Support</a>'
            : '';
          var actionsHtml = '<div class="library-entry-actions">' + borrowHtml + supportHtml + '</div>';
          div.innerHTML =
            '<div class="library-entry-info">' +
              '<div class="library-entry-title-row">' +
                '<img src="' + base + 'book16.png" alt="" class="library-entry-icon">' +
                '<span class="library-entry-title">' + Utils.escapeHtml(entry.title) + '</span>' +
                '<span class="library-entry-format">' + Utils.escapeHtml(formatLabel) + '</span>' +
              '</div>' +
              '<div class="library-entry-author-row">' +
                '<img src="' + base + 'user16.png" alt="" class="library-entry-icon">' +
                '<span class="library-entry-author">' + Utils.escapeHtml(entry.author || '') + '</span>' +
              '</div>' +
              blurbHtml +
            '</div>' +
            actionsHtml;
          el.appendChild(div);
          if (formats.length === 1) {
            var singleLink = div.querySelector('.library-entry-download');
            if (singleLink && Utils.isExternalUrl(formats[0].file)) {
              singleLink.addEventListener('click', function(e) {
                e.preventDefault();
                Utils.triggerDownload(formats[0].file, Utils.downloadFilename(entry.title, formats[0].format));
              });
            }
          } else {
            var btn = div.querySelector('.library-entry-borrow-btn');
            if (btn) btn.addEventListener('click', function() {
              showFormatDialog(formats, entry.title);
            });
          }
        });
      })
      .catch(function() {});
  }

  window.AnnexLibraryInit = init;
})();
