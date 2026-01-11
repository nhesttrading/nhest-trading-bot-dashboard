import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

const getAI = () => {
    // Use Vite's standard import.meta.env for client-side variables
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!ai && apiKey) {
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
};

export const analyzeMarket = async (symbol: string, price: number, bias: string, trendStatus: string): Promise<string> => {
    const client = getAI();
    if (!client) {
        return "Gemini API Key not configured. AI Analysis unavailable.";
    }

    try {
        const prompt = `
            You are a senior institutional trading analyst.
            Analyze the following market state for ${symbol}:
            - Current Price: ${price}
            - System Bias: ${bias}
            - Strategy Status: ${trendStatus}

            Provide a concise, 2-sentence tactical assessment. 
            Is the current logic aligned with macro sentiment? 
            Use professional trading terminology.
        `;

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash-preview-09-2025',
            contents: prompt,
        });

        return response.text || "Analysis incomplete.";
    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        return "Neural Net connection interrupted. AI Analysis unavailable.";
    }
};

export const analyzePortfolioRisk = async (positions: any[], riskSettings: any): Promise<string> => {
    const client = getAI();
    if (!client) return "Gemini API Key not configured. Risk Audit unavailable.";

    try {
        const prompt = `
            You are a Chief Risk Officer (CRO) for a quantitative trading desk.
            Audit the following portfolio state against parameters:

            **Global Limits:**
            - Daily Max Loss Limit: ${riskSettings.dailyMaxLoss}%
            - Max Risk Per Stack: ${riskSettings.riskPerStack}%
            - Max Simultaneous Assets: ${riskSettings.maxAssetsActive}

            **Current Positions:**
            ${positions.length > 0 ? JSON.stringify(positions.map(p => ({ 
                symbol: p.symbol, 
                type: p.type, 
                pnl: p.pnl, 
                layer: p.layer 
            })), null, 2) : "NO ACTIVE POSITIONS"}

            **Task:**
            Provide a strict risk assessment. 
            1. Identify any correlation risks (e.g., Long BTC + Long ETH).
            2. Flag over-exposure or limit breaches.
            3. Provide a clear "RISK LEVEL: LOW/MED/HIGH" rating.
            
            Keep the response concise (under 80 words) and use bullet points.
        `;

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash-preview-09-2025',
            contents: prompt,
        });

        return response.text || "Risk audit incomplete.";
    } catch (error) {
        console.error("Gemini Risk Error:", error);
        return "Neural Net connection interrupted during risk audit.";
    }
};