import { useState } from 'react';

function App() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!message.trim()) return;

    setMessages((current) => [...current, { role: 'user', content: message }]);
    setMessage('');
  };

  return (
    <div className="app-shell">
      <header>
        <h1>Ollama Chat</h1>
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
        </div>

        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
          />
          <button type="submit">Send</button>
        </form>
      </main>
    </div>
  );
}

export default App;
