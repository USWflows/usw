let editor, pyodide, activeLang, currentUser = null;

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
        backgroundColor: "#000000"
    });
});

function handleAuth(type) {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const msg = document.getElementById('auth-msg');
    if (type === 'signup') {
        if(USW_DATA.saveUser(u, p)) msg.innerText = "ID CREATED. LOGIN.";
        else msg.innerText = "ID UNAVAILABLE.";
    } else {
        if (USW_DATA.verifyUser(u, p)) {
            currentUser = u;
            sessionStorage.setItem('usw_user', u);
            document.getElementById('auth-overlay').classList.add('hidden');
            updateSidebar();
        } else msg.innerText = "ACCESS DENIED.";
    }
}

async function launchIDE(lang, isNew) {
    activeLang = lang;
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('editor-stage').classList.remove('hidden');
    document.getElementById('runtime-controls').classList.remove('hidden');
    
    const mode = (lang === 'html') ? 'html' : (lang === 'javascript' ? 'javascript' : 'python');
    monaco.editor.setModelLanguage(editor.getModel(), mode);

    if (isNew) editor.setValue("");
    else editor.setValue(USW_DATA.loadCode(currentUser, lang) || "");

    if (lang === 'python' && !pyodide) {
        document.getElementById('output-stream').innerText = "SYSTEM: MOUNTING...";
        pyodide = await loadPyodide();
        document.getElementById('output-stream').innerText = "SYSTEM: READY.";
    }
}

async function runCode() {
    const out = document.getElementById('output-stream');
    const code = editor.getValue();
    out.innerText = "RUNNING...";
    try {
        if (activeLang === 'python') {
            await pyodide.runPythonAsync(`import sys, io\nsys.stdout = io.StringIO()`);
            await pyodide.runPythonAsync(code);
            out.innerText = "PY: " + pyodide.runPython("sys.stdout.getvalue()");
        } else if (activeLang === 'javascript') {
            const runner = new Function(code);
            runner();
            out.innerText = "JS: EXECUTED.";
        } else if (activeLang === 'html') {
            const win = window.open();
            win.document.write(code);
            out.innerText = "HTML: RENDERED.";
        }
    } catch (e) { out.innerText = "ERR: " + e.message; }
}

function updateSidebar() {
    const list = document.getElementById('saved-files-list');
    const users = JSON.parse(localStorage.getItem('usw_users') || '{}');
    const snippets = users[currentUser]?.snippets || {};
    list.innerHTML = "";
    Object.keys(snippets).forEach(lang => {
        const div = document.createElement('div');
        div.className = 'saved-item';
        div.innerText = `recover_${lang}.src`;
        div.onclick = () => launchIDE(lang, false);
        list.appendChild(div);
    });
}

function backToMenu() {
    document.getElementById('editor-stage').classList.add('hidden');
    document.getElementById('runtime-controls').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    updateSidebar();
}

function deployToGithub() {
    USW_DATA.saveCode(currentUser, activeLang, editor.getValue());
    updateSidebar();
}

