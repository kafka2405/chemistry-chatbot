const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const OpenAI = require('openai');
const ChatSession = require('./models/ChatSession');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI || 'mongodb://mongo:27017/chemistry-chatbot';

// Kết nối MongoDB
mongoose.connect(mongoUri)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// CORS — cho phép frontend gửi cookie session
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Session middleware — lưu session trong MongoDB
app.use(session({
  secret: process.env.SESSION_SECRET || 'chemistry-chatbot-secret-2025',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: mongoUri }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 ngày
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập.' });
  }
  next();
};

// Routes
const authRoutes = require('./routes/auth');
const historyRoutes = require('./routes/history');
app.use('/api/auth', authRoutes);
app.use('/api/history', historyRoutes);

// 1. Tạo thread mới (chưa tạo ChatSession — sẽ tạo khi gửi tin nhắn đầu tiên)
app.post('/api/threads/create', requireAuth, async (req, res) => {
  try {
    const thread = await openai.beta.threads.create();
    res.json({ threadId: thread.id });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

// 2. Chat — gửi tin nhắn và lưu vào DB
app.post('/api/chat', requireAuth, async (req, res) => {
  const { threadId, message, sessionId } = req.body;
  const assistantId = process.env.ASSISTANT_ID;

  if (!threadId || !message) {
    return res.status(400).json({ error: 'Missing threadId or message' });
  }

  try {
    // Tạo ChatSession nếu chưa có (tin nhắn đầu tiên)
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const chatSession = await ChatSession.create({
        userId: req.session.userId,
        threadId: threadId,
        title: message.substring(0, 60) + (message.length > 60 ? '...' : ''),
        messages: [{ role: 'user', content: message }]
      });
      currentSessionId = chatSession._id;
    } else {
      // Lưu tin nhắn user vào ChatSession đã có
      const chatSession = await ChatSession.findOne({ _id: currentSessionId, userId: req.session.userId });
      if (chatSession) {
        chatSession.messages.push({ role: 'user', content: message });
        await chatSession.save();
      }
    }

    // Gửi tin nhắn lên OpenAI
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message,
    });

    // Chạy assistant
    const run = await openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: assistantId,
    });

    if (run.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(threadId);
      const lastMessage = messages.data[0];

      let answer = '';
      if (lastMessage.role === 'assistant') {
        const textContent = lastMessage.content.find(c => c.type === 'text');
        if (textContent) {
          answer = textContent.text.value;
        }
      }

      // Lưu tin nhắn assistant vào DB
      if (currentSessionId) {
        const chatSession = await ChatSession.findOne({ _id: currentSessionId, userId: req.session.userId });
        if (chatSession) {
          chatSession.messages.push({ role: 'assistant', content: answer });
          await chatSession.save();
        }
      }

      res.json({
        sessionId: currentSessionId,
        answer: answer,
        messageId: lastMessage.id
      });
    } else {
      res.status(500).json({ error: `Run failed with status: ${run.status}` });
    }
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// 3. Lấy tin nhắn theo thread (fallback)
app.get('/api/threads/:threadId/messages', requireAuth, async (req, res) => {
  const { threadId } = req.params;
  try {
    const messages = await openai.beta.threads.messages.list(threadId);
    res.json({ messages: messages.data });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
