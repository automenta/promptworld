// Data Models
// Example: Project Object
function Project(name) {
    this.id = Date.now().toString(); // Simple unique ID
    this.name = name;
    this.images = []; // Array of ImageNode objects
    this.cameraOffsetX = 0;
    this.cameraOffsetY = 0;
    this.cameraZoom = 1; // For the next step (camera zoom)
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
    const goToSettingsBtn = document.getElementById('go-to-settings-btn');
    const backToHomeFromSettingsBtn = document.getElementById('back-to-home-from-settings-btn');
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    const apiKeyInput = document.getElementById('api-key-input');
    const apiKeyStatus = document.getElementById('api-key-status');

    let geminiApiKey = ''; // Global variable to store the API key
    const API_KEY_STORAGE_ID = 'promptWorldApiKey';

    let isPanningCamera = false;
    let lastPanMouseX, lastPanMouseY;

    // Load API Key on startup
    loadApiKey();

    if (dEditorContainer) {
        dEditorContainer.addEventListener('mousedown', onCameraMouseDown);
        dEditorContainer.addEventListener('wheel', onCameraWheel, { passive: false }); // passive:false to allow preventDefault
    }

    if (goToSettingsBtn) {
        goToSettingsBtn.addEventListener('click', () => {
            showScreen(settingsScreen);
            populateApiKeyInput(); // Populate input when showing settings
            apiKeyStatus.textContent = ''; // Clear status
        });
    }

    if (backToHomeFromSettingsBtn) {
        backToHomeFromSettingsBtn.addEventListener('click', () => {
            showScreen(homeScreen);
            apiKeyStatus.textContent = ''; // Clear status
        });
    }

    if (saveApiKeyBtn) {
        saveApiKeyBtn.addEventListener('click', () => {
            const newApiKey = apiKeyInput.value.trim();
            if (newApiKey) {
                geminiApiKey = newApiKey;
                localStorage.setItem(API_KEY_STORAGE_ID, geminiApiKey);
                apiKeyStatus.textContent = 'API Key saved!';
                apiKeyStatus.style.color = 'green';
                console.log("API Key saved.");
            } else {
                localStorage.removeItem(API_KEY_STORAGE_ID);
                geminiApiKey = '';
                apiKeyStatus.textContent = 'API Key cleared.';
                apiKeyStatus.style.color = 'orange';
                console.log("API Key cleared.");
            }
            // Optionally clear the input field after saving, or leave it for user to see
            // apiKeyInput.value = '';
        });
    }

    function loadApiKey() {
        const storedKey = localStorage.getItem(API_KEY_STORAGE_ID);
        if (storedKey) {
            geminiApiKey = storedKey;
            console.log("API Key loaded from localStorage.");
        } else {
            console.log("No API Key found in localStorage.");
        }
    }

    function populateApiKeyInput() {
        if (apiKeyInput) {
            apiKeyInput.value = geminiApiKey || '';
        }
    }

    function onCameraMouseDown(e) {
        // Only pan if the mousedown is directly on the container, not on an image child.
        // And only if not currently interacting with an image (e.g. selectedImageElement is null)
        if (e.target === dEditorContainer && !selectedImageElement && e.button === 0 && !e.altKey && !e.shiftKey) { // Ensure no other interaction is intended
            isPanningCamera = true;
            lastPanMouseX = e.clientX;
            lastPanMouseY = e.clientY;
            dEditorContainer.style.cursor = 'grabbing'; // Indicate panning
            document.addEventListener('mousemove', onCameraMouseMove);
            document.addEventListener('mouseup', onCameraMouseUp);
            e.preventDefault(); // Prevent text selection or other default behaviors
        }
    }

    function onCameraMouseMove(e) {
        if (!isPanningCamera || !currentProject) return;

        const deltaX = e.clientX - lastPanMouseX;
        const deltaY = e.clientY - lastPanMouseY;

        currentProject.cameraOffsetX -= deltaX; // Subtract to make scene move with mouse
        currentProject.cameraOffsetY -= deltaY;

        lastPanMouseX = e.clientX;
        lastPanMouseY = e.clientY;

        renderImagesIn3DView(); // Re-render all images with new camera offset
    }

    function onCameraMouseUp(e) {
        if (isPanningCamera) {
            isPanningCamera = false;
            dEditorContainer.style.cursor = 'grab'; // Reset cursor
            document.removeEventListener('mousemove', onCameraMouseMove);
            document.removeEventListener('mouseup', onCameraMouseUp);

            if (currentProject) {
                saveProject(currentProject).then(() => {
                    console.log("Project saved after camera pan.");
                }).catch(err => {
                    console.error("Error saving project after camera pan:", err);
                });
            }
        }
    }

    function onCameraWheel(e) {
        if (e.target === dEditorContainer && !selectedImageElement && currentProject) {
            e.preventDefault(); // Prevent page scrolling

            const zoomSpeed = 0.05; // Adjust sensitivity
            const minZoom = 0.2;
            const maxZoom = 5.0;
            let newZoom = currentProject.cameraZoom || 1;

            if (e.deltaY < 0) { // Scroll up -> zoom in
                newZoom += zoomSpeed;
            } else { // Scroll down -> zoom out
                newZoom -= zoomSpeed;
            }

            currentProject.cameraZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));

            console.log("Camera Zoom:", currentProject.cameraZoom);
            renderImagesIn3DView(); // Re-render with new zoom

            // Debounce saving? For now, save on each effective zoom change.
            saveProject(currentProject).then(() => {
                // console.log("Project saved after camera zoom.");
            }).catch(err => {
                console.error("Error saving project after camera zoom:", err);
            });
        }
    }

    // Initialize DB
    initDB().then(() => {
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
        // Ensure camera offsets and zoom exist, defaulting if not (for older projects)
        if (typeof currentProject.cameraOffsetX === 'undefined') {
            currentProject.cameraOffsetX = 0;
        }
        if (typeof currentProject.cameraOffsetY === 'undefined') {
            currentProject.cameraOffsetY = 0;
        }
        if (typeof currentProject.cameraZoom === 'undefined') {
            currentProject.cameraZoom = 1;
        }

        console.log("Loading project into editor:", project.name, "CamOffset:", currentProject.cameraOffsetX, currentProject.cameraOffsetY);
        editorHeader.textContent = `Editor: ${project.name}`;
        displayProjectImages(); // Display images for the loaded project
        renderImagesIn3DView(); // Render images in 3D view
    }

    function renderImagesIn3DView() {
        if (!dEditorContainer) return;
        dEditorContainer.innerHTML = ''; // Clear previous content

        if (!currentProject) return;

        // Create or get the image host wrapper
        let imageHostWrapper = document.getElementById('image-host-wrapper');
        if (!imageHostWrapper) {
            imageHostWrapper = document.createElement('div');
            imageHostWrapper.id = 'image-host-wrapper';
            imageHostWrapper.style.transformStyle = 'preserve-3d';
            // The perspective container is dEditorContainer, wrapper is for grouping and global transforms
        }
        dEditorContainer.appendChild(imageHostWrapper);
        imageHostWrapper.innerHTML = ''; // Clear previous images from wrapper

        const camX = currentProject.cameraOffsetX || 0;
        const camY = currentProject.cameraOffsetY || 0;
        const camZoom = currentProject.cameraZoom || 1;

        // Apply pan and zoom to the wrapper
        imageHostWrapper.style.transform = `translate3d(${-camX}px, ${-camY}px, 0px) scale(${camZoom})`;

        if (currentProject.images) {
            currentProject.images.forEach((imgNode, index) => {
                const imgElement = document.createElement('img');
                imgElement.src = imgNode.imageDataUrl;
                imgElement.id = imgNode.id;

                // Positions are now relative to the wrapper, so use their direct values
                const x = imgNode.position.x || (index * 20 - (currentProject.images.length * 10));
                const y = imgNode.position.y || 0;
                const z = imgNode.position.z || (index * -10); // Default cascade

                const rotX = imgNode.rotation.x || 0;
                const rotY = imgNode.rotation.y || 0;
                const rotZ = imgNode.rotation.z || 0;
                const scale = imgNode.scale || 1; // This is individual image scale

                imgElement.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg) scale(${scale})`;

                // Add mousedown listener for dragging
                imgElement.addEventListener('mousedown', onImageMouseDown);
                // Add wheel listener for scaling
                imgElement.addEventListener('wheel', onImageWheel);

                imageHostWrapper.appendChild(imgElement); // Append to wrapper, not container
            });
        }
    }

    let selectedImageElement = null;
    let offsetX, offsetY; // For X, Y positioning
    let currentImageNode = null;

    let isRotating = false; // Flag for rotation mode (Shift key)
    let initialMouseX, initialRotationY;

    let isTranslatingZ = false; // Flag for Z translation mode (Alt key)
    let initialMouseYForZ, initialPositionZ;


    function onImageMouseDown(e) {
        if (e.button !== 0) return; // Only respond to left mouse button

        selectedImageElement = e.target;
        if (currentProject && currentProject.images) {
            currentImageNode = currentProject.images.find(imgNode => imgNode.id === selectedImageElement.id);
        }

        if (!currentImageNode) {
            console.error("Could not find ImageNode for selected element:", selectedImageElement.id);
            selectedImageElement = null;
            return;
        }

        // Reset modes
        isRotating = false;
        isTranslatingZ = false;

        if (e.shiftKey && !e.altKey) { // Shift key for Y-axis rotation
            isRotating = true;
            initialMouseX = e.clientX;
            initialRotationY = currentImageNode.rotation.y;
        } else if (e.altKey && !e.shiftKey) { // Alt key for Z-axis translation
            isTranslatingZ = true;
            initialMouseYForZ = e.clientY;
            initialPositionZ = currentImageNode.position.z;
        } else if (!e.shiftKey && !e.altKey) { // Default: X, Y positioning
            const transform = selectedImageElement.style.transform;
            const translateMatch = transform.match(/translate3d\(([^,]+)px, ([^,]+)px, ([^,]+)px\)/);

            let currentX = 0;
            let currentY = 0;
            if (translateMatch) {
                currentX = parseFloat(translateMatch[1]);
                currentY = parseFloat(translateMatch[2]);
            }
            offsetX = e.clientX - currentX;
            offsetY = e.clientY - currentY;
        } else {
            // If both Shift and Alt are pressed, or some other combo, do nothing for now.
            // Or define a behavior if needed.
            selectedImageElement = null; // Prevent further actions
            currentImageNode = null;
            return;
        }


        document.addEventListener('mousemove', onImageMouseMove);
        document.addEventListener('mouseup', onImageMouseUp);

        // Prevent default browser drag behavior
        e.preventDefault();
    }

    function onImageMouseMove(e) {
        if (!selectedImageElement || !currentImageNode) return;

        if (isRotating) { // Shift key for Y-axis rotation
            const deltaX = e.clientX - initialMouseX;
            const newRotationY = initialRotationY + deltaX;
            currentImageNode.rotation.y = newRotationY % 360;

            const translateString = `translate3d(${currentImageNode.position.x}px, ${currentImageNode.position.y}px, ${currentImageNode.position.z}px)`;
            const scaleString = `scale(${currentImageNode.scale})`;
            const otherRotations = `rotateX(${currentImageNode.rotation.x}deg) rotateZ(${currentImageNode.rotation.z}deg)`;
            selectedImageElement.style.transform = `${translateString} rotateY(${currentImageNode.rotation.y}deg) ${otherRotations} ${scaleString}`;

        } else if (isTranslatingZ) { // Alt key for Z-axis translation
            const deltaY = e.clientY - initialMouseYForZ;
            currentImageNode.position.z = initialPositionZ + deltaY;

            const translateString = `translate3d(${currentImageNode.position.x}px, ${currentImageNode.position.y}px, ${currentImageNode.position.z}px)`;
            const rotationString = `rotateX(${currentImageNode.rotation.x}deg) rotateY(${currentImageNode.rotation.y}deg) rotateZ(${currentImageNode.rotation.z}deg)`;
            const scaleString = `scale(${currentImageNode.scale})`;
            selectedImageElement.style.transform = `${translateString} ${rotationString} ${scaleString}`;

        } else { // Default: X, Y positioning
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;
            // Note: currentImageNode.position.x and .y are not updated here, only on mouseup.
            // The visual update uses newX, newY directly.

            const rotationString = `rotateX(${currentImageNode.rotation.x}deg) rotateY(${currentImageNode.rotation.y}deg) rotateZ(${currentImageNode.rotation.z}deg)`;
            const scaleString = `scale(${currentImageNode.scale})`;
            selectedImageElement.style.transform = `translate3d(${newX}px, ${newY}px, ${currentImageNode.position.z}px) ${rotationString} ${scaleString}`;
        }
    }

    function onImageMouseUp(e) {
        if (!selectedImageElement || !currentImageNode) {
            document.removeEventListener('mousemove', onImageMouseMove);
            document.removeEventListener('mouseup', onImageMouseUp);
            isRotating = false;
            isTranslatingZ = false;
            return;
        }

        if (isRotating) {
            console.log("ImageNode updated (Rotation Y):", currentImageNode.id, "New Y Rot:", currentImageNode.rotation.y);
        } else if (isTranslatingZ) {
            console.log("ImageNode updated (Position Z):", currentImageNode.id, "New Z Pos:", currentImageNode.position.z);
        } else { // X, Y Positioning
            const transform = selectedImageElement.style.transform;
            const translateMatch = transform.match(/translate3d\(([^,]+)px, ([^,]+)px, ([^,]+)px\)/);
            if (translateMatch) {
                currentImageNode.position.x = parseFloat(translateMatch[1]);
                currentImageNode.position.y = parseFloat(translateMatch[2]);
                // currentImageNode.position.z is already up-to-date or handled by isTranslatingZ
            }
            console.log("ImageNode updated (Position X,Y):", currentImageNode.id, "New Pos:", currentImageNode.position);
        }

        // Reset all interaction mode flags
        isRotating = false;
        isTranslatingZ = false;

        saveProject(currentProject).then(() => {
            console.log("Project saved after image move.");
            // Optionally, re-render or update UI elements if needed
            // displayProjectImages(); // if something in the list needs update based on position
        }).catch(err => {
            console.error("Error saving project after image move:", err);
        });

        selectedImageElement = null;
        currentImageNode = null;
        document.removeEventListener('mousemove', onImageMouseMove);
        document.removeEventListener('mouseup', onImageMouseUp);
    }

    function onImageWheel(e) {
        e.preventDefault(); // Prevent page scrolling

        const targetImageElement = e.target;
        let targetImageNode = null;

        if (currentProject && currentProject.images) {
            targetImageNode = currentProject.images.find(imgNode => imgNode.id === targetImageElement.id);
        }

        if (!targetImageNode) {
            console.error("Could not find ImageNode for wheel event on element:", targetImageElement.id);
            return;
        }

        const scaleAmount = 0.1; // How much to scale on each wheel tick
        let newScale = targetImageNode.scale;

        if (e.deltaY < 0) { // Scroll up - zoom in
            newScale += scaleAmount;
        } else { // Scroll down - zoom out
            newScale -= scaleAmount;
        }

        newScale = Math.max(0.1, newScale); // Prevent scale from becoming zero or negative

        targetImageNode.scale = newScale;

        // Update the style for visual feedback
        const existingTransform = targetImageElement.style.transform;
        const translateMatch = existingTransform.match(/translate3d\([^)]+\)/);
        const rotateMatch = existingTransform.match(/rotateX\([^)]+\) rotateY\([^)]+\) rotateZ\([^)]+\)/);

        const translateString = translateMatch ? translateMatch[0] : 'translate3d(0px, 0px, 0px)';
        const rotationString = rotateMatch ? rotateMatch[0] : 'rotateX(0deg) rotateY(0deg) rotateZ(0deg)';

        targetImageElement.style.transform = `${translateString} ${rotationString} scale(${newScale})`;

        // Save changes (debouncing might be good here for performance if many wheel events fire rapidly)
        saveProject(currentProject).then(() => {
            // console.log("Project saved after image scale.");
        }).catch(err => {
            console.error("Error saving project after image scale:", err);
        });
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
