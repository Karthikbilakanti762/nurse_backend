const Patient = require('../models/patient.model');
const LabReport = require('../models/lab_report.model');
const Visit = require('../models/visit.model');
const Prescription = require('../models/prescription.model');
const { getGridFSBucket } = require('../utils/gridfs');
const mongoose = require('mongoose');

// Create Patient (new schema)
const createPatient = async (req, res) => {
  try {
    const { name, age, gender, phone, vitals } = req.body;
    // Handle photo/document upload with GridFS
    let imageId = null;
    let documentId = null;
    const bucket = getGridFSBucket();
    if (req.files && req.files['photo'] && req.files['photo'][0]) {
      const photoFile = req.files['photo'][0];
      const uploadStream = bucket.openUploadStream(photoFile.originalname, { contentType: photoFile.mimetype });
      uploadStream.end(photoFile.buffer);
      await new Promise((resolve, reject) => {
        uploadStream.on('finish', () => {
          imageId = uploadStream.id;
          resolve();
        });
        uploadStream.on('error', reject);
      });
    }
    if (req.files && req.files['document'] && req.files['document'][0]) {
      const docFile = req.files['document'][0];
      const uploadStream = bucket.openUploadStream(docFile.originalname, { contentType: docFile.mimetype });
      uploadStream.end(docFile.buffer);
      await new Promise((resolve, reject) => {
        uploadStream.on('finish', () => {
          documentId = uploadStream.id;
          resolve();
        });
        uploadStream.on('error', reject);
      });
    }

    // Create patient (do NOT include vitals)
    const newPatient = new Patient({
      name,
      age,
      gender,
      phone,
      image: imageId,
      document: documentId
    });
    const savedPatient = await newPatient.save();

    // Handle lab reports if any
    if (req.files && req.files['labReports'] && req.files['labReports'].length > 0) {
      console.log('Processing lab reports:', req.files['labReports'].length);
      for (const labReportFile of req.files['labReports']) {
        console.log('Processing lab report file:', labReportFile.originalname);
        const uploadStream = bucket.openUploadStream(labReportFile.originalname, { contentType: labReportFile.mimetype });
        uploadStream.end(labReportFile.buffer);
        let result = null;
        await new Promise((resolve, reject) => {
          uploadStream.on('finish', () => {
            result = uploadStream.id;
            resolve();
          });
          uploadStream.on('error', reject);
        });

        // Create lab report entry
        const labReport = new LabReport({
          patientId: savedPatient._id,
          testName: 'Lab Report', // Default name, can be updated later
          testDate: new Date(),
          result
        });
        const savedReport = await labReport.save();
        savedPatient.labReports.push(savedReport._id);
      }
      await savedPatient.save();
    }

    // Create first visit for the patient (optionally with vitals)
    let vitalsData = undefined;
    if (vitals) {
      vitalsData = typeof vitals === 'string' ? (() => { try { return JSON.parse(vitals); } catch (e) { return {}; } })() : vitals;
      if (typeof vitalsData !== 'object' || Array.isArray(vitalsData)) vitalsData = {};
    }
    const firstVisit = new Visit({
      patientId: savedPatient._id,
      visitDate: new Date(),
      vitals: vitalsData || {},
      doctorNote: { title: '', content: '' }
    });
    const savedVisit = await firstVisit.save();
    savedPatient.visits.push(savedVisit._id);
    await savedPatient.save();

    // Fetch the complete patient data with populated lab reports
    const completePatient = await Patient.findById(savedPatient._id)
      .populate('labReports')
      .populate('visits');

    res.status(200).json({
      success: true,
      message: 'Patient registered successfully',
      patient: completePatient,
      firstVisit: savedVisit
    });
  } catch (error) {
    console.error('Error in createPatient:', error);
    res.status(500).json({ success: false, error: 'Failed to register patient', details: error.message });
  }
};

// Update Patient (new schema)
const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    let { name, age, gender, phone } = req.body;
    let updateFields = { name, age, gender, phone };
    // Handle file updates with GridFS
    const bucket = getGridFSBucket();
    if (req.files && req.files['photo'] && req.files['photo'][0]) {
      const photoFile = req.files['photo'][0];
      const uploadStream = bucket.openUploadStream(photoFile.originalname, { contentType: photoFile.mimetype });
      uploadStream.end(photoFile.buffer);
      await new Promise((resolve, reject) => {
        uploadStream.on('finish', () => {
          updateFields.image = uploadStream.id;
          resolve();
        });
        uploadStream.on('error', reject);
      });
    }
    if (req.files && req.files['document'] && req.files['document'][0]) {
      const docFile = req.files['document'][0];
      const uploadStream = bucket.openUploadStream(docFile.originalname, { contentType: docFile.mimetype });
      uploadStream.end(docFile.buffer);
      await new Promise((resolve, reject) => {
        uploadStream.on('finish', () => {
          updateFields.document = uploadStream.id;
          resolve();
        });
        uploadStream.on('error', reject);
      });
    }
    const updatedPatient = await Patient.findByIdAndUpdate(id, updateFields, { new: true });
    res.json({ success: true, message: 'Patient updated successfully', patient: updatedPatient });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update patient', details: error.message });
  }
};

// Add Visit (new schema)
const addVisit = async (req, res) => {
  try {
    const { id } = req.params;
    const { vitals, doctorNote, medicines } = req.body;
    const patient = await Patient.findById(id);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    let prescription = null;
    if (medicines && Array.isArray(medicines) && medicines.length > 0) {
      prescription = new Prescription({ medicines });
      await prescription.save();
    }
    let vitalsData = vitals;
if (typeof vitals === 'string') {
  try {
    vitalsData = JSON.parse(vitals);
  } catch (e) {
    vitalsData = {};
  }
}
if (typeof vitalsData !== 'object' || Array.isArray(vitalsData)) vitalsData = {};
const visit = new Visit({
  patientId: id,
  visitDate: new Date(),
  vitals: vitalsData,
  doctorNote: typeof doctorNote === 'string' ? JSON.parse(doctorNote) : doctorNote,
  prescriptionId: prescription ? prescription._id : undefined
});
    const savedVisit = await visit.save();
    patient.visits.push(savedVisit._id);
    await patient.save();
    res.json({ success: true, message: 'Visit added successfully', visit: savedVisit });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add visit', details: error.message });
  }
};

// Update Visit (new schema)
const updateVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    const { vitals, doctorNote, medicines } = req.body;
    const visit = await Visit.findById(visitId);
    if (!visit) {
      return res.status(404).json({ success: false, error: 'Visit not found' });
    }
    if (vitals) visit.vitals = typeof vitals === 'string' ? JSON.parse(vitals) : vitals;
    if (doctorNote) visit.doctorNote = typeof doctorNote === 'string' ? JSON.parse(doctorNote) : doctorNote;
    if (medicines && Array.isArray(medicines)) {
      let prescription;
      if (visit.prescriptionId) {
        prescription = await Prescription.findById(visit.prescriptionId);
        if (prescription) {
          prescription.medicines = medicines;
          await prescription.save();
        } else {
          prescription = new Prescription({ medicines });
          await prescription.save();
          visit.prescriptionId = prescription._id;
        }
      } else {
        prescription = new Prescription({ medicines });
        await prescription.save();
        visit.prescriptionId = prescription._id;
      }
    }
    await visit.save();
    res.json({ success: true, message: 'Visit updated successfully', visit });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update visit', details: error.message });
  }
};

// Add Lab Report (new schema)
const addLabReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { testName, visitId } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const patient = await Patient.findById(id);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    // Store file in GridFS
    const bucket = getGridFSBucket();
    let result = null;
    const uploadStream = bucket.openUploadStream(req.file.originalname, { contentType: req.file.mimetype });
    uploadStream.end(req.file.buffer);
    await new Promise((resolve, reject) => {
      uploadStream.on('finish', () => {
        result = uploadStream.id;
        resolve();
      });
      uploadStream.on('error', reject);
    });
    const labReport = new LabReport({
      patientId: id,
      testName: testName || 'Lab Report',
      testDate: new Date(),
      result,
      visitId: visitId || undefined
    });
    const savedReport = await labReport.save();
    patient.labReports.push(savedReport._id);
    await patient.save();
    res.status(200).json({ success: true, report: savedReport });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add lab report', details: error.message });
  }
};

// Delete a lab report
const deleteLabReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await LabReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Lab report not found' });
    }
    await LabReport.findByIdAndDelete(reportId);
    // Remove from patient's labReports array
    await Patient.updateOne({ _id: report.patientId }, { $pull: { labReports: reportId } });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting lab report:', error);
    res.status(500).json({ success: false, error: 'Failed to delete lab report', details: error.message });
  }
};

// Download a lab report file by report ID (GridFS only)
const downloadLabReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await LabReport.findById(reportId);
    if (!report || !report.result) {
      return res.status(404).json({ success: false, error: 'Lab report or file not found' });
    }
    const bucket = getGridFSBucket();
    const result = report.result;
    const files = await bucket.find({ _id: result }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ success: false, error: 'File not found in GridFS' });
    }
    const file = files[0];
    res.set('Content-Type', file.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${file.filename}"`);
    const readStream = bucket.openDownloadStream(result);
    readStream.on('error', err => {
      res.status(500).json({ success: false, error: 'Error streaming file', details: err.message });
    });
    readStream.pipe(res);
  } catch (error) {
    console.error('Error downloading lab report:', error);
    res.status(500).json({ success: false, error: 'Failed to download lab report', details: error.message });
  }
};

// Delete patient by ID
const deletePatient = async (req, res) => {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.id);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    // Optionally, also remove related medical history, lab reports, and visits
    await LabReport.deleteMany({ patientId: req.params.id });
    await Visit.deleteMany({ patientId: req.params.id });
    res.json({ success: true, message: 'Patient deleted' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update a lab report file (image)
const updateLabReportFile = async (req, res) => {
  try {
    const reportId = req.params.reportId;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    // Store file in GridFS
    const bucket = getGridFSBucket();
    let result = null;
    const uploadStream = bucket.openUploadStream(file.originalname, { contentType: file.mimetype });
    uploadStream.end(file.buffer);
    await new Promise((resolve, reject) => {
      uploadStream.on('finish', () => {
        result = uploadStream.id;
        resolve();
      });
      uploadStream.on('error', reject);
    });
    const updatedReport = await LabReport.findByIdAndUpdate(
      reportId,
      { result },
      { new: true }
    );
    if (!updatedReport) {
      return res.status(404).json({ success: false, error: 'Lab report not found' });
    }
    res.json({ success: true, report: updatedReport });
  } catch (err) {
    console.error('Error updating lab report:', err);
    res.status(500).json({ success: false, error: 'Failed to update lab report', details: err.message });
  }
};

// Get a single patient by ID (with lab reports and visits populated)
const getPatient = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate('labReports')
      .populate('visits');
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    // Ensure image is a string
    const patientObj = patient.toObject();
    if (patientObj.image && typeof patientObj.image === 'object' && patientObj.image.toString) {
      patientObj.image = patientObj.image.toString();
    }
    res.json(patientObj);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch patient', details: error.message });
  }
};

// Get all patients
const getAllPatients = async (req, res) => {
  try {
    const patients = await Patient.find()
      .populate('labReports')
      .populate('visits')
      .sort({ createdAt: -1 });

    // No file path conversion, only return result fields
    const formattedPatients = patients.map(patient => {
      const patientObj = patient.toObject();
      const visitsVitals = (patientObj.visits || []).map(visit => visit.vitals || {});
      return {
        ...patientObj,
        visits: patientObj.visits || [],
        visitsVitals
      };
    });
    // Ensure image is a string for each patient
    const formattedPatientsWithStringImage = formattedPatients.map(p => {
      if (p.image && typeof p.image === 'object' && p.image.toString) {
        return { ...p, image: p.image.toString() };
      }
      return p;
    });
    res.json(formattedPatientsWithStringImage);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch patients',
      details: error.message
    });
  }
};


module.exports = {
  createPatient,
  updatePatient,
  addVisit,
  updateVisit,
  addLabReport,
  deleteLabReport,
  downloadLabReport,
  deletePatient,
  updateLabReportFile,
  getAllPatients,
  getPatient
};
