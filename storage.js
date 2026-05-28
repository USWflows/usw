const USW_DATA = {
    // Saves a new user name and password
    saveUser: (user, pass) => {
        let database = JSON.parse(localStorage.getItem('usw_users') || '{}');
        if (database[user]) return false; // Username already taken
        database[user] = { pass: pass, files: {} };
        localStorage.setItem('usw_users', JSON.stringify(database));
        return true;
    },
    
    // Verifies password when logging back in
    verifyUser: (user, pass) => {
        let database = JSON.parse(localStorage.getItem('usw_users') || '{}');
        return database[user] && database[user].pass === pass;
    },

    // Adds a brand new file to the user's account
    createFile: (user, filename, lang, defaultCode = "") => {
        let database = JSON.parse(localStorage.getItem('usw_users') || '{}');
        if (!database[user]) return null;
        if (!database[user].files) database[user].files = {};

        const fileId = 'id_' + Math.random().toString(36).substring(2, 11);
        database[user].files[fileId] = {
            id: fileId,
            filename: filename,
            lang: lang,
            code: defaultCode
        };
        
        localStorage.setItem('usw_users', JSON.stringify(database));
        return fileId;
    },

    // Fetches a saved file to open in the editor
    getFile: (user, fileId) => {
        let database = JSON.parse(localStorage.getItem('usw_users') || '{}');
        return database[user]?.files?.[fileId] || null;
    },

    // Saves code changes automatically
    updateFileCode: (user, fileId, code) => {
        let database = JSON.parse(localStorage.getItem('usw_users') || '{}');
        if (database[user] && database[user].files?.[fileId]) {
            database[user].files[fileId].code = code;
            localStorage.setItem('usw_users', JSON.stringify(database));
            return true;
        }
        return false;
    },

    // Deletes a file completely
    deleteFile: (user, fileId) => {
        let database = JSON.parse(localStorage.getItem('usw_users') || '{}');
        if (database[user] && database[user].files?.[fileId]) {
            delete database[user].files[fileId];
            localStorage.setItem('usw_users', JSON.stringify(database));
            return true;
        }
        return false;
    },

    // Loads all files belonging to the logged-in user
    getAllUserFiles: (user) => {
        let database = JSON.parse(localStorage.getItem('usw_users') || '{}');
        if (!database[user] || !database[user].files) return [];
        return Object.values(database[user].files);
    }
};
