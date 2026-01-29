// Function to parse frontmatter and content from markdown
function parseMd(markdown) {
    const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return null;

    const frontMatter = match[1];
    const content = match[2].trim();
    
    // Parse frontmatter
    const metadata = {};
    frontMatter.split('\n').forEach(line => {
        const [key, ...value] = line.split(':');
        if (key && value) {
            metadata[key.trim()] = value.join(':').trim();
        }
    });

    return { metadata, content };
}

// Function to format date for display
function formatDate(isoDate) {
    const date = new Date(isoDate);
    return date.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit'
    }) + ' ' + date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // Configure marked for security
    marked.setOptions({
        headerIds: false,
        mangle: false,
        headerPrefix: '',
        breaks: true,
        gfm: true,
        sanitize: true
    });

    // DOM elements
    const postListContainer = document.querySelector('.post-list-container');
    const postList = document.querySelector('.post-list');
    const postViewer = document.querySelector('.post-viewer');
    const statusCount = document.querySelector('.status-count');

    // Function to get URL for index.json (works from local path on GitHub Pages)
    function getIndexUrl() {
        return '/blog/posts/index.json';
    }

    // Function to get URL for markdown files (use raw GitHub for production)
    function getMarkdownUrl(filename) {
        const hostname = window.location.hostname;
        // If we're on the live site, use raw GitHub content
        if (hostname === 'suhailstry.ing' || hostname === 'heysuhail.com' || hostname.includes('github.io')) {
            return 'https://raw.githubusercontent.com/suhailxyz/trying/main/blog/posts/' + filename;
        }
        // Local development - use relative path from blog directory
        return 'posts/' + filename;
    }

    // Notes index and content URLs (same pattern as posts)
    function getNotesIndexUrl() {
        return '/blog/notes/index.json';
    }

    function getNoteContentUrl(filename) {
        const hostname = window.location.hostname;
        if (hostname === 'suhailstry.ing' || hostname === 'heysuhail.com' || hostname.includes('github.io')) {
            return 'https://raw.githubusercontent.com/suhailxyz/trying/main/blog/notes/' + filename;
        }
        return 'notes/' + filename;
    }

    // Function to get list of posts from directory
    async function getPostFiles() {
        console.log('Attempting to fetch index.json...');
        try {
            const indexUrl = getIndexUrl();
            const response = await fetch(indexUrl, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            console.log('Index.json response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const posts = await response.json();
            console.log('Successfully loaded index.json:', posts);
            return posts;
        } catch (error) {
            console.error('Error getting post files:', error);
            return [];
        }
    }

    // Load and parse posts
    async function loadPosts() {
        console.log('Starting to load posts...');
        try {
            const postFiles = await getPostFiles();
            console.log('Got post files:', postFiles);
            // Use Promise.allSettled instead of Promise.all so one failure doesn't break everything
            const results = await Promise.allSettled(postFiles.map(async postInfo => {
                try {
                console.log('Fetching post:', postInfo.file);
                const markdownUrl = getMarkdownUrl(postInfo.file);
                const response = await fetch(markdownUrl, {
                    headers: {
                        'Accept': 'text/plain'
                    }
                });
                console.log(`Response for ${postInfo.file}:`, response.status);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} for ${postInfo.file}`);
                }
                const markdown = await response.text();
                const parsed = parseMd(markdown);
                if (!parsed) {
                    console.log(`Failed to parse markdown for ${postInfo.file}`);
                    return null;
                }
                console.log(`Successfully loaded post: ${postInfo.file}`);
                return {
                    filename: postInfo.file,
                    title: parsed.metadata.title,
                    subtitle: parsed.metadata.subtitle || null,
                    date: parsed.metadata.date,
                    substack: parsed.metadata.substack || null,
                    content: parsed.content
                };
                } catch (error) {
                    console.error(`Error loading post ${postInfo.file}:`, error);
                    return null;
                }
            }));

            // Extract successful posts
            const posts = results
                .map(result => result.status === 'fulfilled' ? result.value : null)
                .filter(post => post !== null);

            console.log('Final processed posts:', posts);
            return posts.sort((a, b) => 
                new Date(b.date) - new Date(a.date)
            );
        } catch (error) {
            console.error('Error loading posts:', error);
            return [];
        }
    }

    // Store posts globally so they persist
    let allPosts = [];

    // Notes: index and loaded notes
    let allNotes = [];

    async function getNoteFiles() {
        try {
            const response = await fetch(getNotesIndexUrl(), { headers: { 'Accept': 'application/json' } });
            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error('Error getting note files:', error);
            return [];
        }
    }

    async function loadNotes() {
        try {
            const noteFiles = await getNoteFiles();
            const results = await Promise.allSettled(noteFiles.map(async (noteInfo) => {
                try {
                    const url = getNoteContentUrl(noteInfo.file);
                    const response = await fetch(url, { headers: { 'Accept': 'text/plain' } });
                    if (!response.ok) return null;
                    const markdown = await response.text();
                    const parsed = parseMd(markdown);
                    const title = parsed ? (parsed.metadata.title || noteInfo.file.replace(/\.(md|txt)$/i, '')) : noteInfo.file.replace(/\.(md|txt)$/i, '');
                    const date = parsed && parsed.metadata.date ? parsed.metadata.date : null;
                    const content = parsed ? parsed.content : markdown;
                    return {
                        filename: noteInfo.file,
                        title,
                        date,
                        content
                    };
                } catch (err) {
                    console.error('Error loading note ' + noteInfo.file, err);
                    return null;
                }
            }));
            allNotes = results
                .map(r => r.status === 'fulfilled' ? r.value : null)
                .filter(n => n !== null);
            return allNotes;
        } catch (error) {
            console.error('Error loading notes:', error);
            allNotes = [];
            return [];
        }
    }

    // Populate post list container (used by renderPosts and when switching back from notes)
    function renderPostListItems() {
        postListContainer.innerHTML = '';
        allPosts.forEach((post, index) => {
            const postElement = document.createElement('div');
            postElement.className = 'post';
            if (index === 0 && !notesModeActive) postElement.classList.add('active');

            const titleElement = document.createElement('div');
            titleElement.className = 'post-title';
            titleElement.textContent = post.title;

            const dateElement = document.createElement('div');
            dateElement.className = 'post-date';
            const date = new Date(post.date);
            dateElement.textContent = date.toLocaleDateString('en-US', { 
                month: 'short',
                day: '2-digit',
                year: 'numeric'
            }).replace(', ', ' ');

            postElement.appendChild(titleElement);
            postElement.appendChild(dateElement);
            postListContainer.appendChild(postElement);
            postElement.dataset.postIndex = index;

            postElement.addEventListener('click', () => {
                document.querySelectorAll('.post-list-container .post').forEach(p => p.classList.remove('active'));
                postElement.classList.add('active');
                const postIndex = parseInt(postElement.dataset.postIndex);
                const selectedPost = allPosts[postIndex];
                if (selectedPost) renderPostContent(selectedPost);
                const listEl = document.querySelector('.post-list');
                const overlay = document.getElementById('mobile-overlay');
                if (listEl && listEl.classList.contains('mobile-open') && overlay) {
                    listEl.classList.remove('mobile-open');
                    overlay.classList.remove('active');
                }
            });
        });
    }

    // Populate note list container
    function renderNotesListItems() {
        postListContainer.innerHTML = '';
        allNotes.forEach((note, index) => {
            const noteElement = document.createElement('div');
            noteElement.className = 'post';
            if (index === 0) noteElement.classList.add('active');

            const titleElement = document.createElement('div');
            titleElement.className = 'post-title';
            titleElement.textContent = note.title;

            const dateElement = document.createElement('div');
            dateElement.className = 'post-date';
            dateElement.textContent = note.date
                ? new Date(note.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).replace(', ', ' ')
                : '—';

            noteElement.appendChild(titleElement);
            noteElement.appendChild(dateElement);
            postListContainer.appendChild(noteElement);
            noteElement.dataset.noteIndex = index;

            noteElement.addEventListener('click', () => {
                document.querySelectorAll('.post-list-container .post').forEach(p => p.classList.remove('active'));
                noteElement.classList.add('active');
                const noteIndex = parseInt(noteElement.dataset.noteIndex);
                const selectedNote = allNotes[noteIndex];
                if (selectedNote) renderNoteContent(selectedNote);
                const listEl = document.querySelector('.post-list');
                const overlay = document.getElementById('mobile-overlay');
                if (listEl && listEl.classList.contains('mobile-open') && overlay) {
                    listEl.classList.remove('mobile-open');
                    overlay.classList.remove('active');
                }
            });
        });
    }

    // Render note content in viewer (no Substack, no LATEST_POST)
    function renderNoteContent(note) {
        const formattedDate = note.date
            ? new Date(note.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            : '';
        const dateHtml = formattedDate ? `<div class="header-actions"><div class="date">${formattedDate}</div></div>` : '';
        const content = marked.parse(note.content);
        postViewer.innerHTML = `
            <div class="viewer-header">
                <div class="subject">${note.title}</div>
                ${dateHtml}
            </div>
            <div class="viewer-content markdown-content">${content}</div>
        `;
        applySavedFontSize();
    }

    // Notes mode state (persist in localStorage)
    let notesModeActive = false;

    function setListMode(isNotes) {
        const listHeaderTitle = document.getElementById('list-header-title');
        const toolbarPostsBtn = document.getElementById('toolbar-posts-btn');
        const toolbarNotesBtn = document.getElementById('toolbar-notes-btn');
        const listModeToggle = document.getElementById('list-mode-toggle');
        notesModeActive = isNotes;
        try { localStorage.setItem('blogNotesMode', isNotes ? '1' : '0'); } catch (_) {}

        if (listHeaderTitle) listHeaderTitle.textContent = isNotes ? 'Note' : 'Subject';
        if (toolbarPostsBtn) toolbarPostsBtn.classList.toggle('active', !isNotes);
        if (toolbarNotesBtn) toolbarNotesBtn.classList.toggle('active', isNotes);
        if (listModeToggle) {
            listModeToggle.querySelector('[data-mode="posts"]')?.classList.toggle('active', !isNotes);
            listModeToggle.querySelector('[data-mode="notes"]')?.classList.toggle('active', isNotes);
        }

        if (isNotes) {
            if (allNotes.length === 0) {
                loadNotes().then(() => {
                    renderNotesListItems();
                    statusCount.textContent = `${allNotes.length} note${allNotes.length !== 1 ? 's' : ''}`;
                    if (allNotes.length > 0) renderNoteContent(allNotes[0]);
                    else postViewer.innerHTML = '<div class="viewer-content">No notes available.</div>';
                });
            } else {
                renderNotesListItems();
                statusCount.textContent = `${allNotes.length} note${allNotes.length !== 1 ? 's' : ''}`;
                if (allNotes.length > 0) renderNoteContent(allNotes[0]);
                else postViewer.innerHTML = '<div class="viewer-content">No notes available.</div>';
            }
        } else {
            renderPostListItems();
            statusCount.textContent = `${allPosts.length} message${allPosts.length !== 1 ? 's' : ''}`;
            if (allPosts.length > 0) {
                renderPostContent(allPosts[0]);
                document.querySelectorAll('.post-list-container .post').forEach((p, i) => p.classList.toggle('active', i === 0));
            } else postViewer.innerHTML = '<div class="viewer-content">No messages available.</div>';
        }
    }

    // Render posts (initial load and refill list)
    async function renderPosts() {
        const posts = await loadPosts();
        allPosts = posts;
        const savedNotesMode = localStorage.getItem('blogNotesMode') === '1';
        if (savedNotesMode) {
            await loadNotes();
            setListMode(true);
        } else {
            setListMode(false);
        }
    }

    // Function to adjust font size
    function adjustFontSize(delta) {
        const markdownContent = document.querySelector('.markdown-content');
        if (!markdownContent) return;
        
        // Get current size or default to 12px
        let currentSize = parseFloat(markdownContent.style.fontSize);
        if (!currentSize) {
            currentSize = parseFloat(getComputedStyle(markdownContent).fontSize) || 12;
        }
        
        const newSize = Math.max(8, Math.min(24, currentSize + delta));
        markdownContent.style.fontSize = newSize + 'px';
        
        // Store in localStorage for persistence
        localStorage.setItem('blogFontSize', newSize);
    }

    // Apply saved font size on load
    function applySavedFontSize() {
        const savedSize = localStorage.getItem('blogFontSize');
        if (savedSize) {
            const markdownContent = document.querySelector('.markdown-content');
            if (markdownContent) {
                markdownContent.style.fontSize = savedSize + 'px';
            }
        }
    }

    // Get the latest post (excluding about.md)
    function getLatestPost() {
        return allPosts.find(post => post.filename !== 'about.md') || allPosts[0];
    }

    // Render post content
    function renderPostContent(post) {
        const formattedDate = new Date(post.date).toLocaleDateString('en-US', { 
            weekday: 'long',
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
        });
        
        // Create a container for the rendered content
        const subtitleHtml = post.subtitle ? `<div class="subtitle">${post.subtitle}</div>` : '';
        
        // Substack button if link exists
        const substackButtonHtml = post.substack ? `
            <a href="${post.substack}" target="_blank" rel="noopener noreferrer" class="substack-button">
                Read on Substack
            </a>
        ` : '';
        
        // Parse markdown content
        let content = marked.parse(post.content);
        
        // If this is the about post, replace [here]([LATEST_POST]) with link to latest post
        if (post.filename === 'about.md') {
            const latestPost = getLatestPost();
            if (latestPost) {
                const postIndex = allPosts.indexOf(latestPost);
                const latestPostLink = `<a href="#" class="latest-post-link" data-post-index="${postIndex}">here</a>`;
                content = content.replace(/\[here\]\(\[LATEST_POST\]\)/g, latestPostLink);
            }
        }
        
        postViewer.innerHTML = `
            <div class="viewer-header">
                <div class="subject">${post.title}</div>
                ${subtitleHtml}
                <div class="header-actions">
                    <div class="date">${formattedDate}</div>
                    ${substackButtonHtml}
                </div>
            </div>
            <div class="viewer-content markdown-content">${content}</div>
        `;
        
        // Add click handler for latest post link if it exists
        const latestPostLink = postViewer.querySelector('.latest-post-link');
        if (latestPostLink) {
            latestPostLink.addEventListener('click', (e) => {
                e.preventDefault();
                const postIndex = parseInt(latestPostLink.dataset.postIndex);
                const selectedPost = allPosts[postIndex];
                if (selectedPost) {
                    renderPostContent(selectedPost);
                    // Update active post in the list
                    document.querySelectorAll('.post').forEach(p => p.classList.remove('active'));
                    const postElements = document.querySelectorAll('.post');
                    postElements.forEach((el, index) => {
                        if (allPosts[index] === selectedPost) {
                            el.classList.add('active');
                        }
                    });
                }
            });
        }
        
        // Apply saved font size after rendering
        applySavedFontSize();
    }

    // Window controls and toolbar actions
    document.addEventListener('click', (e) => {
        // Handle window controls
        if (e.target.matches('.window-controls button:not(:disabled)')) {
            const action = e.target.dataset.action;
            switch (action) {
                case 'minimize':
                    // Disabled - do nothing
                    break;
                case 'maximize':
                    document.querySelector('.blog-window').classList.toggle('maximized');
                    break;
                case 'close':
                    showConfirmDialog();
                    break;
            }
        }
        
        // Handle toolbar buttons
        if (e.target.matches('.tool-button')) {
            const action = e.target.dataset.action;
            if (action === 'home') {
                showConfirmDialog();
            } else if (action === 'toggle-menu') {
                const postList = document.querySelector('.post-list');
                const overlay = document.getElementById('mobile-overlay');
                postList.classList.toggle('mobile-open');
                if (overlay) {
                    overlay.classList.toggle('active');
                }
            } else if (action === 'about-page') {
                // Find the about post by filename
                const aboutPost = allPosts.find(post => 
                    post.filename === 'about.md'
                );
                if (aboutPost) {
                    renderPostContent(aboutPost);
                    // Update active post in the list
                    document.querySelectorAll('.post').forEach(p => p.classList.remove('active'));
                    const postElements = document.querySelectorAll('.post');
                    postElements.forEach((el, index) => {
                        if (allPosts[index] === aboutPost) {
                            el.classList.add('active');
                        }
                    });
                }
            } else if (action === 'new') {
                // Open Substack in new tab
                window.open('https://suhailstrying.substack.com', '_blank', 'noopener,noreferrer');
            } else if (action === 'font-increase') {
                adjustFontSize(1);
            } else if (action === 'font-decrease') {
                adjustFontSize(-1);
            } else if (e.target.dataset.mode) {
                setListMode(e.target.dataset.mode === 'notes');
            }
        }
        // In-panel Posts/Notes buttons (mobile)
        if (e.target.matches('.list-mode-btn')) {
            setListMode(e.target.dataset.mode === 'notes');
        }
    });

    // Add divider functionality (desktop only)
    let isDragging = false;
    let startX, startWidth;

    postList.addEventListener('mousedown', function(e) {
        // Don't enable divider dragging on mobile
        if (window.innerWidth <= 768) return;
        
        const rect = postList.getBoundingClientRect();
        const isClickOnDivider = e.clientX >= rect.right - 4 && e.clientX <= rect.right;
        
        if (isClickOnDivider) {
            isDragging = true;
            startX = e.pageX;
            startWidth = postList.offsetWidth;
            
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;

        const width = startWidth + (e.pageX - startX);
        if (width > 100 && width < window.innerWidth - 200) {
            postList.style.width = width + 'px';
        }
    });

    document.addEventListener('mouseup', function() {
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        const postList = document.querySelector('.post-list');
        const overlay = document.getElementById('mobile-overlay');
        const toggleButton = document.getElementById('mobile-menu-toggle');
        
        // Close when clicking on overlay
        if (e.target === overlay) {
            postList.classList.remove('mobile-open');
            overlay.classList.remove('active');
        }
        
        // If menu is open and click is outside the menu and not on the toggle button
        if (postList && postList.classList.contains('mobile-open')) {
            if (!postList.contains(e.target) && e.target !== toggleButton && !toggleButton.contains(e.target) && e.target !== overlay) {
                postList.classList.remove('mobile-open');
                if (overlay) {
                    overlay.classList.remove('active');
                }
            }
        }
    });

    // Confirmation dialog functions
    function showConfirmDialog() {
        const dialog = document.getElementById('confirm-dialog');
        dialog.style.display = 'flex';
    }

    function hideConfirmDialog() {
        const dialog = document.getElementById('confirm-dialog');
        dialog.style.display = 'none';
    }

    function navigateHome() {
        window.location.href = '/';
    }

    // Dialog button handlers
    document.getElementById('dialog-yes').addEventListener('click', () => {
        hideConfirmDialog();
        navigateHome();
    });

    document.getElementById('dialog-no').addEventListener('click', () => {
        hideConfirmDialog();
    });

    document.getElementById('dialog-close').addEventListener('click', () => {
        hideConfirmDialog();
    });

    // Close dialog when clicking outside
    document.getElementById('confirm-dialog').addEventListener('click', (e) => {
        if (e.target.id === 'confirm-dialog') {
            hideConfirmDialog();
        }
    });

    // Initial render
    renderPosts().then(() => {
        // Apply saved font size after posts are rendered
        applySavedFontSize();
    });
}); 