// --- Marked Configuration ---
marked.setOptions({
    gfm: true,
    breaks: true,
    tables: true,
    highlight: function(code, lang) {
        if (Prism.languages[lang]) {
            return Prism.highlight(code, Prism.languages[lang], lang);
        }
        return code;
    }
});

// --- Custom Slugger for Anchor Links ---
function slugify(text) {
    return text.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

// --- Alerts Extension ---
const alertExtension = {
    name: 'alert',
    level: 'block',
    start(src) { return src.match(/^> \[!/)?.index; },
    tokenizer(src, tokens) {
        const rule = /^> \[!(NOTE|WARNING|TIP|IMPORTANT)\]\r?\n((?:> .*(?:\r?\n|$))*)/i;
        const match = rule.exec(src);
        if (match) {
            return {
                type: 'alert',
                raw: match[0],
                alertType: match[1].toLowerCase(),
                text: match[2].replace(/^> /gm, '').trim()
            };
        }
    },
    renderer(token) {
        const icons = {
            note: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
            warning: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
            tip: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.364-6.364l-.707-.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path></svg>',
            important: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
        };
        return `
            <div class="alert alert-${token.alertType}">
                <div class="alert-title">${icons[token.alertType]} ${token.alertType.toUpperCase()}</div>
                <div class="alert-content">${marked.parse(token.text)}</div>
            </div>
        `;
    }
};

marked.use({ extensions: [alertExtension] });

// --- Utils ---
const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
};

// --- App Logic ---
const state = {
    theme: localStorage.getItem('theme') || 'dark-mode',
    sidebar: window.innerWidth > 1300,
    currentDoc: null,
    history: JSON.parse(localStorage.getItem('inkview_history') || localStorage.getItem('ink_history') || localStorage.getItem('mark_history') || localStorage.getItem('editorial_history') || '[]'),
    selectedIds: new Set()
};

// DOM Elements
const body = document.body;
const landingPage = document.getElementById('landing-page');
const contentArea = document.getElementById('content');
const tocList = document.getElementById('toc-list');
const docTitle = document.getElementById('current-filename');
const pasteArea = document.getElementById('paste-area');
const fileInput = document.getElementById('file-input');
const historyOverlay = document.getElementById('history-overlay');
const historyList = document.getElementById('history-list');
const historySearch = document.getElementById('history-search');

// Editor Elements
const editorModal = document.getElementById('editor-modal');
const modalPasteArea = document.getElementById('modal-paste-area');
const enlargeBtn = document.getElementById('enlarge-btn');
const closeEditor = document.getElementById('close-editor');
const modalBeginBtn = document.getElementById('modal-begin-btn');
const startBtn = document.getElementById('start-btn');

// File UI Elements
const dropZone = document.getElementById('drop-zone');
const dropZoneDefault = document.getElementById('drop-zone-default');
const dropZoneSelected = document.getElementById('drop-zone-selected');
const selectedFileName = document.getElementById('selected-file-name');
const cancelFileBtn = document.getElementById('cancel-file-btn');

// --- Confirmation Modal Logic ---
function showConfirmModal(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('modal-title');
        const messageEl = document.getElementById('modal-message');
        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');

        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.classList.add('active');

        const cleanup = (value) => {
            modal.classList.remove('active');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(value);
        };

        confirmBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
    });
}

// --- TOC Tracking Observer ---
const observerOptions = {
    root: null,
    rootMargin: '-5% 0px -75% 0px',
    threshold: 0
};

const tocObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const id = entry.target.id;
            const tocLink = document.querySelector(`#toc-list a[href="#${id}"]`);
            if (tocLink && !tocLink.classList.contains('manual-active')) {
                document.querySelectorAll('#toc-list a').forEach(a => a.classList.remove('active', 'manual-active'));
                tocLink.classList.add('active');
                tocLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    });
}, observerOptions);

// Flag to temporarily disable observer during manual TOC navigation
let isManualNavigation = false;
let manualNavTimeout = null;

// --- Core Functions ---

function updateBodyClass() {
    body.className = `${state.theme} ${state.sidebar ? 'sidebar-open' : ''}`;
}

function updateBulkActions() {
    const deleteBtn = document.getElementById('delete-selected-btn');
    if (state.selectedIds.size > 0) {
        deleteBtn.classList.remove('hidden');
        deleteBtn.textContent = `Delete Selected (${state.selectedIds.size})`;
    } else {
        deleteBtn.classList.add('hidden');
    }
}

function updateStartBtn() {
    startBtn.disabled = !pasteArea.value.trim();
}

function saveToHistory(doc) {
    const index = state.history.findIndex(h => h.id === doc.id);
    if (index !== -1) {
        state.history[index] = { ...state.history[index], ...doc, updatedAt: Date.now() };
    } else {
        state.history.unshift({ ...doc, createdAt: Date.now(), updatedAt: Date.now() });
    }
    localStorage.setItem('inkview_history', JSON.stringify(state.history));
    localStorage.setItem('inkview_last_active_id', doc.id);
}

function renderMarkdown(text, id = null, title = null, scrollPos = 0) {
    if (!title) {
        const firstLine = text.split('\n')[0].replace(/^#+\s*/, '').trim();
        title = firstLine || "Untitled Document";
    }
    if (!id) id = 'doc_' + Math.random().toString(36).substr(2, 9);

    state.currentDoc = { id, title, content: text, lastReadPos: scrollPos };
    docTitle.textContent = title;
    tocList.innerHTML = '';
    contentArea.innerHTML = marked.parse(text);
    
    tocObserver.disconnect();
    const headers = contentArea.querySelectorAll('h1, h2, h3');
    headers.forEach((h) => {
        const hId = slugify(h.textContent);
        h.id = hId;
        tocObserver.observe(h);
        
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `#${hId}`;
        a.textContent = h.textContent;
        a.className = `level-${h.tagName.slice(1)}`;
        li.appendChild(a);
        tocList.appendChild(li);
        
        a.onclick = (e) => {
            e.preventDefault();
            
            // Temporarily disable observer to prevent scroll-based highlighting
            isManualNavigation = true;
            if (manualNavTimeout) clearTimeout(manualNavTimeout);
            manualNavTimeout = setTimeout(() => {
                isManualNavigation = false;
            }, 1000);
            
            // Manually set active state
            document.querySelectorAll('#toc-list a').forEach(el => el.classList.remove('active', 'manual-active'));
            a.classList.add('active', 'manual-active');
            
            h.scrollIntoView({ behavior: 'smooth' });
            window.history.pushState(null, null, `#${hId}`);
            if (window.innerWidth <= 1300) {
                state.sidebar = false;
                updateBodyClass();
            }
        };
    });
    
    document.querySelectorAll('pre').forEach(pre => {
        const btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.textContent = 'Copy';
        btn.onclick = () => {
            navigator.clipboard.writeText(pre.querySelector('code').innerText);
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy', 2000);
        };
        pre.appendChild(btn);
    });

    landingPage.classList.add('hidden');
    saveToHistory(state.currentDoc);
    
    // Re-run Prism highlighting on all code blocks after DOM insertion
    Prism.highlightAll();
    
    setTimeout(() => {
        window.scrollTo({ top: scrollPos, behavior: 'auto' });
    }, 100);
}

function renderHistoryList(query = '') {
    historyList.innerHTML = '';
    const filtered = state.history.filter(doc => {
        const q = query.toLowerCase();
        return doc.title.toLowerCase().includes(q) || doc.content.toLowerCase().includes(q);
    }).sort((a, b) => {
        if (query) {
            const aTitle = a.title.toLowerCase().includes(query.toLowerCase());
            const bTitle = b.title.toLowerCase().includes(query.toLowerCase());
            if (aTitle && !bTitle) return -1;
            if (!aTitle && bTitle) return 1;
        }
        return b.updatedAt - a.updatedAt;
    });

    if (filtered.length === 0) {
        historyList.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">No documents found.</div>';
        return;
    }

    filtered.forEach(doc => {
        const item = document.createElement('div');
        const isSelected = state.selectedIds.has(doc.id);
        item.className = `history-item ${isSelected ? 'selected' : ''}`;
        item.innerHTML = `
            <div class="custom-checkbox">
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="4" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div class="history-item-content">
                <div class="history-item-title">${doc.title}</div>
                <div class="history-item-meta">
                    <span>Updated: ${new Date(doc.updatedAt).toLocaleDateString()}</span>
                    <span>${doc.content.length} chars</span>
                </div>
            </div>
            <button class="delete-item-btn" title="Delete document">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
        `;
        
        item.onclick = async (e) => {
            if (e.target.closest('.custom-checkbox')) {
                e.stopPropagation();
                if (state.selectedIds.has(doc.id)) state.selectedIds.delete(doc.id);
                else state.selectedIds.add(doc.id);
                updateBulkActions();
                renderHistoryList(historySearch.value);
                return;
            }

            if (e.target.closest('.delete-item-btn')) {
                e.stopPropagation();
                const confirmed = await showConfirmModal("Delete Document", `Are you sure you want to delete "${doc.title}"?`);
                if (confirmed) {
                    state.history = state.history.filter(h => h.id !== doc.id);
                    state.selectedIds.delete(doc.id);
                    localStorage.setItem('inkview_history', JSON.stringify(state.history));
                    updateBulkActions();
                    renderHistoryList(historySearch.value);
                }
                return;
            }
            renderMarkdown(doc.content, doc.id, doc.title, doc.lastReadPos);
            historyOverlay.classList.remove('active');
        };
        historyList.appendChild(item);
    });
}

// --- Event Listeners ---

// Editor Modal Listeners
enlargeBtn.onclick = () => {
    modalPasteArea.value = pasteArea.value;
    editorModal.classList.add('active');
};

closeEditor.onclick = () => {
    pasteArea.value = modalPasteArea.value;
    editorModal.classList.remove('active');
    updateStartBtn();
};

modalPasteArea.oninput = () => {
    pasteArea.value = modalPasteArea.value;
    updateStartBtn();
};

modalBeginBtn.onclick = () => {
    const text = modalPasteArea.value.trim();
    if (text) {
        editorModal.classList.remove('active');
        // If we are in the reader, preserve the current ID/title
        if (state.currentDoc) {
            renderMarkdown(text, state.currentDoc.id, state.currentDoc.title, window.scrollY);
        } else {
            renderMarkdown(text);
        }
    }
};

const toggleTheme = () => {
    state.theme = state.theme === 'light-mode' ? 'dark-mode' : 'light-mode';
    localStorage.setItem('theme', state.theme);
    updateBodyClass();
};

const openHistory = () => {
    state.selectedIds.clear();
    updateBulkActions();
    renderHistoryList();
    historyOverlay.classList.add('active');
};

document.getElementById('theme-toggle').onclick = toggleTheme;
document.getElementById('landing-theme-toggle').onclick = toggleTheme;

document.getElementById('sidebar-toggle').onclick = () => {
    state.sidebar = !state.sidebar;
    updateBodyClass();
};

document.getElementById('new-doc-btn').onclick = () => {
    state.currentDoc = null; 
    window.location.hash = '';
    landingPage.classList.remove('hidden');
    resetLandingPage();
};

document.getElementById('edit-doc-btn').onclick = () => {
    if (state.currentDoc) {
        modalPasteArea.value = state.currentDoc.content;
        pasteArea.value = state.currentDoc.content; // Keep landing textarea in sync too
        editorModal.classList.add('active');
    }
};

function resetLandingPage() {
    pasteArea.value = '';
    modalPasteArea.value = '';
    fileInput.value = '';
    dropZoneDefault.classList.remove('hidden');
    dropZoneSelected.classList.add('hidden');
    dropZone.classList.remove('has-file');
    updateStartBtn();
}

document.getElementById('history-btn').onclick = openHistory;
document.getElementById('landing-history-btn').onclick = openHistory;

document.getElementById('close-history').onclick = () => {
    historyOverlay.classList.remove('active');
};

document.getElementById('clear-all-btn').onclick = async () => {
    if (state.history.length === 0) return;
    const confirmed = await showConfirmModal("Clear All History", "Are you sure you want to clear your entire reading history? This cannot be undone.");
    if (confirmed) {
        state.history = [];
        state.selectedIds.clear();
        localStorage.setItem('inkview_history', JSON.stringify([]));
        localStorage.removeItem('inkview_last_active_id');
        updateBulkActions();
        renderHistoryList();
    }
};

document.getElementById('delete-selected-btn').onclick = async () => {
    if (state.selectedIds.size === 0) return;
    const confirmed = await showConfirmModal("Delete Selected", `Are you sure you want to delete ${state.selectedIds.size} selected documents?`);
    if (confirmed) {
        state.history = state.history.filter(doc => !state.selectedIds.has(doc.id));
        state.selectedIds.clear();
        localStorage.setItem('inkview_history', JSON.stringify(state.history));
        updateBulkActions();
        renderHistoryList(historySearch.value);
    }
};

historyOverlay.onclick = (e) => {
    if (e.target === historyOverlay) historyOverlay.classList.remove('active');
};

historySearch.oninput = debounce((e) => {
    renderHistoryList(e.target.value);
}, 300);

docTitle.onblur = () => {
    if (state.currentDoc) {
        state.currentDoc.title = docTitle.textContent.trim() || "Untitled Document";
        docTitle.textContent = state.currentDoc.title;
        saveToHistory(state.currentDoc);
    }
};

docTitle.onkeydown = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        docTitle.blur();
    }
};

startBtn.onclick = () => {
    const text = pasteArea.value.trim();
    if (text) renderMarkdown(text);
};

pasteArea.oninput = () => {
    updateStartBtn();
};

document.getElementById('drop-zone').onclick = () => {
    if (!dropZoneSelected.classList.contains('hidden')) return; // Don't trigger browse if file already selected
    fileInput.click();
};

fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
};

cancelFileBtn.onclick = (e) => {
    e.stopPropagation();
    resetLandingPage();
};

dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('hover'); };
dropZone.ondragleave = () => { dropZone.classList.remove('hover'); };
dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('hover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
};

function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        pasteArea.value = e.target.result;
        modalPasteArea.value = e.target.result;
        updateStartBtn();
        
        dropZoneDefault.classList.add('hidden');
        dropZoneSelected.classList.remove('hidden');
        dropZone.classList.add('has-file');
        selectedFileName.textContent = file.name;
    };
    reader.readAsText(file);
}

contentArea.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a && a.getAttribute('href')?.startsWith('#')) {
        e.preventDefault();
        const id = a.getAttribute('href').substring(1);
        const target = document.getElementById(id) || document.querySelector(`[name="${id}"]`);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
            window.history.pushState(null, null, `#${id}`);
        }
    }
});

// --- Scroll Tracking ---
window.onscroll = debounce(() => {
    if (state.currentDoc && landingPage.classList.contains('hidden')) {
        state.currentDoc.lastReadPos = window.scrollY;
        saveToHistory(state.currentDoc);
    }
}, 500);

// --- Initialization ---
updateBodyClass();

const lastActiveId = localStorage.getItem('inkview_last_active_id') || localStorage.getItem('ink_last_active_id') || localStorage.getItem('mark_last_active_id') || localStorage.getItem('editorial_last_active_id');
if (lastActiveId) {
    const doc = state.history.find(h => h.id === lastActiveId);
    if (doc) {
        renderMarkdown(doc.content, doc.id, doc.title, doc.lastReadPos);
    }
}

if (window.location.hash) {
    setTimeout(() => {
        const id = window.location.hash.substring(1);
        const target = document.getElementById(id);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    }, 500);
}
