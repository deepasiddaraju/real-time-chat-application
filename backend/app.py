from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO, join_room, leave_room
from flask_cors import CORS
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+mysqlconnector://root:Sushma%404545Ro2@localhost/chatapp'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = "super-secret-key-change-this"

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")
jwt = JWTManager(app)

# Models
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    avatar_url = db.Column(db.String(255), default="/default-avatar.png")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Room(db.Model):
    __tablename__ = 'rooms'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default="sent")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Routes
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(username=data['username']).first():
        return jsonify({"error": "Username exists"}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"error": "Email exists"}), 400
    hashed_pw = generate_password_hash(data['password'])
    new_user = User(username=data['username'], email=data['email'], password_hash=hashed_pw)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"id": new_user.id, "username": new_user.username, "avatar_url": new_user.avatar_url})

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data['username']).first()
    if user and check_password_hash(user.password_hash, data['password']):
        token = create_access_token(identity=user.id, expires_delta=timedelta(days=1))
        return jsonify({"token": token, "id": user.id, "username": user.username, "avatar_url": user.avatar_url})
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/me', methods=['GET'])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"id": user.id, "username": user.username, "avatar_url": user.avatar_url})

@app.route('/rooms', methods=['GET'])
def get_rooms():
    rooms = Room.query.all()
    return jsonify([{"id": r.id, "name": r.name} for r in rooms])

@app.route('/rooms', methods=['POST'])
def create_room():
    data = request.get_json()
    normalized = data['name'].strip()
    if Room.query.filter(Room.name.ilike(normalized)).first():
        return jsonify({"error": "Room already exists"}), 400
    new_room = Room(name=normalized)
    db.session.add(new_room)
    db.session.commit()
    return jsonify({"id": new_room.id, "name": new_room.name})

@app.route('/messages/<int:room_id>', methods=['GET'])
def get_messages(room_id):
    msgs = Message.query.filter_by(room_id=room_id).all()
    result = []
    for m in msgs:
        user = User.query.get(m.user_id)
        result.append({
            "id": m.id,
            "username": user.username if user else "Unknown",
            "avatar_url": user.avatar_url if user else "/default-avatar.png",
            "message": m.message,
            "status": m.status,
            "created_at": m.created_at.isoformat(),
            "room_id": room_id
        })
    return jsonify(result)

# Active user + message stats
active_users = {}
message_counts = {}

def broadcast_room_stats():
    stats = []
    for room, users in active_users.items():
        stats.append({
            "room": room,
            "count": len(users),
            "messages": message_counts.get(room, 0)
        })
    socketio.emit("room_stats", stats)

@socketio.on("join")
def handle_join(data):
    room = data.get("room")
    user_id = data.get("user_id")
    if not room or not user_id:
        return
    user = User.query.get(user_id)
    join_room(room)

    if room not in active_users:
        active_users[room] = []
    if not any(u["id"] == user.id for u in active_users[room]):
        active_users[room].append({
            "id": user.id,
            "username": user.username,
            "avatar_url": user.avatar_url,
            "sid": request.sid
        })

    socketio.emit("user_list", active_users[room], room=room)
    broadcast_room_stats()

@socketio.on("leave")
def handle_leave(data):
    room = data.get("room")
    user_id = data.get("user_id")
    if not room or not user_id:
        return
    leave_room(room)

    if room in active_users:
        active_users[room] = [u for u in active_users[room] if u["id"] != user_id]
        socketio.emit("user_list", active_users[room], room=room)
    broadcast_room_stats()

@socketio.on("disconnect")
def handle_disconnect():
    for room, users in active_users.items():
        active_users[room] = [u for u in users if u.get("sid") != request.sid]
        socketio.emit("user_list", active_users[room], room=room)
    broadcast_room_stats()

@socketio.on('message')
def handle_message(data):
    room = data.get("room")
    user_id = data.get("user_id")
    username = data.get("username")
    if not room or not user_id or not username:
        return

    new_message = Message(
        room_id=data.get('room_id'),
        user_id=user_id,
        recipient_id=data.get('recipient_id'),
        message=data.get('message'),
        status="sent"
    )
    db.session.add(new_message)
    db.session.commit()

    message_counts[room] = message_counts.get(room, 0) + 1

    socketio.emit('message', {
        'id': new_message.id,
        'username': username,
        'avatar_url': data.get('avatar_url'),
        'message': new_message.message,
        'status': new_message.status,
        'created_at': new_message.created_at.isoformat(),
        'room_id': new_message.room_id,
        'recipient_id': new_message.recipient_id
    }, room=room)

    broadcast_room_stats()
@socketio.on("typing")
def handle_typing(data):
    room = data.get("room")
    username = data.get("username")
    if room and username:
        # Broadcast to everyone else in the room
        socketio.emit("typing", {"username": username}, room=room, include_self=False)

@socketio.on("stop_typing")
def handle_stop_typing(data):
    room = data.get("room")
    if room:
        # Tell everyone else to clear the indicator
        socketio.emit("stop_typing", room=room, include_self=False)


if __name__ == '__main__':
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
