const express = require("express");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const Visit = require("../models/visit.model");
const Prescription = require("../models/prescription.model");
const { Medicine } = require("../models/medicine.model");
const upload = require("../utils/multerMemory");

const router = express.Router();

// Gemini setup using API key (from .env)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post("/upload", upload.single("image"), async (req, res) => {
  const { visitId } = req.body;
  console.log('[DEBUG] /prescriptions/upload called with visitId:', visitId);

  if (!visitId) {
    return res.status(400).json({ error: "visitId is required" });
  }

  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    let mimeType = req.file.mimetype;
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (req.file.originalname.match(/\.jpe?g$/i)) mimeType = 'image/jpeg';
      else if (req.file.originalname.match(/\.png$/i)) mimeType = 'image/png';
    }

    console.log('[DEBUG] mimetype:', mimeType);
    console.log('[DEBUG] originalname:', req.file.originalname);

    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: mimeType,
      }
    };

    const prompt = `You are a medical assistant trained to read handwritten prescriptions. Extract the medicines from the following doctor's handwritten note and convert them into clean JSON. Interpret dosage patterns like 1-0-1 as:

1-0-1 → "Morning and night"

1-0-0 → "Morning only"

0-0-1 → "Night only"

1-1-1 → "Morning, afternoon and night"

Also include whether each medicine should be taken before or after meals if specified. For ointments, mouth gels, or external use, include "application method" like "Massage on gums". Keep the "dosage" field blank if not mentioned.
[
  {
    "name": "Medicine name",
    "dosage": "Dosage",
    "duration": "How long to take",
    "instructions": "How/when to take"
  }
]

Follow these rules strictly:

Include only medicines (ignore patient names, dates, doctor names, contact info).

If dosage or duration is not mentioned, leave the field as an empty string ("").

Standardize timings like:

"before meals", "after meals", "once a day", "twice a day", "three times daily", "at night", etc.

Use terms like "morning", "noon", "night" if dosage timing is written as 1-0-1.

Do not return any explanation or extra text—only the valid JSON array.

Your goal: interpret and normalize even messy handwriting or medical shorthand (like "TID", "OD", "1 tab BID", etc.).`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [imagePart, { text: prompt }]
        }
      ]
    });

    const responseText = await result.response.text();
    console.log('[DEBUG] Gemini response.text:', responseText);

    let parsedPrescriptions;
    try {
      let cleanText = responseText.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
      }
      parsedPrescriptions = JSON.parse(cleanText);
      console.log('[DEBUG] Parsed prescriptions:', parsedPrescriptions);
    } catch (e) {
      console.error('[DEBUG] Failed to parse Gemini output as JSON:', responseText);
      return res.status(500).json({ error: "Failed to parse Gemini output as JSON", raw: responseText });
    }

    const visit = await Visit.findById(visitId);
    if (!visit) {
      console.error('[DEBUG] Visit not found for visitId:', visitId);
      return res.status(404).json({ error: "Visit not found" });
    }

    const prescription = new Prescription({ medicines: parsedPrescriptions });
    await prescription.save();
    console.log('[DEBUG] Saved prescription:', prescription);

    visit.prescriptionId = prescription._id;
    await visit.save();
    console.log('[DEBUG] Updated visit with prescriptionId:', visit);

    res.json({ message: "Prescriptions added to visit successfully", prescriptions: parsedPrescriptions });

  } catch (err) {
    console.error('[DEBUG] Error processing prescription:', err);
    res.status(500).json({ error: "Failed to process prescription", details: err.message });
  }
});

module.exports = router;
