const express = require('express');
const router = express.Router();
const ChatSession = require('../models/ChatSession');

// Middleware kiểm tra đăng nhập
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập.' });
  }
  next();
};

// Lấy danh sách các phiên chat của user
router.get('/', requireAuth, async (req, res) => {
  try {
    const sessions = await ChatSession.find({ userId: req.session.userId })
      .select('title createdAt messages')
      .sort({ createdAt: -1 });

    // Trả về danh sách với số tin nhắn
    const result = sessions.map(s => ({
      id: s._id,
      title: s.title,
      messageCount: s.messages.length,
      createdAt: s.createdAt
    }));

    res.json({ sessions: result });
  } catch (error) {
    console.error('History list error:', error);
    res.status(500).json({ error: 'Lỗi khi tải lịch sử.' });
  }
});

// Xem chi tiết tin nhắn của 1 phiên (read-only)
router.get('/:sessionId', requireAuth, async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.sessionId,
      userId: req.session.userId
    });

    if (!session) {
      return res.status(404).json({ error: 'Không tìm thấy phiên chat.' });
    }

    res.json({
      id: session._id,
      title: session.title,
      messages: session.messages,
      createdAt: session.createdAt
    });
  } catch (error) {
    console.error('History detail error:', error);
    res.status(500).json({ error: 'Lỗi khi tải chi tiết phiên chat.' });
  }
});

module.exports = router;
