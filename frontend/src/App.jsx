import { useEffect, useState, useRef } from 'react';
import "./app.css"

function App() {

  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const socketRef = useRef(null);

  useEffect(() => {
    fetch("http://localhost:8000/users")
      .then((response) => response.json())
      .then((data) => {
        setUsers(data);
      });
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    fetch("http://localhost:8000/messages")
      .then((response) => response.json())
      .then((data) => {
        setMessages(data);
      });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const ws = new WebSocket(
      `ws://127.0.0.1:8000/ws/${currentUser.id}`
    );

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      const newMessage = JSON.parse(event.data);

      setMessages((previousMessages) => [
        ...previousMessages,
        {
          ...newMessage,
        },
      ]);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    socketRef.current = ws;

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [currentUser]);

  const sendMessage = () => {
    if (!messageText.trim()) return;

    const ws = socketRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log("WebSocket not connected");
      return;
    }

    console.log("Sending:", messageText);

    ws.send(messageText);

    setMessageText("");
  };


  if (!currentUser) {
    return (
      <div className="user-selection">
        <h1>Choose User</h1>

        {users.map((user) => (
          <button
            key={user.id}
            onClick={() => setCurrentUser(user)}
          >
            {user.username}
          </button>
        ))}
      </div>
    );
  }

  return (

    <div className="chat-container">

      <div className="chat-header">
        <h1>Welcome, {currentUser.username}</h1>

        <button
          className="switch-button"
          onClick={() => setCurrentUser(null)}
        >
          Switch User
        </button>
      </div>

      <div className="messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.sender_id === currentUser.id
              ? "message-you"
              : "message-other"
              }`}
          >
            <strong>
              {message.sender_id === currentUser.id
                ? "You"
                : "Other user"}
            </strong>

            <p>{message.content}</p>
          </div>
        ))}
      </div>

      <div className="message-input">
        <input
          type="text"
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          placeholder="Type a message..."
        />

        <button onClick={sendMessage}>
          Send
        </button>
      </div>

    </div>

  );
}

export default App;
