import OpenAI from "openai";

// Lazy-loaded OpenAI client to avoid startup errors when API key is not set
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  
  return openaiClient;
}

// Generate mitigation plan using OpenAI
export async function generateMitigationPlan(
  cveId: string,
  vulnerabilityName: string,
  description: string,
  riskLevel: string,
  probability: number
): Promise<{
  urgency: string;
  mitigation: string;
  steps: string[];
}> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    console.log("OpenAI API key not set, using fallback mitigation");
    return generateFallbackMitigation(riskLevel);
  }
  
  try {
    const prompt = `You are a cybersecurity expert. Analyze this vulnerability and provide a detailed mitigation plan.

Vulnerability: ${cveId}
Name: ${vulnerabilityName}
Description: ${description}
Risk Level: ${riskLevel}
Confidence: ${(probability * 100).toFixed(1)}%

Provide a JSON response with the following structure:
{
  "urgency": "Immediate" | "High" | "Medium" | "Low",
  "mitigation": "A clear, concise summary of the recommended mitigation strategy",
  "steps": ["Step 1...", "Step 2...", "Step 3...", "Step 4..."]
}

Focus on practical, actionable steps that security teams can implement immediately.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a cybersecurity threat analyst. Always respond with valid JSON only, no markdown."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || "{}";
    let parsed: any;

    try {
      if (!content || typeof content !== "string") {
        throw new Error("Invalid response content");
      }
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse OpenAI JSON response:", parseError);
      return generateFallbackMitigation(riskLevel);
    }

    return {
      urgency: typeof parsed.urgency === "string" ? parsed.urgency : "Medium",
      mitigation: typeof parsed.mitigation === "string" ? parsed.mitigation : "Apply vendor patches and monitor for suspicious activity.",
      steps: Array.isArray(parsed.steps) && parsed.steps.every((s: any) => typeof s === "string")
        ? parsed.steps
        : [
            "Review vendor security advisory",
            "Test patches in staging environment",
            "Apply patches to production systems",
            "Monitor for exploitation attempts"
          ]
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    // Fallback to rule-based mitigation
    return generateFallbackMitigation(riskLevel);
  }
}

// Generate mitigation plan for custom vulnerability
export async function generateCustomMitigationPlan(
  name: string,
  description: string,
  riskLevel: string,
  probability: number
): Promise<{
  urgency: string;
  summary: string;
  steps: string[];
}> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    console.log("OpenAI API key not set, using fallback mitigation");
    const fallback = generateFallbackMitigation(riskLevel);
    return {
      urgency: fallback.urgency,
      summary: fallback.mitigation,
      steps: fallback.steps
    };
  }
  
  try {
    const prompt = `You are a cybersecurity expert. Analyze this custom vulnerability and provide a detailed mitigation plan.

Vulnerability Name: ${name}
Description: ${description}
Risk Level: ${riskLevel}
Confidence: ${(probability * 100).toFixed(1)}%

Provide a JSON response with the following structure:
{
  "urgency": "Immediate" | "High" | "Medium" | "Low",
  "summary": "A clear, concise summary of the recommended mitigation strategy",
  "steps": ["Step 1...", "Step 2...", "Step 3...", "Step 4..."]
}

Focus on practical, actionable steps that security teams can implement immediately.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a cybersecurity threat analyst. Always respond with valid JSON only, no markdown."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || "{}";
    let parsed: any;

    try {
      if (!content || typeof content !== "string") {
        throw new Error("Invalid response content");
      }
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse OpenAI JSON response:", parseError);
      const fallback = generateFallbackMitigation(riskLevel);
      return {
        urgency: fallback.urgency,
        summary: fallback.mitigation,
        steps: fallback.steps
      };
    }

    return {
      urgency: typeof parsed.urgency === "string" ? parsed.urgency : "Medium",
      summary: typeof parsed.summary === "string" ? parsed.summary : "Apply security best practices and monitor for suspicious activity.",
      steps: Array.isArray(parsed.steps) && parsed.steps.every((s: any) => typeof s === "string")
        ? parsed.steps
        : [
            "Identify affected systems",
            "Apply vendor patches or workarounds",
            "Implement monitoring",
            "Document remediation"
          ]
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    const fallback = generateFallbackMitigation(riskLevel);
    return {
      urgency: fallback.urgency,
      summary: fallback.mitigation,
      steps: fallback.steps
    };
  }
}

// Fallback mitigation when AI is unavailable
function generateFallbackMitigation(riskLevel: string): {
  urgency: string;
  mitigation: string;
  steps: string[];
} {
  const urgencyMap: Record<string, string> = {
    High: "Immediate",
    Medium: "High",
    Low: "Medium"
  };

  const stepsMap: Record<string, string[]> = {
    High: [
      "Immediately isolate affected systems from the network",
      "Apply emergency patches or disable vulnerable services",
      "Review vendor security advisories and apply all recommended fixes",
      "Implement network segmentation to limit exposure",
      "Enable enhanced logging and monitoring on affected systems",
      "Conduct a threat hunt for indicators of compromise",
      "Notify security operations center and incident response team"
    ],
    Medium: [
      "Schedule patching within the next maintenance window",
      "Review vendor security advisories for available updates",
      "Test patches in non-production environment first",
      "Implement compensating controls if immediate patching is not possible",
      "Monitor for suspicious activity on affected systems",
      "Document remediation actions in the change management system"
    ],
    Low: [
      "Add to regular patching schedule",
      "Review vendor security advisories",
      "Test patches in staging environment",
      "Apply patches during next maintenance cycle",
      "Monitor security bulletins for updates",
      "Document in vulnerability management system"
    ]
  };

  return {
    urgency: urgencyMap[riskLevel] || "Medium",
    mitigation: `Apply security patches and implement compensating controls for this ${riskLevel.toLowerCase()}-risk vulnerability. Review vendor advisories and prioritize remediation based on asset criticality.`,
    steps: stepsMap[riskLevel] || stepsMap["Medium"]
  };
}
