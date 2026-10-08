import { useEffect, useState, useRef } from 'react';
import { Client } from "@stomp/stompjs";
import "./app.css"
import Login from "./login.jsx"

const API = "http://localhost:8080";

function App() {

  const [currentUser, setCurrentUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [authChecked, setauthChecked] = useState(false);
  const [loginError, setLoginError] = useState("");
  const stompClientRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null))
      .finally(() => setauthChecked(true));
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    fetch(`${API}/messages`, { credentials: "include" })
      .then((response) => {
        if (response.status === 403) {
          setCurrentUser(null);
          setLoginError("Your session ended. Please sign in again.");
          throw new Error("Session ended");
        }
        return response.json()
      })
      .then(setMessages)
      .catch(() => { });

  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const client = new Client({
      brokerURL: "ws://localhost:8080/ws",

      onConnect: () => {
        console.log("STOMP connected");

        client.subscribe("/topic/messages", (message) => {
          const newMessage = JSON.parse(message.body);

          setMessages((previousMessages) => [
            ...previousMessages,
            newMessage,
          ]);
        });
      },

      onDisconnect: () => {
        console.log("STOMP disconnected");
      },

      onStompError: (frame) => {
        console.error("STOMP error:", frame);
      },
    });

    client.activate();

    stompClientRef.current = client;

    return () => {
      client.deactivate();
      stompClientRef.current = null;
    };
  }, [currentUser]);

  const handleLogin = async (username, password) => {
    setLoginError("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.status === 401) return setLoginError("Invalid username or password");
      if (!res.ok) return setLoginError("Something went wrong. Try again.");

      const me = await fetch(`${API}/auth/me`, { credentials: "include" });
      setCurrentUser(await me.json());
    } catch {
      setLoginError("Cannot reach the server");
    }
  };

  const handleLogout = async () => {
    await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    setCurrentUser(null);
    setMessages([]);
  };

  const sendMessage = async () => {
    if (!messageText.trim()) return;

    const res = await fetch(`${API}/auth/me`, { credentials: "include" }).catch(() => null);

    if (!res || !res.ok) {
      setLoginError("Your session ended. Please sign in again.");
      setCurrentUser(null);
      setMessages([]);
      return;
    }

    const client = stompClientRef.current;
    if (!client || !client.connected) {
      console.log("STOMP not connected");
      return;
    }

    client.publish({
      destination: "/app/chat",
      body: JSON.stringify({
        senderId: currentUser.id,
        content: messageText,
      }),
    });

    setMessageText("");
  };


  if (!authChecked) return null;

  if (!currentUser) {
    return <Login onLogin={handleLogin} error={loginError} />;
  }

  return (

    <div className="chat-container">

      <div className="chat-header">
        <h1>Welcome, {currentUser.username}</h1>

        <button
          className="switch-button"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>

      <div className="messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.senderId === currentUser.id
              ? "message-you"
              : "message-other"
              }`}
          >
            <strong>
              {message.senderId === currentUser.id
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

        <button onClick={sendMessage} onKeyDown={(e) => e.key === "Enter" && sendMessage()}>
          Send
        </button>
      </div>

    </div>

  );
}

export default App;