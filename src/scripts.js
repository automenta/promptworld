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
    const settingsScreen = document.getElementById('settings-screen');
    const promptScreen = document.getElementById('prompt-screen'); // New Prompt Screen
    const imageUploadInput = document.getElementById('image-upload-input');
    const importImageBtn = document.getElementById('import-image-btn');
    const currentProjectImagesDiv = document.getElementById('current-project-images');
    // AI Processing UI Elements
    const processSelectedAiBtn = document.getElementById('process-selected-ai-btn');
    const aiSelectableImageListUl = document.getElementById('ai-selectable-image-list');
    const aiStatusIndicator = document.getElementById('ai-status-indicator');
    const aiDescriptionsListUl = document.getElementById('ai-descriptions-list');

    const newProjectBtn = document.getElementById('new-project-btn');
    const backToHomeBtn = document.getElementById('back-to-home-btn');
    const goToSettingsBtn = document.getElementById('go-to-settings-btn');
    const backToHomeFromSettingsBtn = document.getElementById('back-to-home-from-settings-btn');
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    const apiKeyInput = document.getElementById('api-key-input');
    const apiKeyStatus = document.getElementById('api-key-status');
    const toggleViewModeBtn = document.getElementById('toggle-view-mode-btn');
    // Prompt Screen Elements
    const goToPromptScreenBtn = document.getElementById('go-to-prompt-screen-btn');
    const backToEditorFromPromptBtn = document.getElementById('back-to-editor-from-prompt-btn');
    const userPromptInput = document.getElementById('user-prompt-input');
    const submitPromptBtn = document.getElementById('submit-prompt-btn');
    const promptResponseArea = document.getElementById('prompt-response-area');
    const exportProjectJsonBtn = document.getElementById('export-project-json-btn');
    const exportViewPngBtn = document.getElementById('export-view-png-btn');


    let geminiApiKey = ''; // Global variable to store the API key
    const API_KEY_STORAGE_ID = 'promptWorldApiKey';

    let isNavigationMode = false; // false = Edit Mode, true = Navigation Mode
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

    if (exportViewPngBtn) {
        exportViewPngBtn.addEventListener('click', () => {
            if (!currentProject) {
                alert("No project loaded to export a view.");
                return;
            }
            if (!dEditorContainer) {
                alert("Editor container not found.");
                return;
            }

            alert("Note: Screenshot functionality is experimental and may not fully represent the 3D view due to CSS3D complexities when rendering to a 2D canvas without external libraries. It will attempt to capture a 2D projection.");

            const imageHostWrapper = document.getElementById('image-host-wrapper');
            if (!imageHostWrapper) {
                alert("Image host wrapper not found.");
                return;
            }

            const canvas = document.createElement('canvas');
            const containerRect = dEditorContainer.getBoundingClientRect();
            canvas.width = containerRect.width;
            canvas.height = containerRect.height;
            const ctx = canvas.getContext('2d');

            // Fill background of canvas (matching dEditorContainer's background)
            const computedStyle = window.getComputedStyle(dEditorContainer);
            ctx.fillStyle = computedStyle.backgroundColor || '#e0e0e0'; // Default if not found
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const promises = [];

            // It's crucial to draw images in their perceived Z-order for a somewhat correct representation.
            // We can sort by the 'z' component of translate3d if available and significant.
            // This is a simplification as true 3D ordering is more complex.
            const imagesToDraw = Array.from(imageHostWrapper.children)
                .filter(el => el.tagName === 'IMG')
                .map(imgEl => {
                    const transform = imgEl.style.transform;
                    let z = 0;
                    const translateMatch = transform.match(/translate3d\([^,]+,\s*[^,]+,\s*([^p]+)px\)/);
                    if (translateMatch && translateMatch[1]) {
                        z = parseFloat(translateMatch[1]) || 0;
                    }
                    return { element: imgEl, z: z };
                })
                .sort((a, b) => a.z - b.z); // Draw images with smaller Z (further away) first


            imagesToDraw.forEach(imgData => {
                const imgEl = imgData.element;
                const img = new Image();
                // Important: For cross-origin images, this will taint the canvas unless CORS headers are set on the image source.
                // Since we are using base64 data URLs, this should be fine.
                img.src = imgEl.src;

                const promise = new Promise((resolve, reject) => {
                    img.onload = () => {
                        // This is a major simplification. Replicating CSS transform matrix on canvas is hard.
                        // We will attempt a simplified version.
                        const transformStyle = imgEl.style.transform;
                        const matrix = new DOMMatrix(window.getComputedStyle(imgEl).transform);

                        // Get image's original (untransformed) dimensions and position relative to its offsetParent (imageHostWrapper)
                        // For absolute positioned elements, offsetTop/Left are relative to offsetParent
                        const elRect = imgEl.getBoundingClientRect();
                        const parentRect = imageHostWrapper.getBoundingClientRect();

                        // Calculate the top-left corner of the image *before* transformation, relative to the imageHostWrapper
                        // This is not straightforward with CSS transforms. getBoundingClientRect includes the transform.
                        // A more robust way would be to parse translate3d from imgEl.style.transform
                        // For simplicity, we'll try to use matrix components if they represent simple translations.
                        // The matrix.e and matrix.f are the x and y translation components (m41, m42)

                        const imgWidth = parseFloat(imgEl.style.width) || imgEl.width || elRect.width / (matrix.a || 1) ; // Approximate original width
                        const imgHeight = parseFloat(imgEl.style.height) || imgEl.height || elRect.height / (matrix.d || 1); // Approximate original height

                        ctx.save();

                        // The imageHostWrapper itself is transformed for camera pan/zoom.
                        // We are attempting to draw a "flattened" view as seen within dEditorContainer.
                        // Using getBoundingClientRect for images relative to dEditorContainer already gives
                        // their screen-projected positions and dimensions.

                        // Then apply the individual image's transformation
                        // This is where it gets really tricky to be accurate for full 3D.
                        // setTransform will overwrite, so we need to multiply matrices or apply sequentially.
                        // For now, we'll apply the image's matrix relative to the already transformed context.
                        // This means we need to pre-multiply the wrapper's transform by the image's transform.
                        // Or, simpler: translate, rotate, scale based on parsed values.
                        // The current approach ctx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f)
                        // will draw the image as if its transform was relative to the canvas origin, not the wrapper.

                        // Let's try to apply the image's transform directly if it's simple.
                        // We are drawing onto a canvas that is the size of dEditorContainer.
                        // The image positions are relative to imageHostWrapper.
                        // And imageHostWrapper is transformed.

                        // The most straightforward way for a 2D canvas is to draw each image
                        // at its transformed position and size as seen in the 2D projection.
                        // This means we use the bounding client rect relative to the container.

                        const dEditorRect = dEditorContainer.getBoundingClientRect();
                        const imgBoundingRect = imgEl.getBoundingClientRect();

                        // Calculate position relative to the dEditorContainer
                        const drawX = imgBoundingRect.left - dEditorRect.left;
                        const drawY = imgBoundingRect.top - dEditorRect.top;
                        const drawWidth = imgBoundingRect.width;
                        const drawHeight = imgBoundingRect.height;

                        // This doesn't account for rotation within the bounding box.
                        // For a more accurate representation of rotation, one would need to:
                        // 1. Translate context to image center.
                        // 2. Rotate context.
                        // 3. Draw image offset by -width/2, -height/2.
                        // This is still a 2D rotation. 3D rotations (rotateX, rotateY) are not directly mappable.

                        // Simple draw using bounding box (will not show 3D perspective or rotations accurately)
                        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

                        ctx.restore();
                        resolve();
                    };
                    img.onerror = () => {
                        console.error("Error loading image for canvas drawing:", imgEl.src);
                        reject("Image load error for canvas");
                    };
                });
                promises.push(promise);
            });

            Promise.all(promises).then(() => {
                const dataUrl = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = dataUrl;
                const projectName = currentProject.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'untitled_project';
                a.download = `${projectName}_view.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                console.log("View exported as PNG:", a.download);
            }).catch(error => {
                console.error("Error drawing images to canvas:", error);
                alert("Failed to export view as PNG. Some images might not have loaded correctly for capture. See console.");
            });
        });
    }

    if (exportProjectJsonBtn) {
        exportProjectJsonBtn.addEventListener('click', () => {
            if (!currentProject) {
                alert("No project loaded to export.");
                return;
            }

            try {
                // Sanitize or select fields for export if necessary.
                // For now, exporting the whole currentProject object.
                // Note: imageDataUrl can make the JSON very large. Consider if this is desired.
                // For simplicity, we'll include it as per current structure.
                const projectJson = JSON.stringify(currentProject, null, 2); // Pretty print JSON
                const blob = new Blob([projectJson], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                // Sanitize project name for filename
                const projectName = currentProject.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'untitled_project';
                a.download = `${projectName}.promptworld.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                console.log("Project exported as JSON:", a.download);
            } catch (error) {
                console.error("Error exporting project to JSON:", error);
                alert("Failed to export project as JSON. See console for details.");
            }
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

    // Navigation for Prompt Screen
    if (goToPromptScreenBtn) {
        goToPromptScreenBtn.addEventListener('click', () => {
            if (!currentProject) {
                alert("Please load a project first to use the prompting feature.");
                return;
            }
            // Ensure we are leaving navigation mode if it was active in editor
            if (isNavigationMode) {
                isNavigationMode = false; // Reset to edit mode conceptually for editor
                toggleViewModeBtn.textContent = 'Switch to Navigation Mode';
                dEditorContainer.classList.remove('navigation-mode');
                clearDescriptionTooltip();
                // No need to re-render here as we are leaving the screen
            }
            showScreen(promptScreen);
            promptResponseArea.innerHTML = '<p>AI response will appear here...</p>'; // Reset response area
            userPromptInput.value = ''; // Clear previous prompt
        });
    }

    if (backToEditorFromPromptBtn) {
        backToEditorFromPromptBtn.addEventListener('click', () => {
            showScreen(editorScreen);
            // No need to change navigation mode state here, editor will be in its last state (edit mode)
        });
    }

    if (submitPromptBtn) {
        submitPromptBtn.addEventListener('click', handlePromptSubmission);
    }

    async function handlePromptSubmission() {
        const userQuery = userPromptInput.value.trim();
        if (!userQuery) {
            alert("Please enter a prompt.");
            return;
        }

        if (!geminiApiKey) {
            promptResponseArea.innerHTML = "<p style='color: red;'>Error: Gemini API Key is not set. Please set it in Settings.</p>";
            alert("Gemini API Key is not set. Please go to Settings to add it.");
            return;
        }

        if (!navigator.onLine) {
            promptResponseArea.innerHTML = "<p style='color: red;'>Error: No internet connection. Please check your connection and try again.</p>";
            alert("Error: No internet connection. Prompting requires an active internet connection.");
            return;
        }

        if (!currentProject || !currentProject.images || currentProject.images.length === 0) {
            promptResponseArea.innerHTML = "<p style='color: orange;'>No images in the current project to prompt about.</p>";
            alert("There are no images in the current project to ask about.");
            return;
        }

        promptResponseArea.innerHTML = "<p><i>Sending prompt to AI...</i></p>";
        submitPromptBtn.disabled = true;

        try {
            // 1. Aggregate World Model Data
            const worldModelContext = currentProject.images.map(imgNode => {
                return {
                    id: imgNode.id.substring(0, 5), // Short ID for context
                    description: imgNode.description || "No description available.",
                    position: imgNode.position,
                    rotation: imgNode.rotation,
                    scale: imgNode.scale
                };
            });

            const worldModelString = JSON.stringify(worldModelContext, null, 2);

            // 2. Construct the prompt
            const systemInstruction = `You are an AI assistant helping to understand and interact with a 3D model composed of several images.
The user will provide a query about this model.
The model's current state is described by the following JSON data, where each object represents an image plane in the 3D scene:
${worldModelString}

Based on this data and the user's query, provide a concise and helpful response.
If the query asks to simulate a change, describe the likely outcome or what would need to happen. Do not actually modify the JSON data.
If a query is ambiguous or requires information not present in the descriptions or spatial data, state that clearly.
Focus on interpreting the spatial relationships and descriptive content of the images.`;

            const fullPrompt = `${systemInstruction}\n\nUser Query: "${userQuery}"`;

            // 3. Call Gemini API
            const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
            const requestBody = {
                contents: [{ parts: [{ text: fullPrompt }] }],
                // Optional: Add generationConfig for temperature, maxOutputTokens, safetySettings etc.
                // generationConfig: {
                //   "temperature": 0.7,
                //   "maxOutputTokens": 1024,
                // }
            };

            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                const apiErrorMsg = errorData.error ? errorData.error.message : `HTTP ${response.statusText}`;
                let userFriendlyError = `Error: API request failed (${response.status}). ${apiErrorMsg}`;
                 if (response.status === 400 && apiErrorMsg.toLowerCase().includes("api key not valid")) {
                    userFriendlyError = "Error: Invalid API Key. Please check your API key in Settings.";
                } else if (response.status === 429) {
                    userFriendlyError = "Error: API rate limit exceeded or quota finished. Please try again later.";
                }
                promptResponseArea.innerHTML = `<p style='color: red;'>${userFriendlyError}</p>`;
                console.error("API Error during prompting:", response.status, errorData);
            } else {
                const responseData = await response.json();
                if (responseData.promptFeedback && responseData.promptFeedback.blockReason) {
                    const reason = responseData.promptFeedback.blockReason;
                    promptResponseArea.innerHTML = `<p style='color: orange;'>Warning: Prompt was blocked by the API. Reason: ${reason}.</p>`;
                    console.warn("Prompt blocked by API:", reason, responseData);
                } else if (responseData.candidates && responseData.candidates.length > 0 &&
                    responseData.candidates[0].content && responseData.candidates[0].content.parts &&
                    responseData.candidates[0].content.parts.length > 0 && responseData.candidates[0].content.parts[0].text) {

                    const aiResponseText = responseData.candidates[0].content.parts[0].text;
                    // Sanitize basic HTML from response if needed, or use .textContent
                    promptResponseArea.innerHTML = `<p>${aiResponseText.replace(/\n/g, '<br>')}</p>`;
                } else {
                    promptResponseArea.innerHTML = "<p style='color: orange;'>Warning: AI returned an empty or unexpected response.</p>";
                    console.warn("Empty or unexpected AI response:", responseData);
                }
            }

        } catch (error) {
            console.error("Error during prompt submission:", error);
            let errorMessage = `An unexpected error occurred: ${error.message}.`;
            if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
                errorMessage = "Error: Network issue. Could not connect to the AI service.";
            }
            promptResponseArea.innerHTML = `<p style='color: red;'>${errorMessage}</p>`;
        } finally {
            submitPromptBtn.disabled = false;
        }
    }


    if (toggleViewModeBtn) {
        toggleViewModeBtn.addEventListener('click', () => {
            isNavigationMode = !isNavigationMode;
            if (isNavigationMode) {
                toggleViewModeBtn.textContent = 'Switch to Edit Mode';
                dEditorContainer.classList.add('navigation-mode');
                // Potentially clear selected image if any
                if(selectedImageElement) {
                    // Logic to deselect if any visual indication of selection exists
                    selectedImageElement = null;
                    currentImageNode = null;
                }
                console.log("Switched to Navigation Mode");
            } else {
                toggleViewModeBtn.textContent = 'Switch to Navigation Mode';
                dEditorContainer.classList.remove('navigation-mode');
                // Clear any active tooltips
                clearDescriptionTooltip();
                console.log("Switched to Edit Mode");
            }
            // Re-render to apply/remove event listeners or change styles if needed
            renderImagesIn3DView();
        });
    }

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
        if (settingsScreen) settingsScreen.style.display = 'none';
        if (promptScreen) promptScreen.style.display = 'none'; // Hide prompt screen

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
                imgElement.addEventListener('wheel', onImageWheel);

                if (isNavigationMode) {
                    imgElement.addEventListener('mouseenter', onImageMouseEnterNavigation);
                    imgElement.addEventListener('mouseleave', onImageMouseLeaveNavigation);
                    // For touch devices, a tap could show the tooltip
                    imgElement.addEventListener('click', onImageClickNavigation);
                } else {
                    // Ensure these are removed if mode switched back
                    imgElement.removeEventListener('mouseenter', onImageMouseEnterNavigation);
                    imgElement.removeEventListener('mouseleave', onImageMouseLeaveNavigation);
                    imgElement.removeEventListener('click', onImageClickNavigation);
                }

                imageHostWrapper.appendChild(imgElement); // Append to wrapper, not container
            });
        }
    }

    let descriptionTooltip = null; // To hold the tooltip element

    function showDescriptionTooltip(imgNode, event) {
        clearDescriptionTooltip(); // Remove any existing tooltip

        if (!imgNode.description) return; // No description to show

        descriptionTooltip = document.createElement('div');
        descriptionTooltip.id = 'description-tooltip';
        descriptionTooltip.textContent = imgNode.description;
        descriptionTooltip.style.position = 'absolute';

        // Position tooltip near the mouse cursor or image element
        // Adjusting for editor container's offset and scale
        const rect = dEditorContainer.getBoundingClientRect();
        let x = event.clientX - rect.left;
        let y = event.clientY - rect.top;

        descriptionTooltip.style.left = `${x + 15}px`; // Offset from cursor
        descriptionTooltip.style.top = `${y + 15}px`;

        descriptionTooltip.style.background = 'rgba(0,0,0,0.8)';
        descriptionTooltip.style.color = 'white';
        descriptionTooltip.style.padding = '8px';
        descriptionTooltip.style.borderRadius = '4px';
        descriptionTooltip.style.maxWidth = '300px';
        descriptionTooltip.style.zIndex = '10000'; // Ensure it's on top
        descriptionTooltip.style.pointerEvents = 'none'; // So it doesn't interfere with other mouse events

        dEditorContainer.appendChild(descriptionTooltip);
    }

    function clearDescriptionTooltip() {
        if (descriptionTooltip) {
            descriptionTooltip.remove();
            descriptionTooltip = null;
        }
    }

    function onImageMouseEnterNavigation(event) {
        if (!isNavigationMode || !currentProject) return;
        const imgId = event.target.id;
        const imgNode = currentProject.images.find(node => node.id === imgId);
        if (imgNode) {
            showDescriptionTooltip(imgNode, event);
        }
    }

    function onImageMouseLeaveNavigation() {
        if (!isNavigationMode) return;
        clearDescriptionTooltip();
    }

    let lastTooltipClickTime = 0;
    let lastTooltipNodeId = null;

    function onImageClickNavigation(event) {
        if (!isNavigationMode || !currentProject) return;
        event.preventDefault(); // Prevent other actions like drag-select starting
        event.stopPropagation(); // Stop event from bubbling to editor container for panning

        const imgId = event.target.id;
        const imgNode = currentProject.images.find(node => node.id === imgId);

        const currentTime = Date.now();
        // If tapping the same image again quickly, hide tooltip (toggle behavior)
        if (imgNode && descriptionTooltip && lastTooltipNodeId === imgId && (currentTime - lastTooltipClickTime < 500)) {
            clearDescriptionTooltip();
            lastTooltipClickTime = 0; // Reset time
            lastTooltipNodeId = null;
        } else if (imgNode) {
            showDescriptionTooltip(imgNode, event);
            lastTooltipClickTime = currentTime;
            lastTooltipNodeId = imgId;
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

        // If in navigation mode, image mousedown should not initiate drag/rotate/translate for the image itself.
        // It might still be useful for other interactions later, but for now, we block editing actions.
        // Panning the camera is handled by dEditorContainer's mousedown.
        if (isNavigationMode) {
            // If a tooltip is shown via click, another click on an image (even the same one)
            // should ideally hide the current tooltip before potentially showing a new one.
            // The onImageClickNavigation handles tooltip display.
            // We could clear the tooltip here if the click is on an image,
            // but onImageClickNavigation is more specific.
            // For now, just prevent edit interactions.
            e.stopPropagation(); // Prevent editor container panning if clicking on an image in nav mode.
                                 // This allows onImageClickNavigation to handle the interaction.
            return;
        }

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
        // If in navigation mode, wheel event on an image should not scale the image.
        // It should be handled by the dEditorContainer's wheel event for camera zoom.
        if (isNavigationMode) {
            // Allow event to bubble up to dEditorContainer for camera zoom.
            // Do not preventDefault or stopPropagation here unless specifically intending to block camera zoom when over an image.
            // For now, assume camera zoom should still work.
            return;
        }

        e.preventDefault(); // Prevent page scrolling if we are scaling an image
        e.stopPropagation(); // Prevent dEditorContainer's wheel (camera zoom) if scaling an image

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
            if (aiSelectableImageListUl) aiSelectableImageListUl.innerHTML = ""; // Clear AI selection list too
            if (aiDescriptionsListUl) aiDescriptionsListUl.innerHTML = ""; // Clear AI descriptions list
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
                // Display description if available
                if (imgNode.description) {
                    const descSpan = document.createElement('span');
                    descSpan.textContent = ` Description: ${imgNode.description.substring(0, 30)}...`;
                    descSpan.style.fontSize = "0.8em";
                    descSpan.style.color = "#555";
                    li.appendChild(descSpan);
                }
                ul.appendChild(li);
            });
            currentProjectImagesDiv.appendChild(ul);
        }
        populateAiSelectableImageList(); // Populate the AI image selection list
        renderAiDescriptions(); // Render existing descriptions
    }

    function populateAiSelectableImageList() {
        if (!aiSelectableImageListUl || !currentProject || !currentProject.images) {
            if (aiSelectableImageListUl) aiSelectableImageListUl.innerHTML = "";
            return;
        }
        aiSelectableImageListUl.innerHTML = ""; // Clear previous list

        if (currentProject.images.length === 0) {
            aiSelectableImageListUl.innerHTML = "<li>No images in project to select.</li>";
            return;
        }

        currentProject.images.forEach(imgNode => {
            const listItem = document.createElement('li');
            listItem.style.display = 'flex';
            listItem.style.alignItems = 'center';
            listItem.style.marginBottom = '5px';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `cb-ai-${imgNode.id}`;
            checkbox.value = imgNode.id;
            checkbox.style.marginRight = '10px';

            const imgElement = document.createElement('img');
            imgElement.src = imgNode.imageDataUrl;
            imgElement.style.width = "40px";
            imgElement.style.height = "40px";
            imgElement.style.objectFit = "cover";
            imgElement.style.marginRight = "10px";

            const label = document.createElement('label');
            label.htmlFor = `cb-ai-${imgNode.id}`;
            label.appendChild(imgElement);
            label.appendChild(document.createTextNode(`Image ID: ${imgNode.id.substring(0,5)}... (Click to select)`));

            // Display existing description hint
            if (imgNode.description) {
                const descHint = document.createElement('span');
                descHint.textContent = " (Has description)";
                descHint.style.fontSize = "0.8em";
                descHint.style.color = "green";
                label.appendChild(descHint);
            }


            listItem.appendChild(checkbox);
            listItem.appendChild(label);
            aiSelectableImageListUl.appendChild(listItem);
        });
    }

    function renderAiDescriptions() {
        if (!aiDescriptionsListUl || !currentProject || !currentProject.images) {
            if (aiDescriptionsListUl) aiDescriptionsListUl.innerHTML = "";
            return;
        }
        aiDescriptionsListUl.innerHTML = ""; // Clear previous list

        const imagesWithDescriptions = currentProject.images.filter(img => img.description);

        if (imagesWithDescriptions.length === 0) {
            aiDescriptionsListUl.innerHTML = "<li>No descriptions available yet. Process images with AI.</li>";
            return;
        }

        imagesWithDescriptions.forEach(imgNode => {
            const listItem = document.createElement('li');

            const imgElement = document.createElement('img');
            imgElement.src = imgNode.imageDataUrl;
            imgElement.style.width = "30px";
            imgElement.style.height = "30px";
            imgElement.style.objectFit = "cover";
            imgElement.style.marginRight = "5px";
            imgElement.style.verticalAlign = "middle";

            const textStrong = document.createElement('strong');
            textStrong.textContent = `Image ${imgNode.id.substring(0,5)}...: `;

            const descText = document.createElement('span');
            descText.textContent = imgNode.description;

            // Basic edit functionality (can be enhanced later)
            const editBtn = document.createElement('button');
            editBtn.textContent = "Edit";
            editBtn.style.marginLeft = "10px";
            editBtn.style.padding = "2px 5px";
            editBtn.onclick = () => {
                const newDesc = prompt(`Edit description for image ${imgNode.id.substring(0,5)}:`, imgNode.description);
                if (newDesc !== null && newDesc.trim() !== imgNode.description) {
                    imgNode.description = newDesc.trim();
                    saveProject(currentProject).then(() => {
                        console.log("Description updated and project saved.");
                        renderAiDescriptions(); // Re-render this list
                        displayProjectImages(); // Re-render main image list to show updated snippet
                        populateAiSelectableImageList(); // Re-render selection list to update "has description" hint
                    }).catch(err => console.error("Error saving updated description:", err));
                }
            };

            listItem.appendChild(imgElement);
            listItem.appendChild(textStrong);
            listItem.appendChild(descText);
            listItem.appendChild(editBtn);
            aiDescriptionsListUl.appendChild(listItem);
        });
    }


    if (processSelectedAiBtn) {
        processSelectedAiBtn.addEventListener('click', async () => {
            if (!currentProject) {
                alert("No project loaded.");
                return;
            }
            if (!geminiApiKey) {
                aiStatusIndicator.textContent = "Error: Gemini API Key is not set. Please set it in Settings.";
                aiStatusIndicator.style.color = "red";
                alert("Gemini API Key is not set. Please go to Settings to add it.");
                return;
            }

            if (!navigator.onLine) {
                aiStatusIndicator.textContent = "Error: No internet connection. Please check your connection and try again.";
                aiStatusIndicator.style.color = "red";
                alert("Error: No internet connection. AI processing requires an active internet connection.");
                return;
            }

            const selectedImageNodes = [];
            const checkboxes = aiSelectableImageListUl.querySelectorAll('input[type="checkbox"]:checked');
            checkboxes.forEach(cb => {
                const nodeId = cb.value;
                const node = currentProject.images.find(img => img.id === nodeId);
                if (node) {
                    selectedImageNodes.push(node);
                }
            });

            if (selectedImageNodes.length === 0) {
                aiStatusIndicator.textContent = "No images selected for AI processing.";
                aiStatusIndicator.style.color = "orange";
                alert("Please select at least one image to process.");
                return;
            }

            aiStatusIndicator.textContent = `Processing ${selectedImageNodes.length} image(s)... (This may take a moment)`;
            aiStatusIndicator.style.color = "blue";
            processSelectedAiBtn.disabled = true;

            try {
                await generateImageDescriptions(selectedImageNodes);
                aiStatusIndicator.textContent = `Successfully processed ${selectedImageNodes.length} image(s). Descriptions updated.`;
                aiStatusIndicator.style.color = "green";
                // Refresh UI
                saveProject(currentProject).then(() => {
                     console.log("Project saved with new descriptions.");
                     displayProjectImages(); // This will call populateAiSelectableImageList and renderAiDescriptions
                });
            } catch (error) {
                console.error("Error during AI processing:", error);
                aiStatusIndicator.textContent = `Error: ${error.message}. Check console for details.`;
                aiStatusIndicator.style.color = "red";
            } finally {
                processSelectedAiBtn.disabled = false;
            }
        });
    }


    async function generateImageDescriptions(imageNodes) {
        if (!geminiApiKey) {
            throw new Error("Gemini API Key is not set.");
        }

        const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
        let processedCount = 0;
        let errorCount = 0;

        for (const imgNode of imageNodes) {
            try {
                aiStatusIndicator.textContent = `Processing image ${processedCount + 1} of ${imageNodes.length} (ID: ${imgNode.id.substring(0,5)})...`;

                // 1. Extract Base64 data and MIME type
                const imageDataPrefix = "data:";
                const base64Marker = ";base64,";

                if (!imgNode.imageDataUrl.startsWith(imageDataPrefix)) {
                    console.error(`Image ${imgNode.id} has invalid imageDataUrl format.`);
                    imgNode.description = "Error: Invalid image data format.";
                    errorCount++;
                    processedCount++;
                    continue;
                }

                const mimeTypeEndIndex = imgNode.imageDataUrl.indexOf(base64Marker);
                if (mimeTypeEndIndex === -1) {
                    console.error(`Image ${imgNode.id} has invalid imageDataUrl format (missing base64 marker).`);
                    imgNode.description = "Error: Invalid image data format.";
                    errorCount++;
                    processedCount++;
                    continue;
                }

                const mimeType = imgNode.imageDataUrl.substring(imageDataPrefix.length, mimeTypeEndIndex);
                const base64Data = imgNode.imageDataUrl.substring(mimeTypeEndIndex + base64Marker.length);

                if (!mimeType.startsWith("image/")) {
                     console.error(`Image ${imgNode.id} has non-image MIME type: ${mimeType}`);
                     imgNode.description = `Error: Invalid MIME type (${mimeType}).`;
                     errorCount++;
                     processedCount++;
                     continue;
                }

                const requestBody = {
                    contents: [
                        {
                            parts: [
                                { text: "Describe this image in detail." },
                                {
                                    inline_data: {
                                        mime_type: mimeType,
                                        data: base64Data
                                    }
                                }
                            ]
                        }
                    ],
                    // Optional: Add generationConfig if needed, e.g., for safety settings
                    // generationConfig: {
                    //   "temperature": 0.7,
                    //   "maxOutputTokens": 2048,
                    // }
                };

                const response = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    let userErrorMessage = `API request failed (${response.status}).`;
                    try {
                        const errorData = await response.json();
                        console.error(`API Error for image ${imgNode.id}: ${response.status}`, errorData);
                        const apiErrorMsg = errorData.error ? errorData.error.message : response.statusText;

                        if (response.status === 400) { // Bad Request
                            if (apiErrorMsg.toLowerCase().includes("api key not valid")) {
                                userErrorMessage = "Error: Invalid API Key. Please check your API key in Settings.";
                            } else {
                                userErrorMessage = `Error: API Bad Request (${response.status}) - ${apiErrorMsg}. Please check image data or prompt.`;
                            }
                        } else if (response.status === 429) { // Too Many Requests
                            userErrorMessage = "Error: API rate limit exceeded or quota finished. Please try again later.";
                        } else if (response.status >= 500) { // Server error
                            userErrorMessage = `Error: Gemini API server error (${response.status}). Please try again later.`;
                        } else {
                            userErrorMessage = `Error: API request failed (${response.status}) - ${apiErrorMsg}.`;
                        }
                        imgNode.description = userErrorMessage;
                    } catch (e) { // JSON parsing failed or other network issue
                        console.error(`API Error (could not parse JSON) for image ${imgNode.id}: ${response.status}`, response.statusText);
                        imgNode.description = `Error: API request failed (${response.status}) - ${response.statusText}.`;
                    }
                    errorCount++;
                } else {
                    const responseData = await response.json();

                    if (responseData.promptFeedback && responseData.promptFeedback.blockReason) {
                        const blockReason = responseData.promptFeedback.blockReason;
                        console.warn(`Image ${imgNode.id} processing blocked by API. Reason: ${blockReason}`);
                        let friendlyBlockReason = blockReason;
                        if (blockReason === "SAFETY") {
                            friendlyBlockReason = "due to safety concerns by the API";
                        } else if (blockReason === "OTHER") {
                             friendlyBlockReason = "for an unspecified reason by the API";
                        }
                        imgNode.description = `Warning: Processing blocked ${friendlyBlockReason}.`;
                        // Consider if this should count as an error for the summary
                        // errorCount++;
                    } else if (responseData.candidates && responseData.candidates.length > 0 &&
                        responseData.candidates[0].content && responseData.candidates[0].content.parts &&
                        responseData.candidates[0].content.parts.length > 0 && responseData.candidates[0].content.parts[0].text) {

                        imgNode.description = responseData.candidates[0].content.parts[0].text.trim();
                        console.log(`Description for ${imgNode.id}: ${imgNode.description}`);
                    } else {
                        console.warn(`No description found in API response for image ${imgNode.id}:`, responseData);
                        imgNode.description = "Warning: No description text returned by API. The response might be empty or in an unexpected format.";
                    }
                }
            } catch (err) { // Catches network errors (e.g., fetch promise rejected) or other JS errors
                console.error(`Error processing image ${imgNode.id}:`, err);
                if (err instanceof TypeError && err.message.includes("Failed to fetch")) { // Common network error
                     imgNode.description = "Error: Network issue. Could not connect to API.";
                } else {
                    imgNode.description = `Error: ${err.message}`;
                }
                errorCount++;
            }
            processedCount++;
        } // end for loop

        if (errorCount > 0) {
            // The main error message for the status indicator is handled in the click event handler's catch block.
            // This throw is to signal failure to that handler.
            throw new Error(`Finished processing with ${errorCount} error(s) out of ${imageNodes.length} images. Check individual image descriptions for details.`);
        }
    }

});

// Further application logic will be added here:
// - AI integration (Gemini API calls) - Partially started
// - etc.
console.log("scripts.js loaded");
