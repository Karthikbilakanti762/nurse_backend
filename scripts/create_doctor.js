const mongoose = require('mongoose');
const Doctor = require('../models/doctor.model');
const bcrypt = require('bcryptjs');

async function createDoctor(email, password) {
  await mongoose.connect('mongodb://localhost:27017/hosp_app'); // Change 'yourdbname' to your actual DB name if needed
  const hashedPassword = await bcrypt.hash(password, 10);
  const doctor = new Doctor({ email, password: hashedPassword });
  await doctor.save();
  console.log('✅ Doctor created:', doctor.email);
  mongoose.disconnect();
}

// Example doctor
createDoctor('doctor@example.com', 'password123');
