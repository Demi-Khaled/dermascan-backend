const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { protect } = require('../middleware/authMiddleware');
const { getLesions, createLesion, addScanToLesion } = require('../controllers/lesionController');

const uploadDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    cb(null, req.user._id + '-' + Date.now() + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

router.route('/')
  .get(protect, getLesions)
  .post(protect, createLesion);

router.post('/:id/scans', protect, upload.single('image'), addScanToLesion);

module.exports = router;
