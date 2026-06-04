let editor, pyodide, activeLang, currentUser = null;
let currentFileId = null; // Tracks current file entity state bindings

// SERVICE WORKER & SESSION INIT
window.addEventListener('load', () => {
    // Note: session storage here only persists username tracking, never passwords or raw file assets.
    const savedUser = sessionStorage.getItem('usw_user');
    if (savedUser) {
        currentUser = savedUser;
        document.getElementById('auth-overlay').classList.add('hidden');
        // Let the app context know we need authorization keys mapped if coming from cold load
        document.getElementById('auth-msg').innerText = "Session expired. Please re-authenticate.";
        document.getElementById('auth-overlay').classList.remove('hidden');
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
        backgroundColor: "#0a0a0c"
    });
});

// Upgraded async auth gateway to absorb the non-blocking cryptographic verification pass
async function handleAuth(type) { 
    const u = document.getElementById('username').value; 
    const p = document.getElementById('password').value; 
    const msg = document.getElementById('auth-msg'); 
    
    if (type === 'signup') {
        if (await USW_DATA.saveUser(u, p)) { 
            msg.style.color = "#39e393"; 
            msg.innerText = "Secure Vault created successfully! Please sign in."; 
        } else {
            msg.style.color = "#ff6b6b"; 
            msg.innerText = "This username is already taken."; 
        }
    } else {
        if (await USW_DATA.verifyUser(u, p)) { 
            currentUser = u; 
            sessionStorage.setItem('usw_user', u); 
            document.getElementById('auth-overlay').classList.add('hidden'); 
            await updateSidebar(); 
        } else {
            msg.style.color = "#ff6b6b"; 
            msg.innerText = "Decryption failure. Incorrect credentials.";
        }
    }
}

async function launchIDE(lang, isNew, fileId = null) {
    activeLang = lang;
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('editor-stage').classList.remove('hidden');
    document.getElementById('runtime-controls').classList.remove('hidden');
    
    const mode = (lang === 'html') ? 'html' : (lang === 'javascript' ? 'javascript' : 'python');
    monaco.editor.setModelLanguage(editor.getModel(), mode);

    if (isNew) {
        editor.setValue("");
        currentFileId = null; 
    } else if (fileId) {
        currentFileId = fileId;
        const fileRecord = await USW_DATA.getFile(currentUser, fileId);
        if (fileRecord) editor.setValue(fileRecord.code || "");
    } else {
        const userFiles = await USW_DATA.getAllUserFiles(currentUser);
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

async function updateSidebar() {
    const list = document.getElementById('saved-files-list');
    list.innerHTML = "";
    
    const userFiles = await USW_DATA.getAllUserFiles(currentUser);
    
    if (userFiles.length === 0) {
        list.innerHTML = `<div style="font-size: 0.75rem; color: #626a7a; padding: 0.5rem 0.8rem; font-style: italic;">No recent projects</div>`;
        return;
    }

    const groups = {
        'html': { title: '浴 HTML / CSS Workspace', files: [] },
        'javascript': { title: '浴 JS Workspace', files: [] },
        'python': { title: '浴 Python 3 Workspace', files: [] }
    };

    userFiles.forEach(file => {
        if (groups[file.lang]) {
            groups[file.lang].files.push(file);
        }
    });

    Object.keys(groups).forEach(key => {
        const group = groups[key];
        if (group.files.length === 0) return;

        const groupFolder = document.createElement('div');
        groupFolder.style.marginBottom = "0.75rem";
        
        const folderHeader = document.createElement('div');
        folderHeader.style.cssText = "font-size: 0.8rem; font-weight: 500; color: #e2e8f0; padding: 0.4rem 0.5rem; cursor: pointer; border-radius: 4px; transition: background 0.2s;";
        folderHeader.innerText = group.title;
        folderHeader.onclick = () => {
            const contents = folderHeader.nextElementSibling;
            contents.style.display = contents.style.display === 'none' ? 'block' : 'none';
        };

        const folderContents = document.createElement('div');
        folderContents.style.paddingLeft = "1rem";
        folderContents.style.marginTop = "0.25rem";

        group.files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'saved-item';
            fileItem.style.cssText = "font-size: 0.75rem; padding: 0.4rem 0.6rem; color: #626a7a; border-left: 1px solid rgba(255,255,255,0.05); margin-bottom: 2px;";
            fileItem.innerText = `塘 ${file.filename}`;
            fileItem.onclick = async (e) => {
                e.stopPropagation();
                await launchIDE(file.lang, false, file.id);
            };
            folderContents.appendChild(fileItem);
        });

        groupFolder.appendChild(folderHeader);
        groupFolder.appendChild(folderContents);
        list.appendChild(groupFolder);
    });
}

async function backToMenu() {
    document.getElementById('editor-stage').classList.add('hidden');
    document.getElementById('runtime-controls').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('output-stream').innerText = "System ready.";
    await updateSidebar();
}

async function deployToGithub() {
    const codeContent = editor.getValue();
    const out = document.getElementById('output-stream');
    
    if (!currentUser) {
        out.innerText = "Error: No user logged in.";
        return;
    }

    if (currentFileId) {
        await USW_DATA.updateFileCode(currentUser, currentFileId, codeContent);
    } else {
        const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const projectTitle = `script_${timestamp.replace(' ','').toLowerCase()}.${activeLang === 'html' ? 'html' : activeLang === 'javascript' ? 'js' : 'py'}`;
        currentFileId = await USW_DATA.createFile(currentUser, projectTitle, activeLang, codeContent);
    }
    
    out.innerText = "Changes securely encrypted and saved.";
    await updateSidebar();
}
