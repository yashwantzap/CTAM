import type { Vulnerability } from "@shared/schema";

const CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const CISA_FETCH_TIMEOUT_MS = 30000;
const CISA_MAX_RETRIES = 3;
const CISA_RETRY_DELAY_MS = 1000;

interface CISAVulnerability {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  shortDescription: string;
  dateAdded: string;
  dueDate: string;
  requiredAction: string;
  knownRansomwareCampaignUse: string;
  notes: string;
  cwes?: string[];
}

interface CISAFeedResponse {
  title: string;
  catalogVersion: string;
  dateReleased: string;
  count: number;
  vulnerabilities: CISAVulnerability[];
}

// Fetch KEV data from CISA with retry logic
async function fetchWithRetry(retryCount = 0): Promise<Vulnerability[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CISA_FETCH_TIMEOUT_MS);

    const response = await fetch(CISA_KEV_URL, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "CTAM-System/1.0"
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status >= 500 && retryCount < CISA_MAX_RETRIES) {
        console.warn(`CISA API returned ${response.status}, retrying (attempt ${retryCount + 1}/${CISA_MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, CISA_RETRY_DELAY_MS * (retryCount + 1)));
        return fetchWithRetry(retryCount + 1);
      }
      throw new Error(`CISA API returned ${response.status}`);
    }

    const data: CISAFeedResponse = await response.json();

    return data.vulnerabilities.map((vuln, index) => ({
      id: `vuln-${index}-${vuln.cveID}`,
      cveId: vuln.cveID,
      vendorProject: vuln.vendorProject,
      product: vuln.product,
      vulnerabilityName: vuln.vulnerabilityName,
      shortDescription: vuln.shortDescription,
      dateAdded: vuln.dateAdded,
      dueDate: vuln.dueDate,
      requiredAction: vuln.requiredAction,
      knownRansomwareCampaignUse: vuln.knownRansomwareCampaignUse,
      notes: vuln.notes || "",
      cwes: vuln.cwes || []
    }));
  } catch (error) {
    if (retryCount < CISA_MAX_RETRIES) {
      console.warn(
        `Error fetching CISA KEV data: ${error instanceof Error ? error.message : String(error)}, retrying...`
      );
      await new Promise((resolve) => setTimeout(resolve, CISA_RETRY_DELAY_MS * (retryCount + 1)));
      return fetchWithRetry(retryCount + 1);
    }

    console.error(`Failed to fetch CISA KEV data after ${CISA_MAX_RETRIES} retries:`, error);
    throw error;
  }
}

export async function fetchCISAKevData(): Promise<Vulnerability[]> {
  return fetchWithRetry();
}

// Get vulnerability by CVE ID
export function findVulnerabilityByCveId(
  vulnerabilities: Vulnerability[],
  cveId: string
): Vulnerability | null {
  return vulnerabilities.find(v => 
    v.cveId.toLowerCase() === cveId.toLowerCase()
  ) || null;
}

// Get recent vulnerabilities (last N days)
export function getRecentVulnerabilities(
  vulnerabilities: Vulnerability[],
  days: number = 30
): Vulnerability[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return vulnerabilities.filter(v => {
    const dateAdded = new Date(v.dateAdded);
    return dateAdded >= cutoffDate;
  }).sort((a, b) => 
    new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
  );
}

// Get vulnerabilities with ransomware usage
export function getRansomwareVulnerabilities(
  vulnerabilities: Vulnerability[]
): Vulnerability[] {
  return vulnerabilities.filter(v => 
    v.knownRansomwareCampaignUse?.toLowerCase() === "known"
  );
}

// Get vulnerabilities by vendor
export function getVulnerabilitiesByVendor(
  vulnerabilities: Vulnerability[],
  vendor: string
): Vulnerability[] {
  return vulnerabilities.filter(v => 
    v.vendorProject.toLowerCase().includes(vendor.toLowerCase())
  );
}
