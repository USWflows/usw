/**
 * USW SECURITY KERNEL - ZERO-KNOWLEDGE CRYPTO LAYER
 * Implementation: 256-bit AES-GCM Encryption with PBKDF2 Key Derivation
 */

// Ephemeral runtime memory slot (Wiped instantly on page reload, logout, or tab close)
let derivedSessionKey = null;

const USW_DATA = {
    // Generates a cryptographically strong 256-bit AES key from user credentials
    deriveKey: async (password, username) => {
        const encoder = new TextEncoder();
        const baseKeyData = encoder.encode(password);
        // Salt ensures unique outputs even if multiple users use identical passwords
        const salt = encoder.encode(username.padStart(16, 'salt_usw_network')); 

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

    // Encrypts raw JSON text into hex-encoded initialization vectors and ciphertext
    encryptData: async (text, key) => {
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12)); // Crucial non-repeating Initialization Vector
        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encoder.encode(text)
        );

        return {
            iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
            data: Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('')
        };
    },

    // Decrypts hex packaged ciphertext back into readable plain text strings
    decryptData: async (hexIv, hexData, key) => {
        try {
            const iv = new Uint8Array(hexIv.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            const encrypted = new Uint8Array(hexData.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, encrypted);
            return new TextDecoder().decode(decrypted);
        } catch (e) {
            return null; // Signals cryptographic decryption failure (Wrong credentials)
        }
    },

    // USER REGISTRATION: Initializes an empty encrypted file ledger block
    saveUser: async (user, pass) => {
        let registry = JSON.parse(localStorage.getItem('usw_vaults') || '{}');
        if (registry[user]) return false; // Namespace collision safeguard

        const key = await USW_DATA.deriveKey(pass, user);
        const encryptedPackage = await USW_DATA.encryptData(JSON.stringify({}), key);

        registry[user] = { iv: encryptedPackage.iv, data: encryptedPackage.data };
        localStorage.setItem('usw_vaults', JSON.stringify(registry));
        return true;
    },
    
    // AUTHENTICATION: Verifies credentials by testing vault payload decryption success
    verifyUser: async (user, pass) => {
        let registry = JSON.parse(localStorage.getItem('usw_vaults') || '{}');
        if (!registry[user]) return false;

        const prospectiveKey = await USW_DATA.deriveKey(pass, user);
        const testDecryption = await USW_DATA.decryptData(registry[user].iv, registry[user].data, prospectiveKey);

        if (testDecryption !== null) {
            derivedSessionKey = prospectiveKey; // Unlock successful! Escrow key to runtime memory
            return true;
        }
        return false;
    },

    // Commits file mappings back into the secure local ciphertext registry
    syncVault: async (user, filesMap) => {
        if (!derivedSessionKey) return false;
        let registry = JSON.parse(localStorage.getItem('usw_vaults') || '{}');
        
        const encryptedPackage = await USW_DATA.encryptData(JSON.stringify(filesMap), derivedSessionKey);
        registry[user] = { iv: encryptedPackage.iv, data: encryptedPackage.data };
        localStorage.setItem('usw_vaults', JSON.stringify(registry));
        return true;
    },

    // Internal fetch utility to read the active user's current isolated vault inventory
    getVaultFiles: async (user) => {
        if (!derivedSessionKey) return {};
        let registry = JSON.parse(localStorage.getItem('usw_vaults') || '{}');
        if (!registry[user]) return {};

        const decryptedString = await USW_DATA.decryptData(registry[user].iv, registry[user].data, derivedSessionKey);
        return decryptedString ? JSON.parse(decryptedString) : {};
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

    deleteFile: async (user, fileId) => {
        const files = await USW_DATA.getVaultFiles(user);
        if (!files[fileId]) return false;
        
        delete files[fileId];
        return await USW_DATA.syncVault(user, files);
    },

    getAllUserFiles: async (user) => {
        const files = await USW_DATA.getVaultFiles(user);
        return Object.values(files);
    }
};
