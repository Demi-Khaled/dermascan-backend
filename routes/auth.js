const express = require('express');
const router = express.Router();
const { registerUser, loginUser, updateUser, deleteUser, googleLogin, refreshAccessToken, uploadProfilePicture, changePassword, forgotPassword, verifyOTP, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../config/cloudinary');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleLogin);
router.post('/refresh', refreshAccessToken);
router.put('/update', protect, updateUser);
router.put('/change-password', protect, changePassword);
router.delete('/delete', protect, deleteUser);
router.post('/upload-avatar', protect, upload.single('avatar'), uploadProfilePicture);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);

module.exports = router;
