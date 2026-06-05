const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getLesions, createLesion, addScanToLesion, updateLesion } = require('../controllers/lesionController');
const { lesionUpload } = require('../config/cloudinary');

router.route('/')
  .get(protect, getLesions)
  .post(protect, createLesion);

router.route('/:id')
  .put(protect, updateLesion);

router.post('/:id/scans', protect, lesionUpload.single('image'), addScanToLesion);


module.exports = router;
