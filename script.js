let editor, pyodide, activeLang, currentUser = null;
let currentFileId = null; // Dynamically links editor instances to storage IDs

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
            .then(() => console.log("AETHER: Kernel Online"))
            .catch(err => console.log("AETHER: Kernel Error", err));
    }
});

// MONACO SETUP
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
require(['vs/editor/editor.main'], function() {
    editor = monaco.editor.create(document.getElementById('monaco-canvas'), {
        theme: 'vs-dark', automaticLayout: true, fontSize: 16, 
        fontFamily: "'JetBrains Mono'", minimap: { enabled: false },
        backgroundColor: "#0a0a0c" // Deep tint to match your new workspace theme
    });
});

function handleAuth(type) {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const msg = document.getElementById('auth-msg');
    if (type === 'signup') {
        if(USW_DATA.saveUser(u, p)) {
            msg.style.color = "#39e393";
            msg.innerText = "Account created successfully! Please sign in.";
        } else {
            msg.style.color = "#ff6b6b";
            msg.innerText = "This username is already taken.";
        }
    } else {
        if (USW_DATA.verifyUser(u, p)) {
            currentUser = u;
            sessionStorage.setItem('usw_user', u);
            document.getElementById('auth-overlay').classList.add('hidden');
            updateSidebar();
        } else {
            msg.style.color = "#ff6b6b";
            msg.innerText = "Incorrect username or password.";
        }
    }
}

async function launchIDE(lang, isNew) {
    activeLang = lang;
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('editor-stage').classList.remove('hidden');
    document.getElementById('runtime-controls').classList.remove('hidden');
    
    const mode = (lang === 'html') ? 'html' : (lang === 'javascript' ? 'javascript' : 'python');
    monaco.editor.setModelLanguage(editor.getModel(), mode);

    if (isNew) {
        editor.setValue("");
        currentFileId = null; // Fresh workspace session
    } else {
        // Fallback safety to locate an existing file if parsing raw history
        const userFiles = USW_DATA.getAllUserFiles(currentUser);
        const match = userFiles.find(f => f.lang === lang);
        if (match) {
            currentFileId = match.id;
            editor.setValue(match.code || "");
        } else {
            editor.setValue("");
            currentFileId = null;
        }
    }

    if (lang === 'python' && !pyodide) {
        document.getElementById('output-stream').innerText = "System: Launching Python Runtime...";
        pyodide = await loadPyodide();
        document.getElementById('output-stream').innerText = "System: Ready.";
    }
}

async function runCode() {
    const out = document.getElementById('output-stream');
    const code = editor.getValue();
    out.innerText = "Running...";
    try {
        if (activeLang === 'python') {
            await pyodide.runPythonAsync(`import sys, io\nsys.stdout = io.StringIO()`);
            await pyodide.runPythonAsync(code);
            out.innerText = "Python result: " + pyodide.runPython("sys.stdout.getvalue()");
        } else if (activeLang === 'javascript') {
            const runner = new Function(code);
            runner();
            out.innerText = "JavaScript executed successfully.";
        } else if (activeLang === 'html') {
            const win = window.open();
            win.document.write(code);
            out.innerText = "HTML rendered in new tab.";
        }
    } catch (e) { out.innerText = "Error: " + e.message; }
}

function updateSidebar() {
    const list = document.getElementById('saved-files-list');
    list.innerHTML = "";
    
    // Safely retrieves user assets using your official storage layout API
    const userFiles = USW_DATA.getAllUserFiles(currentUser);
    
    if (userFiles.length === 0) {
        list.innerHTML = `<div style="font-size: 0.75rem; color: #626a7a; padding: 0.5rem 0.8rem; font-style: italic;">No recent projects</div>`;
        return;
    }

    userFiles.forEach(file => {
        const div = document.createElement('div');
        div.className = 'saved-item';
        div.innerText = file.filename;
        div.onclick = () => {
            launchIDE(file.lang, false);
            currentFileId = file.id;
            const fileRecord = USW_DATA.getFile(currentUser, file.id);
            if (fileRecord) editor.setValue(fileRecord.code);
        };
        list.appendChild(div);
    });
}

function backToMenu() {
    document.getElementById('editor-stage').classList.add('hidden');
    document.getElementById('runtime-controls').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('output-stream').innerText = "System ready.";
    updateSidebar();
}

function deployToGithub() {
    const codeContent = editor.getValue();
    const out = document.getElementById('output-stream');
    
    if (currentFileId) {
        // Safely overwrites file code inside database
        USW_DATA.updateFileCode(currentUser, currentFileId, codeContent);
    } else {
        // Creates a fresh entry, capturing the brand new ID returned from storage.js
        const projectTitle = `project_${activeLang}.src`;
        currentFileId = USW_DATA.createFile(currentUser, projectTitle, activeLang, codeContent);
    }
    
    out.innerText = "Changes saved securely.";
    updateSidebar();
}
