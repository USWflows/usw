// Internal helper to securely hash passwords using native SHA-256
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const USW_DATA = {
    // Saves a new user name and a HASHED password
    saveUser: async (user, pass) => {
        let database = JSON.parse(localStorage.getItem('usw_users') || '{}');
        if (database[user]) return false; // Username already taken
        
        // Securely hash the password before saving
        const secureHash = await hashPassword(pass);
        database[user] = { pass: secureHash, files: {} };
        
        localStorage.setItem('usw_users', JSON.stringify(database));
        return true;
    },
    
    // Hashes the incoming password and compares it against the stored hash
    verifyUser: async (user, pass) => {
        let database = JSON.parse(localStorage.getItem('usw_users') || '{}');
        if (!database[user]) return false;
        
        const incomingHash = await hashPassword(pass);
        return database[user].pass === incomingHash;
    },

    // Adds a brand new file to the user's account 
    createFile: (user, filename, lang, defaultCode = "") => { // 
        let database = JSON.parse(localStorage.getItem('usw_users') || '{}'); // 
        if (!database[user]) return null; // 
        if (!database[user].files) database[user].files = {}; // 

        const fileId = 'id_' + Math.random().toString(36).substring(2, 11); // 
        database[user].files[fileId] = { // 
            id: fileId, // 
            filename: filename, // 
            lang: lang, // 
            code: defaultCode // 
        }; // 
        
        localStorage.setItem('usw_users', JSON.stringify(database)); // 
        return fileId; // 
    }, // 

    // Fetches a saved file to open in the editor 
    getFile: (user, fileId) => { // 
        let database = JSON.parse(localStorage.getItem('usw_users') || '{}'); // 
        return database[user]?.files?.[fileId] || null; // 
    }, // 

    // Saves code changes automatically 
    updateFileCode: (user, fileId, code) => { // 
        let database = JSON.parse(localStorage.getItem('usw_users') || '{}'); // 
        if (database[user] && database[user].files?.[fileId]) { // 
            database[user].files[fileId].code = code; // 
            localStorage.setItem('usw_users', JSON.stringify(database)); // 
            return true; // 
        } // 
        return false; // 
    }, // 

    // Deletes a file completely 
    deleteFile: (user, fileId) => { // 
        let database = JSON.parse(localStorage.getItem('usw_users') || '{}'); // 
        if (database[user] && database[user].files?.[fileId]) { // 
            delete database[user].files[fileId]; // 
            localStorage.setItem('usw_users', JSON.stringify(database)); // 
            return true; // 
        } // 
        return false; // 
    }, // 

    // Loads all files belonging to the logged-in user 
    getAllUserFiles: (user) => { // 
        let database = JSON.parse(localStorage.getItem('usw_users') || '{}'); // 
        if (!database[user] || !database[user].files) return []; // 
        return Object.values(database[user].files); // 
    } // 
};
