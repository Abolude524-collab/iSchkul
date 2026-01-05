# ischkul Backend

A standard Node.js/Express backend for the ischkul educational platform.

## Features

- **Authentication**: User registration, login, JWT tokens
- **Chat**: Real-time messaging with Socket.io
- **Groups**: Study group management
- **File Upload**: PDF, DOCX, TXT file processing
- **AI Generation**: Quiz and flashcard generation
- **Leaderboard**: XP and level tracking
- **User Management**: Profile management and search

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment variables**:
   Copy `.env` and update the values:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: Secret key for JWT tokens
   - `OPENAI_API_KEY`: For AI-powered quiz generation (optional)
   - `PORT`: Server port (default: 5000)

3. **Start MongoDB**:
   Make sure MongoDB is running locally or update the connection string.

4. **Run the server**:
   ```bash
   npm run dev  # Development with nodemon
   # or
   npm start    # Production
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Chat
- `GET /api/chat/messages/:groupId` - Get group messages
- `POST /api/chat/send` - Send message
- `GET /api/chat/online` - Get online users

### Groups
- `GET /api/groups` - Get user's groups
- `GET /api/groups/:id` - Get group details
- `POST /api/groups/create` - Create new group
- `POST /api/groups/:id/join` - Join group

### Files
- `POST /api/files/upload` - Upload file
- `GET /api/files` - Get user's files

### Generate
- `POST /api/generate/quiz` - Generate quiz
- `POST /api/generate/flashcards` - Generate flashcards

### Users
- `GET /api/users/search?q=query` - Search users
- `GET /api/users/:id` - Get user profile

### Leaderboard
- `GET /api/leaderboard` - Get leaderboard
- `GET /api/leaderboard/rank` - Get current user's rank

## Real-time Features

The backend includes Socket.io for real-time chat:
- `join-group`: Join a group chat room
- `leave-group`: Leave a group chat room
- `send-message`: Send message to group
- `new-message`: Receive new messages

## Development

- Uses Express.js for routing
- MongoDB with Mongoose for data storage
- JWT for authentication
- Socket.io for real-time communication
- Multer for file uploads
- OpenAI API integration (optional)

## Deployment

This is a standard Node.js application that can be deployed to:
- Heroku
- Vercel
- AWS EC2
- DigitalOcean
- Any Node.js hosting service

Make sure to set environment variables in your deployment platform.