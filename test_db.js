require('dotenv').config();
const mongoose = require('mongoose');
const Lesion = require('./models/Lesion');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const lesions = await Lesion.find();
  console.log(JSON.stringify(lesions, null, 2));
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
