# ConvoX Server - Backend Architecture & API Guide

> Express.js + Socket.io + MongoDB + Redis | Real-time Chat API

---

## 📚 Quick Navigation

| Topic               | Purpose                             |
| ------------------- | ----------------------------------- |
| **Setup**           | See below                           |
| **Architecture**    | [Architecture](#-architecture)      |
| **API Routes**      | [REST API](#-rest-api)              |
| **Socket Events**   | [WebSocket Events](#-socket-events) |
| **Database Models** | [Data Models](#-database-models)    |

---

## 🚀 Quick Start

```bash
cd chat-app-server

# Install dependencies
npm install

# Create .env file
cat > .env << 'EOF'
MONGODB_URI=mongodb://localhost:27017/convox
REDIS_URL=redis://localhost:6379
JWT_SECRET=change_me_in_production
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3000
EOF

# Start development server
npm start

# Server running on http://localhost:5000
```

---

## 📁 Directory Structure

```
src/
├── models/                              # MongoDB Schemas
│   ├── User.js                          # User account schema
│   ├── Message.js                       # Message document schema
│   ├── Conversation.js                  # Conversation/chat room schema
│   └── ScheduledMessage.js              # Scheduled messages
│
├── controllers/                         # Business Logic
│   ├── auth.controller.js               # Registration, login, OAuth
│   ├── chat.controller.js               # Conversations, messages
│   ├── group.controller.js              # Group management
│   ├── reset.controller.js              # Password reset
│   └── schedule.controller.js           # Message scheduling
│
├── routes/                              # API Endpoints
│   ├── auth.routes.js                   # /api/auth/*
│   ├── chat.routes.js                   # /api/chat/*
│   ├── group.routes.js                  # /api/group/*
│   ├── reset.routes.js                  # /api/reset/*
│   └── schedule.routes.js               # /api/schedule/*
│
├── socket/                              # WebSocket Handlers
│   ├── handler.js                       # Socket connection & auth
│   ├── message.js                       # message:send, :edit, :delete, :react
│   ├── conversation.js                  # conversation:join, :leave, :seen
│   ├── presence.js                      # Online status tracking (Redis)
│   ├── typing.js                        # Typing indicators
│   └── helpers.js                       # Socket utility functions
│
├── middleware/                          # Express Middleware
│   ├── auth.middleware.js               # JWT verification
│   └── group.middleware.js              # Group access control
│
├── config/                              # Configuration
│   ├── database.js (or db.js)           # MongoDB connection
│   ├── redis.js                         # Redis client setup
│   ├── passport.js                      # OAuth strategies
│   └── constants.js                     # App constants
│
├── utility/                             # Helper Functions
│   ├── db.js                            # Database utilities
│   ├── email.js                         # Email sending (nodemailer)
│   ├── scheduler.js                     # Message scheduler worker
│   └── validators.js                    # Input validation
│
├── index.js                             # Server entry point
└── package.json

public/                                  # Static files (if any)
.env                                     # Environment variables
```

---

## 🏗 Architecture Overview

### Request Flow

```
HTTP Request / WebSocket Connection
    ↓
Middleware (auth verification)
    ↓
Route Handler / Socket Handler
    ↓
Controller (business logic)
    ↓
Database Query / External Service
    ↓
Response / Socket Event Broadcast
    ↓
Client receives data
```

### Key Design Patterns

1. **Room Broadcasting** - Socket.io rooms for targeted messaging
2. **Redis Presence** - Track online users with TTL
3. **Optimistic Locking** - Atomic database operations
4. **Event-Driven** - Socket events trigger state changes
5. **JWT Auth** - All socket connections authenticated

---

## 📦 Core Models

### User Model

```javascript
{
  _id: ObjectId,

  // Profile
  name: String,                           // User's display name
  email: String (unique),                 // Email address
  password: String,                       // Bcrypted password
  avatar: String,                         // Avatar URL

  // Status
  status: "online" | "offline" | "away",  // Current status
  lastSeen: Date,                         // Last activity timestamp

  // OAuth (optional)
  googleId: String,
  githubId: String,

  // Preferences
  notificationSettings: {
    email: Boolean,
    push: Boolean,
    soundEnabled: Boolean
  },

  // Meta
  createdAt: Date,
  updatedAt: Date
}
```

### Conversation Model

```javascript
{
  _id: ObjectId,

  // Type & Participants
  type: "dm" | "group",                   // Conversation type
  participants: [ObjectId],               // User IDs in conversation

  // Group-only fields
  name: String,                           // Group name
  avatar: String,                         // Group avatar
  createdBy: ObjectId,                    // Group creator
  admins: [ObjectId],                     // Admin users

  // Message metadata
  lastMessage: {
    text: String,
    sender: ObjectId,
    timestamp: Date
  },

  // Per-user tracking
  unreadCount: Map<String, Number>,       // userId -> count
  pinnedBy: [ObjectId],                   // Who pinned
  archivedBy: [ObjectId],                 // Who archived
  mutedBy: [ObjectId],                    // Who muted

  // Meta
  createdAt: Date,
  updatedAt: Date
}
```

### Message Model

```javascript
{
  _id: ObjectId,

  // Relations
  conversationId: ObjectId,               // Parent conversation
  sender: ObjectId,                       // Message author
  receiverId: ObjectId | null,            // For DM only

  // Content
  text: String,                           // Message text
  gifUrl: String,                         // GIF URL if applicable

  // Threading
  replyTo: ObjectId | null,               // Parent message for replies

  // Reactions
  reactions: Map<String, [ObjectId]>,     // emoji -> [userIds]

  // Editing
  isEdited: Boolean,                      // Was message edited?
  editedAt: Date,                         // Edit timestamp

  // Deletion
  isDeleted: Boolean,                     // Marked as deleted?
  deletedFor: [ObjectId],                 // Who deleted for themselves

  // Status & Delivery
  status: "sent" | "delivered" | "read",
  deliveredAt: Date,
  seenAt: Date,

  // Group delivery tracking (one entry per participant)
  deliveredTo: [{
    user: ObjectId,
    deliveredAt: Date
  }],
  readBy: [{
    user: ObjectId,
    readAt: Date
  }],

  // Meta
  createdAt: Date,
  updatedAt: Date
}
```

### ScheduledMessage Model

```javascript
{
  _id: ObjectId,

  // Content & Target
  conversationId: ObjectId,
  sender: ObjectId,
  text: String,

  // Scheduling
  scheduledTime: Date,                    // When to send
  status: "pending" | "sent" | "failed",

  // Meta
  createdAt: Date,
  sentAt: Date,
  error: String  // If failed
}
```

---

## 🔌 Socket Events

### Connection & Authentication

```javascript
// CLIENT → SERVER
const socket = io(url, {
  auth: { token: "jwt_token_here" },
});

// SERVER
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // Verify JWT, attach user
  socket.userId = decoded.id;
  next();
});
```

### Message Events

| Event                  | Direction | Payload                                           | Purpose              |
| ---------------------- | --------- | ------------------------------------------------- | -------------------- |
| `message:send`         | ↑         | `{conversationId, text, gifUrl, replyTo, tempId}` | Send message         |
| `message:new`          | ↓         | Full message object                               | New message received |
| `message:edit`         | ↑         | `{messageId, newText}`                            | Edit message         |
| `message:edited`       | ↓         | Updated message                                   | Message was edited   |
| `message:delete`       | ↑         | `{messageId, conversationId}`                     | Delete for everyone  |
| `message:deleted`      | ↓         | `{messageId}`                                     | Message deleted      |
| `message:deleteForMe`  | ↑         | `{messageId, conversationId}`                     | Delete for self      |
| `message:deletedForMe` | ↓         | `{messageId}`                                     | Hidden from you      |
| `message:react`        | ↑         | `{messageId, emoji}`                              | Add/toggle reaction  |
| `message:reacted`      | ↓         | `{messageId, reactions}`                          | Reactions updated    |

### Conversation Events

| Event                | Direction | Payload                               | Purpose      |
| -------------------- | --------- | ------------------------------------- | ------------ |
| `conversation:join`  | ↑         | `{conversationId}`                    | Join room    |
| `conversation:leave` | ↑         | `{conversationId}`                    | Leave room   |
| `conversation:seen`  | ↑         | `{conversationId, lastSeenMessageId}` | Mark as read |
| `unread:update`      | ↓         | `{conversationId, unreadCount}`       | Unread count |

### Presence Events

| Event             | Direction | Payload                      | Purpose           |
| ----------------- | --------- | ---------------------------- | ----------------- |
| `presence:ping`   | ↑         | (no payload)                 | Keep alive signal |
| `presence:update` | ↓         | `{userId, online, lastSeen}` | Status changed    |

### Typing Events

| Event          | Direction | Payload                        | Purpose        |
| -------------- | --------- | ------------------------------ | -------------- |
| `typing:start` | ↑         | `{conversationId, receiverId}` | User typing    |
| `typing:stop`  | ↑         | `{conversationId, receiverId}` | Stopped typing |
| `typing:users` | ↓         | `{conversationId, users}`      | Who's typing   |

### Implementation Example

```javascript
// src/socket/message.js
registerMessageHandlers = (socket, { emitToUser, io }) => {
  socket.on("message:send", async ({ conversationId, text, replyTo }) => {
    try {
      // 1. Validate & create message in DB
      const message = new Message({
        conversationId,
        sender: socket.userId,
        text,
        replyTo,
      });
      await message.save();

      // 2. Update conversation's lastMessage
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: { text, sender: socket.userId, timestamp: new Date() },
      });

      // 3. Broadcast to all in room
      io.to(`conv:${conversationId}`).emit("message:new", {
        _id: message._id,
        text: message.text,
        sender: { _id: socket.userId, name: user.name },
        createdAt: message.createdAt,
      });
    } catch (err) {
      socket.emit("message:error", { message: err.message });
    }
  });
};
```

---

## 🌐 REST API Routes

### Authentication

```
POST /api/auth/register
  Body: { name, email, password }
  Response: { user, token }

POST /api/auth/login
  Body: { email, password }
  Response: { user, token }

POST /api/auth/logout
  Response: { success: true }

POST /api/auth/refresh
  Response: { token }

GET /api/auth/google
  Redirects to Google OAuth

GET /api/auth/google/callback
  OAuth callback handler
```

### Chat & Conversations

```
GET /api/chat/conversations
  Response: [{ _id, participants, lastMessage, unreadCount, ... }]
  Auth: Required (JWT)

GET /api/chat/conversations/:conversationId/messages
  Response: [{ _id, text, sender, reactions, ... }]
  Query: ?page=1&limit=30
  Auth: Required

POST /api/chat/conversations
  Body: { participantId } (for DM) or { userIds, name } (for group)
  Response: { _id, type, participants, ... }
  Auth: Required

POST /api/chat/messages
  Body: { conversationId, text, gifUrl, replyTo }
  Response: { _id, text, sender, createdAt, ... }
  Auth: Required

PATCH /api/chat/conversations/:conversationId/pin
  Response: { _id, pinnedBy, ... } (toggled)
  Auth: Required

PATCH /api/chat/conversations/:conversationId/archive
  Response: { _id, archivedBy, ... } (toggled)
  Auth: Required

PATCH /api/chat/conversations/:conversationId/mute
  Response: { _id, mutedBy, ... } (toggled)
  Auth: Required

POST /api/chat/:conversationId/seen
  Body: { lastSeenMessageId }
  Response: { success: true }
  Auth: Required

GET /api/chat/users?q=search_term
  Response: [{ _id, name, email, avatar, ... }]
  Auth: Required

POST /api/chat/last-seen (batch)
  Body: { userIds: [id1, id2] }
  Response: { id1: { online, lastSeen }, id2: { ... } }
  Auth: Required
```

### Group Management

```
POST /api/group
  Body: { name, userIds, avatar }
  Response: { _id, name, createdBy, ... }
  Auth: Required

GET /api/group/:groupId
  Response: { _id, name, participants, admins, ... }
  Auth: Required

PATCH /api/group/:groupId
  Body: { name, avatar }
  Response: Updated group
  Auth: Required (owner/admin)

POST /api/group/:groupId/members
  Body: { userIds: [id1, id2] }
  Response: { participants, ... }
  Auth: Required (owner/admin)

DELETE /api/group/:groupId/members/:userId
  Response: { success: true }
  Auth: Required (owner/admin)
```

### Message Scheduling

```
POST /api/schedule
  Body: { conversationId, text, scheduledTime }
  Response: { _id, status, scheduledTime, ... }
  Auth: Required

GET /api/schedule
  Response: [{ _id, text, scheduledTime, status, ... }]
  Auth: Required

DELETE /api/schedule/:scheduleId
  Response: { success: true }
  Auth: Required (owner)
```

---

## 🔐 Authentication

### JWT Token Structure

```javascript
{
  id: userId,
  email: user.email,
  iat: issuedAt,
  exp: expiresAt
}
```

### Middleware Usage

```javascript
// In route files
router.get("/conversations", auth, getConversations);

// In socket handlers
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const user = jwt.verify(token, process.env.JWT_SECRET);
  socket.userId = user.id;
  next();
});
```

---

## 📊 Database Indexes

For optimal performance:

```javascript
// Message indexes
messageSchema.index({ conversationId: 1, createdAt: -1 }); // Pagination
messageSchema.index({ sender: 1, createdAt: -1 }); // User messages
messageSchema.index({ deletedFor: 1 }); // Delete for me
messageSchema.index({ replyTo: 1 }); // Threads

// Conversation indexes
conversationSchema.index({ participants: 1 }); // Find user convs
conversationSchema.index({ participants: 1, _id: 1 }); // Pagination

// User indexes
userSchema.index({ email: 1 }, { unique: true }); // Login
userSchema.index({ name: 1 }); // Search
```

---

## 🔄 Data Flow Examples

### Sending a Message

```
1. Client: socket.emit("message:send", { conversationId, text, tempId })
2. Server: Verify conversation membership
3. Server: Create Message in MongoDB
4. Server: Update Conversation lastMessage
5. Server: io.to(`conv:{id}`).emit("message:new", payload)
6. All participants in room receive message
7. Client: Add to messages array, remove optimistic message
```

### Edit Message

```
1. Client: socket.emit("message:edit", { messageId, newText })
2. Server: Verify sender owns message
3. Server: Update Message { text, isEdited: true, editedAt: now }
4. Server: io.to(`conv:{id}`).emit("message:edited", updated)
5. All participants see edited message
```

### Pin Conversation

```
1. Client: api.patch(`/api/chat/conversations/{id}/pin`)
2. Server: Toggle user in Conversation.pinnedBy array
3. Server: Return updated conversation
4. Client: Update conversations list, re-sort with pinned first
```

---

## 🚀 Environment Variables

```env
# Database
MONGODB_URI=mongodb://localhost:27017/convox
REDIS_URL=redis://localhost:6379

# Server
NODE_ENV=development|production
PORT=5000

# Security
JWT_SECRET=super_secret_key_here
JWT_EXPIRE=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=app_password

# File Upload
MAX_FILE_SIZE=5242880
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/gif
```

---

## 🧪 Testing

### Test Message Send

```bash
# Start server
npm start

# In another terminal, test API
curl -X POST http://localhost:5000/api/chat/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"...", "text":"Hello"}'
```

### Test WebSocket

```javascript
// Terminal with node
const io = require("socket.io-client");
const socket = io("http://localhost:5000", {
  auth: { token: "your_jwt_token" },
});

socket.on("connect", () => console.log("Connected!"));
socket.emit("message:send", {
  conversationId: "...",
  text: "Test message",
});
socket.on("message:new", (msg) => console.log("Received:", msg));
```

---

## 🐛 Debugging

### Enable Verbose Logging

```bash
DEBUG=* npm start  # All modules
DEBUG=socket.io:* npm start  # Socket.io only
```

### Check Database

```bash
# MongoDB
mongosh convox
db.messages.findOne()
db.conversations.findOne()
db.users.findOne()

# Redis
redis-cli
KEYS presence:*
GET presence:userId
```

### Monitor Socket Events

```javascript
// In socket handler
io.on("connection", (socket) => {
  console.log("User connected:", socket.userId);
  socket.onAny((event, ...args) => {
    console.log(`Event: ${event}`, args);
  });
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.userId);
  });
});
```

---

## 📈 Performance Optimization

1. **Pagination** - Fetch messages in chunks (limit 30)
2. **Indexing** - Create DB indexes on frequently queried fields
3. **Caching** - Use Redis for presence & unread counts
4. **Room Broadcasting** - Use Socket.io rooms instead of individual emits
5. **Minify Payload** - Send only necessary data in socket events

---

## 🚀 Deployment

### Build for Production

```bash
npm run build  # If applicable
NODE_ENV=production npm start
```

### Heroku

```bash
heroku config:set MONGODB_URI=mongodb+srv://...
heroku config:set REDIS_URL=redis://...
git push heroku main
```

### Docker

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY src ./src
CMD ["node", "index.js"]
```

---

## 📖 Resources

- [Express.js Docs](https://expressjs.com/)
- [Socket.io Docs](https://socket.io/docs/)
- [MongoDB Docs](https://docs.mongodb.com/)
- [Redis Docs](https://redis.io/documentation)
- [JWT.io](https://jwt.io/)

---

**Last Updated:** March 5, 2026 | v1.0.0

For frontend details, see [CLIENT_README.md](../chat-app-client/README.md)
