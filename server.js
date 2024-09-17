console.log('Script is starting...');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

console.log('Middleware setup...');
const corsOptions = {
  origin: [
    'https://webster-project-funding.vercel.app',
    /https:\/\/webster-project-funding-.*\.vercel\.app$/
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

console.log('Attempting to connect to MongoDB...');
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

const surveySchema = new mongoose.Schema({
  userName: String,
  userEmail: String,
  selectedProjects: [Number],
  comments: Object,
  submittedAt: { type: Date, default: Date.now }
});

const Survey = mongoose.model('Survey', surveySchema);

// Add this function to ping the server
const pingServer = async () => {
  try {
    const response = await axios.get('https://webster-project-funding-backend.onrender.com');
    console.log('Ping successful:', response.status);
  } catch (error) {
    console.error('Ping failed:', error.message);
  }
};

// Set up the interval to ping every 2 minutes (120000 ms)
setInterval(pingServer, 120000);

app.get('/', (req, res) => {
  res.send('Server is running');
});

app.post('/api/submit-survey', async (req, res) => {
  console.log('Received survey submission:', req.body);
  try {
    const newSurvey = new Survey(req.body);
    await newSurvey.save();
    console.log('Survey saved successfully:', newSurvey);
    res.status(201).json({ message: 'Survey submitted successfully', survey: newSurvey });
  } catch (error) {
    console.error('Error submitting survey:', error);
    res.status(400).json({ message: 'Error submitting survey', error: error.message, stack: error.stack });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Ping immediately on startup
  pingServer();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});