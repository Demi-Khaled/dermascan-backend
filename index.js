require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./db');

// Connect to MongoDB
connectDB();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Make the uploads folder accessible statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/lesions', require('./routes/lesions'));
app.use('/api/analyze', require('./routes/analyze'));

// Simple health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

// Root endpoint
app.get('/', (req, res) => {
    res.send('DermaScannAI API is running! Use the /api endpoints to interact with the backend.');
});

app.listen(port, () => {
  console.log(`DermaScannAI Node.js Backend listening at http://localhost:${port}`);
});
