# Quiz Generation Enhancement - Example Prompts

This document shows actual example prompts generated for different student categories, difficulty levels, and subjects.

## Example 1: Secondary School Student - Easy Mathematics

```
You are a patient and engaging secondary school teacher who explains concepts in simple terms suitable for teenagers.

Generate 5 high-quality multiple-choice questions (MCQs) based on the study material provided.

DIFFICULTY LEVEL: EASY
Description: Focus on basic recall and fundamental understanding
Bloom's Level: Remember/Understand
Guidelines: Questions should test vocabulary, basic definitions, and straightforward facts. Use simple language and direct concepts from the material.

TEXT SOURCE (Study Material):
The Pythagorean theorem states that in a right triangle, a² + b² = c². This means the square of the hypotenuse (the longest side) equals the sum of squares of the other two sides. For example, in a 3-4-5 triangle: 3² + 4² = 9 + 16 = 25 = 5².

REQUIREMENTS:
- Each question must have exactly 4 options (A, B, C, D)
- Questions should be directly relevant to the provided content
- Include a clear explanation for each correct answer that references the source material
- Difficulty should match the specified level

SPECIAL INSTRUCTIONS FOR MATHEMATICS:
- For mathematical questions, include numerical calculations or numerical answers
- Show the working/steps in the explanation
- Provide options with common calculation errors as distractors
- Include both theoretical and computational questions
- Ensure numerical accuracy in all answers and explanations

Return ONLY valid JSON in this exact format...
```

**Key Features:**
- ✅ Simple language suitable for teenagers
- ✅ Focus on basic definitions and facts
- ✅ Clear Pythagorean theorem example with numbers
- ✅ Math calculations explicitly requested
- ✅ Working/steps to be shown in answers

---

## Example 2: University Student - Hard Calculus

```
You are a university lecturer or professor who asks questions testing conceptual understanding and real-world application.

Generate 8 high-quality multiple-choice questions (MCQs) based on the study material provided.

DIFFICULTY LEVEL: HARD
Description: Emphasize analysis and synthesis of complex concepts
Bloom's Level: Analyze/Evaluate
Guidelines: Questions should require deep understanding, critical thinking, and the ability to connect multiple concepts or analyze scenarios.

TEXT SOURCE (Study Material):
The derivative of a function measures the rate of change. The limit definition is f'(x) = lim[h→0] (f(x+h) - f(x))/h. The derivative tells us the instantaneous rate of change at a point. For f(x) = x², f'(x) = 2x. Derivatives are fundamental to calculus and have applications in physics, economics, and engineering.

REQUIREMENTS:
- Each question must have exactly 4 options (A, B, C, D)
- Questions should be directly relevant to the provided content
- Include a clear explanation for each correct answer that references the source material
- Difficulty should match the specified level

SPECIAL INSTRUCTIONS FOR CALCULUS:
- For mathematical questions, include numerical calculations or numerical answers
- Show the working/steps in the explanation
- Provide options with common calculation errors as distractors
- Include both theoretical and computational questions
- Ensure numerical accuracy in all answers and explanations

Return ONLY valid JSON in this exact format...
```

**Key Features:**
- ✅ University-level language (instantaneous rate of change, limit definition)
- ✅ Expected to test conceptual understanding and applications
- ✅ Questions require deep understanding and critical thinking
- ✅ Math calculations and working steps emphasized
- ✅ Connection to real-world applications (physics, economics, engineering)

---

## Example 3: Postgraduate Student - Very Hard Physics

```
You are an advanced academic professor designing highly analytical and research-oriented questions.

Generate 10 high-quality multiple-choice questions (MCQs) based on the study material provided.

DIFFICULTY LEVEL: VERY HARD
Description: Maximum cognitive challenge requiring expert-level thinking
Bloom's Level: Evaluate/Create
Guidelines: Questions should demand synthesis, evaluation, and creation of new insights. Include edge cases, exceptions, and complex scenarios.

TEXT SOURCE (Study Material):
Quantum mechanics describes the behavior of matter at atomic and subatomic scales. The wave function ψ contains all information about the system. The Schrödinger equation governs the evolution of wave functions. Quantum superposition allows particles to exist in multiple states simultaneously until measured. The uncertainty principle states that certain pairs of observable properties cannot both be precisely determined.

REQUIREMENTS:
- Each question must have exactly 4 options (A, B, C, D)
- Questions should be directly relevant to the provided content
- Include a clear explanation for each correct answer that references the source material
- Difficulty should match the specified level

SPECIAL INSTRUCTIONS FOR PHYSICS:
- For mathematical questions, include numerical calculations or numerical answers
- Show the working/steps in the explanation
- Provide options with common calculation errors as distractors
- Include both theoretical and computational questions
- Ensure numerical accuracy in all answers and explanations

Return ONLY valid JSON in this exact format...
```

**Key Features:**
- ✅ Advanced academic language (superposition, Schrödinger equation, uncertainty principle)
- ✅ Research-oriented questions on cutting-edge physics
- ✅ Expects synthesis and evaluation of complex concepts
- ✅ Edge cases and exceptions emphasized
- ✅ Both theoretical and computational components
- ✅ 10 questions (more depth than secondary school)

---

## Example 4: Vocational/Technical Student - Medium Electrical Engineering

```
You are a practical technical instructor focusing on applied skills and hands-on knowledge.

Generate 6 high-quality multiple-choice questions (MCQs) based on the study material provided.

DIFFICULTY LEVEL: MEDIUM
Description: Balance between recall and application of concepts
Bloom's Level: Apply/Analyze
Guidelines: Questions should require students to apply knowledge, make comparisons, and show understanding of relationships between concepts.

TEXT SOURCE (Study Material):
Electrical circuits consist of voltage sources, resistors, and switches connected in series or parallel configurations. In a series circuit, the same current flows through all components. In a parallel circuit, voltage is the same across all branches but current divides. Ohm's law states V = IR, where V is voltage, I is current, and R is resistance. Power consumption is P = VI or P = I²R.

REQUIREMENTS:
- Each question must have exactly 4 options (A, B, C, D)
- Questions should be directly relevant to the provided content
- Include a clear explanation for each correct answer that references the source material
- Difficulty should match the specified level

Return ONLY valid JSON in this exact format...
```

**Key Features:**
- ✅ Practical, hands-on language
- ✅ Focus on applied skills (circuit design, calculations)
- ✅ Real-world applications (series/parallel circuits, power consumption)
- ✅ Balance between theory and practice
- ✅ Moderate cognitive level (Apply/Analyze)
- ✅ 6 questions (practical depth)

---

## Example 5: Non-Math Subject - Medium Literature

```
You are a university lecturer or professor who asks questions testing conceptual understanding and real-world application.

Generate 5 high-quality multiple-choice questions (MCQs) based on the study material provided.

DIFFICULTY LEVEL: MEDIUM
Description: Balance between recall and application of concepts
Bloom's Level: Apply/Analyze
Guidelines: Questions should require students to apply knowledge, make comparisons, and show understanding of relationships between concepts.

TEXT SOURCE (Study Material):
Shakespeare's Romeo and Juliet explores themes of love, family conflict, and fate. The play follows two young lovers whose relationship is forbidden by their feuding families. The tragedy demonstrates how personal desires conflict with social obligations. Key characters include Romeo, Juliet, the Nurse, Friar Lawrence, and members of the Montague and Capulet families. The work uses poetic language and dramatic irony to convey its messages.

REQUIREMENTS:
- Each question must have exactly 4 options (A, B, C, D)
- Questions should be directly relevant to the provided content
- Include a clear explanation for each correct answer that references the source material
- Difficulty should match the specified level

Return ONLY valid JSON in this exact format...
```

**Key Features:**
- ✅ No "SPECIAL INSTRUCTIONS FOR LITERATURE" (not a math subject)
- ✅ Questions focused on literary analysis and comprehension
- ✅ Requires understanding of themes and character relationships
- ✅ University-level discussion of literature
- ✅ No numerical calculations or working steps
- ✅ Balanced difficulty (apply/analyze)

---

## Comparing the Prompts

### Educator Voice
| Level | Voice |
|-------|-------|
| Secondary | Patient and engaging teacher explaining in simple terms |
| University | Lecturer/professor testing conceptual understanding |
| Postgraduate | Advanced professor designing research-oriented questions |
| Vocational | Technical instructor focusing on hands-on knowledge |

### Cognitive Levels
| Difficulty | Bloom's | Example Focus |
|-----------|---------|---------------|
| Easy | Remember/Understand | Definitions, vocabulary, basic facts |
| Medium | Apply/Analyze | Applications, comparisons, relationships |
| Hard | Analyze/Evaluate | Deep understanding, critical thinking |
| Very Hard | Evaluate/Create | Synthesis, edge cases, new insights |

### Math vs Non-Math
| Feature | Math | Non-Math |
|---------|------|----------|
| Calculations | ✅ Required | ❌ Not applicable |
| Working/Steps | ✅ Show steps | ❌ Not needed |
| Distractors | Common calculation errors | Plausible but wrong answers |
| Accuracy Focus | Numerical precision | Conceptual correctness |

### Question Count by Level
| Category | Easy | Medium | Hard | Very Hard |
|----------|------|--------|------|-----------|
| Secondary | 5 | 6 | 7 | 8+ |
| University | 5 | 8 | 10 | 12+ |
| Postgraduate | 8 | 10 | 12 | 15+ |
| Vocational | 4 | 6 | 8 | 10 |

---

## How the System Selects the Right Prompt

```
1. Check student's category in database
   ↓
2. Select educator role (5 options)
   ↓
3. Get difficulty guidelines (4 options)
   ↓
4. Detect subject (Math or Non-Math)
   ↓
5. If Math: Add calculation instructions
   ↓
6. Build unified prompt with all components
   ↓
7. Send to OpenAI or Gemini
   ↓
8. Receive personalized questions
```

---

## Real-World Impact Examples

### Before Enhancement
**All students received generic prompts:**
```
"Generate 5 quiz questions based on this content. 
Return JSON with questions, options, and correct answers."
```

**Result**: Questions were inconsistent in difficulty and language level.

### After Enhancement
**Secondary School Student gets:**
- Simple, clear language
- Basic definitions focus
- Easy/medium difficulty options
- Explanations suitable for teenagers

**University Student gets:**
- Academic language
- Conceptual understanding focus
- Hard/very hard difficulty options
- Real-world applications emphasized

**Postgraduate Student gets:**
- Advanced academic language
- Research-oriented questions
- Very hard difficulty with edge cases
- Expects synthesis and evaluation

**Math Student gets:**
- Explicit calculation requirements
- Working/steps shown
- Common error distractors
- Numerical accuracy checked

**Literature Student gets:**
- No math instructions
- Focus on analysis and themes
- Discussion of symbolism and language
- Conceptual understanding emphasized

---

## Testing the Prompts Yourself

To see the exact prompts being generated:

```bash
cd backend1
node test_quiz_enhancement.js  # Runs all 5 test cases
```

Or create a custom test:

```javascript
const educatorRole = getEducatorRole('University Student');
const prompt = buildQuizPrompt(
  8,                    // 8 questions
  'hard',              // Hard difficulty
  contentText,         // Your study material
  'Physics',           // Subject
  'University Student', // Student category
  educatorRole
);
console.log(prompt);    // See the generated prompt
```

---

## Prompt Templates Used

All prompts follow this structure:

1. **Educator Introduction**: Role and teaching style
2. **Task**: Number of questions and type (MCQ)
3. **Difficulty Level**: Label, description, Bloom's level, guidelines
4. **Content Source**: The study material to base questions on
5. **Requirements**: Format specifications
6. **Subject-Specific**: (If math/science) Special instructions
7. **Output Format**: JSON structure with fields

This consistent structure ensures:
- ✅ AI understands the context
- ✅ Questions match the difficulty level
- ✅ Output is properly formatted
- ✅ Subject-specific needs are met
- ✅ Students receive personalized questions

---

**Status**: All examples generated and tested ✅  
**Test Suite**: 100% passing (5/5 test cases) ✅  
**Production Ready**: Yes ✅
