// Data Models
// Example: Project Object
function Project(name) {
    this.id = Date.now().toString(); // Simple unique ID
    this.name = name;
    this.images = []; // Array of ImageNode objects
    this.createdAt = new Date();
}

// Example: ImageNode Object
function ImageNode(imageDataUrl, x = 0, y = 0, z = 0, rotationX = 0, rotationY = 0, rotationZ = 0, scale = 1) {
    this.id = Date.now().toString() + Math.random().toString(36).substring(2, 7); // More unique ID
    this.imageDataUrl = imageDataUrl; // Base64 data URL
    this.description = "";
    this.position = { x, y, z };
    this.rotation = { x: rotationX, y: rotationY, z: rotationZ };
    this.scale = scale;
    this.createdAt = new Date();
}

// IndexedDB Setup
const DB_NAME = 'PromptWorldDB';
const DB_VERSION = 1;
const PROJECT_STORE_NAME = 'projects';
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("Database error: ", event.target.errorCode);
            reject("Database error: " + event.target.errorCode);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("Database initialized successfully.");
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(PROJECT_STORE_NAME)) {
                const objectStore = db.createObjectStore(PROJECT_STORE_NAME, { keyPath: 'id' });
                objectStore.createIndex('name', 'name', { unique: false });
                console.log("Project object store created.");
            }
        };
    });
}

// Screen Navigation Logic
document.addEventListener('DOMContentLoaded', () => {
    const homeScreen = document.getElementById('home-screen');
    const editorScreen = document.getElementById('editor-screen');
    const settingsScreen = document.getElementById('settings-screen'); // Assuming you'll add a settings button

    const newProjectBtn = document.getElementById('new-project-btn');
    const backToHomeBtn = document.getElementById('back-to-home-btn');
    // const goToSettingsBtn = document.getElementById('go-to-settings-btn'); // Example
    // const backToHomeFromSettingsBtn = document.getElementById('back-to-home-from-settings-btn');


    // Initialize DB
    initDB().then(() => {
        // Load projects or perform other startup tasks
        loadProjects();
    }).catch(error => {
        console.error("Failed to initialize DB:", error);
        // Handle DB initialization failure (e.g., show error to user)
    });


    // Event Listeners for Navigation
    if (newProjectBtn) {
        newProjectBtn.addEventListener('click', () => {
            // For now, just switch views. Later, implement project creation logic.
            const projectName = prompt("Enter project name:");
            if (projectName) {
                const newProject = new Project(projectName);
                saveProject(newProject).then(() => {
                    loadProjects(); // Refresh project list
                    // Optionally, navigate to editor for the new project
                    // showScreen(editorScreen);
                    // loadProjectIntoEditor(newProject);
                });
            }
        });
    }

    // Example: Simulate navigating to editor for the first project if one exists
    // This is a placeholder. Actual project selection would be more robust.
    // setTimeout(() => { // Allow DB to load
    //     if (db) {
    //         const transaction = db.transaction([PROJECT_STORE_NAME], 'readonly');
    //         const store = transaction.objectStore(PROJECT_STORE_NAME);
    //         const getAllRequest = store.getAll();
    //         getAllRequest.onsuccess = () => {
    //             if (getAllRequest.result.length > 0) {
    //                 // For demo, clicking a "project" could lead to editor
    //                 // This would be part of loadProjects() typically
    //             }
    //         }
    //     }
    // }, 1000);


    if (backToHomeBtn) {
        backToHomeBtn.addEventListener('click', () => {
            showScreen(homeScreen);
        });
    }

    // Add similar listeners for settings if a settings button and screen exist.
    // e.g. if (goToSettingsBtn) { ... }
    // e.g. if (backToHomeFromSettingsBtn) { ... }

    function showScreen(screenElement) {
        homeScreen.style.display = 'none';
        editorScreen.style.display = 'none';
        if (settingsScreen) settingsScreen.style.display = 'none'; // Check if it exists

        screenElement.style.display = 'block';
    }

    // Placeholder for Project CRUD operations
    function saveProject(project) {
        return new Promise((resolve, reject) => {
            if (!db) {
                console.error("DB not initialized.");
                reject("DB not initialized.");
                return;
            }
            const transaction = db.transaction([PROJECT_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(PROJECT_STORE_NAME);
            const request = store.add(project); // or .put(project) to update if exists

            request.onsuccess = () => {
                console.log("Project saved:", project.name);
                resolve();
            };
            request.onerror = (event) => {
                console.error("Error saving project:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    function loadProjects() {
        if (!db) return;
        const projectListUl = document.getElementById('project-list');
        if (!projectListUl) return;

        projectListUl.innerHTML = ''; // Clear existing list

        const transaction = db.transaction([PROJECT_STORE_NAME], 'readonly');
        const store = transaction.objectStore(PROJECT_STORE_NAME);
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
            const projects = getAllRequest.result;
            if (projects.length === 0) {
                projectListUl.innerHTML = '<li>No projects yet. Click "New Project" to start.</li>';
            } else {
                projects.forEach(project => {
                    const listItem = document.createElement('li');
                    listItem.textContent = project.name + ` (Created: ${new Date(project.createdAt).toLocaleDateString()})`;
                    // Add click listener to open project in editor
                    listItem.addEventListener('click', () => {
                        // For now, log. Later, navigate to editor with this project.
                        console.log("Selected project:", project.name);
                        // showScreen(editorScreen);
                        // loadProjectIntoEditor(project);
                    });
                    projectListUl.appendChild(listItem);
                });
            }
        };
        getAllRequest.onerror = (event) => {
            console.error("Error loading projects:", event.target.error);
            projectListUl.innerHTML = '<li>Error loading projects.</li>';
        };
    }

    // Placeholder for loading a specific project into the editor view
    // function loadProjectIntoEditor(project) {
    //     console.log("Loading project into editor:", project.name);
    //     // Here you would populate the editor screen with the project's data
    //     // For example, display its images in the 3D space.
    // }

});

// Further application logic will be added here:
// - 3D editor functions (CSS3D manipulation)
// - Image import (file input, camera, video frames)
// - AI integration (Gemini API calls)
// - etc.
console.log("scripts.js loaded");
