const USW_DATA = {
    // Registers a new user matrix
    saveUser: (user, pass) => {
        let u = JSON.parse(localStorage.getItem('usw_users') || '{}');
        if (u[user]) return false;
        u[user] = { pass: pass, files: {} };
        localStorage.setItem('usw_users', JSON.stringify(u));
        return true;
    },
    
    // Validates credentials on login
    verifyUser: (user, pass) => {
        let u = JSON.parse(localStorage.getItem('usw_users') || '{}');
        return u[user] && u[user].pass === pass;
    },

    // Instantiates an entirely new file in the user's VFS
    createFile: (user, filename, lang, defaultCode = "") => {
        let u = JSON.parse(localStorage.getItem('usw_users') || '{}');
        if (!u[user]) return null;

        const uniqueId = 'vfs_' + Math.random().toString(36).substring(2, 11);
        u[user].files[uniqueId] = {
            id: uniqueId,
            filename: filename,
            lang: lang,
            code: defaultCode,
            timestamp: Date.now()
        };
        
        localStorage.setItem('usw_users', JSON.stringify(u));
        return uniqueId;
    },

    // Fetches a specific file asset
    getFile: (user, fileId) => {
        let u = JSON.parse(localStorage.getItem('usw_users') || '{}');
        return u[user]?.files?.[fileId] || null;
    },

    // Saves current editor state into permanent local memory
    updateFileCode: (user, fileId, code) => {
        let u = JSON.parse(localStorage.getItem('usw_users') || '{}');
        if (u[user] && u[user].files?.[fileId]) {
            u[user].files[fileId].code = code;
            u[user].files[fileId].timestamp = Date.now();
            localStorage.setItem('usw_users', JSON.stringify(u));
            return true;
        }
        return false;
    },

    // Purges a code stream asset permanently
    deleteFile: (user, fileId) => {
        let u = JSON.parse(localStorage.getItem('usw_users') || '{}');
        if (u[user] && u[user].files?.[fileId]) {
            delete u[user].files[fileId];
            localStorage.setItem('usw_users', JSON.stringify(u));
            return true;
        }
        return false;
    },

    // Gathers all stored documents for the user dashboard list
    getAllUserFiles: (user) => {
        let u = JSON.parse(localStorage.getItem('usw_users') || '{}');
        if (!u[user] || !u[user].files) return [];
        return Object.values(u[user].files).sort((a, b) => b.timestamp - a.timestamp);
    }
};
