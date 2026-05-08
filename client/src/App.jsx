import { useState, useEffect, useRef } from 'react';

function App() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechSynthRef = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setMessage(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setError('Voice recognition failed. Please try again.');
      };
    }

    // Initialize speech synthesis
    if ('speechSynthesis' in window) {
      speechSynthRef.current = window.speechSynthesis;
    }

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
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setError('');
      recognitionRef.current.start();
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
          <button type="button" 
                  onClick={isListening ? stopListening : startListening}
                  className={`voice-button ${isListening ? 'listening' : ''}`}
                  disabled={loading}
                  title={isListening ? 'Stop listening' : 'Start voice input'}>
            {isListening ? '⏹️' : '🎤'}
          </button>
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
