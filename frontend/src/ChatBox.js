import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("http://localhost:5000");

function ChatBox({ username, userId, avatarUrl, room, rooms }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [users, setUsers] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [dmTarget, setDmTarget] = useState(null);
  const [roomStats, setRoomStats] = useState([]);

  const roomObj = rooms.find((r) => r.name === room);
  const room_id = roomObj ? roomObj.id : null;

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!room_id || !userId) return;

    socket.emit("join", { room, username, user_id: userId });

    socket.on("message", (data) => {
      if ((data.room_id === room_id) || (data.recipient_id === userId)) {
        setMessages((prev) => [...prev, data]);
      }
    });

    socket.on("user_list", (list) => setUsers(list));
    socket.on("room_stats", (stats) => setRoomStats(stats));

    // ✅ Typing events
    socket.on("typing", (data) => {
      setTypingUser(data.username);
    });

    socket.on("stop_typing", () => {
      setTypingUser("");
    });

    fetch(`http://localhost:5000/messages/${room_id}`)
      .then((res) => res.json())
      .then((data) => setMessages(data));

    return () => {
      socket.emit("leave", { room, user_id: userId });
      socket.off("message");
      socket.off("user_list");
      socket.off("room_stats");
      socket.off("typing");
      socket.off("stop_typing");
    };
  }, [room, username, room_id, userId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (room_id) {
      if (e.target.value.length > 0) {
        socket.emit("typing", { room, username });
      } else {
        socket.emit("stop_typing", { room });
      }
    }
  };

  const sendMessage = () => {
    if (input.trim() !== "" && room_id) {
      socket.emit("message", {
        room,
        room_id,
        user_id: userId,
        username,
        avatar_url: avatarUrl || "/default-avatar.png",
        recipient_id: dmTarget ? dmTarget.id : null,
        message: input,
      });
      setInput("");
      socket.emit("stop_typing", { room });
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-area">
        <h2>Room: {room}</h2>
        <div className="messages-box">
          {messages.map((msg, i) => (
            <div key={i} className="message-row">
              <img
                src={msg.avatar_url || "/default-avatar.png"}
                alt="avatar"
                className="avatar"
              />
              <div>
                <strong>{msg.username}:</strong> {msg.message}
                <div className="timestamp">
                  {msg.created_at ? new Date(msg.created_at).toLocaleString() : ""} • {msg.status}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        {typingUser && (
          <div className="typing-indicator">{typingUser} is typing...</div>
        )}
        <div className="input-row">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="message-input"
          />
          <button onClick={sendMessage} className="send-btn">Send</button>
        </div>
      </div>

      <div className="sidebar">
        <h3>
          Active Users <span className="badge">{users.length}</span>
        </h3>
        <ul>
          {users.map((u) => (
            <li
              key={u.id}
              onClick={() => setDmTarget(u)}
              className={dmTarget?.id === u.id ? "active-user" : ""}
            >
              <img
                src={u.avatar_url || "/default-avatar.png"}
                alt="avatar"
                className="avatar-small"
              />
              {u.username}
            </li>
          ))}
        </ul>
        {dmTarget && (
          <div className="dm-target">DM to: {dmTarget.username}</div>
        )}

        <h3>Rooms</h3>
        <ul>
          {roomStats.map((r) => (
            <li key={r.room}>
              {r.room} <span className="badge">{r.count}</span>
              <div className="volume-bar">
                <div
                  className="volume-fill"
                  style={{ width: `${Math.min(r.messages * 10, 100)}%` }}
                ></div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ChatBox;
