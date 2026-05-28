let editor, pyodide, activeLang;
let currentFileId = null;
let currentUser = null;

// Check if user is already logged in on page reload
window.addEventListener('load', () => {
    const savedUser = sessionStorage.getItem('usw_user');
    if (savedUser) {
        currentUser = savedUser;
        document.getElementById('auth-overlay').classList.add('hidden');
        showDashboard();
    }
});

// Setup the main Code Editor
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
require(['vs/editor/editor.main'], function() {
    editor = monaco.editor.create(document.getElementById('monaco-canvas'), {
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 14,
        minimap: { enabled: false }
    });
});

// Controls Sign-in and Registration
function handleAuth(type) {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value;
    const msg = document.getElementById('auth-msg');

    if (!u || !p) {
        msg.innerText = "Please enter both a username and password.";
        return;
    }

    if (type === 'signup') {
        if (USW_DATA.saveUser(u, p)) {
            msg.style.color = "#00ffaa";
            msg.innerText = "Account created! Logging you in...";
            setTimeout(() => handleAuth('login'), 800);
        } else {
            msg.innerText = "That username is already taken.";
        }
    } else {
        if (USW_DATA.verifyUser(u, p)) {
            currentUser = u;
            sessionStorage.setItem('usw_user', u);
            document.getElementById('auth-overlay').classList.add('hidden');
            showDashboard();
        } else {
            msg.innerText = "Wrong username or password.";
        }
    }
}

function showDashboard() {
    updateSidebarList();
    document.getElementById('welcome-tag').innerText = `Logged in as: ${currentUser}`;
}

// Prompts user to name a new file and creates it
function createNewFile(lang) {
    const name = prompt(`Name your new ${lang.toUpperCase()} file:`, "untitled");
    if (!name) return;

    const ext = lang === 'python' ? 'py' : (lang === 'javascript' ? 'js' : 'html');
    const fullTitle = `${name}.${ext}`;
    const startingCode = USW_CONFIG.TEMPLATES[lang] || "";

    const newId = USW_DATA.createFile(currentUser, fullTitle, lang, startingCode);
    updateSidebarList();
    openEditor(newId);
}

// Opens a file into the code editor
async function openEditor(fileId) {
    const file = USW_DATA.getFile(currentUser, fileId);
    if (!file) return;

    currentFileId = fileId;
    activeLang = file.lang;

    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('editor-stage').classList.remove('hidden');
    document.getElementById('runtime-controls').classList.remove('hidden');
    
    // Set text editor syntax language highlight
    const mode = activeLang === 'html' ? 'html' : (activeLang === 'javascript' ? 'javascript' : 'python');
    monaco.editor.setModelLanguage(editor.getModel(), mode);
    editor.setValue(file.code);

    // If it's Python, load the compiler engine in the background
    if (activeLang === 'python' && !pyodide) {
        printToConsole("System", "Loading Python engine... Please wait.");
        try {
            pyodide = await loadPyodide();
            printToConsole("System", "Python loaded successfully! Ready to run.");
        } catch (err) {
            printToConsole("Error", "Could not load Python: " + err.message);
        }
    }
}

// The Run Button Engine
async function runCode() {
    if (!currentFileId) return;
    const code = editor.getValue();
    
    // Auto-save changes right before running
    USW_DATA.updateFileCode(currentUser, currentFileId, code);
    printToConsole("System", "Running code...");
    
    try {
        if (activeLang === 'python') {
            if (!pyodide) { printToConsole("Error", "Python is still loading."); return; }
            await pyodide.runPythonAsync(`
import sys, io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
            `);
            await pyodide.runPythonAsync(code);
            const stdout = pyodide.runPython("sys.stdout.getvalue()");
            const stderr = pyodide.runPython("sys.stderr.getvalue()");
            
            if (stdout) printToConsole("Output", stdout.trim());
            if (stderr) printToConsole("Error", stderr.trim());
            if (!stdout && !stderr) printToConsole("System", "Finished running with zero errors.");
        } 
        else if (activeLang === 'javascript') {
            const logs = [];
            const fakeConsole = {
                log: (...args) => logs.push(args.join(' ')),
                error: (...args) => logs.push("ERROR: " + args.join(' ')),
                warn: (...args) => logs.push("WARN: " + args.join(' '))
            };
            const executeJS = new Function('console', code);
            executeJS(fakeConsole);
            printToConsole("Console", logs.length ? logs.join('\n') : "Code executed successfully. (Nothing was printed)");
        } 
        else if (activeLang === 'html') {
            const newTab = window.open();
            if (newTab) {
                newTab.document.open();
                newTab.document.write(code);
                newTab.document.close();
                printToConsole("System", "Opened website layout inside a new tab page window preview.");
            } else {
                printToConsole("Error", "Popup blocked! Allow popups to see your website preview.");
            }
        }
    } catch (e) {
        printToConsole("Crash Error", e.message);
    }
}

function printToConsole(label, text) {
    const box = document.getElementById('console-box');
    if (!box) return;
    box.value += `[${label}] ${text}\n`;
    box.scrollTop = box.scrollHeight;
}

// Updates list of files on dashboard home
function updateSidebarList() {
    const listArea = document.getElementById('saved-files-list');
    listArea.innerHTML = "";
    
    const files = USW_DATA.getAllUserFiles(currentUser);
    
    if (files.length === 0) {
        listArea.innerHTML = `<div style="color:#777; text-align:center; margin-top:20px;">No files created yet.</div>`;
        return;
    }

    files.forEach(file => {
        const row = document.createElement('div');
        row.className = 'file-list-row';
        
        const nameSpan = document.createElement('span');
        nameSpan.innerText = file.filename;
        nameSpan.style.flexGrow = "1";
        nameSpan.onclick = () => openEditor(file.id);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerText = "Delete";
        deleteBtn.style.background = "#ff4444";
        deleteBtn.style.color = "white";
        deleteBtn.style.border = "none";
        deleteBtn.style.padding = "4px 8px";
        deleteBtn.style.cursor = "pointer";
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if(confirm(`Delete ${file.filename} permanently?`)) {
                USW_DATA.deleteFile(currentUser, file.id);
                if (currentFileId === file.id) exitEditor();
                else updateSidebarList();
            }
        };

        row.appendChild(nameSpan);
        row.appendChild(deleteBtn);
        listArea.appendChild(row);
    });
}

function exitEditor() {
    if (currentFileId) {
        USW_DATA.updateFileCode(currentUser, currentFileId, editor.getValue());
    }
    currentFileId = null;
    document.getElementById('editor-stage').classList.add('hidden');
    document.getElementById('runtime-controls').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    updateSidebarList();
}
