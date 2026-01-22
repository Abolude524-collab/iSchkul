#!/usr/bin/env node

/**
 * Test script for boilerplate content filtering
 * Tests the filterContentForQuizGeneration utility
 * 
 * Usage: node test_boilerplate_filter.js
 */

const { 
  filterContentForQuizGeneration, 
  removeBoilerplateSections, 
  extractMainContent,
  isBoilerplateSection 
} = require('./utils/contentFilter');

console.log('\n📋 BOILERPLATE FILTER TEST SUITE\n');

// Test Case 1: Document with preface and multiple sections
const testDoc1 = `
PREFACE

This book is designed for students learning advanced topics.

ACKNOWLEDGEMENTS

Special thanks to all contributors.

CHAPTER 1: INTRODUCTION

This chapter introduces the fundamental concepts of biology. The cell is the basic unit of life. 

CHAPTER 2: CELL STRUCTURE

Cells contain various organelles. The nucleus is the control center. The mitochondria is the powerhouse.

REFERENCES

Smith, J. (2020). Biology Basics.
`;

console.log('TEST 1: Document with Preface, Acknowledgements, Chapters, References');
console.log('─────────────────────────────────────────────────────────────────');
console.log(`Input length: ${testDoc1.length} characters`);

const result1 = filterContentForQuizGeneration(testDoc1);
console.log(`Output length: ${result1.extracted.length} characters`);
console.log(`Reduction: ${((1 - result1.extracted.length / testDoc1.length) * 100).toFixed(1)}%`);
console.log(`Sections removed: ${result1.removed_sections.join(', ')}`);
console.log(`\nFiltered content preview:\n${result1.extracted.substring(0, 200)}...\n`);

// Test Case 2: Document with learning outcomes
const testDoc2 = `
LEARNING OUTCOMES

After reading this chapter, students will be able to:
- Understand photosynthesis
- Explain cellular respiration
- Compare and contrast both processes

INTRODUCTION TO PHOTOSYNTHESIS

Photosynthesis is the process by which plants convert light energy into chemical energy.
The equation for photosynthesis is: 6CO2 + 6H2O → C6H12O6 + 6O2

CELLULAR RESPIRATION

Cellular respiration is the process that cells use to break down glucose.
This process releases energy in the form of ATP.
`;

console.log('TEST 2: Document with Learning Outcomes');
console.log('─────────────────────────────────────────');
console.log(`Input length: ${testDoc2.length} characters`);

const result2 = filterContentForQuizGeneration(testDoc2);
console.log(`Output length: ${result2.extracted.length} characters`);
console.log(`Reduction: ${((1 - result2.extracted.length / testDoc2.length) * 100).toFixed(1)}%`);
console.log(`Sections removed: ${result2.removed_sections.join(', ')}`);
console.log(`\nFiltered content preview:\n${result2.extracted.substring(0, 200)}...\n`);

// Test Case 3: Table of Contents
const testDoc3 = `
TABLE OF CONTENTS

1. Introduction ........................ 1
2. Basic Concepts ..................... 5
3. Advanced Topics ................... 12
4. Practice Problems ................. 20
5. References ........................ 25

INTRODUCTION

This guide covers fundamental programming concepts. Programming languages are tools for instructing computers.

BASIC CONCEPTS

Variables store data. Functions organize code. Loops repeat operations.
`;

console.log('TEST 3: Document with Table of Contents');
console.log('─────────────────────────────────────────');
console.log(`Input length: ${testDoc3.length} characters`);

const result3 = filterContentForQuizGeneration(testDoc3);
console.log(`Output length: ${result3.extracted.length} characters`);
console.log(`Reduction: ${((1 - result3.extracted.length / testDoc3.length) * 100).toFixed(1)}%`);
console.log(`Sections removed: ${result3.removed_sections.join(', ')}`);
console.log(`\nFiltered content preview:\n${result3.extracted.substring(0, 200)}...\n`);

// Test Case 4: About the Author
const testDoc4 = `
ABOUT THE AUTHOR

Dr. Jane Smith is a professor of chemistry with 20 years of experience. She has published over 100 papers.

CHAPTER 1: CHEMICAL BONDS

Chemical bonds are forces that hold atoms together. There are three main types: ionic, covalent, and metallic.

Ionic bonds form between metals and nonmetals. Covalent bonds form between nonmetals.
`;

console.log('TEST 4: Document with About the Author Section');
console.log('────────────────────────────────────────────────');
console.log(`Input length: ${testDoc4.length} characters`);

const result4 = filterContentForQuizGeneration(testDoc4);
console.log(`Output length: ${result4.extracted.length} characters`);
console.log(`Reduction: ${((1 - result4.extracted.length / testDoc4.length) * 100).toFixed(1)}%`);
console.log(`Sections removed: ${result4.removed_sections.join(', ')}`);
console.log(`\nFiltered content preview:\n${result4.extracted.substring(0, 200)}...\n`);

// Test Case 5: Clean document (no boilerplate)
const testDoc5 = `
CHAPTER 1: MATHEMATICS

Algebra is the branch of mathematics that deals with symbols and equations.
Linear equations have the form y = mx + b where m is the slope and b is the y-intercept.

CHAPTER 2: GEOMETRY

Geometry studies shapes and their properties.
A triangle has three sides and three angles.
The sum of angles in a triangle is always 180 degrees.
`;

console.log('TEST 5: Clean Document (No Boilerplate)');
console.log('───────────────────────────────────────');
console.log(`Input length: ${testDoc5.length} characters`);

const result5 = filterContentForQuizGeneration(testDoc5);
console.log(`Output length: ${result5.extracted.length} characters`);
console.log(`Reduction: ${((1 - result5.extracted.length / testDoc5.length) * 100).toFixed(1)}%`);
console.log(`Sections removed: ${result5.removed_sections.length === 0 ? 'None (✓ as expected)' : result5.removed_sections.join(', ')}`);
console.log(`\nFiltered content preview:\n${result5.extracted.substring(0, 200)}...\n`);

// Test Case 6: Boundary test - very short content
const testDoc6 = 'Hello world.';

console.log('TEST 6: Boundary Test - Very Short Content');
console.log('───────────────────────────────────────────');
console.log(`Input length: ${testDoc6.length} characters`);

const result6 = filterContentForQuizGeneration(testDoc6);
console.log(`Output length: ${result6.extracted.length} characters`);
console.log(`Content preserved: ${result6.extracted === testDoc6 ? '✓ Yes' : '✗ No'}\n`);

// Test Case 7: Helper function - isBoilerplateSection
console.log('TEST 7: Boilerplate Section Detection (isBoilerplateSection)');
console.log('─────────────────────────────────────────────────────────────');

const testTitles = [
  { title: 'Introduction', expected: false },
  { title: 'PREFACE', expected: true },
  { title: 'Chapter 1: The Basics', expected: false },
  { title: 'Table of Contents', expected: true },
  { title: 'Learning Outcomes', expected: true },
  { title: 'ACKNOWLEDGEMENTS', expected: true },
  { title: 'About the Author', expected: true },
  { title: 'References', expected: true },
];

let passCount = 0;
testTitles.forEach(({ title, expected }) => {
  const result = isBoilerplateSection(title);
  const status = result === expected ? '✓' : '✗';
  console.log(`  ${status} "${title}" → ${result ? 'boilerplate' : 'content'} (expected: ${expected ? 'boilerplate' : 'content'})`);
  if (result === expected) passCount++;
});
console.log(`\nPassed: ${passCount}/${testTitles.length}\n`);

// Summary
console.log('═════════════════════════════════════════════════════════════════');
console.log('SUMMARY');
console.log('═════════════════════════════════════════════════════════════════');
console.log(`✓ Test 1: Preface/Acknowledgements removal - ${result1.removed_sections.length > 0 ? 'PASS' : 'FAIL'}`);
console.log(`✓ Test 2: Learning Outcomes removal - ${result2.removed_sections.includes('Learning Outcomes') ? 'PASS' : 'FAIL'}`);
console.log(`✓ Test 3: Table of Contents removal - ${result3.removed_sections.includes('Table of Contents') ? 'PASS' : 'FAIL'}`);
console.log(`✓ Test 4: About the Author removal - ${result4.removed_sections.includes('About the Author') ? 'PASS' : 'FAIL'}`);
console.log(`✓ Test 5: Clean document preservation - ${result5.removed_sections.length === 0 ? 'PASS' : 'FAIL'}`);
console.log(`✓ Test 6: Short content handling - ${result6.extracted === testDoc6 ? 'PASS' : 'FAIL'}`);
console.log(`✓ Test 7: Section detection - ${passCount === testTitles.length ? 'PASS' : 'PARTIAL'} (${passCount}/${testTitles.length})`);
console.log('\n✨ All tests completed!\n');
