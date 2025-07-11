# PromptWorld

PromptWorld is a cross-platform application that allows users to organize collections of photos or video frames into an approximate 3D virtual space. It provides simple tools for positioning and rotating images as 2D planes in 3D, without requiring advanced 3D modeling techniques. Integrated AI generates detailed descriptions of the images, enabling users to create a rough "world model" that can be queried or prompted via natural language for tracking, managing, or simulating changes in environments. This app serves as a precursor tool for conceptualizing future interactions with real-world spaces through prompts.

The app is designed with a web-first approach using vanilla JavaScript, HTML, and CSS (leveraging CSS3D for 3D rendering), ensuring maximum code sharing. It runs natively in web browsers and on Android via a thin Java WebView wrapper.

**Key Goals:**
- Approximate 3D organization of images.
- AI-powered image descriptions.
- Natural language prompting for model interaction.
- Utility for environment management and simulation.

**Target Platforms:**
- Web (browsers like Chrome, Firefox, Safari).
- Android (8.0+).

## Features

- **Image Import**: Upload photos or extract frames from videos. Supports gallery selection, camera capture (web via getUserMedia, Android via native intents).
- **3D Editor**: Manually position, rotate, and scale images in a CSS3D-based virtual space using touch/mouse gestures.
- **Navigation**: Explore the 3D model with camera controls (pan, zoom, rotate).
- **AI Processing**: Generate detailed textual descriptions of images using the Gemini API (cloud-based).
- **Prompting**: Query the world model with natural language (e.g., "Describe the layout" or "Simulate removing an object") via Gemini API.
- **Storage**: Local persistence using IndexedDB; export models as JSON.
- **Cross-Platform**: Shared codebase for web and Android, with minimal platform-specific code.
- **Minimal Dependencies**: No external libraries—pure vanilla JS/CSS/HTML for core functionality.

## Technologies

- **Core**: JavaScript (vanilla), HTML5, CSS3 (with 3D transforms).
- **AI Integration**: Google Gemini API (requires user-provided API key).
- **Storage**: IndexedDB (browser standard).
- **Android Wrapper**: Java with Android WebView for native integration (file access, permissions).
- **No Frameworks/Libraries**: Designed for minimalism; no Three.js, React, or other dependencies.

## Installation

### Web Version
1. Clone the repository:
   ```
   git clone https://github.com/yourusername/PromptWorld.git
   ```
2. Open `index.html` in a modern web browser.
3. (Optional) Host on a static server (e.g., GitHub Pages) for online access.
4. Enter your Gemini API key in the app's settings page to enable AI features.

### Android Version
1. Clone the repository.
2. Open the Android project in Android Studio (located in the `android/` directory).
3. Build the APK: Select "Build > Build Bundle(s) / APK(s) > Build APK(s)".
4. Install the APK on an Android device or emulator (Android 8.0+).
5. Grant permissions for storage and internet when prompted.
6. The app loads the web assets locally; enter your Gemini API key in settings.

**Note**: The Android version uses a WebView to run the same HTML/JS/CSS code as the web version. Web assets are bundled in the APK's `assets/` folder.

## Usage

### Quick Start
1. **Create a Project**: From the home screen, click "New Project" and name it.
2. **Import Images**: Upload images or videos. For videos, select frame extraction interval.
3. **Edit in 3D**: Drag images into the 3D space, use gestures to adjust position/rotation/scale.
4. **Process with AI**: Select images and generate descriptions (internet required).
5. **Navigate & Prompt**: Explore the 3D view or use the chat interface to prompt the model (e.g., "List all furniture").
6. **Export**: Save your model as JSON for backup or sharing.

### Settings
- **API Key**: Required for AI features. Obtain from Google Cloud Console (Gemini API).
- **Offline Mode**: Basic editing works offline; AI requires internet.

### Examples
- **Home Management**: Organize room photos, prompt for object inventories, simulate renovations.
- **Prototyping**: Build rough spatial models for design ideas.

## Development

### Folder Structure
```
PromptWorld/
├── src/                  # Shared web assets
│   ├── index.html
│   ├── styles.css
│   ├── scripts.js
│   └── assets/       # Images, etc.
├── android/             # Android-specific Java project
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/... (WebViewActivity.java)
│   │   │   └── assets/  # Copied web files
│   │   └── ...
│   └── build.gradle
├── README.md
└── .gitignore
```

### Building & Testing
- **Web**: Test in browser; use developer tools for debugging.
- **Android**: Use Android Studio; test on devices for gestures and permissions.
- **Code Style**: Follow vanilla JS best practices; comment heavily.

### Limitations
- CSS3D 3D may have rendering quirks on older browsers.
- AI is cloud-only; no on-device processing.
- Video frame extraction limited to browser capabilities.

## Contributing

Contributions are welcome! Please:
1. Submit issues for bugs/features.
2. Follow code style: Minimalist, no dependencies.
3. Pull requests: Test on both platforms.

## License

MIT License

Copyright (c) 2024] YourName

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Contact

For questions, reach out via GitHub issues.
