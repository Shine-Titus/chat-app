import { useEffect, useState, useRef } from 'react';
import { Client } from "@stomp/stompjs";
import "./app.css"
import Login from "./login.jsx"
import Register from "./register.jsx"

const API = "http://localhost:8080";

function App() {

  const [currentUser, setCurrentUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [authChecked, setauthChecked] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [showRegister, setShowRegister] = useState(false);
  const [query, setQuery] = useState("");
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const stompClientRef = useRef(null);
  const selectedUserRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null))
      .finally(() => setauthChecked(true));
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    fetch(`${API}/users/users`, { credentials: "include" })
      .then((response) => {
        if (response.status === 403) {
          setCurrentUser(null);
          setLoginError("Your session ended. Please sign in again.");
          throw new Error("Session ended");
        }
        return response.json()
      })
      .then(setUsers)
      .catch(() => { })

    fetch(`${API}/users/online`, { credentials: "include" })
      .then((response) => {
        if (response.status === 403) {
          setCurrentUser(null);
          setLoginError("Your session ended. Please sign in again.");
          throw new Error("Session ended");
        }
        return response.json()
      })
      .then((list) => setOnlineUsers(new Set(list)))
      .catch(() => { })

  }, [currentUser]);

  useEffect(() => {
    if (!selectedUser) return;

    fetch(`${API}/messages/${selectedUser.id}`, { credentials: "include" })
      .then((response) => {
        if (response.status === 403) {
          setCurrentUser(null);
          setLoginError("Your session ended. Please sign in again.");
          setSelectedUser(null);
          throw new Error("Session ended");
        }
        return response.json()
      })
      .then(setMessages)
      .catch(() => { })
  }, [selectedUser]);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    if (!currentUser) return;

    const client = new Client({
      brokerURL: "ws://localhost:8080/ws",

      onConnect: () => {
        console.log("STOMP connected");

        client.subscribe("/user/queue/messages", (message) => {
          const newMessage = JSON.parse(message.body);
          const open = selectedUserRef.current;

          if (open && (newMessage.senderId === open.id || newMessage.receiverId === open.id)) {
            setMessages((prev) => [...prev, newMessage]);
          }
        });

        client.subscribe("/user/queue/kicked", () => {
          setLoginError("You were signed out because you signed in elsewhere.");
          setCurrentUser(null);
          setSelectedUser(null);
          setUsers([]);
          setMessages([]);
        });

        client.subscribe("/topic/presence", (frame) => {
          const { username, online } = JSON.parse(frame.body);

          setOnlineUsers((prev) => {
            const next = new Set(prev);
            if (online) next.add(username);
            else next.delete(username);
            return next;
          });
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
    setSelectedUser(null);
    setUsers([]);
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
        receiverId: selectedUser.id,
        content: messageText,
      }),
    });

    setMessageText("");
  };

  const goBack = () => {
    setMessages([]);
    setSelectedUser(null);
    setQuery("");
  }

  const filteredChats = users.filter((user) =>
    user.mobile.toLowerCase().includes(query.toLowerCase())
  );

  if (!authChecked) return null;

  if (!currentUser) {
    return showRegister
      ? <Register onBack={() => setShowRegister(false)} />
      : <Login onLogin={handleLogin} error={loginError} onShowRegister={() => setShowRegister(true)} />;
  }

  if (!selectedUser) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <h1>My Chats, {currentUser.username}</h1>
          <button className="switch-button" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <input
          className="mobile-search"
          type="text"
          placeholder="Search by mobile number..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "15px",
            borderRadius: "4px",
            border: "none",
          }}
        />

        <div className="user-list">
          {filteredChats.length === 0 && <p className="user-list-empty">No other users yet.</p>}

          {filteredChats.map((user) => (
            <button key={user.id} className="user-item" onClick={() => setSelectedUser(user)}>
              <span className={`status-dot ${onlineUsers.has(user.username) ? "online" : "offline"}`} />
              <span className="user-name">{user.username}</span>
            </button>
          ))}
        </div>

      </div>
    );
  }

  console.log(onlineUsers);

  return (

    <div className="chat-container">

      <div className="chat-header">
        <div className="header-left">
          <h1>Chat with, {selectedUser.username}</h1>
          <span className={`status-dot ${onlineUsers.has(selectedUser.username) ? "online" : "offline"}`} />
        </div>

        <div className="header-actions">
          <button className="switch-button" onClick={goBack}>Back</button>
          <button className="switch-button" onClick={handleLogout}>Logout</button>
        </div>
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
                : `${selectedUser.username}`}
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
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
        />
        <button onClick={sendMessage} >
          Send
        </button>
      </div>

    </div>

  );
}

export default App;