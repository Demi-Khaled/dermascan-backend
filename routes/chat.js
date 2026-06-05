const express = require('express');
const router = express.Router();
const { generateContent } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, generateContent);

module.exports = router;
