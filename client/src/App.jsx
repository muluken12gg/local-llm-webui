import { useState, useEffect, useRef } from 'react';

function App() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [micPermission, setMicPermission] = useState('unknown'); // 'unknown', 'granted', 'denied'

  // Initialize speech recognition
  useEffect(() => {
    const checkSpeechSupport = async () => {
      // Check if browser supports speech recognition
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn('Speech recognition not supported in this browser');
        setSpeechSupported(false);
        return;
      }

      setSpeechSupported(true);

      // Check microphone permission
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
        setMicPermission(permissionStatus.state);

        permissionStatus.onchange = () => {
          setMicPermission(permissionStatus.state);
        };
      } catch (err) {
        console.warn('Could not check microphone permission:', err);
        // Try to request permission by attempting to use speech recognition
        setMicPermission('unknown');
      }

      // Initialize speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setError(''); // Clear any previous errors
      };

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript && transcript.trim()) {
          setMessage(transcript.trim());
          setError(''); // Clear error on successful transcription
        } else {
          setError('No speech detected. Please speak clearly and try again.');
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error, event);
        setIsListening(false);

        // Provide specific error messages
        let errorMessage = 'Voice recognition failed.';
        switch (event.error) {
          case 'not-allowed':
            errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
            setMicPermission('denied');
            break;
          case 'no-speech':
            errorMessage = 'No speech detected. Please speak clearly and try again.';
            break;
          case 'audio-capture':
            errorMessage = 'No microphone found. Please check your microphone and try again.';
            break;
          case 'network':
            errorMessage = 'Network error occurred. Please check your connection and try again.';
            break;
          case 'service-not-allowed':
            errorMessage = 'Speech recognition service not allowed. Please try again.';
            break;
          default:
            errorMessage = `Voice recognition failed: ${event.error}. Please try again.`;
        }
        setError(errorMessage);
      };
    };

    checkSpeechSupport();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (speechSynthRef.current) {
        speechSynthRef.current.cancel();
      }
    };
  }, []);

  // Load messages from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('ollama-chat-history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (err) {
        console.warn('Failed to load chat history:', err);
      }
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('ollama-chat-history', JSON.stringify(messages));
    }
  }, [messages]);

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem('ollama-chat-history');
  };

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Voice functions
  const startListening = async () => {
    if (!speechSupported) {
      setError('Voice recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (micPermission === 'denied') {
      setError('Microphone access is blocked. Please enable microphone access in your browser settings and refresh the page.');
      return;
    }

    if (recognitionRef.current && !isListening) {
      setError('');
      try {
        // Request microphone permission if not already granted
        if (micPermission === 'unknown' || micPermission === 'prompt') {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          setMicPermission('granted');
        }

        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
        setError('Could not access microphone. Please check your microphone settings and try again.');
        setMicPermission('denied');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const speakText = (text) => {
    if (speechSynthRef.current && text) {
      // Cancel any ongoing speech
      speechSynthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      speechSynthRef.current.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if (speechSynthRef.current) {
      speechSynthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!message.trim()) return;

    const userMessage = message.trim();
    const chatHistory = [
      ...messages,
      { role: 'user', content: userMessage },
    ];

    setMessages((current) => [...current, { role: 'user', content: userMessage }]);
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'codellama:latest',
          messages: chatHistory,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get a response');
      }

      const data = await response.json();
      
      // Ollama response format: { message: { content: "..." }, ... }
      const assistantText = data?.message?.content || data?.response || data?.choices?.[0]?.message?.content || 'No response received.';

      if (!assistantText || assistantText === 'No response received.') {
        console.warn('Unexpected response format:', data);
      }

      setMessages((current) => [
        ...current,
        { role: 'assistant', content: assistantText },
      ]);

      // Auto-speak the response
      speakText(assistantText);
    } catch (err) {
      setError(err.message || 'Unable to reach the backend');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <header>
        <h1>Nira Chat</h1>
        {messages.length > 0 && (
          <button className="clear-button" onClick={clearHistory}>
            Clear History
          </button>
        )}
      </header>

      <main className="chat-window">
        <div className="messages">
          {messages.length === 0 ? (
            <p className="placeholder">Send a message to start the conversation.</p>
          ) : (
            messages.map((entry, index) => (
              <div key={index} className={`message ${entry.role}`}>
                <span className="role">{entry.role}</span>
                <p>{entry.content}</p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && <div className="error-banner">{error}</div>}
        {loading && <div className="status-banner">Waiting for Nira response...</div>}
        {isListening && <div className="status-banner listening">🎤 Listening...</div>}
        {isSpeaking && <div className="status-banner speaking">🔊 Speaking...</div>}

        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
          />
          {speechSupported ? (
            <button type="button" 
                    onClick={isListening ? stopListening : startListening}
                    className={`voice-button ${isListening ? 'listening' : ''} ${micPermission === 'denied' ? 'denied' : ''}`}
                    disabled={loading}
                    title={
                      micPermission === 'denied' 
                        ? 'Microphone access denied' 
                        : isListening 
                          ? 'Stop listening' 
                          : 'Start voice input'
                    }>
              {isListening ? '⏹️' : micPermission === 'denied' ? '🚫' : '🎤'}
            </button>
          ) : (
            <span className="voice-unsupported" title="Voice recognition not supported in this browser">🚫</span>
          )}
          <button type="submit" disabled={loading}>Send</button>
          {isSpeaking && (
            <button type="button" 
                    onClick={stopSpeaking}
                    className="stop-speak-button"
                    title="Stop speaking">
              🔇
            </button>
          )}
        </form>
      </main>
    </div>
  );
}

export default App;
