const USW_CONFIG = {
    APP_NAME: "USW Network Secure Node",
    VERSION: "2.1.0",
    STATUS: "Stable",
    GITHUB: {
        USER: "USWflows",
        REPO: "usw"
    },
    // Starter templates for the editor
    TEMPLATES: {
        python: "# USW Network Python Node\nimport sys\nprint(f'Secure Kernel: {sys.version}')\nprint('Status: Active')",
        javascript: "// USW Network JS Node\nconsole.log('Browser Kernel Active');\nconsole.log('User Agent:', navigator.userAgent);",
        cpp: "// C++ Support via WASM (Experimental)\n#include <iostream>\nint main() { std::cout << 'Hello USW'; return 0; }"
    }
};
