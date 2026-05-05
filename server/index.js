const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend server is running' });
});

// Chat endpoint - proxy to Ollama
app.post('/api/chat', async (req, res) => {
  try {
    const { model, messages, stream = true } = req.body;

    if (!model || !messages) {
      return res.status(400).json({
        error: 'Missing required fields: model and messages'
      });
    }

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

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Proxying Ollama at: ${OLLAMA_URL}`);
});