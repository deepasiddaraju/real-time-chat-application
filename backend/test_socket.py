# test_socket.py
import socketio

# Connect to your backend
sio = socketio.Client()

@sio.event
def connect():
    print("Connected to server")
    # Join room
    sio.emit("join", {"room": "General", "username": "testuser"})
    # Send a message
    sio.emit("message", {
        "room": "General",
        "room_id": 1,
        "user_id": 1,   # assuming testuser has ID 1
        "username": "testuser",
        "message": "Hello from Python client!"
    })

@sio.event
def disconnect():
    print("Disconnected from server")

@sio.on("message")
def on_message(data):
    print("Received message:", data)

# Run client
sio.connect("http://localhost:5000")
sio.wait()
