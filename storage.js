// Global runtime session key memory (wiped instantly on page reload/logout)
let derivedSessionKey = null;

const USW_DATA = {
    // Helper to derive a 256-bit AES-GCM key from a raw password + username salt
    deriveKey: async (password, username) => {
        const encoder = new TextEncoder();
        const baseKeyData = encoder.encode(password);
        const salt = encoder.encode(username.padStart(16, 's')); // Salt prevents rainbow attacks

        const baseKey = await crypto.subtle.importKey(
            "raw", baseKeyData, "PBKDF2", false, ["deriveKey"]
        );

        return await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
            baseKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    },

    // Encrypt raw string data using AES-GCM
    encryptData: async (text, key) => {
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12)); // Initialization Vector
        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encoder.encode(text)
        );

        // Package IV + Encrypted Data together as hex strings
        return {
            iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
            data: Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('')
        };
    },

    // Decrypt AES-GCM package back to raw string
    decryptData: async (hexIv, hexData, key) => {
        const iv = new Uint8Array(hexIv.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const encrypted = new Uint8Array(hexData.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

        try {
            const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, encrypted);
            return new TextDecoder().decode(decrypted);
        } catch (e) {
            return null; // Decryption failed (bad key)
        }
    },

    // SIGNUP: Initializes empty vault skeleton
    saveUser: async (user, pass) => {
        let registry = JSON.parse(localStorage.getItem('usw_registry') || '{}');
        if (registry[user]) return false; // Account already exists

        // Generate the encryption key and create an empty workspace payload
        const key = await USW_DATA.deriveKey(pass, user);
        const emptyVault = JSON.stringify({});
        const encryptedVault = await USW_DATA.encryptData(emptyVault, key);

        // Store vault data package + structural metadata
        registry[user] = { iv: encryptedVault.iv, vault: encryptedVault.data };
        localStorage.setItem('usw_registry', JSON.stringify(registry));
        return true;
    },
    
    // LOGIN: Attempts to decrypt the workspace data vault using the derived key
    verifyUser: async (user, pass) => {
        let registry = JSON.parse(localStorage.getItem('usw_registry') || '{}');
        if (!registry[user]) return false;

        const prospectiveKey = await USW_DATA.deriveKey(pass, user);
        const decryptedPayload = await USW_DATA.decryptData(registry[user].iv, registry[user].vault, prospectiveKey);

        if (decryptedPayload !== null) {
            derivedSessionKey = prospectiveKey; // Key unlocked! Store securely in runtime memory
            return true;
        }
        return false;
    },

    // Save or update file records securely inside the encrypted vault
    syncVault: async (user, filesMap) => {
        if (!derivedSessionKey) return false;
        let registry = JSON.parse(localStorage.getItem('usw_registry') || '{}');
        
        const serialized = JSON.stringify(filesMap);
        const encrypted = await USW_DATA.encryptData(serialized, derivedSessionKey);
        
        registry[user] = { iv: encrypted.iv, vault: encrypted.data };
        localStorage.setItem('usw_registry', JSON.stringify(registry));
        return true;
    },

    // Load and return decrypted file inventory mapping
    getVaultFiles: async (user) => {
        if (!derivedSessionKey) return {};
        let registry = JSON.parse(localStorage.getItem('usw_registry') || '{}');
        if (!registry[user]) return {};

        const decrypted = await USW_DATA.decryptData(registry[user].iv, registry[user].vault, derivedSessionKey);
        return decrypted ? JSON.parse(decrypted) : {};
    },

    createFile: async (user, filename, lang, defaultCode = "") => {
        const files = await USW_DATA.getVaultFiles(user);
        const fileId = 'id_' + Math.random().toString(36).substring(2, 11);
        
        files[fileId] = { id: fileId, filename, lang, code: defaultCode };
        await USW_DATA.syncVault(user, files);
        return fileId;
    },

    getFile: async (user, fileId) => {
        const files = await USW_DATA.getVaultFiles(user);
        return files[fileId] || null;
    },

    updateFileCode: async (user, fileId, code) => {
        const files = await USW_DATA.getVaultFiles(user);
        if (!files[fileId]) return false;
        
        files[fileId].code = code;
        return await USW_DATA.syncVault(user, files);
    },

    getAllUserFiles: async (user) => {
        const files = await USW_DATA.getVaultFiles(user);
        return Object.values(files);
    }
};
