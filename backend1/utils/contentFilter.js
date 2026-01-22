/**
 * Content Filter Utility
 * Removes boilerplate metadata sections before quiz generation
 * Prevents AI from generating questions about: preface, foreword, TOC, etc.
 */

/**
 * Remove boilerplate metadata sections from text
 * @param {string} text - Full document text
 * @returns {string} Cleaned text without boilerplate
 */
function removeBoilerplateSections(text) {
  if (!text) return '';

  // Patterns for common boilerplate sections to remove
  const boilerplatePatterns = [
    // Preface, Foreword, Acknowledgements
    /^(preface|foreword|acknowledgement|acknowledgments?)\s*\n[^\n]*(?:\n(?!^(introduction|chapter|section|\d+\.|[A-Z][a-z]+\s+(and|&)\s+|table\s+of|abstract|overview|aims?|learning|about)).*?(?=\n(introduction|chapter|section|\d+\.|[A-Z][a-z]+\s+(and|&)\s+)|$))?/gim,

    // Table of Contents
    /^table\s+of\s+contents?\s*\n[^\n]*(?:\n(?!^(introduction|chapter|section|\d+\.|[A-Z][a-z]+\s+(and|&))).*?){0,100}(?=\n\n|introduction|chapter|section)/gim,

    // Abstract (at beginning)
    /^abstract\s*\n[^\n]*(?:\n(?!^(introduction|overview)).*?){0,20}(?=\n\n|introduction|overview)/gim,

    // About the Author/Editor sections
    /^about\s+(?:the\s+)?(author|editor|contributors?|writer|publisher)\s*\n[^\n]*(?:\n(?!^(introduction|chapter)).*?){0,10}(?=\n\n|introduction|chapter)/gim,

    // Learning Outcomes (too generic)
    /^(?:learning\s+)?outcomes?\s*\n[^\n]*(?:\n\s*[-•*]\s+[^\n]*){0,15}(?=\n\n|introduction|chapter)/gim,

    // Aims and Objectives (too generic)
    /^(?:aims?\s+)?(?:and\s+)?objectives?\s*\n[^\n]*(?:\n\s*[-•*]\s+[^\n]*){0,15}(?=\n\n|introduction|chapter)/gim,

    // Overview (usually metadata)
    /^overview\s*\n[^\n]*(?:\n(?!^(introduction|chapter|section)).*?){0,10}(?=\n\n|introduction|chapter|section)/gim,

    // Metadata at end of document
    /\n(?:copyright|©|all rights reserved|isbn|publisher|printed|first published)[^\n]*(?:\n.*?){0,5}$/gim,

    // References/Bibliography/Index at end
    /\n(?:references?|bibliography|index|appendix|appendices)\s*\n[^\n]*(?:\n[^\n]*)*$/gim,
  ];

  let cleaned = text;

  // Apply each pattern
  boilerplatePatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '\n');
  });

  // Clean up excessive newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}

/**
 * Extract main content section (Introduction to end, or first substantial chapter)
 * @param {string} text - Full document text
 * @returns {string} Main content only
 */
function extractMainContent(text) {
  if (!text) return '';

  // Find where main content likely starts
  const mainContentMarkers = [
    /^introduction\s*\n/gim,
    /^chapter\s+1\s*\n/gim,
    /^1\s+(?:introduction|overview|background)\s*\n/gim,
    /^1\.\s/gm,
  ];

  let startIndex = 0;
  for (const pattern of mainContentMarkers) {
    const match = text.match(pattern);
    if (match) {
      startIndex = match.index;
      break;
    }
  }

  // Find where main content typically ends
  const endMarkers = [
    /\n(?:references?|bibliography|appendix|index|conclusion)\s*\n/gim,
    /\n©.*?(?:\n|$)/gim,
  ];

  let endIndex = text.length;
  for (const pattern of endMarkers) {
    const match = text.match(pattern);
    if (match) {
      endIndex = match.index;
      break;
    }
  }

  const mainContent = text.substring(startIndex, endIndex);
  return mainContent.trim();
}

/**
 * Filter content for quiz generation
 * Removes boilerplate and extracts main content
 * @param {string} text - Full document text
 * @returns {object} { cleaned: string, extracted: string, removed_sections: array }
 */
function filterContentForQuizGeneration(text) {
  if (!text) {
    return {
      cleaned: '',
      extracted: '',
      removed_sections: [],
    };
  }

  const original = text;
  
  // Step 1: Remove boilerplate
  const cleaned = removeBoilerplateSections(text);
  
  // Step 2: Extract main content
  const extracted = extractMainContent(cleaned);

  // Calculate what was removed
  const removed_sections = [];
  if (original.length - cleaned.length > 100) {
    removed_sections.push('boilerplate_sections');
  }
  if (original !== extracted) {
    removed_sections.push('metadata_and_references');
  }

  return {
    cleaned,
    extracted,
    removed_sections,
  };
}

/**
 * Check if a section title is boilerplate (should not generate questions from it)
 * @param {string} title - Section title
 * @returns {boolean} True if boilerplate
 */
function isBoilerplateSection(title) {
  const boilerplateTerms = [
    'preface',
    'foreword',
    'acknowledgement',
    'acknowledgment',
    'table of contents',
    'abstract',
    'about the author',
    'about the authors',
    'about the editor',
    'learning outcomes',
    'learning objectives',
    'aims and objectives',
    'course objectives',
    'overview',
    'introduction',
    'bibliography',
    'references',
    'index',
    'appendix',
    'copyright',
  ];

  const normalizedTitle = title.toLowerCase().trim();
  return boilerplateTerms.some(term => normalizedTitle.includes(term));
}

module.exports = {
  removeBoilerplateSections,
  extractMainContent,
  filterContentForQuizGeneration,
  isBoilerplateSection,
};
