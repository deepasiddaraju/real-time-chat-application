import React, { useState, useEffect } from "react";
import ChatBox from "./ChatBox";
import "./App.css";

function App() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [room, setRoom] = useState("");
  const [rooms, setRooms] = useState([]);
  const [joined, setJoined] = useState(false);
  const [newRoom, setNewRoom] = useState("");
  const [mode, setMode] = useState("login");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUsername = localStorage.getItem("username");
    const savedRoom = localStorage.getItem("room");
    if (savedUsername) setUsername(savedUsername);
    if (savedRoom) setRoom(savedRoom);

    if (token) {
      fetch("http://localhost:5000/me", {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            localStorage.removeItem("token");
            setJoined(false);
          } else {
            setUserId(data.id);
            setUsername(data.username);
            setAvatarUrl(data.avatar_url);
            setJoined(true);
          }
        })
        .catch(() => {
          localStorage.removeItem("token");
          setJoined(false);
        });
    }

    fetch("http://localhost:5000/rooms")
      .then(res => res.json())
      .then(data => {
        setRooms(data);
        if (data.length > 0 && !room) setRoom(data[0].name);
      });
  }, [room]); // ✅ include room in dependencies

  const handleAuth = () => {
    const endpoint = mode === "login" ? "/login" : "/register";
    const payload =
      mode === "login"
        ? { username, password }
        : { username, email, password };

    fetch(`http://localhost:5000${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error);
        } else {
          if (data.token) localStorage.setItem("token", data.token);
          localStorage.setItem("username", data.username);
          localStorage.setItem("room", room);
          setUserId(data.id);
          setUsername(data.username);
          setAvatarUrl(data.avatar_url);
          setJoined(true);
        }
      });
  };

  const createRoom = () => {
    if (newRoom.trim() !== "") {
      fetch("http://localhost:5000/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoom }),
      })
        .then(res => res.json())
        .then(data => {
          setRooms(prev => [...prev, data]);
          setRoom(data.name);
          localStorage.setItem("room", data.name);
          setNewRoom("");
        });
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("room");
    setJoined(false);
    setUserId(null);
    setUsername("");
    setAvatarUrl("");
  };

  return (
    <div className="app-container">
      {!joined ? (
        <div className="auth-box">
          <h2>{mode === "login" ? "Login" : "Register"}</h2>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {mode === "register" && (
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="button-row">
            <button onClick={handleAuth}>
              {mode === "login" ? "Login" : "Register"}
            </button>
            <button onClick={() => setMode(mode === "login" ? "register" : "login")}>
              Switch to {mode === "login" ? "Register" : "Login"}
            </button>
          </div>
          <hr />
          <label>Select Room:</label>
          <select
            value={room}
            onChange={(e) => {
              setRoom(e.target.value);
              localStorage.setItem("room", e.target.value);
            }}
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.name}>{r.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="New room name"
            value={newRoom}
            onChange={(e) => setNewRoom(e.target.value)}
          />
          <button onClick={createRoom}>Create Room</button>
        </div>
      ) : (
        <div>
          <button onClick={logout} className="logout-btn">Logout</button>
          <ChatBox
            username={username}
            userId={userId}
            avatarUrl={avatarUrl}
            room={room}
            rooms={rooms}
          />
        </div>
      )}
    </div>
  );
}

export default App;
