const router = require('express').Router();
const auth = require('../middleware/auth');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// POST /api/ai/symptom-check
router.post('/symptom-check', auth, async (req, res) => {
  try {
    const { symptoms, age, gender } = req.body;

    if (!symptoms || symptoms.trim() === "") {
      return res.status(400).json({ error: "Please describe your symptoms." });
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

      const prompt = `
        You are an advanced clinical medical AI assistant designed to help patients understand their symptoms.
        Analyze the patient's symptoms described below, considering their demographic details if provided.

        Patient Symptoms: "${symptoms}"
        Patient Age: ${age || 'Not specified'}
        Patient Gender: ${gender || 'Not specified'}

        Provide a structured, helpful, and safe medical analysis. You MUST return your response as a valid JSON object ONLY. 
        Do not wrap in markdown code blocks or backticks (e.g. do NOT include \`\`\`json). 
        The JSON object must strictly conform to this schema:

        {
          "condition_analysis": "A concise (2-3 sentences) clinical overview of what these symptoms might indicate, written in patient-friendly, reassuring, yet professional language.",
          "risk_level": "Low" or "Medium" or "High",
          "symptoms_reported": "A comprehensive summary confirming and discussing the exact symptoms the patient reported, and their typical timeline/severity.",
          "underlying_causes": "A detailed explanation of the physiological, environmental, or trigger-based causes of these specific symptoms.",
          "possible_diseases": [
            "Disease/Condition name: Explanatory note of how it relates to these symptoms"
          ],
          "prevention_strategies": [
            "Preventive measure/action 1 to avoid recurrence or worsening of the suspected conditions.",
            "Preventive measure/action 2 to avoid recurrence or worsening of the suspected conditions."
          ],
          "recommended_specialties": [
            "SpecializationName1"
          ],
          "suggested_tests": [
            "TestName1"
          ],
          "suggested_medications": [
            "MedicationName1"
          ],
          "medicine_clinical_notes": "Clear advice outlining what medicine is appropriate, how they work for these symptoms, and critical warnings about safe usage.",
          "red_flags": "List critical warning signs that require immediate emergency room visit (e.g. chest pain, breathing trouble, sudden numbness) if relevant to the symptoms, otherwise an empty string. Keep it concise.",
          "self_care": [
            "Safe, conservative self-care measure 1",
            "Safe, conservative self-care measure 2"
          ]
        }

        Constraints:
        1. "risk_level" must be exactly "Low", "Medium", or "High". High is for severe, life-threatening symptoms.
        2. "recommended_specialties" MUST be chosen from the following exact categories if matching:
           - "Cardiology" (for heart, chest pain, pulse issues)
           - "Dermatology" (for skin rashes, moles, acne, hairfall)
           - "Neurology" (for severe migraines, chronic dizziness, numbness, seizures)
           - "Orthopedics" (for bone fracture, severe joint pain, sprains)
           - "General" (for fevers, common cold, minor stomach issues, general checkups)
           - "ENT" (for ear, nose, throat, sinusitis, hearing issues)
           - "Pediatrics" (for infant or child-related complaints if patient age is under 18)
        3. "suggested_tests" should choose the most relevant items from this exact catalog list:
           - "Blood Test", "Full Body Checkup", "Diabetes Test", "Thyroid Test", "Dengue Test", "Malaria Test", "Cancer Test", "Hairfall Test", "Vitamin Deficiency Test", "Heart Disease Test", "Liver Function Test", "Kidney Function Test", "Hormones Test"
        4. "suggested_medications" should choose the most relevant over-the-counter or common items from this exact catalog list:
           - "Paracetamol", "Azithromycin", "Cough Syrup", "Vitamin D", "Insulin", "Amoxicillin", "Omeprazole", "Ibuprofen", "Atorvastatin", "Metformin", "Lisinopril", "Albuterol Inhaler", "Pantoprazole", "Cetirizine", "Montelukast", "Daily Multivitamin"
      `;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();
      
      let cleanJsonStr = responseText;
      if (cleanJsonStr.startsWith("```")) {
        cleanJsonStr = cleanJsonStr.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }

      let parsed;
      try {
        parsed = JSON.parse(cleanJsonStr);
      } catch (parseError) {
        console.error("JSON parsing failed for text:", responseText);
        throw new Error("The AI response was not in a valid JSON structure.");
      }

      res.json({
        success: true,
        data: parsed
      });

    } catch (geminiError) {
      console.error("⚠️ Gemini API Call failed:", geminiError);
      res.status(500).json({ 
        error: `Google Gemini AI analysis failed: ${geminiError.message}. Please verify your API key and connection.` 
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
