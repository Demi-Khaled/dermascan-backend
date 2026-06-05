const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { analyzeImage } = require('../controllers/analyzeController');
const { lesionUpload } = require('../config/cloudinary');

router.post('/', protect, lesionUpload.single('image'), analyzeImage);

module.exports = router;
