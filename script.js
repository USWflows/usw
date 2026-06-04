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

async function launchIDE(lang, isNew, fileId = null) {
    activeLang = lang;
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('editor-stage').classList.remove('hidden');
    document.getElementById('runtime-controls').classList.remove('hidden');
    
    const mode = (lang === 'html') ? 'html' : (lang === 'javascript' ? 'javascript' : 'python');
    monaco.editor.setModelLanguage(editor.getModel(), mode);

    if (isNew) {
        editor.setValue("");
        currentFileId = null; // Fresh workspace session
    } else if (fileId) {
        // Direct open from the nested files inside the sidebar tree
        currentFileId = fileId;
        const fileRecord = USW_DATA.getFile(currentUser, fileId);
        if (fileRecord) editor.setValue(fileRecord.code || "");
    } else {
        // Fallback safety to locate an existing file if clicking text links
        const userFiles = USW_DATA.getAllUserFiles(currentUser);
        const match = userFiles.find(f => f.lang === lang);
        if (match) {
            // FIX: Ensure this state is properly tracked globally
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

    // Grouping our files by workspace profiles (HTML, JavaScript, Python)
    const groups = {
        'html': { title: '🗁 HTML / CSS Workspace', files: [] },
        'javascript': { title: '🗁 JS Workspace', files: [] },
        'python': { title: '🗁 Python 3 Workspace', files: [] }
    };

    userFiles.forEach(file => {
        if (groups[file.lang]) {
            groups[file.lang].files.push(file);
        }
    });

    // Generate nested folder project entries inside your recent files view
    Object.keys(groups).forEach(key => {
        const group = groups[key];
        if (group.files.length === 0) return;

        // Parent Project Container Folder
        const groupFolder = document.createElement('div');
        groupFolder.style.marginBottom = "0.75rem";
        
        const folderHeader = document.createElement('div');
        folderHeader.style.cssText = "font-size: 0.8rem; font-weight: 500; color: #e2e8f0; padding: 0.4rem 0.5rem; cursor: pointer; border-radius: 4px; transition: background 0.2s;";
        folderHeader.innerText = group.title;
        folderHeader.onclick = () => {
            const contents = folderHeader.nextElementSibling;
            contents.style.display = contents.style.display === 'none' ? 'block' : 'none';
        };

        // File List Wrap Component
        const folderContents = document.createElement('div');
        folderContents.style.paddingLeft = "1rem";
        folderContents.style.marginTop = "0.25rem";

        group.files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'saved-item';
            fileItem.style.cssText = "font-size: 0.75rem; padding: 0.4rem 0.6rem; color: #626a7a; border-left: 1px solid rgba(255,255,255,0.05); margin-bottom: 2px;";
            fileItem.innerText = `📄 ${file.filename}`;
            fileItem.onclick = (e) => {
                e.stopPropagation();
                launchIDE(file.lang, false, file.id);
            };
            folderContents.appendChild(fileItem);
        });

        groupFolder.appendChild(folderHeader);
        groupFolder.appendChild(folderContents);
        list.appendChild(groupFolder);
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
    
    if (!currentUser) {
        out.innerText = "Error: No user logged in.";
        return;
    }

    if (currentFileId) {
        // Safely overwrites file code inside database
        USW_DATA.updateFileCode(currentUser, currentFileId, codeContent);
    } else {
        // Capture the brand new ID returned from storage.js and assign it globally!
        const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const projectTitle = `script_${timestamp.replace(' ','').toLowerCase()}.${activeLang === 'html' ? 'html' : activeLang === 'javascript' ? 'js' : 'py'}`;
        
        // FIX: Assign this to currentFileId instead of just letting it float
        currentFileId = USW_DATA.createFile(currentUser, projectTitle, activeLang, codeContent);
    }
    
    out.innerText = "Changes saved securely.";
    updateSidebar();
}
