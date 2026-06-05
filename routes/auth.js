const express = require('express');
const router = express.Router();
const { registerUser, loginUser, logoutUser, updateUser, deleteUser, googleLogin, refreshAccessToken, uploadProfilePicture, changePassword, forgotPassword, verifyOTP, resetPassword, verifyRegistration, resendVerificationOTP } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { profileUpload } = require('../config/cloudinary');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);
router.post('/google', googleLogin);
router.post('/refresh', refreshAccessToken);
router.put('/update', protect, updateUser);
router.put('/change-password', protect, changePassword);
router.delete('/delete', protect, deleteUser);
router.post('/upload-avatar', protect, profileUpload.single('avatar'), uploadProfilePicture);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);
router.post('/verify-registration', verifyRegistration);
router.post('/resend-verification', resendVerificationOTP);

module.exports = router;
