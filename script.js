let editor, pyodide, activeLang, currentUser = null;
let currentFileId = null;

// SERVICE WORKER & SESSION INIT
window.addEventListener('load', () => {
    const savedUser = sessionStorage.getItem('usw_user');
    if (savedUser) {
        currentUser = savedUser;
        document.getElementById('auth-overlay').classList.add('hidden');
        updateSidebar();
    }
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./server.js', { scope: './' })
            .then(() => console.log("USW_KERNEL: Connected successfully."))
            .catch(err => console.error("USW_KERNEL: Worker error.", err));
    }
});

// MONACO SETUP
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
require(['vs/editor/editor.main'], function() {
    editor = monaco.editor.create(document.getElementById('monaco-canvas'), {
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 16,
        fontFamily: "'JetBrains Mono', monospace",
        minimap: { enabled: false },
        backgroundColor: "#0a0a0c"
    });
});

async function handleAuth(type) {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value;
    const msg = document.getElementById('auth-msg');

    if (!u || !p) {
        msg.innerText = "Fields cannot be blank.";
        return;
    }

    if (type === 'signup') {
        const success = USW_DATA.saveUser(u, p);
        msg.innerText = success ? "Account provisioned. Please log in." : "Username already exists.";
    } else {
        const valid = USW_DATA.verifyUser(u, p);
        if (valid) {
            currentUser = u;
            sessionStorage.setItem('usw_user', u);
            document.getElementById('auth-overlay').classList.add('hidden');
            document.getElementById('output-stream').innerText = "System online. Secure environment decrypted.";
            updateSidebar();
        } else {
            msg.innerText = "Invalid credentials.";
        }
    }
}

async function launchIDE(lang, isNew, fileId = null) {
    activeLang = lang;
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('editor-stage').classList.remove('hidden');
    document.getElementById('runtime-controls').classList.remove('hidden');

    const mode = lang === 'html' ? 'html' : (lang === 'javascript' ? 'javascript' : 'python');
    monaco.editor.setModelLanguage(editor.getModel(), mode);

    const out = document.getElementById('output-stream');

    if (isNew) {
        editor.setValue("");
        currentFileId = null;
        out.innerText = `New ${lang.toUpperCase()} workspace open.`;
    } else if (fileId) {
        currentFileId = fileId;
        const file = USW_DATA.getFile(currentUser, fileId);
        if (file) {
            editor.setValue(file.code || "");
            out.innerText = `Mounted file: ${file.filename}`;
        }
    }

    if (lang === 'python' && !pyodide) {
        out.innerText = "Initializing WebAssembly Python environment...";
        try {
            pyodide = await loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
            });
            out.innerText = "Python environment active and ready.";
        } catch (err) {
            out.innerText = `Initialization Error: ${err.message}`;
        }
    }
}

function runCode() {
    const code = editor.getValue();
    const out = document.getElementById('output-stream');
    out.innerText = "Executing script...";

    try {
        if (activeLang === 'javascript') {
            const result = new Function(code)();
            out.innerText = result !== undefined ? `[Output]: ${result}` : "Code executed successfully with no return value.";
        } else if (activeLang === 'python') {
            if (!pyodide) {
                out.innerText = "Error: Python environment is still starting up.";
                return;
            }
            pyodide.runPythonAsync(`import sys, io\nsys.stdout = io.StringIO()`)
                .then(() => pyodide.runPythonAsync(code))
                .then(() => {
                    const output = pyodide.runPython("sys.stdout.getvalue()");
                    out.innerText = output || "Python execution complete.";
                })
                .catch(err => { out.innerText = `Python Error: ${err.message}`; });
        } else if (activeLang === 'html') {
            const win = window.open();
            win.document.write(code);
            win.document.close();
            out.innerText = "HTML page rendered in a separate window tab.";
        }
    } catch (err) {
        out.innerText = `Execution Error: ${err.message}`;
    }
}

function deployToGithub() {
    const content = editor.getValue();
    const out = document.getElementById('output-stream');

    if (!currentUser) {
        out.innerText = "Error: Session tracking lost.";
        return;
    }

    if (currentFileId) {
        USW_DATA.updateFileCode(currentUser, currentFileId, content);
    } else {
        const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const ext = activeLang === 'html' ? 'html' : (activeLang === 'javascript' ? 'js' : 'py');
        const name = `script_${time.replace(/[:\s]/g, '').toLowerCase()}.${ext}`;
        currentFileId = USW_DATA.createFile(currentUser, name, activeLang, content);
    }

    out.innerText = "Changes saved securely to local drive.";
    updateSidebar();
}

function updateSidebar() {
    const list = document.getElementById('saved-files-list');
    if (!list) return;
    list.innerHTML = "";

    const files = USW_DATA.getAllUserFiles(currentUser);
    if (files.length === 0) {
        list.innerHTML = `<div style="padding: 10px; font-size: 0.8rem; color: #626a7a; font-style: italic;">No saved files found.</div>`;
        return;
    }

    files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'saved-item';
        item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px; margin-bottom: 4px; background: rgba(255,255,255,0.02); border-radius: 4px; cursor: pointer;";
        item.innerHTML = `<span>📄 ${file.filename}</span><span class="del-btn" style="color: #626a7a; padding: 0 4px;">✕</span>`;
        
        item.onclick = () => launchIDE(file.lang, false, file.id);
        
        item.querySelector('.del-btn').onclick = (e) => {
            e.stopPropagation();
            if (confirm("Delete this file permanently?")) {
                USW_DATA.deleteFile(currentUser, file.id);
                if (currentFileId === file.id) {
                    editor.setValue("");
                    currentFileId = null;
                }
                updateSidebar();
            }
        };
        list.appendChild(item);
    });
}

function backToMenu() {
    document.getElementById('editor-stage').classList.add('hidden');
    document.getElementById('runtime-controls').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('output-stream').innerText = "System ready.";
    updateSidebar();
}
