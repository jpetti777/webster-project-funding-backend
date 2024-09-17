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

console.log('Defining MongoDB schema...');
const surveySchema = new mongoose.Schema({
  userName: String,
  userEmail: String,
  selectedProjects: [Number],
  comments: mongoose.Schema.Types.Mixed,
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

surveySchema.index({ userEmail: 1 });
surveySchema.index({ submittedAt: -1 });

const Survey = mongoose.model('Survey', surveySchema);

console.log('Setting up MongoDB connection...');
const connectWithRetry = () => {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
    maxPoolSize: 50,
  })
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  });
};

connectWithRetry();

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  setTimeout(connectWithRetry, 5000);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
  connectWithRetry();
});

const pingServer = async () => {
  try {
    const response = await axios.get('https://webster-project-funding-backend.onrender.com');
    console.log('Ping successful:', response.status);
  } catch (error) {
    console.error('Ping failed:', error.message);
  }
};

setInterval(pingServer, 120000);

function warmUpDB() {
  Survey.findOne({}).then(() => {
    console.log('DB connection warmed up');
  }).catch(console.error);
}

setInterval(warmUpDB, 5 * 60 * 1000); // Run every 5 minutes

app.get('/', (req, res) => {
  res.send('Server is running');
});

const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

app.post('/api/submit-survey', async (req, res) => {
  console.time('survey-submission');
  console.log('Received survey submission:', req.body);
  try {
    console.time('database-operation');
    const newSurvey = new Survey(req.body);
    await retryOperation(() => newSurvey.save({ writeConcern: { w: 'majority', wtimeout: 5000 } }));
    console.timeEnd('database-operation');
    console.log('Survey saved successfully:', newSurvey);
    res.status(201).json({ message: 'Survey submitted successfully', survey: newSurvey });
  } catch (error) {
    console.error('Error submitting survey:', error);
    if (error.name === 'MongooseServerSelectionError') {
      res.status(503).json({ message: 'Database connection error. Please try again later.' });
    } else {
      res.status(500).json({ message: 'Error submitting survey', error: error.message });
    }
  }
  console.timeEnd('survey-submission');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  pingServer();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Log the server's IP address
const http = require('http');
http.get({'host': 'api.ipify.org', 'port': 80, 'path': '/'}, function(resp) {
  resp.on('data', function(ip) {
    console.log("Server's public IP address is: " + ip);
  });
});