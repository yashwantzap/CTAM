import natural from 'natural';

const TfIdf = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

// Store the trained TF-IDF model and vocabulary
let tfidf: natural.TfIdf | null = null;
let vocabulary: string[] = [];
let idfWeights: Map<string, number> = new Map();

// Fixed number of TF-IDF features
export const TFIDF_FEATURE_COUNT = 50;

// Security-related keywords to prioritize in vocabulary
const SECURITY_KEYWORDS = [
  'remote', 'code', 'execution', 'rce', 'buffer', 'overflow',
  'sql', 'injection', 'xss', 'cross', 'site', 'scripting',
  'privilege', 'escalation', 'authentication', 'bypass',
  'denial', 'service', 'dos', 'arbitrary', 'memory', 'corruption',
  'heap', 'stack', 'use', 'after', 'free', 'uaf',
  'information', 'disclosure', 'path', 'traversal', 'command',
  'deserialization', 'unsafe', 'vulnerability', 'exploit', 'malicious'
];

// Preprocess text for TF-IDF
function preprocessText(text: string): string[] {
  if (!text) return [];
  
  // Convert to lowercase
  let processed = text.toLowerCase();
  
  // Remove special characters but keep spaces
  processed = processed.replace(/[^a-z0-9\s]/g, ' ');
  
  // Tokenize and stem
  const tokens = tokenizer.tokenize(processed) || [];
  const stemmed = tokens
    .filter(token => token.length > 2) // Filter short words
    .map(token => stemmer.stem(token));
  
  return stemmed;
}

// Build TF-IDF model from vulnerability descriptions
export function buildTfidfModel(descriptions: string[]): void {
  // Guard against empty corpus
  if (!descriptions || descriptions.length === 0) {
    console.log('No documents provided for TF-IDF model, skipping build');
    tfidf = null;
    vocabulary = [];
    idfWeights = new Map();
    return;
  }
  
  tfidf = new TfIdf();
  idfWeights = new Map();
  
  // Add all documents to the corpus
  const processedDocs: string[][] = [];
  descriptions.forEach(desc => {
    const tokens = preprocessText(desc);
    processedDocs.push(tokens);
    tfidf!.addDocument(tokens.join(' '));
  });
  
  // Calculate term frequencies across all documents
  const termDocCounts: Map<string, number> = new Map();
  const allTerms: Set<string> = new Set();
  
  processedDocs.forEach(tokens => {
    const uniqueTokens = new Set(tokens);
    uniqueTokens.forEach(token => {
      allTerms.add(token);
      termDocCounts.set(token, (termDocCounts.get(token) || 0) + 1);
    });
  });
  
  // Calculate IDF weights for all terms
  const numDocs = descriptions.length;
  allTerms.forEach(term => {
    const docCount = termDocCounts.get(term) || 1;
    const idf = Math.log(numDocs / docCount) + 1; // Smoothed IDF
    idfWeights.set(term, idf);
  });
  
  // Build vocabulary: prioritize security keywords, then by document frequency
  const securityTermsStemmed = SECURITY_KEYWORDS.map(k => stemmer.stem(k));
  
  // Start with security keywords that appear in the corpus
  const vocabSet: Set<string> = new Set();
  securityTermsStemmed.forEach(term => {
    if (allTerms.has(term) && vocabSet.size < TFIDF_FEATURE_COUNT) {
      vocabSet.add(term);
    }
  });
  
  // Fill remaining slots with most common terms (by document frequency)
  const sortedByFreq = Array.from(termDocCounts.entries())
    .filter(([term]) => !vocabSet.has(term))
    .sort((a, b) => b[1] - a[1]);
  
  for (const [term] of sortedByFreq) {
    if (vocabSet.size >= TFIDF_FEATURE_COUNT) break;
    vocabSet.add(term);
  }
  
  // Convert to array - always exactly TFIDF_FEATURE_COUNT terms
  vocabulary = Array.from(vocabSet).slice(0, TFIDF_FEATURE_COUNT);
  
  // Pad vocabulary if needed (unlikely but safe)
  while (vocabulary.length < TFIDF_FEATURE_COUNT) {
    vocabulary.push(`_pad_${vocabulary.length}`);
  }
  
  console.log(`TF-IDF model built with ${vocabulary.length} vocabulary terms from ${numDocs} documents`);
}

// Extract TF-IDF features from a single text using the trained corpus
export function extractTfidfFeatures(text: string): number[] {
  if (!tfidf || vocabulary.length === 0) {
    // Return zero vector if model not built
    return new Array(TFIDF_FEATURE_COUNT).fill(0);
  }
  
  const tokens = preprocessText(text);
  if (tokens.length === 0) {
    return new Array(TFIDF_FEATURE_COUNT).fill(0);
  }
  
  // Calculate term frequencies for this document
  const termFreq: Map<string, number> = new Map();
  tokens.forEach(token => {
    termFreq.set(token, (termFreq.get(token) || 0) + 1);
  });
  
  // Calculate TF-IDF for vocabulary terms using corpus IDF weights
  const features: number[] = vocabulary.map(term => {
    const tf = termFreq.get(term) || 0;
    const idf = idfWeights.get(term) || 1;
    return tf * idf;
  });
  
  // L2 normalize features
  const magnitude = Math.sqrt(features.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    return features.map(f => f / magnitude);
  }
  
  return features;
}

// Get feature names for interpretation
export function getTfidfFeatureNames(): string[] {
  return vocabulary.map(term => `tfidf_${term}`);
}

// Check if model is ready
export function isTfidfModelReady(): boolean {
  return tfidf !== null && vocabulary.length === TFIDF_FEATURE_COUNT;
}

// Get vocabulary size (always TFIDF_FEATURE_COUNT when model is ready)
export function getVocabularySize(): number {
  return vocabulary.length;
}

// Reset TF-IDF model
export function resetTfidfModel(): void {
  tfidf = null;
  vocabulary = [];
  idfWeights = new Map();
}
