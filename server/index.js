const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs').promises;
const { spawn } = require('child_process');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdir(uploadDir, { recursive: true }).catch((err) => {
  console.error('Failed to create upload directory:', err);
});
const upload = multer({ dest: uploadDir });

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveWhisperModel() {
  const candidates = [];
  if (process.env.WHISPER_MODEL_PATH) {
    candidates.push(process.env.WHISPER_MODEL_PATH);
  }
  candidates.push(path.join(__dirname, '..', 'models', 'ggml-medium.en.bin'));
  candidates.push(path.join(__dirname, '..', 'models', 'ggml-base.en.bin'));

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return process.env.WHISPER_MODEL_PATH || path.join(__dirname, '..', 'models', 'ggml-medium.en.bin');
}

function findBinaryInPath(name) {
  try {
    const result = require('child_process').spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout) {
      const found = result.stdout.split(/\r?\n/).find(Boolean);
      return found?.trim();
    }
  } catch (err) {
    // ignore
  }
  return null;
}

async function resolveWhisperBinary() {
  if (process.env.WHISPER_CPP_PATH) {
    const candidate = process.env.WHISPER_CPP_PATH;
    if (await pathExists(candidate)) return candidate;
  }

  const localBinary = path.join(__dirname, '..', 'whisper.cpp', process.platform === 'win32' ? 'main.exe' : 'main');
  if (await pathExists(localBinary)) return localBinary;

  const pathName = process.platform === 'win32' ? 'main.exe' : 'main';
  const found = findBinaryInPath(pathName);
  if (found && await pathExists(found)) return found;

  return null;
}

async function resolveFfmpegBinary() {
  if (process.env.FFMPEG_PATH) {
    const candidate = process.env.FFMPEG_PATH;
    if (await pathExists(candidate)) return candidate;
  }

  const found = findBinaryInPath('ffmpeg');
  if (found && await pathExists(found)) return found;

  return null;
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve static React frontend
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend server is running' });
});

// Offline transcription endpoint using whisper.cpp
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded.' });
  }

  const audioPath = req.file.path;
  const modelPath = await resolveWhisperModel();
  const whisperPath = await resolveWhisperBinary();
  const ffmpegPath = await resolveFfmpegBinary();
  const transcriptPath = `${audioPath}.txt`;

  if (!whisperPath) {
    await fs.unlink(audioPath).catch(() => {});
    return res.status(500).json({
      error: 'Whisper.cpp binary not found.',
      details: 'Set WHISPER_CPP_PATH to your local whisper.cpp executable or install whisper.cpp in the workspace.'
    });
  }

  if (!modelPath || !(await pathExists(modelPath))) {
    await fs.unlink(audioPath).catch(() => {});
    return res.status(500).json({
      error: 'Whisper model file not found.',
      details: 'Set WHISPER_MODEL_PATH to a valid ggml model file, for example ggml-medium.en.bin or ggml-base.en.bin.'
    });
  }

  let finalAudioPath = audioPath;
  let cleanupConverted = null;

  try {
    const ext = path.extname(audioPath).toLowerCase();
    if ((ext === '.webm' || ext === '.ogg') && ffmpegPath) {
      const convertedPath = `${audioPath}.wav`;
      const ffmpegArgs = ['-y', '-i', audioPath, '-ar', '16000', '-ac', '1', convertedPath];
      const ffmpegProc = spawn(ffmpegPath, ffmpegArgs);
      let ffmpegErr = '';

      ffmpegProc.stderr.on('data', (chunk) => {
        ffmpegErr += chunk.toString();
      });

      await new Promise((resolve, reject) => {
        ffmpegProc.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`ffmpeg exited with code ${code}: ${ffmpegErr}`));
          } else {
            resolve();
          }
        });
        ffmpegProc.on('error', reject);
      });

      finalAudioPath = convertedPath;
      cleanupConverted = convertedPath;
    }

    const args = [
      '-m', modelPath,
      '-f', finalAudioPath,
      '-otxt',
      '--task', 'transcribe',
      '--language', 'en'
    ];

    const proc = spawn(whisperPath, args);
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    await new Promise((resolve, reject) => {
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`whisper.cpp exited with code ${code}: ${stderr}`));
        } else {
          resolve();
        }
      });
      proc.on('error', reject);
    });

    const transcription = await fs.readFile(transcriptPath, 'utf8');
    await fs.unlink(audioPath).catch(() => {});
    if (cleanupConverted) await fs.unlink(cleanupConverted).catch(() => {});
    await fs.unlink(transcriptPath).catch(() => {});

    if (!transcription || !transcription.trim()) {
      return res.status(500).json({ error: 'Whisper did not return any transcription.' });
    }

    res.json({ transcription: transcription.trim() });
  } catch (err) {
    console.error('Offline transcription failed:', err);
    await fs.unlink(audioPath).catch(() => {});
    if (cleanupConverted) await fs.unlink(cleanupConverted).catch(() => {});
    await fs.unlink(transcriptPath).catch(() => {});
    res.status(500).json({ error: 'Offline transcription failed.', details: err.message });
  }
});

// Chat endpoint - proxy to Ollama
app.post('/api/chat', async (req, res) => {
  console.log('🔄 Received chat request:', { body: req.body, headers: req.headers });
  try {
    const { model, messages, stream = true } = req.body;

    if (!model || !messages) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        error: 'Missing required fields: model and messages'
      });
    }

    console.log('📤 Forwarding to Ollama:', { model, messageCount: messages.length, stream });
    // Forward request to Ollama
    const response = await axios.post(`${OLLAMA_URL}/api/chat`, {
      model,
      messages,
      stream
    }, {
      responseType: stream ? 'stream' : 'json',
      timeout: 60000 // 60 second timeout
    });

    if (stream) {
      // Handle streaming response
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      response.data.on('data', (chunk) => {
        res.write(chunk);
      });

      response.data.on('end', () => {
        res.end();
      });

      response.data.on('error', (error) => {
        console.error('Stream error:', error);
        res.end();
      });
    } else {
      // Handle non-streaming response
      res.json(response.data);
    }

  } catch (error) {
    console.error('Error proxying to Ollama:', error.message);

    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Ollama server is not running or not accessible',
        details: 'Please ensure Ollama is running on localhost:11434'
      });
    }

    if (error.response) {
      // Ollama returned an error
      return res.status(error.response.status).json(error.response.data);
    }

    // Generic error
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Serve React app for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Start server
console.log('Starting server...');
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🔗 Proxying Ollama at: ${OLLAMA_URL}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️  Port ${PORT} is busy, trying port ${PORT + 1}...`);
    const newPort = PORT + 1;
    const retryServer = app.listen(newPort, () => {
      console.log(`✅ Server running on http://localhost:${newPort}`);
      console.log(`🔗 Proxying Ollama at: ${OLLAMA_URL}`);
    }).on('error', (retryErr) => {
      console.error('❌ Failed to start server on any port:', retryErr);
      process.exit(1);
    });
  } else {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
});