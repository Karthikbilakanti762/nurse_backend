const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config(); // Make sure this is on top before accessing env variables

const authRoutes = require('./routes/auth.routes');
const patientRoutes = require('./routes/patient.routes');
const visitRoutes = require('./routes/visit.routes');
const prescriptionRoutes = require('./routes/prescription.routes');
const fileRoutes = require('./routes/file.routes');

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);



// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL // Use environment variable in production
    : ['http://localhost:3000', 'http://localhost:5000'], // Development origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/notetitle', require('./routes/notetitle'));
app.use('/api/files', fileRoutes);


// MongoDB Connection with retry mechanism
const connectWithRetry = () => {
  mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    retryWrites: true,
  })
  .then(() => {
    console.log('✅ MongoDB connected');
    // Initialize GridFS
    require('./utils/gridfs').initGridFS(mongoose.connection);
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  });
};

connectWithRetry();

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
