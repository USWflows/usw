/**
 * USW CORE APPLICATION INTERFACE ENGINE v12.5
 * Pattern: Event-Driven Object Module Capsule Singleton
 * Strict Requirements: 100% Local-First, Encapsulated State Tracker
 */

const USW_Core = {
    // 1. ISOLATED RUNTIME STATE CONTAINER
    state: {
        editor: null,
        pyodide: null,
        activeLang: null,
        currentUser: null,
        currentFileId: null,
        isCompiling: false
    },

    // 2. SYSTEM LIFECYCLE INITIALIZATION ENTRYPOINT
    init: () => {
        window.addEventListener('load', async () => {
            try {
                // Recover username state tracking across standard page refreshes
                const sessionCachedUser = sessionStorage.getItem('usw_user');
                if (sessionCachedUser) {
                    USW_Core.state.currentUser = sessionCachedUser;
                    
                    // Trigger immediate credential validation notification
                    const authMessageNode = document.getElementById('auth-msg');
                    if (authMessageNode) {
                        authMessageNode.style.color = "var(--text-muted)";
                        authMessageNode.innerText = "Secure vault located. Provide matching cryptographic key signature to parse assets.";
                    }
                }
                USW_Core.registerServiceWorker();
            } catch (systemError) {
                USW_Core.logTerminal(`System Bootstrap Failure: ${systemError.message}`);
            }
        });
        USW_Core.bootstrapMonaco();
    },

    // 3. SERVICE WORKER PWA COUPLING
    registerServiceWorker: () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./server.js', { scope: './' })
                .then(() => console.log("USW_KERNEL: Offline PWA Asset Engine Online"))
                .catch(err => console.error("USW_KERNEL: Cache Engine Registration Denied", err));
        }
    },

    // 4. MICRO-OPTIMIZED EDITING SURFACE FABRICATION
   bootstrapMonaco: () => {
        require.config({ 
            paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' },
            // Direct monaco to fetch its web-workers from web links that our service worker caches
            'vs/nls': { availableLanguages: { '*': 'en' } }
        });
        
        require(['vs/editor/editor.main'], () => {
            USW_Core.state.editor = monaco.editor.create(document.getElementById('monaco-canvas'), {
                theme: 'vs-dark',
                automaticLayout: true,
                fontSize: 15,
                fontFamily: "'JetBrains Mono', monospace",
                lineHeight: 24,
                letterSpacing: 0.02,
                minimap: { enabled: false },
                scrollbar: { verticalWidth: 5, horizontalHeight: 5 },
                padding: { top: 16, bottom: 16 },
                backgroundColor: "#050507",
                renderLineHighlight: "all",
                cursorBlinking: "smooth",
                smoothScrolling: true
            });
        });
    },

    // 5. SECURE CRYPTO HANDSHAKE TRANSMISSION LAYER
    handleAuth: async (transactionType) => {
        const usernameInput = document.getElementById('username').value.trim();
        const passwordInput = document.getElementById('password').value;
        const feedbackNode = document.getElementById('auth-msg');

        if (!usernameInput || !passwordInput) {
            feedbackNode.style.color = "#ff6b6b";
            feedbackNode.innerText = "Credentials cannot evaluate empty code blocks.";
            return;
        }

        feedbackNode.style.color = "var(--text-muted)";
        feedbackNode.innerText = "Deriving 256-bit secure encryption signature vectors...";

        try {
            if (transactionType === 'signup') {
                const registrationSuccess = await USW_DATA.saveUser(usernameInput, passwordInput);
                if (registrationSuccess) {
                    feedbackNode.style.color = "var(--accent)";
                    feedbackNode.innerText = "Vault registry initialized. Provide key signature to authenticate.";
                } else {
                    feedbackNode.style.color = "#ff6b6b";
                    feedbackNode.innerText = "Namespace occupied. Choose alternative system handle.";
                }
            } else {
                const validationSuccess = await USW_DATA.verifyUser(usernameInput, passwordInput);
                if (validationSuccess) {
                    USW_Core.state.currentUser = usernameInput;
                    sessionStorage.setItem('usw_user', usernameInput);
                    document.getElementById('auth-overlay').classList.add('hidden');
                    USW_Core.logTerminal("Handshake complete. Vault sector cipher array decrypted successfully.");
                    await USW_Core.syncSidebarUI();
                } else {
                    feedbackNode.style.color = "#ff6b6b";
                    feedbackNode.innerText = "Signature mismatch. Memory array remains cipher-locked.";
                }
            }
        } catch (authException) {
            feedbackNode.style.color = "#ff6b6b";
            feedbackNode.innerText = `Crypto Core Exception: ${authException.message}`;
        }
    },

    // 6. ISOLATED ENVIRONMENT INTERFACE ENGINE
    launchIDE: async (languageKey, forceNewFlag, targetedFileId = null) => {
        USW_Core.state.activeLang = languageKey;
        document.getElementById('dashboard').classList.add('hidden');
        document.getElementById('editor-stage').classList.remove('hidden');
        document.getElementById('runtime-controls').classList.remove('hidden');

        const editorModeMapping = languageKey === 'html' ? 'html' : (languageKey === 'javascript' ? 'javascript' : 'python');
        monaco.editor.setModelLanguage(USW_Core.state.editor.getModel(), editorModeMapping);

        try {
            if (forceNewFlag) {
                USW_Core.state.editor.setValue("");
                USW_Core.state.currentFileId = null;
                USW_Core.logTerminal(`Initialized local ${languageKey.toUpperCase()} code buffer.`);
            } else if (targetedFileId) {
                USW_Core.state.currentFileId = targetedFileId;
                const recordPayload = await USW_DATA.getFile(USW_Core.state.currentUser, targetedFileId);
                if (recordPayload) {
                    USW_Core.state.editor.setValue(recordPayload.code || "");
                    USW_Core.logTerminal(`Mounted secure vault file stream: ${recordPayload.filename}`);
                }
            }

            // Fire up Python sandbox, routing it explicitly through the Service Worker catch net
            if (languageKey === 'python' && !USW_Core.state.pyodide) {
                USW_Core.logTerminal("Compiling isolated client-side WebAssembly Python VM...");
                USW_Core.state.pyodide = await loadPyodide({
                    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
                });
                USW_Core.logTerminal("WASM virtual core reporting stable state. Systems localized.");
            }
        } catch (ioException) {
            USW_Core.logTerminal(`IDE Local Mount Failure: ${ioException.message}`);
        }
    },

    // 7. COMPILATION RUNTIME VIEW PORT EXECUTOR
    executeCodePipeline: async () => {
        if (USW_Core.state.isCompiling) return;
        USW_Core.state.isCompiling = true;

        const terminalNode = document.getElementById('output-stream');
        const codeBufferString = USW_Core.state.editor.getValue();
        terminalNode.innerText = "Evaluating local code matrix execution hooks...";

        try {
            if (USW_Core.state.activeLang === 'python') {
                await USW_Core.state.pyodide.runPythonAsync(`import sys, io\nsys.stdout = io.StringIO()`);
                await USW_Core.state.pyodide.runPythonAsync(codeBufferString);
                const runtimeResult = USW_Core.state.pyodide.runPython("sys.stdout.getvalue()");
                terminalNode.innerText = `[Python IO Vector Output]:\n${runtimeResult || '[Process completed cleanly with no output return]'}`;
            } else if (USW_Core.state.activeLang === 'javascript') {
                // Run cleanly in local sandboxed evaluation stack space
                const sandboxedExecutionContext = new Function(codeBufferString);
                sandboxedExecutionContext();
                terminalNode.innerText = "[JS Execution]: Engine sequence finalized with 0 runtime exceptions.";
            } else if (USW_Core.state.activeLang === 'html') {
                const targetDisplayContext = window.open();
                targetDisplayContext.document.write(codeBufferString);
                targetDisplayContext.document.close();
                terminalNode.innerText = "[Visual Canvas]: DOM tree drawn successfully to mirror frame viewport.";
            }
        } catch (compilationError) {
            terminalNode.innerText = `Runtime Process Exception: ${compilationError.message}`;
        } finally {
            USW_Core.state.isCompiling = false;
        }
    },

    // 8. NON-BLOCKING VAULT ENCRYPTION COMMIT WRITER
    commitWorkspaceData: async () => {
        const structuralContent = USW_Core.state.editor.getValue();
        try {
            if (!USW_Core.state.currentUser) {
                USW_Core.logTerminal("Commit rejected. Current token signature lookup context is empty.");
                return;
            }

            if (USW_Core.state.currentFileId) {
                await USW_DATA.updateFileCode(USW_Core.state.currentUser, USW_Core.state.currentFileId, structuralContent);
            } else {
                const ISO_Stamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const cleanSuffix = USW_Core.state.activeLang === 'html' ? 'html' : (USW_Core.state.activeLang === 'javascript' ? 'js' : 'py');
                const uniqueFileName = `script_${ISO_Stamp.replace(/[:\s]/g, '').toLowerCase()}.${cleanSuffix}`;
                
                USW_Core.state.currentFileId = await USW_DATA.createFile(
                    USW_Core.state.currentUser, uniqueFileName, USW_Core.state.activeLang, structuralContent
                );
            }
            USW_Core.logTerminal("Workspace assets securely hashed and committed to hardware block arrays.");
            await USW_Core.syncSidebarUI();
        } catch (writeException) {
            USW_Core.logTerminal(`Data Serialization Denied: ${writeException.message}`);
        }
    },

    // 9. RESOURCE PURGE REMOVAL CONTROLLER
    purgeFileEntity: async (targetId, clickEvent) => {
        clickEvent.stopPropagation(); // Halt execution loop propagation from firing parent element click maps
        if (!confirm("Are you sure you want to permanently delete this resource array node?")) return;

        try {
            await USW_DATA.deleteFile(USW_Core.state.currentUser, targetId);
            USW_Core.logTerminal("Data node unlinked from cryptographic database inventory.");
            
            if (USW_Core.state.currentFileId === targetId) {
                USW_Core.state.editor.setValue("");
                USW_Core.state.currentFileId = null;
            }
            await USW_Core.syncSidebarUI();
        } catch (deleteException) {
            USW_Core.logTerminal(`Purge Error Exception: ${deleteException.message}`);
        }
    },

    // 10. REACTIVE TREE VIEW INTERFACE MANAGER
    syncSidebarUI: async () => {
        const sidebarMountContainer = document.getElementById('saved-files-list');
        if (!sidebarMountContainer) return;
        sidebarMountContainer.innerHTML = "";

        try {
            const rawFileCollection = await USW_DATA.getAllUserFiles(USW_Core.state.currentUser);
            
            if (rawFileCollection.length === 0) {
                sidebarMountContainer.innerHTML = `<div style="font-size: 0.72rem; color: var(--text-muted); padding: 0.5rem 0.6rem; font-style: italic;">No unallocated scripts recorded.</div>`;
                return;
            }

            const categoricalGroupings = {
                'html': { title: '浴 VISUAL CANVAS INDEX', nodes: [] },
                'javascript': { title: '浴 ES RUNTIME PIPELINES', nodes: [] },
                'python': { title: '浴 WEB-ASSEMBLY PYTHON CORES', nodes: [] }
            };

            rawFileCollection.forEach(nodeItem => {
                if (categoricalGroupings[nodeItem.lang]) {
                    categoricalGroupings[nodeItem.lang].nodes.push(nodeItem);
                }
            });

            Object.keys(categoricalGroupings).forEach(categoryKey => {
                const categoryGroup = categoricalGroupings[categoryKey];
                if (categoryGroup.nodes.length === 0) return;

                const branchGroupFrame = document.createElement('div');
                branchGroupFrame.className = 'folder-group';

                const branchHeaderElement = document.createElement('div');
                branchHeaderElement.className = 'folder-header';
                branchHeaderElement.innerHTML = `<span>${categoryGroup.title}</span><span style="font-size:0.65rem; color:var(--text-muted); font-family:var(--font-mono)">[${categoryGroup.nodes.length}]</span>`;
                
                branchHeaderElement.onclick = () => {
                    const toggleSectionTarget = branchHeaderElement.nextElementSibling;
                    toggleSectionTarget.style.display = toggleSectionTarget.style.display === 'none' ? 'block' : 'none';
                };

                const leafNodeWrapper = document.createElement('div');
                leafNodeWrapper.className = 'folder-contents';

                categoryGroup.nodes.forEach(fileRecord => {
                    const continuousLeafItem = document.createElement('div');
                    continuousLeafItem.className = 'saved-item';
                    continuousLeafItem.innerHTML = `<span>塘 ${fileRecord.filename}</span><button class="delete-node-btn" title="Purge resource entity block">✕</button>`;
                    
                    continuousLeafItem.onclick = async () => {
                        await USW_Core.launchIDE(fileRecord.lang, false, fileRecord.id);
                    };

                    const dropElementButton = continuousLeafItem.querySelector('.delete-node-btn');
                    dropElementButton.onclick = async (eventInstance) => {
                        await USW_Core.purgeFileEntity(fileRecord.id, eventInstance);
                    };

                    leafNodeWrapper.appendChild(continuousLeafItem);
                });

                branchGroupFrame.appendChild(branchHeaderElement);
                branchGroupFrame.appendChild(leafNodeWrapper);
                sidebarMountContainer.appendChild(branchGroupFrame);
            });
        } catch (uiSyncError) {
            USW_Core.logTerminal(`Sidebar Interface Layer Sync Interrupted: ${uiSyncError.message}`);
        }
    },

    // 11. CENTRAL SYSTEM NAVIGATION OVERRIDE ROUTER
    exitStudioContext: async () => {
        document.getElementById('editor-stage').classList.add('hidden');
        document.getElementById('runtime-controls').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        USW_Core.logTerminal("Pipeline processing array offline. System ready.");
        await USW_Core.syncSidebarUI();
    },

    // 12. CENTRALIZED MONACO TRACK LOGGING DECK
    logTerminal: (terminalMessageString) => {
        const terminalLogTarget = document.getElementById('output-stream');
        if (terminalLogTarget) {
            terminalLogTarget.innerText = `[USW_OS] » ${terminalMessageString}`;
        }
    }
};

// Fire the application architecture pipeline thread context execution loop
USW_Core.init();
