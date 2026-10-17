import { useEffect, useState, useRef } from 'react';
import { Client } from "@stomp/stompjs";
import "./app.css"
import Login from "./login.jsx"
import Register from "./register.jsx"

const API = "http://localhost:8080";

function App() {

  // auth
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setauthChecked] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showRegister, setShowRegister] = useState(false);

  // navigation
  const [screen, setScreen] = useState("home");

  // data
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [selectedConversation, setSelectedConversation] = useState("");
  const [conversations, setConversations] = useState([]);
  const [members, setMembers] = useState([]);

  // searching 
  const [query, setQuery] = useState("");

  // members in group


  // conversations 


  // forms
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState(new Set()); // selected user ids
  const [groupError, setGroupError] = useState("");
  const [addSelection, setAddSelection] = useState(new Set());
  const [actionError, setActionError] = useState("");

  const stompClientRef = useRef(null);
  const selectedConversationRef = useRef(null);
  const messageEndRef = useRef(null);

  // derived values
  const isActive = selectedConversation ? selectedConversation.isActive !== false : false;
  const isAdmin = members.some((m) => m.id === currentUser?.id && m.role === "ADMIN");

  const resetState = (message = "") => {
    setCurrentUser(null);
    setLoginError(message);
    setScreen("home");
    setUsers([]);
    setConversations([]);
    setSelectedConversation(null);
    setMessages([]);
    setMembers([]);
    setOnlineUsers(new Set());
    setGroupName("");
    setGroupMembers(new Set());
    setGroupError("");
    setAddSelection(new Set());
    setActionError("");
    setMessageText("");
  };

  const sessionEnded = () => resetState("Your session ended. Please sign in again.");

  const titleOf = (c) => (c.type === "DIRECT" ? c.otherUsername : c.name);


  // effects

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // check if user authourized
  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null))
      .finally(() => setauthChecked(true));
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    fetch(`${API}/users/online`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setOnlineUsers(new Set(list)))
      .catch(() => { });
  }, [currentUser]);

  // show users to add
  useEffect(() => {
    if (!currentUser) return;
    if (screen !== "users" && screen !== "newGroup" && screen != "addMembers") return;

    fetch(`${API}/users/users`, { credentials: "include" })
      .then((response) => {
        if (response.status === 403) {
          sessionEnded();
          throw new Error("Session ended");
        }
        return response.json()
      })
      .then(setUsers)
      .catch(() => { })

  }, [screen, currentUser]);

  // show conversations
  useEffect(() => {
    if (!currentUser || screen != "home") return;

    fetch(`${API}/conversations`, { credentials: "include" })
      .then((response) => {
        if (response.status === 403) {
          sessionEnded();
          throw new Error("Session ended");
        }
        return response.json()
      })
      .then(setConversations)
      .catch(() => { })

  }, [screen, currentUser]);

  // fetch history messages
  useEffect(() => {
    if (!selectedConversation) return;

    fetch(`${API}/conversations/${selectedConversation.id}/messages`, { credentials: "include" })
      .then((response) => {
        if (response.status === 403) {
          sessionEnded();
          throw new Error("Session ended");
        }
        return response.json()
      })
      .then(setMessages)
      .catch(() => { })

  }, [selectedConversation?.id]);

  const loadMembers = async (conversationId) => {
    const res = await fetch(`${API}/conversations/${conversationId}/members`, {
      credentials: "include",
    }).catch(() => null);

    if (!res) return;
    if (res.status === 403) return sessionEnded();
    if (res.status === 404) {
      setSelectedConversation(null);
      setScreen("home");
      return;
    }
    if (!res.ok) return;

    const data = await res.json();
    setMembers(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    if (screen !== "members" || !selectedConversation) return;
    setActionError("");
    loadMembers(selectedConversation.id);
  }, [screen]);

  // keep newest message in view
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behaviour: "smooth" })
  }, [messages, screen]);

  // useEffect(() => {
  //   selectedConversationRef.current = selectedConversation;
  // }, [selectedConversation]);

  useEffect(() => {
    if (!currentUser) return;

    const client = new Client({
      brokerURL: "ws://localhost:8080/ws",

      onConnect: () => {
        console.log("STOMP connected");

        client.subscribe("/user/queue/messages", (message) => {
          const newMessage = JSON.parse(message.body);
          const open = selectedConversationRef.current;

          if (open && newMessage.conversationId === open.id) {
            setMessages((prev) => [...prev, newMessage]);
          }
        });

        client.subscribe("/user/queue/kicked", () => {
          setLoginError("You were signed out because you signed in elsewhere.");
          setCurrentUser(null);
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

  // functions / actions

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
    resetState("");
  };

  const openConversation = (conversation) => {
    setMessages([]);
    setSelectedConversation(conversation);
    setScreen("chat")
  }

  const goBack = () => {
    setMessages([]);
    setSelectedConversation(null);
    setMembers([]);
    setScreen("home");
  }

  const createDirectConversation = async (userId) => {

    const res = await fetch(`${API}/conversations/direct`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "userId": userId }),
    });

    if (res.status === 403) { return sessionEnded(); }
    if (!res.ok) return console.error("Could not open chat", res.status);

    openConversation(await res.json());
  }

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConversation || !isActive) return;

    const client = stompClientRef.current;
    if (!client || !client.connected) {
      console.log("STOMP not connected");
      return;
    }

    client.publish({
      destination: "/app/chat",
      body: JSON.stringify({
        conversationId: selectedConversation.id,
        content: messageText,
      }),
    });

    setMessageText("");
  };

  //new group

  const toggleMember = (id) => {
    setGroupMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createGroup = async () => {
    setGroupError("");

    if (!groupName.trim()) return setGroupError("Enter a group name");
    if (groupMembers.size < 1) return setGroupError("Pick at least one member");

    const res = await fetch(`${API}/conversations`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: groupName.trim(),
        participantIds: [...groupMembers],
      }),
    });

    if (res.status === 403) {
      setCurrentUser(null);
      setLoginError("Your session ended. Please sign in again.");
      return;
    }
    if (!res.ok) return setGroupError("Could not create group");

    const group = await res.json();
    setGroupName("");
    setGroupMembers(new Set());
    setSelectedConversation(group);
    setScreen("chat");
  };

  const cancelGroup = () => {
    setGroupName("");
    setGroupMembers(new Set());
    setGroupError("");
    setScreen("home");
  };

  // admin -> add or remove members
  const removeMember = async (userId) => {
    setActionError("");

    const res = await fetch(`${API}/conversations/${selectedConversation.id}/participants`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantUserIds: [userId] })
    });

    if (res.status === 403) return setActionError("Only admins can remove members");
    if (!res.ok) return setActionError("Could not remove member");

    loadMembers(selectedConversation.id);
  };

  const toggleAddSelection = (id) => {
    setAddSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addMembers = async () => {
    setActionError("");
    if (addSelection.size < 1) return setActionError("Pick at least one user");

    const res = await fetch(`${API}/conversations/${selectedConversation.id}/participants`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantUserIds: [...addSelection] }),
    });

    if (res.status === 403) return setActionError("Only admins can add members");
    if (!res.ok) return setActionError("Could not add members");

    setAddSelection(new Set());
    await loadMembers(selectedConversation.id);
    setScreen("members");
  };

  // screens

  if (!authChecked) return null;

  if (!currentUser) {
    return showRegister
      ? <Register onBack={() => setShowRegister(false)} />
      : <Login onLogin={handleLogin} error={loginError} onShowRegister={() => setShowRegister(true)} />;
  }

  // users list after clicking new chat
  if (screen == "users") {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <h1>All Users, {currentUser.username}</h1>
          <button className="switch-button" onClick={() => setScreen("home")}>Back</button>
          <button className="switch-button" onClick={handleLogout}>Logout</button>
        </div>

        {/* <input
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
        /> */}

        <div className="user-list">
          {users.length === 0 && <p className="user-list-empty">No other users yet.</p>}

          {users.map((user) => (
            <button key={user.id} className="user-item" onClick={() => createDirectConversation(user.id)}>
              <span className={`status-dot ${onlineUsers.has(user.username) ? "online" : "offline"}`} />
              <span className="user-name">{user.username}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (screen === "newGroup") {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <h1>New group</h1>
          <button className="switch-button" onClick={cancelGroup}>Back</button>
        </div>

        <div className="group-form">
          {groupError && <p className="login-error">{groupError}</p>}

          <input
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />

          <p className="group-hint">Select members ({groupMembers.size})</p>

          <div className="user-list">
            {users.map((user) => (
              <label key={user.id} className="user-item">
                <input
                  type="checkbox"
                  checked={groupMembers.has(user.id)}
                  onChange={() => toggleMember(user.id)}
                />
                <span className="user-name">{user.username}</span>
              </label>
            ))}
          </div>

          <button className="create-group-button" onClick={createGroup}>
            Create group
          </button>
        </div>
      </div>
    );
  }

  if (screen === "members" && selectedConversation) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <h1>{selectedConversation.name} · members</h1>
          <div className="header-actions">
            {isAdmin && (
              <button className="switch-button" onClick={() => { setActionError(""); setScreen("addMembers"); }}>
                Add
              </button>
            )}
            <button className="switch-button" onClick={() => setScreen("chat")}>Back</button>
          </div>
        </div>

        <div className="group-form">
          {actionError && <p className="login-error">{actionError}</p>}

          <div className="user-list">
            {members.map((member) => (
              <div key={member.id} className="user-item member-row">
                <span className={`status-dot ${onlineUsers.has(member.username) ? "online" : "offline"}`} />
                <span className="user-name">
                  {member.username}
                  {member.id === currentUser.id ? " (you)" : ""}
                </span>
                {member.role === "ADMIN" && <span className="badge">Admin</span>}
                {isAdmin && member.id !== currentUser.id && (
                  <button className="danger-button" onClick={() => removeMember(member.id)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (screen === "addMembers" && selectedConversation) {
    const candidates = users.filter((u) => !members.some((m) => m.id === u.id));

    return (
      <div className="chat-container">
        <div className="chat-header">
          <h1>Add to {selectedConversation.name}</h1>
          <button className="switch-button" onClick={() => { setAddSelection(new Set()); setScreen("members"); }}>
            Back
          </button>
        </div>

        <div className="group-form">
          {actionError && <p className="login-error">{actionError}</p>}

          <p className="group-hint">Select users ({addSelection.size})</p>

          <div className="user-list">
            {candidates.length === 0 && <p className="user-list-empty">Everyone is already in this group.</p>}

            {candidates.map((user) => (
              <label key={user.id} className="user-item">
                <input
                  type="checkbox"
                  checked={addSelection.has(user.id)}
                  onChange={() => toggleAddSelection(user.id)}
                />
                <span className="user-name">{user.username}</span>
              </label>
            ))}
          </div>

          <button className="create-group-button" onClick={addMembers}>
            Add selected
          </button>
        </div>
      </div>
    );
  }

  if (screen === "chat" && selectedConversation) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <div className="header-left">
            <h1>{titleOf(selectedConversation)}</h1>
            {selectedConversation.type === "DIRECT" && (
              <span
                className={`status-dot ${onlineUsers.has(selectedConversation.otherUsername) ? "online" : "offline"
                  }`}
              />
            )}
          </div>

          <div className="header-actions">
            {selectedConversation.type === "GROUP" && isActive && (
              <button className="switch-button" onClick={() => setScreen("members")}>Members</button>
            )}
            <button className="switch-button" onClick={goBack}>Back</button>
          </div>
        </div>

        <div className="messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.senderId === currentUser.id ? "message-you" : "message-other"}`}
            >
              <strong>{message.senderId === currentUser.id ? "You" : message.senderUsername}</strong>
              <p>{message.content}</p>
            </div>
          ))}
          <div ref={messageEndRef} />
        </div>

        {isActive ? (
          <div className="message-input">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type a message..."
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        ) : (
          <div className="readonly-bar">You were removed from this group</div>
        )}
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>{currentUser.username}</h1>
        <div className="header-actions">
          <button className="switch-button" onClick={() => setScreen("users")}>New chat</button>
          <button className="switch-button" onClick={() => setScreen("newGroup")}>New group</button>
          <button className="switch-button" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="user-list">
        {conversations.length === 0 && <p className="user-list-empty">No conversations yet.</p>}

        {conversations.map((conversation) => (
          <button key={conversation.id} className="user-item" onClick={() => openConversation(conversation)}>
            {conversation.type === "DIRECT" && (
              <span
                className={`status-dot ${onlineUsers.has(conversation.otherUsername) ? "online" : "offline"}`}
              />
            )}
            <span className="user-name">{titleOf(conversation)}</span>
            {conversation.type === "GROUP" && conversation.active === false && (
              <span className="removed-tag">(removed)</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}


export default App;