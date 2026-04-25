const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/authMiddleware');
const { analyzeImage } = require('../controllers/analyzeController');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    cb(null, req.user._id + '-temp-' + Date.now() + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

router.post('/', protect, upload.single('image'), analyzeImage);

module.exports = router;
