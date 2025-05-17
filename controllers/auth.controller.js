const Nurse = require('../models/nurse.model');
const Doctor = require('../models/doctor.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

exports.signup = async (req, res) => {
  const { email, password, role } = req.body;
  try {
    // Validate input
    if (!email || !password || !role) {
      return res.status(400).json({ 
        success: false,
        msg: 'Email, password, and role are required' 
      });
    }
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        msg: 'Password must be at least 6 characters long' 
      });
    }
    // Check if email exists in either Nurse or Doctor
    const nurseExists = await Nurse.findOne({ email });
    const doctorExists = await Doctor.findOne({ email });
    if (nurseExists || doctorExists) {
      return res.status(400).json({ 
        success: false,
        msg: 'Email already exists' 
      });
    }
    const hashed = await bcrypt.hash(password, 10);
    let user;
    if (role === 'doctor') {
      user = await Doctor.create({ email, password: hashed });
    } else {
      user = await Nurse.create({ email, password: hashed });
    }
    res.status(201).json({ 
      success: true,
      msg: 'Signup successful',
      email: user.email, 
      role
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ 
      success: false,
      msg: 'Server error during signup',
      error: err.message 
    });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt for email:', email);

  try {
    // Validate input
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ 
        success: false,
        msg: 'Email and password are required' 
      });
    }

    // Try Nurse login
    let user = await Nurse.findOne({ email });
    let role = 'nurse';
    if (!user) {
      // Try Doctor login
      user = await Doctor.findOne({ email });
      role = 'doctor';
    }
    console.log('Found user:', user ? 'yes' : 'no', 'Role:', role);

    if (!user) {
      return res.status(400).json({ 
        success: false,
        msg: 'No account found with this email' 
      });
    }

    const match = await bcrypt.compare(password, user.password);
    console.log('Password match:', match ? 'yes' : 'no');

    if (!match) {
      return res.status(400).json({ 
        success: false,
        msg: 'Invalid password' 
      });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('Login successful for:', email, 'Role:', role);
    res.json({ 
      success: true,
      msg: 'Login successful',
      token,
      email: user.email,
      role
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      success: false,
      msg: 'Server error during login',
      error: err.message 
    });
  }
};
