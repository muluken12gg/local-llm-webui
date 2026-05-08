# Nira AI - Local LLM Chat Interface

A comprehensive, offline-first chat application that combines **Ollama** (local LLM inference), **whisper.cpp** (offline speech-to-text), and **Web Speech API** (text-to-speech) for a complete conversational AI experience without internet connectivity.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Key Features](#key-features)
4. [Technology Stack](#technology-stack)
5. [Project Structure](#project-structure)
6. [Installation & Setup](#installation--setup)
7. [Configuration](#configuration)
8. [API Documentation](#api-documentation)
9. [Frontend Architecture](#frontend-architecture)
10. [Voice & Audio Features](#voice--audio-features)
11. [Data Persistence](#data-persistence)
12. [Error Handling](#error-handling)
13. [Development Guide](#development-guide)
14. [Troubleshooting](#troubleshooting)

---

## Overview

**Nira AI** is a web-based chat interface designed for **complete offline operation**. It allows users to:
- Chat with local LLM models via Ollama
- Record voice messages and transcribe them locally using whisper.cpp
- Receive spoken responses via the Web Speech API
- Maintain chat history locally in the browser

This project is ideal for users who want to run AI models on their own hardware without relying on cloud services or internet connectivity.

### Use Cases
- **Development**: Test and interact with local LLM models
- **Privacy**: Keep all conversations and data on your machine
- **Offline Work**: Chat with AI without internet access
- **Edge Computing**: Run on local hardware for low-latency inference

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Frontend)                            │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    React App (App.jsx)                         │  │
│  │                                                                │  │
│  │  • State Management (useState hooks)                          │  │
│  │  • Message history                                            │  │
│  │  • Audio recording state                                      │  │
│  │  • TTS state                                                  │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │  │
│  │  │   Chat UI    │  │Voice Recorder│  │   TTS Voice  │        │  │
│  │  │  (Messages)  │  │ (MediaRec.)  │  │ (Web Speech) │        │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │  │
│  │         ↓                  ↓                  ↓                │  │
│  │  API Calls to Backend                                         │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────────────────────────────┘
               │
         HTTP/CORS
               │
┌──────────────▼──────────────────────────────────────────────────────┐
│                   NODE.JS BACKEND (Express.js)                       │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    Express Server                              │  │
│  │                                                                │  │
│  │  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐ │  │
│  │  │ /api/chat       │  │/api/transcribe  │/health          │ │  │
│  │  │ (Proxy to      │  │ (Audio →   │  (Server Status) │ │  │
│  │  │  Ollama)       │  │  Whisper)  │  │                │ │  │
│  │  └─────────────────┘  └──────────────┘  └──────────────────┘ │  │
│  │         ↓                      ↓                               │  │
│  │  Axios HTTP Calls         Subprocess Spawning                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────┬──────────────────────┬──────────────────────────────┘
               │                      │
       ┌───────▼────────┐    ┌────────▼──────────────────┐
       │ OLLAMA SERVER  │    │  WHISPER.CPP + FFmpeg    │
       │ (localhost:    │    │                          │
       │  11434)        │    │  • Main.exe (Binary)     │
       │                │    │  • ggml-base.en.bin      │
       │ LLM Models     │    │  • FFmpeg (Audio Conv.)  │
       │ • codellama    │    │                          │
       │ • others       │    │ Process:                 │
       │                │    │ 1. Upload audio (webm)   │
       └────────────────┘    │ 2. Convert to WAV        │
                             │ 3. Transcribe to text    │
                             │ 4. Return transcription  │
                             └──────────────────────────┘
```

### Data Flow

#### Chat Message Flow
```
User Types Message
         ↓
    [Frontend]
   sendChat()
    (Add to state)
         ↓
   POST /api/chat
   {model, messages, stream}
         ↓
    [Backend]
   Express server
         ↓
Proxy to Ollama
   /api/chat
         ↓
   [Ollama]
 LLM Processing
         ↓
   Response
    (JSON/Stream)
         ↓
    [Frontend]
  Display & Speak
    speakText()
         ↓
  Update messages
  Save to localStorage
```

#### Voice Recording & Transcription Flow
```
User Clicks 🎙️ Button
         ↓
   [Frontend]
 startRecording()
 (MediaRecorder)
         ↓
User speaks...
Recording in progress
         ↓
User Clicks 🎙️ Button (again)
   stopRecording()
         ↓
Audio Blob (webm)
   transcribeAudio()
         ↓
   POST /api/transcribe
   (FormData with audio)
         ↓
    [Backend]
  Audio file uploaded
  to: server/uploads/
         ↓
  FFmpeg conversion
  (webm → wav)
         ↓
  Whisper.cpp spawn
  Process audio file
         ↓
  Output: {audioPath}.txt
         ↓
  Read transcription
  Clean up temp files
         ↓
  Response JSON:
  {transcription: "..."}
         ↓
    [Frontend]
 Extract text
 Call sendChat()
 with transcript
         ↓
 Chat continues...
```

---

## Key Features

### 1. **Chat Interface** 💬
- Clean, modern UI for sending and receiving messages
- Full conversation history displayed in chronological order
- Role labels for user and assistant messages
- Message styling with different background colors for distinction
- Placeholder text when no messages exist
- Responsive layout that works on different screen sizes

### 2. **Voice Recording & Transcription** 🎙️
- **Offline Audio Recording**: Uses browser's MediaRecorder API
- **Audio Format**: Records in WebM format for efficient compression
- **Automatic Conversion**: FFmpeg converts webm → wav (16kHz mono) for whisper.cpp
- **Whisper.cpp Integration**: Local speech-to-text transcription
- **Language Support**: Currently configured for English
- **No Cloud Dependency**: All processing happens locally
- **Smart Format Handling**: Auto-detects and converts audio formats

### 3. **Text-to-Speech** 🔊
- Uses Web Speech API for synthesized speech output
- Customizable voice parameters:
  - Rate: 0.9 (slightly slower for clarity)
  - Pitch: 1 (normal)
  - Volume: 0.8 (moderate level)
- Stop button to interrupt ongoing speech
- Automatic speech trigger after AI responses
- Visual indicator while speaking

### 4. **Chat History** 📝
- Messages are stored in browser's localStorage
- Automatic save on every message update
- Load history on application startup
- Clear history button to reset conversation
- Preserves entire conversation across browser sessions

### 5. **Error Handling & Feedback** ⚠️
- Error banners display at the top of chat window
- Status messages for recording, transcribing, waiting for response
- Detailed error messages from backend (with hints)
- Visual feedback for all states:
  - Recording in progress
  - Transcribing audio
  - Waiting for AI response
  - Speaking response

### 6. **Microphone Permissions** 🔐
- Browser-based permission request
- Clear error message if permission denied
- Check for MediaRecorder support (Chrome/Edge recommended)
- Graceful degradation for unsupported browsers

### 7. **Ollama Integration** 🤖
- Proxy connection to local Ollama server
- Support for any Ollama model (codellama by default)
- Streaming response support
- Automatic connection error detection
- Helpful error messages if Ollama is down

---

## Technology Stack

### Frontend
| Technology | Purpose | Version |
|-----------|---------|---------|
| **React** | UI framework and state management | 19.0.0 |
| **React DOM** | DOM rendering | 19.0.0 |
| **Vite** | Build tool and dev server | 5.4.1 |
| **CSS3** | Styling and animations | Native |

### Backend
| Technology | Purpose | Version |
|-----------|---------|---------|
| **Node.js** | JavaScript runtime | v25.9.0+ |
| **Express.js** | Web framework | 4.18.2 |
| **Axios** | HTTP client for proxying | 1.6.0 |
| **Multer** | File upload middleware | 2.1.1 |
| **CORS** | Cross-origin resource sharing | 2.8.5 |
| **dotenv** | Environment variable management | 16.3.1 |

### External Services
| Service | Purpose | Requirement |
|---------|---------|-------------|
| **Ollama** | Local LLM inference server | Must be running on localhost:11434 |
| **whisper.cpp** | Offline speech-to-text | Binary executable + ggml model |
| **FFmpeg** | Audio format conversion | Optional (auto-detects) |

### Browser APIs
| API | Purpose | Compatibility |
|-----|---------|----------------|
| **MediaRecorder** | Audio recording | Chrome, Edge, Firefox |
| **Web Speech API** | Text-to-speech synthesis | Chrome, Edge, Safari |
| **localStorage** | Client-side data persistence | All modern browsers |
| **getUserMedia** | Microphone access | Chrome, Edge, Firefox |

---

## Project Structure

```
ollama/                                 # Root directory
│
├── client/                              # React frontend
│   ├── src/
│   │   ├── App.jsx                      # Main React component
│   │   │   ├── ErrorBoundary            # Error boundary component
│   │   │   ├── State management         # useState hooks
│   │   │   ├── API functions            # sendChat, transcribeAudio
│   │   │   ├── Voice functions          # startRecording, stopRecording
│   │   │   ├── TTS functions            # speakText, stopSpeaking
│   │   │   └── UI rendering             # JSX for chat interface
│   │   ├── main.jsx                     # React entry point
│   │   ├── styles.css                   # All styling
│   │   └── index.html                   # HTML template
│   ├── dist/                            # Built frontend (auto-generated)
│   ├── package.json                     # Frontend dependencies
│   ├── vite.config.js                   # Vite configuration
│   └── .gitignore
│
├── server/                              # Express backend
│   ├── index.js                         # Main server file (400+ lines)
│   │   ├── Configuration                # PORT, OLLAMA_URL from .env
│   │   ├── Binary resolution functions  # resolveWhisperBinary, resolveFfmpegBinary
│   │   ├── Middleware setup             # CORS, JSON, static files
│   │   ├── /health endpoint             # Server status check
│   │   ├── /api/transcribe endpoint    # Audio transcription
│   │   ├── /api/chat endpoint          # Chat proxy to Ollama
│   │   ├── Static file serving         # React frontend
│   │   └── Server startup logic        # Port fallback on conflict
│   ├── .env                             # Environment variables
│   ├── uploads/                         # Temp audio files (auto-created)
│   ├── package.json                     # Backend dependencies
│   └── .gitignore
│
├── whisper.cpp/                         # Whisper.cpp (git submodule or clone)
│   ├── main.exe                         # Whisper binary (Windows)
│   ├── models/                          # Model files
│   └── ...other files
│
├── models/                              # ML models directory
│   └── ggml-base.en.bin                 # Whisper base model (600MB+)
│
├── .git/                                # Git repository
├── .gitignore                           # Git ignore rules
├── package.json                         # Root package manifest
├── package-lock.json                    # Dependency lock file
└── README.md                            # This file

```

### Directory Responsibilities

#### `/client`
- **React SPA** for the entire UI
- **Vite** bundles and serves the frontend
- **Build output** goes to `dist/` (served by Express)

#### `/server`
- **Express server** that:
  - Proxies requests to Ollama
  - Handles audio uploads and transcription
  - Serves the built React frontend
  - Manages file uploads and cleanup

#### `/whisper.cpp`
- Local clone or installation of the whisper.cpp repository
- Contains the compiled `main.exe` binary
- Models directory for ggml format models

#### `/models`
- Stores GGML format model files (large files ~600MB+)
- Currently: `ggml-base.en.bin` for English transcription
- Can be swapped with smaller/larger models as needed

---

## Installation & Setup

### Prerequisites

Before you start, ensure you have:

1. **Node.js** (v18+)
   ```bash
   node --version  # Check version
   ```

2. **Ollama** running on your machine
   - Download from https://ollama.ai
   - Start with: `ollama serve`
   - Default runs on `http://localhost:11434`

3. **Git** (for cloning and version control)
   ```bash
   git --version
   ```

4. **whisper.cpp** binary and model
   - See [Audio Features](#voice--audio-features) section for detailed setup

5. **FFmpeg** (optional, for audio conversion)
   - Windows: Download from https://ffmpeg.org/download.html
   - Or install via package manager

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd ollama
```

### Step 2: Install Backend Dependencies

```bash
cd server
npm install
```

This installs:
- `express` - Web framework
- `axios` - HTTP client
- `cors` - CORS middleware
- `multer` - File upload handling
- `dotenv` - Environment variables
- `nodemon` (dev) - Auto-restart on file changes

### Step 3: Install Frontend Dependencies

```bash
cd ../client
npm install
```

This installs:
- `react` - UI framework
- `react-dom` - DOM rendering
- `vite` (dev) - Build tool
- `@vitejs/plugin-react` (dev) - React support

### Step 4: Build the Frontend

```bash
npm run build
```

This creates the `dist/` folder with optimized production build.

### Step 5: Setup whisper.cpp & Model

See the [Voice & Audio Features](#voice--audio-features) section for complete instructions.

### Step 6: Configure Environment Variables

Edit `server/.env`:

```env
OLLAMA_URL=http://localhost:11434
PORT=3001

# After setting up whisper.cpp:
WHISPER_CPP_PATH=C:\Users\HP\Ollama\whisper.cpp\main.exe
WHISPER_MODEL_PATH=C:\Users\HP\Ollama\models\ggml-medium.en.bin

# Optional:
# FFMPEG_PATH=C:\path\to\ffmpeg\bin\ffmpeg.exe
```

### Step 7: Start the Backend

```bash
cd server
npm start
```

Expected output:
```
Starting server...
✅ Server running on http://localhost:3001
🔗 Proxying Ollama at: http://localhost:11434
```

### Step 8: Access the Application

Open your browser and navigate to:
```
http://localhost:3001
```

---

## Configuration

### Environment Variables

All configuration happens in `server/.env`. Here's the complete reference:

#### Required Variables

| Variable | Default | Purpose | Example |
|----------|---------|---------|---------|
| `PORT` | 3001 | Backend server port | `3001` |
| `OLLAMA_URL` | http://localhost:11434 | Ollama server URL | `http://localhost:11434` |

#### Optional Variables (Voice Features)

| Variable | Purpose | Example |
|----------|---------|---------|
| `WHISPER_CPP_PATH` | Path to whisper binary | `C:\Users\HP\Ollama\whisper.cpp\main.exe` |
| `WHISPER_MODEL_PATH` | Path to GGML model file | `C:\Users\HP\Ollama\models\ggml-medium.en.bin` |
| `FFMPEG_PATH` | Path to FFmpeg binary | `C:\Program Files\FFmpeg\bin\ffmpeg.exe` |

### Automatic Binary Resolution

The backend uses intelligent binary resolution:

1. **Checks environment variables first** (if set)
2. **Checks local workspace** (`../whisper.cpp/main.exe` for Windows)
3. **Searches system PATH** using `where` (Windows) or `which` (Unix)

This means you can:
- Set paths explicitly in `.env`
- Keep binaries in the workspace
- Install binaries globally and they'll be auto-discovered

### Model Selection

The default model in the frontend is:
```javascript
model: 'codellama:latest'  // In App.jsx sendChat()
```

To use a different model:
1. Ensure it's installed in Ollama: `ollama pull <model-name>`
2. Change the string in `client/src/App.jsx` line ~82

Available Ollama models:
- `llama2` - Meta's Llama 2
- `codellama` - Llama optimized for code
- `mistral` - Mistral AI model
- `neural-chat` - Intel Neural Chat
- And many others from ollama.ai

### Voice Parameters

Customize TTS voice in `client/src/App.jsx` in the `speakText()` function:

```javascript
utterance.rate = 0.9;    // 0.1 to 10 (slower = clearer)
utterance.pitch = 1;     // 0 to 2 (higher = higher pitch)
utterance.volume = 0.8;  // 0 to 1 (louder = more volume)
```

---

## API Documentation

### Backend Endpoints

#### 1. Health Check

**Endpoint:** `GET /health`

**Purpose:** Verify backend is running

**Response:**
```json
{
  "status": "OK",
  "message": "Backend server is running"
}
```

**Usage:**
```javascript
fetch('/health').then(r => r.json()).then(console.log)
```

---

#### 2. Chat (LLM Proxy)

**Endpoint:** `POST /api/chat`

**Purpose:** Send message to Ollama and get AI response

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "model": "codellama:latest",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "stream": false
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Ollama model name |
| `messages` | array | Yes | Conversation history |
| `stream` | boolean | No | Stream response (default: true) |

**Response (Non-streaming):**
```json
{
  "message": {
    "role": "assistant",
    "content": "I'm doing well, thank you for asking!"
  },
  "model": "codellama:latest",
  "created_at": "2024-01-15T10:30:00Z",
  "done": true
}
```

**Response (Streaming):**
```
Server-Sent Events format
Each chunk contains part of the response
```

**Error Responses:**

```json
// Missing fields
{
  "error": "Missing required fields: model and messages"
}

// Ollama not running
{
  "error": "Ollama server is not running or not accessible",
  "details": "Please ensure Ollama is running on localhost:11434"
}

// Other errors
{
  "error": "Internal server error",
  "details": "<error message>"
}
```

**Frontend Usage:**
```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'codellama:latest',
    messages: [{ role: 'user', content: message }],
    stream: false
  })
});
const data = await response.json();
```

---

#### 3. Audio Transcription

**Endpoint:** `POST /api/transcribe`

**Purpose:** Convert audio (speech) to text using whisper.cpp

**Content-Type:** `multipart/form-data`

**Request Body:**
```
Form field: "audio"
File: WebM or WAV audio file
```

**Request Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `audio` | File | Audio file (webm, wav, mp3, etc.) |

**Response (Success):**
```json
{
  "transcription": "Hello, this is a test message"
}
```

**Response (Errors):**

```json
// No file uploaded
{
  "error": "No audio file uploaded."
}

// whisper.cpp not found
{
  "error": "Whisper.cpp binary not found.",
  "details": "Set WHISPER_CPP_PATH to your local whisper.cpp executable..."
}

// Model not found
{
  "error": "Whisper model file not found.",
  "details": "Set WHISPER_MODEL_PATH to a valid ggml model file..."
}

// Transcription failed
{
  "error": "Offline transcription failed.",
  "details": "whisper.cpp exited with code 1: <stderr output>"
}

// Empty transcription
{
  "error": "Whisper did not return any transcription."
}
```

**Frontend Usage:**
```javascript
const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
const formData = new FormData();
formData.append('audio', audioBlob, 'recording.webm');

const response = await fetch('/api/transcribe', {
  method: 'POST',
  body: formData
});
const data = await response.json();
console.log(data.transcription);
```

---

### Static File Serving

**Endpoint:** `GET /`

**Purpose:** Serve the React frontend

**Files Served:**
- `/index.html` - React app entry point
- `/assets/` - CSS, JS bundles
- All other files from `client/dist/`

**Fallback:** All non-API routes serve `index.html` (SPA routing)

---

## Frontend Architecture

### Component Structure

```
App (Main Component)
├── ErrorBoundary (Error handling)
│
├── State Management (useState)
│   ├── message (current input)
│   ├── messages (chat history)
│   ├── loading (waiting for response)
│   ├── error (error messages)
│   ├── isRecording (recording state)
│   ├── isTranscribing (transcription state)
│   └── isSpeaking (TTS state)
│
├── Refs (useRef)
│   ├── speechSynthRef (TTS API)
│   ├── mediaRecorderRef (recorder instance)
│   ├── recordedChunksRef (audio chunks)
│   ├── messagesEndRef (auto-scroll)
│   └── messagesRef (messages reference)
│
├── Side Effects (useEffect)
│   ├── messagesRef sync
│   ├── Recording support check
│   ├── TTS initialization
│   ├── Load from localStorage
│   ├── Save to localStorage
│   └── Auto-scroll to bottom
│
├── JSX (UI Rendering)
│   ├── <header> - App title and clear button
│   ├── <main> - Chat window
│   │   ├── .messages - Message list
│   │   ├── Banners - Error, status, recording, TTS
│   │   └── .chat-form - Input and buttons
│   └── Error boundary fallback
│
└── Exported Component
    └── AppWithErrorBoundary
```

### State Variables Explained

| Variable | Type | Purpose | Initial |
|----------|------|---------|---------|
| `message` | string | Current user input in text field | `''` |
| `messages` | array | Full chat history | `[]` |
| `loading` | boolean | Waiting for AI response | `false` |
| `error` | string | Error message to display | `''` |
| `isRecording` | boolean | Microphone recording active | `false` |
| `isTranscribing` | boolean | Audio being transcribed | `false` |
| `isSpeaking` | boolean | AI response being spoken | `false` |
| `recordingSupported` | boolean | Browser supports MediaRecorder | `false` |

### Key Functions

#### `sendChat(userMessage: string)`
Sends a message to the Ollama LLM:
1. Builds message history with new user message
2. Updates component state
3. Makes POST request to `/api/chat`
4. Parses response from multiple possible formats
5. Adds assistant response to messages
6. Triggers TTS for response
7. Saves to localStorage

#### `transcribeAudio(audioBlob: Blob)`
Converts voice to text and continues chat:
1. Sets transcribing state to `true`
2. Creates FormData with audio file
3. POST to `/api/transcribe`
4. Extracts transcription from response
5. Calls `sendChat()` with transcribed text
6. Shows error if transcription fails

#### `startRecording()`
Initiates microphone capture:
1. Checks browser support
2. Requests microphone permission
3. Creates MediaRecorder instance
4. Sets up handlers for `ondataavailable` and `onstop`
5. Starts recording and updates state

#### `stopRecording()`
Ends recording and triggers transcription:
1. Stops the MediaRecorder
2. Collects all audio chunks
3. Creates Blob with type `audio/webm`
4. Calls `transcribeAudio()`
5. Stops the audio stream

#### `speakText(text: string)`
Synthesizes and plays audio response:
1. Cancels any previous speech
2. Creates SpeechSynthesisUtterance
3. Sets voice parameters (rate, pitch, volume)
4. Sets event handlers (onstart, onend, onerror)
5. Calls `speechSynthesis.speak()`

#### `stopSpeaking()`
Cancels ongoing speech synthesis:
1. Calls `speechSynthesis.cancel()`
2. Updates `isSpeaking` state

#### `handleSubmit(event)`
Form submission handler:
1. Prevents default form behavior
2. Validates message is not empty
3. Calls `sendChat()`

#### `clearHistory()`
Clears chat and persistent storage:
1. Resets `messages` state to `[]`
2. Removes from localStorage

#### `scrollToBottom()`
Auto-scrolls to latest message:
1. Called whenever messages change
2. Uses `messagesEndRef` to scroll smoothly

---

## Voice & Audio Features

### Speech-to-Text (Transcription)

#### Architecture

```
Browser Audio Recording
  (MediaRecorder API)
         ↓
    WebM Format
         ↓
    Upload to Server
  (Multipart/form-data)
         ↓
    Server Receives Audio
         ↓
   [If WebM] FFmpeg Convert
      webm → wav
    16kHz, mono, 16-bit
         ↓
  Spawn Whisper.cpp Process
  Args:
  - -m {modelPath}
  - -f {audioPath}
  - -otxt
  - --task transcribe
  - --language en
         ↓
  Whisper.cpp Processing
  (Inference on CPU/GPU)
         ↓
  Output: {audioPath}.txt
         ↓
  Read text file
         ↓
  Return JSON Response
  {transcription: "..."}
         ↓
  Clean up temp files
```

#### Setup Instructions

##### Step 1: Clone whisper.cpp

```bash
cd C:\Users\HP\Ollama
git clone https://github.com/ggerganov/whisper.cpp.git --depth 1
cd whisper.cpp
```

##### Step 2: Get the Binary

**Option A: Download Pre-built (Recommended)**

1. Visit: https://github.com/ggerganov/whisper.cpp/releases
2. Download: `main-windows-x64.exe` (latest release)
3. Place in: `C:\Users\HP\Ollama\whisper.cpp\main.exe`

**Option B: Build from Source**

Requires: Visual Studio Build Tools, CMake, C++ compiler

```bash
cd C:\Users\HP\Ollama\whisper.cpp
mkdir build && cd build
cmake ..
cmake --build . --config Release
```

Then copy `Release\main.exe` to the whisper.cpp folder.

##### Step 3: Download Model

Download the GGML model file (quantized weights):

1. Create directory: `C:\Users\HP\Ollama\models`
2. Download model (~1.5GB for medium):
   - From Hugging Face: https://huggingface.co/ggerganov/whisper.cpp/tree/main
   - File: `ggml-medium.en.bin` (English only, better accuracy)
   - Or: `ggml-base.en.bin` (smaller, faster)

Command line download (if curl available):
```bash
curl -L -o C:\Users\HP\Ollama\models\ggml-medium.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin
```

##### Step 4: Configure Environment

Edit `server/.env`:
```env
WHISPER_CPP_PATH=C:\Users\HP\Ollama\whisper.cpp\main.exe
WHISPER_MODEL_PATH=C:\Users\HP\Ollama\models\ggml-medium.en.bin
```

##### Step 5: Test

```bash
cd C:\Users\HP\Ollama\server
node index.js
```

Open browser, record audio, and click Stop. Check for transcription.

#### Whisper.cpp Parameters

The backend calls whisper.cpp with these flags:

| Flag | Value | Purpose |
|------|-------|---------|
| `-m` | {modelPath} | Path to GGML model file |
| `-f` | {audioPath} | Input audio file path |
| `-otxt` | - | Output format: text file |
| `--task` | transcribe | Operation mode |
| `--language` | en | Language for transcription |

#### Audio Format Support

**Supported Formats:**
- WAV (preferred, no conversion needed)
- WebM (auto-converted to WAV)
- OGG (auto-converted to WAV)
- MP3 (auto-converted to WAV if ffmpeg available)
- Other formats (if FFmpeg can convert)

**Conversion Process:**
1. Frontend records as WebM (browser default)
2. Backend detects `.webm` extension
3. If FFmpeg available, converts to WAV:
   - Sample rate: 16kHz
   - Channels: Mono (1)
   - Bit depth: 16-bit
4. Whisper.cpp processes WAV file
5. Both source and converted files deleted after processing

#### Performance Considerations

- **Model Size**: base.en.bin is ~600MB
- **Processing Time**: Depends on audio length and CPU
  - 10-second audio: ~10-30 seconds on modern CPU
  - Faster on GPU if whisper.cpp compiled with CUDA/Metal
- **Memory**: ~1-2GB RAM during processing

#### Whisper Models Available

| Model | Size | Languages | Speed | Quality |
|-------|------|-----------|-------|---------|
| tiny.en | 75MB | English | Fastest | Lowest |
| base.en | 600MB | English | Fast | Good |
| small.en | 1.7GB | English | Medium | Better |
| medium.en | 3.1GB | English | Slow | Best |
| large | 2.9GB | 98 languages | Very Slow | Best |

Switch models by:
1. Downloading to `models/` folder
2. Updating `WHISPER_MODEL_PATH` in `.env`

### Text-to-Speech (TTS)

#### Architecture

```
AI Response Text
       ↓
   Frontend
    speakText()
       ↓
Create SpeechSynthesisUtterance
   Set parameters:
   - Rate: 0.9
   - Pitch: 1
   - Volume: 0.8
       ↓
  Browser Web Speech API
 (Usually OS-provided voice)
       ↓
   Audio Synthesis
 (Typically fast/real-time)
       ↓
   Speaker Output
   (System speakers)
```

#### Browser Compatibility

| Browser | Support | Voice Selection |
|---------|---------|-----------------|
| Chrome | ✅ Full | Multiple voices |
| Edge | ✅ Full | Multiple voices |
| Firefox | ✅ Full | Multiple voices |
| Safari | ✅ Full | Multiple voices |
| Mobile browsers | ✅ Limited | System voice |

#### Customization

Edit `client/src/App.jsx` in `speakText()`:

```javascript
const utterance = new SpeechSynthesisUtterance(text);
utterance.rate = 0.9;      // 0.1-10 (1 = normal speed)
utterance.pitch = 1;       // 0-2 (1 = normal pitch)
utterance.volume = 0.8;    // 0-1 (1 = loudest)
utterance.voice = null;    // Optional: select specific voice
```

#### Available Voices

List available voices in browser console:
```javascript
window.speechSynthesis.getVoices().forEach(voice => {
  console.log(voice.name, voice.lang);
});
```

Then assign voice in code:
```javascript
const voices = window.speechSynthesis.getVoices();
utterance.voice = voices.find(v => v.name === 'Google UK English Male');
```

---

## Data Persistence

### Local Storage

#### What's Stored

Chat history is stored in browser's localStorage:

```javascript
Key: 'ollama-chat-history'
Value: JSON string of messages array

Example:
[
  {
    "role": "user",
    "content": "Hello"
  },
  {
    "role": "assistant",
    "content": "Hello! How can I help you?"
  }
]
```

#### When Data is Saved

- **Automatic save**: Every time `messages` state changes
- **On startup**: Chat history is loaded and restored
- **Manual clear**: When user clicks "Clear History" button

#### Viewing Stored Data

Open browser DevTools (F12):
1. Go to "Application" or "Storage" tab
2. Click "Local Storage"
3. Find your domain (localhost:3001)
4. Look for key: `ollama-chat-history`
5. Value shows your full chat history

#### Storage Limits

- **Size limit**: ~5-10MB per domain (browser dependent)
- **Message estimate**: Each message ~200 bytes on average
- **Typical capacity**: 25,000-50,000 messages per domain

#### Clearing Data

**Via UI:**
- Click "Clear History" button in header (if messages exist)

**Via DevTools:**
1. Open DevTools (F12)
2. Go to "Application" → "Local Storage"
3. Right-click and select "Delete"

**Programmatically:**
```javascript
localStorage.removeItem('ollama-chat-history');
```

#### Privacy Implications

⚠️ **Important**: All chat history is stored **locally in the browser**
- Not sent to any server
- Persists across browser sessions
- Visible to other apps/users on the same machine
- Survives browser restart

---

## Error Handling

### Frontend Error Handling

#### Error Boundary Component

```javascript
class ErrorBoundary extends Component {
  // Catches React component errors
  // Displays error details
  // Provides refresh button
}
```

**When It Triggers:**
- Any error during React render
- Lifecycle method errors
- Constructor errors

**User Sees:**
```
Something went wrong
The chat application encountered an error. 
Please refresh the page.

[Refresh Page button]

[Error Details (for debugging)]
```

#### API Error Handling

All API calls wrapped in try-catch:

**Chat Errors:**
```javascript
try {
  const response = await fetch('/api/chat', {...});
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to get a response');
  }
  // Process response
} catch (err) {
  setError(err.message || 'Unable to reach the backend');
}
```

**Transcription Errors:**
```javascript
try {
  const response = await fetch('/api/transcribe', {...});
  if (!response.ok) {
    const errorData = await response.json();
    const details = errorData.details ? ` ${errorData.details}` : '';
    throw new Error(`${errorData.error}${details}`);
  }
  // Process transcription
} catch (err) {
  setError(err.message || 'Offline transcription failed.');
}
```

#### Microphone Permission Errors

```javascript
try {
  const stream = await navigator.mediaDevices.getUserMedia({audio: true});
  // Use stream
} catch (err) {
  console.error('Failed to start recording:', err);
  setError('Unable to access the microphone. Check permissions and try again.');
}
```

### Backend Error Handling

#### Error Response Format

All errors return consistent JSON:

```json
{
  "error": "Human-readable error message",
  "details": "Optional technical details for debugging"
}
```

#### HTTP Status Codes

| Code | Meaning | Trigger |
|------|---------|---------|
| 200 | Success | Request successful |
| 400 | Bad Request | Missing file or fields |
| 500 | Server Error | Processing failed |
| 503 | Service Unavailable | Ollama not running |

#### Specific Error Scenarios

**1. Chat - Ollama Not Running**
```
Status: 503
Error: "Ollama server is not running or not accessible"
Details: "Please ensure Ollama is running on localhost:11434"
```

**2. Chat - Missing Fields**
```
Status: 400
Error: "Missing required fields: model and messages"
```

**3. Transcription - No File**
```
Status: 400
Error: "No audio file uploaded."
```

**4. Transcription - whisper.cpp Not Found**
```
Status: 500
Error: "Whisper.cpp binary not found."
Details: "Set WHISPER_CPP_PATH to your local whisper.cpp executable..."
```

**5. Transcription - Model Not Found**
```
Status: 500
Error: "Whisper model file not found."
Details: "Set WHISPER_MODEL_PATH to a valid ggml model file..."
```

**6. Transcription - Processing Failed**
```
Status: 500
Error: "Offline transcription failed."
Details: "whisper.cpp exited with code 1: <stderr output>"
```

### Logging

#### Frontend Logging

```javascript
// Console errors logged by:
console.error('React Error Boundary caught an error:', error);
console.error('Failed to start recording:', err);
console.warn('Failed to load chat history:', err);
```

Check browser DevTools Console (F12) for errors.

#### Backend Logging

Server logs to console:

```
Starting server...
✅ Server running on http://localhost:3001
🔗 Proxying Ollama at: http://localhost:11434

🔄 Received chat request: {...}
📤 Forwarding to Ollama: {...}

Offline transcription failed: <error message>
Error proxying to Ollama: <error message>
```

---

## Development Guide

### Prerequisites for Development

- Node.js v18+
- Visual Studio Code (or any editor)
- Git
- Ollama (for testing)
- whisper.cpp setup (for voice features)

### Project Setup for Development

#### 1. Clone and Install

```bash
git clone <repo-url>
cd ollama

# Backend
cd server
npm install

# Frontend
cd ../client
npm install
cd ..
```

#### 2. Build Frontend (One-time)

```bash
cd client
npm run build
cd ..
```

#### 3. Start Backend in Development

```bash
cd server
npm run dev    # Uses nodemon for auto-restart
```

Or if you want to restart manually:
```bash
npm start
```

#### 4. (Optional) Frontend Dev Server

For active frontend development, run Vite dev server in another terminal:

```bash
cd client
npm run dev    # Runs on http://localhost:5173
```

Note: Still need backend running for API calls. Proxy requests in Vite config if needed.

### File Structure for Development

```
ollama/
├── server/
│   ├── index.js          # Main file - edit here for backend features
│   ├── .env              # Configuration - edit for settings
│   ├── uploads/          # Temp files (git-ignored)
│   ├── package.json      # Dependencies
│   └── node_modules/     # Installed packages
│
├── client/
│   ├── src/
│   │   ├── App.jsx       # Main file - edit here for frontend features
│   │   ├── styles.css    # Styling - edit for UI changes
│   │   ├── main.jsx      # Entry point
│   │   └── index.html    # HTML template
│   ├── dist/             # Built frontend (auto-generated)
│   ├── package.json
│   └── node_modules/
│
└── .git/                 # Version control
```

### Common Development Tasks

#### Adding a New Backend Endpoint

1. Add endpoint in `server/index.js`:

```javascript
app.post('/api/new-feature', async (req, res) => {
  try {
    const { param1, param2 } = req.body;
    // Your logic here
    res.json({ result: 'success' });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});
```

2. Restart backend: `npm run dev` (auto with nodemon)
3. Test with curl or frontend

#### Updating Frontend UI

1. Edit `client/src/App.jsx` for logic or JSX
2. Edit `client/src/styles.css` for styling
3. Rebuild: `cd client && npm run build`
4. Restart backend to serve new build

#### Changing Chat Model

In `client/src/App.jsx`, line ~82:

```javascript
body: JSON.stringify({
  model: 'llama2:latest',  // Change here
  messages: chatHistory,
  stream: false,
})
```

Ensure model is installed in Ollama:
```bash
ollama pull llama2
```

#### Adding Environment Variables

1. Add to `server/.env`:
```env
NEW_VAR=value
```

2. Access in `server/index.js`:
```javascript
const newVar = process.env.NEW_VAR;
```

3. Restart backend for changes to take effect

#### Debugging

**Frontend:**
- Open DevTools (F12)
- Check "Console" tab for errors
- Use "Network" tab to inspect API calls
- Use "Application" tab to view localStorage

**Backend:**
- Check console output while running
- Add `console.log()` statements
- Check response in Network tab

### Code Style

#### Backend (Express/Node)

- Use async/await for asynchronous operations
- Wrap operations in try-catch
- Return consistent JSON responses
- Log important operations
- Use descriptive variable names

#### Frontend (React)

- Use functional components with hooks
- Keep state close to where it's used
- Use useEffect for side effects
- Keep functions small and focused
- Add comments for complex logic

### Git Workflow

```bash
# Check status
git status

# Add changes
git add .

# Commit
git commit -m "Description of changes"

# Push
git push origin main

# Pull latest
git pull origin main
```

### Testing

Currently no automated tests. Manual testing:

1. **Chat**: Send messages and verify responses
2. **Voice**: Record audio and check transcription
3. **TTS**: Verify AI responses are spoken
4. **History**: Reload page and check history persists
5. **Errors**: Disconnect Ollama and check error handling

---

## Troubleshooting

### Common Issues and Solutions

#### ❌ "Cannot find module 'express'"

**Cause:** Dependencies not installed

**Solution:**
```bash
cd server
npm install
```

---

#### ❌ "Port 3001 is already in use"

**Cause:** Another process using the port

**Solution 1:** Kill the process
```bash
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

**Solution 2:** Change port in `.env`
```env
PORT=3002
```

---

#### ❌ "Ollama server is not running"

**Cause:** Ollama not started or not on expected URL

**Solution:**
1. Start Ollama: `ollama serve`
2. Check URL in `.env`: should be `http://localhost:11434`
3. Test: `curl http://localhost:11434/api/tags`

---

#### ❌ "Whisper.cpp binary not found"

**Cause:** whisper.cpp not installed or path incorrect

**Solution:** See [Voice & Audio Features - Setup](#setup-instructions)

In short:
1. Download binary from GitHub releases
2. Place in: `C:\Users\HP\Ollama\whisper.cpp\main.exe`
3. Set in `.env`: `WHISPER_CPP_PATH=...`

---

#### ❌ "Whisper model file not found"

**Cause:** ggml model not downloaded or path incorrect

**Solution:**
1. Create: `C:\Users\HP\Ollama\models\`
2. Download: `ggml-base.en.bin` (~600MB)
3. Set in `.env`: `WHISPER_MODEL_PATH=...`

---

#### ❌ "Unable to access the microphone"

**Cause:** Permission denied or not supported

**Solution:**
1. Check browser permissions:
   - Chrome: Settings → Privacy → Microphone → Allow
2. Use supported browser (Chrome, Edge, Firefox)
3. Ensure you use HTTPS or localhost
4. Check `recordingSupported` in console

---

#### ❌ "Offline transcription failed" with no details

**Cause:** Backend error with unclear cause

**Solution:**
1. Check backend console for error details
2. Verify audio file uploaded (check `server/uploads/`)
3. Test whisper.cpp manually:
   ```bash
   cd C:\Users\HP\Ollama\whisper.cpp
   .\main.exe -m ..\models\ggml-base.en.bin -f test.wav
   ```

---

#### ❌ "No transcription was returned"

**Cause:** whisper.cpp didn't produce output

**Solution:**
1. Ensure audio file is valid (not corrupted)
2. Try different audio (clearer speech)
3. Check model file exists and is valid
4. Increase audio length (whisper needs enough content)

---

#### ❌ "Browser says 'Recording not supported'"

**Cause:** MediaRecorder API not available

**Solution:**
- Use a modern browser (Chrome, Edge, Firefox)
- Update your browser to latest version
- Check console for more details

---

#### ❌ Chat loading forever (no response)

**Cause:** Ollama taking too long or stuck

**Solution:**
1. Check Ollama is responding:
   ```bash
   curl http://localhost:11434/api/tags
   ```
2. Try with smaller model:
   ```bash
   ollama pull tinyllama
   ```
3. Check CPU/RAM usage - model might be too large

---

#### ❌ "Cannot POST /api/chat" or 404 error

**Cause:** Backend not running or wrong URL

**Solution:**
1. Verify backend is running: Check console output
2. Check port number matches `.env`
3. Check URL in browser: `http://localhost:3001`
4. Restart backend

---

#### ❌ Chat history not persisting

**Cause:** localStorage disabled or full

**Solution:**
1. Check localStorage is enabled in browser
2. Clear old data: `localStorage.clear()` in console
3. Check available space - try with fewer messages

---

#### ❌ Audio quality is poor / Speech not recognized

**Cause:** Audio recording issues

**Solution:**
1. Speak clearly and slowly
2. Reduce background noise
3. Check microphone input levels
4. Try shorter messages
5. Use larger model: `ggml-small.en.bin` instead of base

---

### Getting Help

1. **Check console errors:**
   - Browser: F12 → Console
   - Terminal: Watch backend output

2. **Check server logs:**
   - Look at terminal running `npm run dev`
   - Look for error messages with error codes

3. **Test components individually:**
   - Test chat without voice
   - Test voice without chat
   - Test Ollama manually

4. **Check file permissions:**
   - Ensure write access to `server/uploads/`
   - Ensure read access to model files

5. **Verify all prerequisites:**
   - Ollama running: `curl localhost:11434`
   - Node.js installed: `node --version`
   - Dependencies installed: `npm list`

---

## Glossary

### Technical Terms

| Term | Definition | Used In |
|------|-----------|---------|
| **Ollama** | Local LLM inference engine | Backend, API |
| **whisper.cpp** | Speech-to-text inference | Backend |
| **GGML** | Quantized ML model format | Models |
| **MediaRecorder** | Browser API for audio recording | Frontend |
| **WebM** | Audio/video container format | Frontend |
| **WAV** | Uncompressed audio format | Backend |
| **FFmpeg** | Audio/video conversion tool | Backend |
| **SPA** | Single-Page Application | Frontend Architecture |
| **CORS** | Cross-Origin Resource Sharing | Backend |
| **TTS** | Text-To-Speech synthesis | Frontend |
| **STT** | Speech-To-Text transcription | Backend |
| **Streaming** | Real-time data transfer | Chat API |
| **Quantized** | Reduced-size neural network | Models |

---

## Conclusion

This documentation covers every major aspect of the Nira AI application. Whether you're setting up for the first time, developing new features, or troubleshooting issues, refer to the relevant sections above.

**Key Takeaways:**
- ✅ Complete offline AI chat (no cloud dependency)
- ✅ Local LLM inference via Ollama
- ✅ Local voice transcription via whisper.cpp
- ✅ Text-to-speech synthesis via Web Speech API
- ✅ Persistent chat history in browser
- ✅ Full error handling and user feedback
- ✅ Modular, extensible architecture

**Next Steps:**
1. Follow the [Installation](#installation--setup) guide
2. Setup [Voice Features](#voice--audio-features)
3. Configure [Environment Variables](#configuration)
4. Start using the application!

For questions or issues, refer to the [Troubleshooting](#troubleshooting) section.

---

**Version:** 1.0.0  
**Last Updated:** May 2026  
**Status:** Production Ready
