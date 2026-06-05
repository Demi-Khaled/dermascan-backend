const User = require('../models/User');
const Lesion = require('../models/Lesion');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const nodemailer = require('nodemailer');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
  port: process.env.EMAIL_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASS, // Your email password or app password
  },
});

// Helper to send registration verification email
const sendVerificationEmail = async (email, otp) => {
  const mailOptions = {
    from: `"DermaScan AI" <${process.env.EMAIL_USER || 'no-reply@dermascan.ai'}>`,
    to: email,
    subject: 'DermaScan Email Verification Code',
    text: `Your OTP for email verification is: ${otp}. It will expire in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
        <h2 style="color: #4f46e5; text-align: center;">DermaScan AI</h2>
        <p>Welcome to DermaScan!</p>
        <p>Please use the OTP below to verify your email and complete your sign up:</p>
        <div style="background: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1f2937; border-radius: 8px;">
          ${otp}
        </div>
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">This OTP will expire in 10 minutes. If you did not sign up for DermaScan, please ignore this email.</p>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
};

// Generate tokens
const generateTokens = (id, tokenVersion = 0) => {
  const accessToken = jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: '15m', // Short-lived access token
  });
  const refreshToken = jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: '30d', // Long-lived refresh token
  });
  return { accessToken, refreshToken };
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please add all fields' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      if (userExists.isVerified === false) {
        // Regenerate OTP and update user details to allow retrying
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        userExists.verificationOTP = otp;
        userExists.verificationOTPExpires = Date.now() + 10 * 60 * 1000;
        userExists.name = name;
        userExists.password = password; // Will be hashed in pre-save hook
        await userExists.save();

        await sendVerificationEmail(email, otp);

        return res.status(200).json({
          message: 'Verification code resent. Please verify your email.',
          requiresVerification: true,
          email: email,
        });
      }
      return res.status(400).json({ message: 'User already exists' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    const user = await User.create({
      name,
      email,
      password,
      isVerified: false,
      verificationOTP: otp,
      verificationOTPExpires: otpExpires,
    });

    if (user) {
      await sendVerificationEmail(email, otp);
      res.status(200).json({
        message: 'Verification code sent. Please check your email.',
        requiresVerification: true,
        email: user.email,
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && user.password && (await bcrypt.compare(password, user.password))) {
      if (user.isVerified === false) {
        // Resend registration OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.verificationOTP = otp;
        user.verificationOTPExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        await sendVerificationEmail(email, otp);

        return res.status(403).json({
          message: 'Please verify your email. A new verification code has been sent.',
          requiresVerification: true,
          email: email,
        });
      }

      const { accessToken, refreshToken } = generateTokens(user._id, user.tokenVersion);
      res.json({
        _id: user.id,
        name: user.name,
        email: user.email,
        age: user.age,
        skinType: user.skinType,
        medicalConditions: user.medicalConditions,
        profilePicture: user.profilePicture,
        isDarkMode: user.isDarkMode,
        token: accessToken,
        refreshToken: refreshToken,
      });
    } else if (user && !user.password) {
       res.status(401).json({ message: 'This account uses Google Sign-In' });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Public
const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ message: 'Refresh token required' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    const tokens = generateTokens(user._id, user.tokenVersion);
    res.json({
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

// @desc    Update user profile (name, email, password)
// @route   PUT /api/auth/update
// @access  Private
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, email, password, age, skinType, medicalConditions } = req.body;

    if (name) user.name = name;
    if (email) user.email = email;
    if (age) user.age = age;
    if (skinType) user.skinType = skinType;
    if (medicalConditions) user.medicalConditions = medicalConditions;
    if (req.body.isDarkMode !== undefined) user.isDarkMode = req.body.isDarkMode;
    
    if (password) {
      if (user.googleId && !user.password) {
        return res.status(400).json({ message: 'Social login users cannot set a password this way. Please use Forgot Password or link a password first.' });
      }
      user.password = password; // will be hashed by pre-save hook
    }

    await user.save();

    const { accessToken, refreshToken } = generateTokens(user._id, user.tokenVersion);
    res.json({
      _id: user.id,
      name: user.name,
      email: user.email,
      age: user.age,
      skinType: user.skinType,
      medicalConditions: user.medicalConditions,
      profilePicture: user.profilePicture,
      isDarkMode: user.isDarkMode,
      token: accessToken,
      refreshToken: refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a user and their data
// @route   DELETE /api/auth/delete
// @access  Private
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete associated lesions
    await Lesion.deleteMany({ userId: req.user.id });
    
    // Delete the user
    await user.deleteOne();

    res.json({ message: 'User and all associated data removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Google Login
// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: 'Google ID Token is required' });
    }

    // Verify the token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name } = payload;

    // Find or create user
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId,
        isVerified: true, // Google emails are pre-verified
      });
    } else {
      if (!user.googleId) {
        user.googleId = googleId;
      }
      user.isVerified = true; // Auto-verify if they link with Google
      await user.save();
    }

    const { accessToken, refreshToken } = generateTokens(user._id, user.tokenVersion);
    res.status(200).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      age: user.age,
      skinType: user.skinType,
      medicalConditions: user.medicalConditions,
      profilePicture: user.profilePicture,
      isDarkMode: user.isDarkMode,
      token: accessToken,
      refreshToken: refreshToken,
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({ message: 'Invalid Google Token' });
  }
};

const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.profilePicture = req.file.path; // Cloudinary URL
    await user.save();

    res.json({
      message: 'Profile picture updated successfully',
      profilePicture: user.profilePicture,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide old and new passwords' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'Social login users cannot change password this way' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect current password' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Forgot password - Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Please provide an email' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No user found with this email' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpires = otpExpires;
    await user.save();

    // Send email
    const mailOptions = {
      from: `"DermaScan AI" <${process.env.EMAIL_USER || 'no-reply@dermascan.ai'}>`,
      to: user.email,
      subject: 'Password Reset OTP',
      text: `Your OTP for password reset is: ${otp}. It will expire in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
          <h2 style="color: #4f46e5; text-align: center;">DermaScan AI</h2>
          <p>Hello,</p>
          <p>You requested a password reset. Use the OTP below to proceed:</p>
          <div style="background: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1f2937; border-radius: 8px;">
            ${otp}
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">This OTP will expire in 10 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ message: 'Error sending OTP. Please try again later.' });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Please provide email and OTP' });
    }

    const user = await User.findOne({
      email,
      resetPasswordOTP: otp,
      resetPasswordOTPExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    res.json({ message: 'OTP verified successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Please provide all fields' });
    }

    const user = await User.findOne({
      email,
      resetPasswordOTP: otp,
      resetPasswordOTPExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful. You can now login.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout user (invalidate tokens)
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      user.tokenVersion += 1;
      await user.save();
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify registration OTP
// @route   POST /api/auth/verify-registration
// @access  Public
const verifyRegistration = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Please provide email and OTP' });
    }

    const user = await User.findOne({
      email,
      verificationOTP: otp,
      verificationOTPExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    user.isVerified = true;
    user.verificationOTP = undefined;
    user.verificationOTPExpires = undefined;
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user._id, user.tokenVersion);
    res.status(200).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      age: user.age,
      skinType: user.skinType,
      medicalConditions: user.medicalConditions,
      profilePicture: user.profilePicture,
      isDarkMode: user.isDarkMode,
      token: accessToken,
      refreshToken: refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Resend registration verification OTP
// @route   POST /api/auth/resend-verification
// @access  Public
const resendVerificationOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Please provide an email' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'User is already verified' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationOTP = otp;
    user.verificationOTPExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendVerificationEmail(email, otp);
    res.status(200).json({ message: 'Verification code resent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  updateUser,
  deleteUser,
  googleLogin,
  refreshAccessToken,
  uploadProfilePicture,
  changePassword,
  forgotPassword,
  verifyOTP,
  resetPassword,
  logoutUser,
  verifyRegistration,
  resendVerificationOTP,
};
