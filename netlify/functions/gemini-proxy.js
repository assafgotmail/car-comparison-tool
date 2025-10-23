// This is our secure backend function.
// It runs on Netlify's servers, not in the user's browser.

exports.handler = async (event) => {
    // 1. Get the user's query from the frontend
    const { userQuery } = JSON.parse(event.body);

    // 2. Get the *secret* API key from Netlify's secure environment
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API key is not set up." }),
        };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    const systemPrompt = `You are an automotive data assistant. The user will provide a car make and model. Find the most accurate, up-to-date information for the Netherlands market using Google Search. 
Return *only* a valid JSON object matching this exact structure:
{
  "price": 12345,
  "range": 450,
  "link": "https://www.example.nl",
  "features": {
    "physicalAC": { "available": "true"|"false"|"trim", "note": "Standard" },
    "wirelessCarPlay": { "available": "true"|"false"|"trim", "note": "On Comfort trim" },
    "wirelessCharging": { "available": "true"|"false"|"trim", "note": "Not available" },
    "driverDisplay": { "available": "true"|"false"|"trim", "note": "Standard" },
    "hud": { "available": "true"|"false"|"trim", "note": "Premium pack" },
    "sunroof": { "available": "true"|"false"|"trim", "note": "Premium pack" }
  }
}
Do not include \`\`\`json markdown wrappers or any other text before or after the JSON object.`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        tools: [{ "google_search": {} }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        }
    };

    try {
        // 3. Call the *real* Google API from the secure backend
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Google API error: ${response.statusText}`);
        }

        const result = await response.json();
        let jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!jsonText) {
             throw new Error("No valid content returned from API.");
        }
        
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        const carInfo = JSON.parse(jsonText);

        // 4. Send the *clean JSON result* back to the frontend
        return {
            statusCode: 200,
            body: JSON.stringify(carInfo),
        };

    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
