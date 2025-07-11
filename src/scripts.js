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
let currentProject = null; // Holds the currently loaded project

document.addEventListener('DOMContentLoaded', () => {
    const homeScreen = document.getElementById('home-screen');
    const editorScreen = document.getElementById('editor-screen');
    const editorHeader = editorScreen.querySelector('h2');
    const dEditorContainer = document.getElementById('d-editor-container');
    const settingsScreen = document.getElementById('settings-screen'); // Assuming you'll add a settings button
    const imageUploadInput = document.getElementById('image-upload-input');
    const importImageBtn = document.getElementById('import-image-btn');
    const currentProjectImagesDiv = document.getElementById('current-project-images');

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
            const projectName = prompt("Enter project name:");
            if (projectName) {
                const newProject = new Project(projectName);
                saveProject(newProject).then(() => {
                    loadProjects(); // Refresh project list
                    // Optionally, navigate to editor for the new project
                    // loadProjectIntoEditor(newProject);
                    // showScreen(editorScreen);
                });
            }
        });
    }


    if (backToHomeBtn) {
        backToHomeBtn.addEventListener('click', () => {
            currentProject = null; // Clear current project when going home
            editorHeader.textContent = 'Editor'; // Reset editor title
            showScreen(homeScreen);
        });
    }

    // Add similar listeners for settings if a settings button and screen exist.
    // e.g. if (goToSettingsBtn) { ... }
    // e.g. if (backToHomeFromSettingsBtn) { ... }

    if (importImageBtn) {
        importImageBtn.addEventListener('click', () => {
            if (!currentProject) {
                alert("Please select or create a project first.");
                return;
            }
            imageUploadInput.click(); // Trigger hidden file input
        });
    }

    if (imageUploadInput) {
        imageUploadInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && currentProject) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageDataUrl = e.target.result;
                    const newImageNode = new ImageNode(imageDataUrl);
                    currentProject.images.push(newImageNode);
                    saveProject(currentProject).then(() => {
                        console.log("Image added to project and saved.");
                        displayProjectImages();
                        renderImagesIn3DView(); // Re-render 3D view
                        // Reset file input to allow uploading the same file again if needed
                        imageUploadInput.value = null;
                    }).catch(err => {
                        console.error("Error saving project after adding image:", err);
                    });
                };
                reader.readAsDataURL(file);
            }
        });
    }

    function showScreen(screenElement) {
        homeScreen.style.display = 'none';
        editorScreen.style.display = 'none';
        if (settingsScreen) settingsScreen.style.display = 'none'; // Check if it exists

        screenElement.style.display = 'block';
    }

    // Project CRUD operations
    function saveProject(project) {
        return new Promise((resolve, reject) => {
            if (!db) {
                console.error("DB not initialized.");
                reject("DB not initialized.");
                return;
            }
            const transaction = db.transaction([PROJECT_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(PROJECT_STORE_NAME);
            const request = store.put(project); // Use put to allow updates

            request.onsuccess = () => {
                console.log("Project saved/updated:", project.name);
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
                    listItem.style.cursor = 'pointer'; // Indicate it's clickable
                    // Add click listener to open project in editor
                    listItem.addEventListener('click', () => {
                        loadProjectIntoEditor(project);
                        showScreen(editorScreen);
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

    function loadProjectIntoEditor(project) {
        currentProject = project;
        console.log("Loading project into editor:", project.name);
        editorHeader.textContent = `Editor: ${project.name}`;
        displayProjectImages(); // Display images for the loaded project
        renderImagesIn3DView(); // Render images in 3D view
    }

    function renderImagesIn3DView() {
        if (!dEditorContainer) return;
        dEditorContainer.innerHTML = ''; // Clear previous images

        if (currentProject && currentProject.images) {
            currentProject.images.forEach((imgNode, index) => {
                const imgElement = document.createElement('img');
                imgElement.src = imgNode.imageDataUrl;
                imgElement.id = imgNode.id;
                // Apply default transformations from ImageNode, with a slight offset for new images
                // For newly added images without explicit positions, provide a default cascade
                const x = imgNode.position.x || (index * 20 - (currentProject.images.length * 10)); // Simple cascade
                const y = imgNode.position.y || 0;
                const z = imgNode.position.z || (index * -10); // Slightly behind the previous
                const rotX = imgNode.rotation.x || 0;
                const rotY = imgNode.rotation.y || 0;
                const rotZ = imgNode.rotation.z || 0;
                const scale = imgNode.scale || 1;

                imgElement.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg) scale(${scale})`;
                dEditorContainer.appendChild(imgElement);
            });
        }
    }

    function displayProjectImages() {
        if (!currentProjectImagesDiv) return;
        if (!currentProject) {
            currentProjectImagesDiv.innerHTML = "";
            return;
        }

        currentProjectImagesDiv.innerHTML = `<h3>Images (${currentProject.images.length})</h3>`;
        if (currentProject.images.length === 0) {
            currentProjectImagesDiv.innerHTML += "<p>No images imported yet. Click 'Import Image'.</p>";
        } else {
            const ul = document.createElement('ul');
            currentProject.images.forEach((imgNode, index) => {
                const li = document.createElement('li');
                // Display a small thumbnail and image name/ID
                const imgElement = document.createElement('img');
                imgElement.src = imgNode.imageDataUrl;
                imgElement.style.width = "50px";
                imgElement.style.height = "50px";
                imgElement.style.objectFit = "cover";
                imgElement.style.marginRight = "10px";
                li.appendChild(imgElement);
                li.appendChild(document.createTextNode(`Image ${index + 1} (ID: ${imgNode.id.substring(0,5)}...)`));
                ul.appendChild(li);
            });
            currentProjectImagesDiv.appendChild(ul);
        }
    }

});

// Further application logic will be added here:
// - 3D editor functions (CSS3D manipulation)
// - Image import (file input, camera, video frames)
// - AI integration (Gemini API calls)
// - etc.
console.log("scripts.js loaded");
