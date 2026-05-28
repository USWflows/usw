let editor, pyodide, activeLang;
let currentFileId = null;
let currentUser = null;

// Initialize Session State
window.addEventListener('load', () => {
    const savedUser = sessionStorage.getItem('usw_user');
    if (savedUser) {
        currentUser = savedUser;
        document.getElementById('auth-overlay').classList.add('hidden');
        initWorkspace();
    }
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./server.js', { scope: './' })
            .then(() => logTerminal("SYSTEM", "Aether Secure Kernel Online."))
            .catch(err => logTerminal("ERROR", "Kernel registration failed: " + err));
    }
});

// Bootstrap Monaco Code Canvas
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
require(['vs/editor/editor.main'], function() {
    editor = monaco.editor.create(document.getElementById('monaco-canvas'), {
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 15,
        fontFamily: "'JetBrains Mono', monospace",
        minimap: { enabled: false },
        lineHeight: 24,
        padding: { top: 20 },
        background: "#000000"
    });
});

// Auth Portal Router
function handleAuth(type) {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value;
    const msg = document.getElementById('auth-msg');

    if (!u || !p) {
        msg.innerText = "CREDENTIAL PARAMETERS REQUIRED.";
        return;
    }

    if (type === 'signup') {
        if (USW_DATA.saveUser(u, p)) {
            msg.style.color = "#00ffaa";
            msg.innerText = "ACCESS ID CREATED. LOGGING IN...";
            setTimeout(() => handleAuth('login'), 800);
        } else {
            msg.innerText = "IDENTITY MATRIX CHOSEN OR UNAVAILABLE.";
        }
    } else {
        if (USW_DATA.verifyUser(u, p)) {
            currentUser = u;
            sessionStorage.setItem('usw_user', u);
            document.getElementById('auth-overlay').classList.add('hidden');
            initWorkspace();
        } else {
            msg.innerText = "ACCESS DENIED. ID PASSWORD INVALID.";
        }
    }
}

function initWorkspace() {
    updateSidebar();
    logTerminal("SYSTEM", `Active workspace environment loaded for node: ${currentUser}`);
}

function createNewFile(lang) {
    const name = prompt(`Enter system label name for your ${lang.toUpperCase()} environment:`, `source_${Date.now().toString().slice(-4)}`);
    if (!name) return;

    const fileExt = lang === 'python' ? 'py' : (lang === 'javascript' ? 'js' : 'html');
    const fullFilename = `${name}.${fileExt}`;
    const defaultCode = USW_CONFIG.TEMPLATES[lang] || "";

    const newId = USW_DATA.createFile(currentUser, fullFilename, lang, defaultCode);
    updateSidebar();
    launchIDE(newId);
}

async function launchIDE(fileId) {
    const file = USW_DATA.getFile(currentUser, fileId);
    if (!file) return;

    currentFileId = fileId;
    activeLang = file.lang;

    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('editor-stage').classList.remove('hidden');
    document.getElementById('runtime-controls').classList.remove('hidden');
    
    // Handle Monaco Language Mapping
    const mode = activeLang === 'html' ? 'html' : (activeLang === 'javascript' ? 'javascript' : 'python');
    monaco.editor.setModelLanguage(editor.getModel(), mode);
    editor.setValue(file.code);

    // Boot Python if needed
    if (activeLang === 'python' && !pyodide) {
        logTerminal("PYODIDE", "Compiling local WebAssembly VM environment...");
        try {
            pyodide = await loadPyodide();
            logTerminal("PYODIDE", "Python environment fully mounted via WebAssembly.");
        } catch (err) {
            logTerminal("ERROR", "Python engine failed to load: " + err.message);
        }
    }
}

// Multi-Language Code Compilation Engine
async function runCode() {
    if (!currentFileId) return;
    const code = editor.getValue();
    
    // Auto-save changes dynamically
    USW_DATA.updateFileCode(currentUser, currentFileId, code);
    logTerminal("RUNTIME", `Executing pipeline stream...`);
    
    try {
        if (activeLang === 'python') {
            if (!pyodide) { logTerminal("ERROR", "Python WASM is still warming up. Wait a second."); return; }
            await pyodide.runPythonAsync(`
import sys, io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
            `);
            await pyodide.runPythonAsync(code);
            const stdout = pyodide.runPython("sys.stdout.getvalue()");
            const stderr = pyodide.runPython("sys.stderr.getvalue()");
            
            if (stdout) logTerminal("STDOUT", stdout.trim());
            if (stderr) logTerminal("STDERR", stderr.trim());
            if (!stdout && !stderr) logTerminal("SUCCESS", "Process completed with code 0.");
        } 
        else if (activeLang === 'javascript') {
            const dynamicLogs = [];
            const customConsole = {
                log: (...args) => dynamicLogs.push(args.join(' ')),
                error: (...args) => dynamicLogs.push("ERR: " + args.join(' ')),
                warn: (...args) => dynamicLogs.push("WARN: " + args.join(' '))
            };
            const interceptedWorker = new Function('console', code);
            interceptedWorker(customConsole);
            logTerminal("JS-CONSOLE", dynamicLogs.length ? dynamicLogs.join('\n') : "Script ran without printing outputs.");
        } 
        else if (activeLang === 'html') {
            const previewWindow = window.open();
            if (previewWindow) {
                previewWindow.document.open();
                previewWindow.document.write(code);
                previewWindow.document.close();
                logTerminal("DOM", "Static site frame rendered into a new browser window.");
            } else {
                logTerminal("ERROR", "Pop-up blocker intercepted preview window rendering.");
            }
        }
    } catch (e) {
        logTerminal("EXEC-ERROR", e.message);
    }
}

// Manifest Staging Configuration Output
function deployToGithub() {
    if (!currentFileId) return;
    const code = editor.getValue();
    USW_DATA.updateFileCode(currentUser, currentFileId, code);
    
    const file = USW_DATA.getFile(currentUser, currentFileId);
    logTerminal("DEPLOY", "Packaging current workspace environment file...");
    
    const exportBundle = {
        deploymentId: crypto.randomUUID(),
        node: USW_CONFIG.APP_NAME,
        author: currentUser,
        filename: file.filename,
        payload: btoa(code)
    };
    
    navigator.clipboard.writeText(JSON.stringify(exportBundle, null, 2))
        .then(() => logTerminal("DEPLOY", "Data package compiled! Payload architecture structure added to your clipboard."))
        .catch(() => logTerminal("DEPLOY", `Export generated internally for target name: ${file.filename}`));
}

function logTerminal(channel, text) {
    const logBox = document.getElementById('terminal-log-stream');
    if (!logBox) return;
    const timestamp = new Date().toLocaleTimeString();
    logBox.value += `[${timestamp}] [${channel}] » ${text}\n`;
    logBox.scrollTop = logBox.scrollHeight;
}

function updateSidebar() {
    const container = document.getElementById('saved-files-list');
    container.innerHTML = "";
    
    const workspaceFiles = USW_DATA.getAllUserFiles(currentUser);
    
    if (workspaceFiles.length === 0) {
        container.innerHTML = `<div class="empty-vfs">Workspace is completely clear.</div>`;
        return;
    }

    workspaceFiles.forEach(file => {
        const row = document.createElement('div');
        row.className = 'saved-item';
        
        const label = document.createElement('span');
        label.innerText = `⚙️ ${file.filename}`;
        label.onclick = () => launchIDE(file.id);
        
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-file-btn';
        delBtn.innerText = "✕";
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if(confirm(`Completely delete code stream file: ${file.filename}?`)) {
                USW_DATA.deleteFile(currentUser, file.id);
                if (currentFileId === file.id) backToMenu();
                else updateSidebar();
            }
        };

        row.appendChild(label);
        row.appendChild(delBtn);
        container.appendChild(row);
    });
}

function backToMenu() {
    if (currentFileId) {
        USW_DATA.updateFileCode(currentUser, currentFileId, editor.getValue());
    }
    currentFileId = null;
    document.getElementById('editor-stage').classList.add('hidden');
    document.getElementById('runtime-controls').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    updateSidebar();
}
