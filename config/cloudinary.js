const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'dermascan_profiles',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }],
  },
});

const lesionStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'dermascan_lesions',
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});

const profileUpload = multer({ storage: profileStorage });
const lesionUpload = multer({ storage: lesionStorage });

module.exports = {
  cloudinary,
  profileUpload,
  lesionUpload,
};
