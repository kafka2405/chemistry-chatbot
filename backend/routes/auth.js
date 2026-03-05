const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Đăng ký tài khoản
router.post('/register', async (req, res) => {
  const { username, password, name, grade } = req.body;

  if (!username || !password || !name || !grade) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin.' });
  }
  if (![10, 11, 12].includes(Number(grade))) {
    return res.status(400).json({ error: 'Lớp phải là 10, 11 hoặc 12.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
  }

  try {
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại.' });
    }

    const user = await User.create({ username, password, name, grade: Number(grade) });

    // Tự động đăng nhập sau khi đăng ký
    req.session.userId = user._id;
    res.status(201).json({
      user: { id: user._id, username: user.username, name: user.name, grade: user.grade }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Lỗi hệ thống khi đăng ký.' });
  }
});

// Đăng nhập
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập tài khoản và mật khẩu.' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu.' });
    }

    req.session.userId = user._id;
    res.json({
      user: { id: user._id, username: user.username, name: user.name, grade: user.grade }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Lỗi hệ thống khi đăng nhập.' });
  }
});

// Đăng xuất
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Lỗi khi đăng xuất.' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Đã đăng xuất.' });
  });
});

// Lấy thông tin user hiện tại
router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Chưa đăng nhập.' });
  }

  try {
    const user = await User.findById(req.session.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy user.' });
    }
    res.json({
      user: { id: user._id, username: user.username, name: user.name, grade: user.grade }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

module.exports = router;
