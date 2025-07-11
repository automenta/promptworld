# PromptWorld Development Plan

This development plan outlines the step-by-step process for building PromptWorld, a cross-platform app for organizing images in approximate 3D space with AI descriptions and prompting capabilities. The plan is divided into phases. Milestones include deliverables and testing checkpoints.

The plan emphasizes a web-first approach for maximum code sharing, with Android integration as a wrapper. All core code uses vanilla JavaScript, HTML, and CSS3D.

## Phase 1: Project Setup and Architecture
**Goal**: Establish the foundation, including repository setup, basic structure, and cross-platform configuration.

- **Tasks**:
  - Set up Git repository with folders: `src/` for shared web assets (index.html, styles.css, scripts.js), `android/` for Java project.
  - Define data models in JS (e.g., Project and ImageNode objects).
  - Implement basic IndexedDB storage for projects and nodes.
  - Create skeleton HTML structure: Home screen with project list, navigation between screens (using div visibility toggles).
  - Style basic UI with CSS (responsive for mobile/desktop).
  - For Android: Create Java project in Android Studio, add WebView in MainActivity, load local index.html from assets, and implement JavaScriptInterface for bridges (e.g., file picker).
- **Android-Specific**:
  - Handle permissions (storage, camera, internet).
  - Bundle web assets into APK.
- **Milestones**:
  - Functional empty app shell running in browser and Android emulator.
  - Basic navigation between home and placeholder screens.
- **Testing**: Manual browser tests; Android emulator for WebView rendering.
- **Risks**: Ensure CSS3D compatibility across browsers (test Chrome, Firefox).

## Phase 2: Image Import and Basic 3D Editor
**Goal**: Enable image/video import and core 3D manipulation using CSS3D.

- **Tasks**:
  - Implement image import: HTML file input for uploads, Base64 encoding with FileReader.
  - Video frame extraction: Use <video> and canvas to capture frames at intervals.
  - Camera integration: getUserMedia for web; Android bridge for native camera.
  - Build 3D Editor: Create perspective container div, add image planes as styled divs.
  - Add interactions: JS event listeners for drag (position), pinch/wheel (scale/zoom), multi-touch/mouse for rotation and camera navigation.
  - Sidebar for image list with drag-and-drop to 3D space.
  - Real-time updates: Sync changes to IndexedDB.
- **Android-Specific**:
  - Bridge for gallery intents to pass URIs to JS (convert to Base64 in JS).
- **Milestones**:
  - Users can import images/videos, place/manipulate them in 3D space.
  - Basic navigation (pan/zoom) in the 3D view.
- **Testing**: Unit tests in JS (e.g., simulate events); cross-device gesture testing.
- **Risks**: Gesture inconsistencies (use touch vs. mouse fallbacks); performance with many images (optimize by limiting to 100).

## Phase 3: AI Processing Integration
**Goal**: Add AI for image descriptions using Gemini API.

- **Tasks**:
  - Create settings page for API key input (store in localStorage).
  - Implement AI screen: Progress indicators, loop over selected images, encode Base64, fetch to Gemini API.
  - Parse responses and store descriptions in ImageNode.
  - Add manual edit option for descriptions.
  - Handle errors (e.g., offline warnings, API rate limits).
- **Android-Specific**: Ensure internet permission; no changes needed as fetch is web-standard.
- **Milestones**:
  - Generate and display descriptions for imported images.
  - Integration tested with sample API key.
- **Testing**: Mock API responses for offline dev; end-to-end tests with real API.
- **Risks**: API dependency (require user key); data privacy warnings for uploads.

## Phase 4: Navigation, Prompting, and Advanced Features
**Goal**: Complete user flows with read-only navigation, prompting, and exports.

- **Tasks**:
  - Enhance 3D view for navigation mode (disable edits, add tooltips for descriptions).
  - Implement Prompt screen: Chat-like input, aggregate model as JSON prompt, fetch to Gemini API.
  - Handle prompt responses: Display text, optional model updates (e.g., simulate changes).
  - Add export: JSON download link; screenshot via canvas capture of 3D view.
  - Implement compare feature for project versions (basic diff of descriptions).
- **Android-Specific**: Bridge for file exports if needed (e.g., save to device storage).
- **Milestones**:
  - Full end-to-end workflow: Import → Edit → Process → Prompt → Export.
  - Prompting simulates changes effectively.
- **Testing**: Scenario tests (e.g., "remove object" prompt); performance with large models.
- **Risks**: Prompt quality depends on API; refine prefix prompts iteratively.

## Phase 5: Testing, Optimization, and Polish
**Goal**: Ensure reliability, performance, and user-friendliness across platforms.

- **Tasks**:
  - Comprehensive testing: Browser compatibility (desktop/mobile), Android devices (emulator/real).
  - Optimize: Reduce DOM updates for smoother 3D; handle large Base64 (compression if needed).
  - UI Polish: Responsive design, error messages, loading spinners.
  - Accessibility: Add ARIA labels for 3D elements.
  - Documentation: Update README with usage examples; add in-app help.
- **Android-Specific**: Test APK installation, permissions flow, back button handling.
- **Milestones**:
  - Bug-free core features; passing all test cases.
  - Optimized for mid-range devices (e.g., <5s load times).
- **Testing**: Automated JS tests (using browser APIs); manual usability sessions.
- **Risks**: CSS3D edge cases (e.g., z-index issues); mitigate with fallbacks.

## Phase 6: Deployment and Release
**Goal**: Prepare for public release and initial feedback.

- **Tasks**:
  - Web: Deploy to GitHub Pages or static host; add PWA manifest for installable web app.
  - Android: Build signed APK; optional Google Play submission.
  - Final README updates: Include build instructions, license.
  - Gather feedback: Set up GitHub issues for bug reports.
- **Milestones**:
  - Live web version accessible online.
  - APK available for download.
- **Testing**: Production tests (e.g., real API usage).
- **Risks**: Deployment hurdles (e.g., API key security); address with docs.

## Overall Notes
- **Timeline Flexibility**: Phases can overlap (e.g., test during development). Adjust based on feedback.
- **Resources Needed**: Google Cloud account for Gemini API key; testing devices/browsers.
- **Success Metrics**: Functional MVP with all features; positive initial user tests.
- **Future Phases**: Post-release could include on-device AI (if web standards evolve), more AI models, or iOS wrapper.
