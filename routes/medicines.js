const router = require('express').Router();
const { Medicine, MedicineOrder } = require('../models/Medicine');
const auth = require('../middleware/auth');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// GET /api/medicines
router.get('/', auth, async (req, res) => {
  try {
    const medicines = await Medicine.find().populate('hospitalId', 'name email phone address x y');
    res.json({ medicines });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/medicines/order
router.post('/order', auth, async (req, res) => {
  try {
    const { 
      items, 
      address, 
      payment, 
      hasPrescription, 
      prescriptionImage, 
      prescriptionDoctor, 
      prescriptionDate, 
      prescriptionPatient, 
      prescriptionMedicine 
    } = req.body;

    if (!items || !items.length) return res.status(400).json({ error: 'Cart is empty' });
    if (!address) return res.status(400).json({ error: 'Delivery address required' });

    if (hasPrescription) {
      if (!prescriptionImage) {
        return res.status(400).json({ error: 'Prescription image is required when purchasing with prescription' });
      }
    }

    // Validate stock and deduct
    let total = 0;
    const orderItems = [];
    let hospitalId = null;

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const med = await Medicine.findById(item.medicineId);
      if (!med) return res.status(404).json({ error: `Medicine ${item.medicineId} not found` });
      if (med.stock < item.quantity)
        return res.status(400).json({ error: `Insufficient stock for ${med.name}` });

      if (idx === 0) {
        hospitalId = med.hospitalId;
      }

      med.stock -= item.quantity;
      await med.save();

      total += med.price * item.quantity;
      orderItems.push({ medicine: med._id, name: med.name, price: med.price, quantity: item.quantity });
    }

    const order = await MedicineOrder.create({
      user: req.user._id,
      items: orderItems,
      total,
      address,
      payment: payment || 'COD',
      hospitalId,
      hasPrescription: !!hasPrescription,
      prescriptionImage: hasPrescription ? prescriptionImage : undefined,
      prescriptionDoctor: hasPrescription ? prescriptionDoctor : undefined,
      prescriptionDate: hasPrescription ? prescriptionDate : undefined,
      prescriptionPatient: hasPrescription ? prescriptionPatient : undefined,
      prescriptionMedicine: hasPrescription ? prescriptionMedicine : undefined,
    });

    res.status(201).json({ order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/medicines/orders  – my orders
router.get('/orders', auth, async (req, res) => {
  try {
    const orders = await MedicineOrder.find({ user: req.user._id }).populate('hospitalId').sort('-createdAt');
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/medicines/parse-prescription
router.post('/parse-prescription', auth, async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No prescription image provided' });
    }

    // Check if Gemini API key is configured
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "" || apiKey.startsWith("YOUR_")) {
      return res.status(400).json({ 
        error: "Google Gemini API key is not configured. Please add a valid GEMINI_API_KEY to your .env file." 
      });
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const base64Matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!base64Matches || base64Matches.length !== 3) {
        return res.status(400).json({ error: "Invalid base64 image format" });
      }

      const mimeType = base64Matches[1];
      const base64Data = base64Matches[2];

      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType
        }
      };

      const todayStr = new Date().toISOString().split('T')[0];
      const userName = req.user ? req.user.name : "";

      const prompt = `
        You are an expert clinical medical prescription parser. Analyze the uploaded medical prescription image.
        Identify and extract the following details in a clean structured format:
        1. Doctor details (credentials like MD/MBBS, clinic name) and Registration Number if visible. If not visible, return "".
        2. Date of prescription in standard YYYY-MM-DD format. If not found, return "${todayStr}".
        3. Patient name if visible. If not visible, return "${userName}".
        4. Prescribed Medicines: Extract a clean array of medicine names mentioned in the prescription. Look closely for active ingredients (e.g. Paracetamol, Azithromycin, Cough Syrup, Insulin, Amoxicillin, Omeprazole, Ibuprofen, Atorvastatin, Metformin, Lisinopril, Albuterol Inhaler, Pantoprazole, Cetirizine, Montelukast, etc.).

        Format your response as a valid JSON object ONLY. Do not wrap in markdown or backticks (e.g. do NOT include \`\`\`json). The response must conform to this schema:
        {
          "doctor": "extracted doctor name and reg no details or empty string",
          "date": "YYYY-MM-DD",
          "patient": "extracted patient name or empty string",
          "medicines": ["Medicine1", "Medicine2"]
        }
      `;

      const result = await model.generateContent([prompt, imagePart]);
      const responseText = result.response.text().trim();
      
      let cleanJsonStr = responseText;
      if (cleanJsonStr.startsWith("```")) {
        cleanJsonStr = cleanJsonStr.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }

      const parsed = JSON.parse(cleanJsonStr);
      if (!parsed) {
        throw new Error("Failed to parse AI response as JSON");
      }

      const doctor = parsed.doctor || "";
      const date = parsed.date || todayStr;
      const patient = parsed.patient || userName;
      const medicines = parsed.medicines || [];

      // Check medicine stock in database
      const matchedMeds = [];
      const outOfStockMeds = [];

      for (const name of medicines) {
        const med = await Medicine.findOne({ name: new RegExp('^' + name.trim() + '$', 'i') });
        if (med) {
          const itemInfo = {
            id: med._id,
            name: med.name,
            price: med.price,
            stock: med.stock
          };
          if (med.stock > 0) {
            matchedMeds.push(itemInfo);
          } else {
            outOfStockMeds.push({ name: med.name, reason: 'Out of Stock' });
          }
        } else {
          outOfStockMeds.push({ name: name, reason: 'Not in Catalog' });
        }
      }

      res.json({
        success: true,
        usingGemini: true,
        data: {
          doctor,
          date,
          patient,
          medicineText: medicines.join(', '),
          matchedMedicines: matchedMeds,
          outOfStockMedicines: outOfStockMeds
        }
      });

    } catch (geminiError) {
      console.error("⚠️ Gemini API Call failed:", geminiError);
      res.status(500).json({ 
        error: `Google Gemini AI parsing failed: ${geminiError.message}. Please verify your API key and connection.` 
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
