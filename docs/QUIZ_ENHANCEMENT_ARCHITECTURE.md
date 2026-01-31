# Quiz Generation Enhancement - Architecture & Flow Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│                                                                   │
│  Student submits: POST /api/generate/quiz                        │
│  { subject, text, difficulty, numQuestions }                     │
└─────────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│            Express.js Backend (routes/generate.js)              │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 1. Verify User Authentication (auth middleware)        │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 2. Fetch User from Database                             │    │
│  │    SELECT studentCategory FROM users                    │    │
│  │    WHERE _id = req.user._id                            │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 3. Get Educator Role (from educatorRoleMap)             │    │
│  │    'Secondary School Student' →  patience + simple      │    │
│  │    'University Student'        →  lecturer + application│    │
│  │    'Postgraduate Student'      →  professor + research  │    │
│  │    'Vocational Student'        →  instructor + hands-on │    │
│  │    'Other'                     →  versatile educator    │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 4. Detect Subject Type                                  │    │
│  │    if (subject matches /math|calc|physics|chem/i)      │    │
│  │      specialInstructions = math-specific rules          │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 5. Build Quiz Prompt (buildQuizPrompt function)         │    │
│  │    - Educator role description                          │    │
│  │    - Difficulty level (EASY/MEDIUM/HARD/VERY HARD)     │    │
│  │    - Bloom's taxonomy level                             │    │
│  │    - Content excerpt (first 3000 chars)                 │    │
│  │    - Math-specific instructions (if applicable)         │    │
│  │    - JSON format requirements                           │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 6. Send to AI Provider                                  │    │
│  │                                                         │    │
│  │    ┌──────────────────┐        ┌──────────────────┐    │    │
│  │    │  OpenAI API      │        │  Gemini API      │    │    │
│  │    │  (Primary)       │        │  (Fallback)      │    │    │
│  │    │                  │        │                  │    │    │
│  │    │ gpt-3.5-turbo    │   OR   │ gemini-2.5-flash │    │    │
│  │    └────────┬─────────┘        └────────┬─────────┘    │    │
│  │             │                           │               │    │
│  │             └─────────────┬─────────────┘               │    │
│  │                           ▼                             │    │
│  │                    AI Generates                         │    │
│  │                    10-12 Questions                      │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 7. Validate & Parse Response                            │    │
│  │    - Extract JSON from response                         │    │
│  │    - Validate question structure                        │    │
│  │    - Ensure 4 options per question                      │    │
│  │    - Check explanation length                           │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 8. Store in Database                                    │    │
│  │    INSERT INTO quizzes (questions, difficulty, ...)     │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 9. Return to Frontend                                   │    │
│  │    { success: true, data: { questions: [...] } }       │    │
│  └────────────────────────────┬────────────────────────────┘    │
└─────────────────────────────────┼─────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Frontend Renders Quiz                          │
│                                                                   │
│  - Displays questions based on difficulty                        │
│  - Uses simple language for Secondary/complex for Postgraduate   │
│  - Shows calculations for Math questions                         │
│  - Matches educator role expectations                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Educator Role Selection Flow

```
Student's Database Record
        │
        ├─ studentCategory: "University Student"
        │
        ▼
getEducatorRole("University Student")
        │
        ├─ Look up in educatorRoleMap
        │
        └─ Return: "a university lecturer or professor who asks 
                   questions testing conceptual understanding and 
                   real-world application"
        │
        ▼
Include in OpenAI System Message:
"You are {educatorRole}. Generate high-quality MCQs..."
        │
        ▼
OpenAI Generates Questions That:
- Use university-level vocabulary
- Ask conceptual questions
- Focus on applications
- Test understanding
```

---

## Difficulty Level & Bloom's Taxonomy

```
                 ┌─────────────────────────────────┐
                 │   DIFFICULTY SELECTION          │
                 └──────────────────┬──────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
              EASY           MEDIUM            HARD
         Remember/             Apply/          Analyze/
         Understand            Analyze         Evaluate
              │                  │                │
              ├─ Definitions     ├─ Applications ├─ Critical thinking
              ├─ Facts           ├─ Comparisons  ├─ Complex scenarios
              ├─ Vocabulary      ├─ Relationships├─ Deep understanding
              ├─ Basic recall    └─ Problem      └─ Multiple concepts
              └─ Direct content     solving
                                                    │
                                                    ▼
                                          VERY HARD
                                         Evaluate/
                                          Create
                                              │
                                              ├─ Synthesis
                                              ├─ Edge cases
                                              ├─ New insights
                                              └─ Expert thinking
```

---

## Subject Type Detection & Handling

```
Input Subject
       │
       ▼
Does subject match regex:
/math|calc|algebra|geometry|trig|stat|physics|chem/i ?
       │
   ┌───┴───┐
   │       │
   YES     NO
   │       │
   ▼       ▼
MATH      NON-MATH
SUBJECT   SUBJECT
   │       │
   ▼       │
Add Special Instructions:
   │       │
   ├─ Include calculations
   │       │
   ├─ Show working/steps
   │       │
   ├─ Common error distractors
   │       │
   ├─ Numerical accuracy
   │       │
   └─ Both theory + computation
           │
           ▼
Both paths continue to buildQuizPrompt()
           │
           ▼
Final Prompt with appropriate instructions
```

---

## Prompt Building Process

```
buildQuizPrompt() Function Call
        │
        ├─ Input: numQuestions=8
        ├─ Input: difficulty="hard"
        ├─ Input: contentText="The derivative..."
        ├─ Input: subject="Calculus"
        ├─ Input: studentCategory="University Student"
        └─ Input: educatorRole="a university lecturer..."
        │
        ▼
1. Get Difficulty Guidelines
   difficultyGuidelines[difficulty] → 
   {
     label: "Hard",
     description: "Emphasize analysis...",
     guidelines: "Deep understanding...",
     bloomLevel: "Analyze/Evaluate"
   }
   │
   ▼
2. Detect Subject Type
   isMathSubject = /calc|math|physics/.test("Calculus") → TRUE
   │
   ▼
3. Build Subject-Specific Instructions
   "SPECIAL INSTRUCTIONS FOR CALCULUS:
    - Include numerical calculations...
    - Show working/steps...
    - Common error distractors...
    - Both theoretical and computational..."
   │
   ▼
4. Construct Complete Prompt String
   "You are {educatorRole}.
    
    Generate {numQuestions} high-quality MCQs...
    
    DIFFICULTY LEVEL: {Hard}
    Description: {Emphasize analysis...}
    Bloom's Level: {Analyze/Evaluate}
    Guidelines: {Deep understanding...}
    
    TEXT SOURCE:
    {contentText.substring(0, 3000)}
    
    REQUIREMENTS:
    - Exactly 4 options per question
    - Directly relevant to content
    - Clear explanations
    - Match difficulty level
    
    {subjectSpecificInstructions}
    
    Return ONLY valid JSON in exact format:
    { \"questions\": [...] }"
   │
   ▼
5. Return Complete Prompt String
   └─ Ready to send to OpenAI or Gemini
```

---

## Student Category → Educator Role Mapping

```
┌──────────────────────────────────────┬────────────────────────────────────┐
│      Student Category                │      Educator Role                 │
├──────────────────────────────────────┼────────────────────────────────────┤
│                                      │                                    │
│ Secondary School Student             │ Patient, engaging teacher who      │
│ (Ages 13-18)                         │ explains in simple terms suitable  │
│                                      │ for teenagers                      │
├──────────────────────────────────────┼────────────────────────────────────┤
│                                      │                                    │
│ University Student                   │ University lecturer/professor who  │
│ (Ages 18+)                           │ tests conceptual understanding and │
│                                      │ real-world application             │
├──────────────────────────────────────┼────────────────────────────────────┤
│                                      │                                    │
│ Postgraduate Student                 │ Advanced academic professor        │
│ (Masters/PhD level)                  │ designing highly analytical and    │
│                                      │ research-oriented questions        │
├──────────────────────────────────────┼────────────────────────────────────┤
│                                      │                                    │
│ Vocational/Technical Student         │ Practical technical instructor     │
│ (Hands-on training)                  │ focusing on applied skills and     │
│                                      │ hands-on knowledge                 │
├──────────────────────────────────────┼────────────────────────────────────┤
│                                      │                                    │
│ Other / Not Specified                │ Versatile educator adapting to     │
│                                      │ the learner's level                │
└──────────────────────────────────────┴────────────────────────────────────┘
```

---

## Math vs Non-Math Subject Processing

```
                    ┌─────────────────────────┐
                    │   buildQuizPrompt()     │
                    │   Detects Subject       │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                        │
                    ▼                        ▼
            MATH SUBJECT                NON-MATH
            (Calculus, Physics, etc)    (Literature, History, etc)
                    │                        │
                    ▼                        ▼
        Add Math Instructions          Standard Instructions
                    │                        │
        ┌─ Calculations                 ├─ Concept understanding
        ├─ Working steps                ├─ Analysis
        ├─ Error distractors            ├─ Application
        ├─ Numerical accuracy           └─ Critical thinking
        └─ Theory + Computation
                    │                        │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    Both sent to AI Provider
                    with same prompt structure
                                 │
                                 ▼
                    AI Generates Customized
                    Questions matching type
```

---

## Error Handling & Fallback Flow

```
Start: Generate Quiz
       │
       ▼
Fetch User From Database
       │
   ┌───┴──────────────────┐
   │                      │
 SUCCESS              FAILURE
   │                      │
   ▼                      ▼
Use student           Use 'Other'
category           category
   │                      │
   └──────┬───────────────┘
          │
          ▼
   Get Educator Role
          │
          ▼
   Build Prompt
          │
          ▼
   Try OpenAI API
          │
   ┌──────┴──────┐
   │             │
 SUCCESS    FAILURE
   │             │
   │             ▼
   │         Try Gemini API
   │             │
   │         ┌───┴──────┐
   │         │          │
   │       SUCCESS  FAILURE
   │         │          │
   │         │          ▼
   │         │      Use Mock
   │         │      Questions
   │         │          │
   └──────┬──┴──────────┘
          │
          ▼
   Validate Response
          │
          ▼
   Save to Database
          │
          ▼
   Return to Frontend
```

---

## Integration Points with Existing System

```
┌────────────────────────────────────────────────────────────┐
│         ischkul-azure/backend1/routes/generate.js          │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ IMPORT SECTION (Line 11)                            │  │
│  │ const User = require('../models/User');             │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ HELPER FUNCTIONS (Lines 47-130)                     │  │
│  │ - educatorRoleMap (47-52)                           │  │
│  │ - difficultyGuidelines (55-71)                      │  │
│  │ - getEducatorRole() (74-76)                         │  │
│  │ - buildQuizPrompt() (80-130)                        │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ OPENAI INTEGRATION (Lines 410-447)                  │  │
│  │ - Fetch user category (410-417)                     │  │
│  │ - Get educator role                                 │  │
│  │ - Build prompt with buildQuizPrompt()               │  │
│  │ - Send to OpenAI API                                │  │
│  │ - Parse response                                    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ GEMINI FALLBACK (Lines 512-527)                     │  │
│  │ - Reuse user category & educator role               │  │
│  │ - Call buildQuizPrompt() (same as OpenAI)           │  │
│  │ - Send to Gemini API                                │  │
│  │ - Parse response                                    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ RESPONSE VALIDATION & RETURN                        │  │
│  │ - Store in quizzes collection                       │  │
│  │ - Return to frontend                                │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
        ▲
        │
        ├── Imports User Model
        ├── Uses Quiz Model for storage
        ├── Uses Question Model if needed
        └── Called by /api/generate/quiz endpoint
```

---

## Database Schema Integration

```
┌─ User Collection ────────────────────┐
│                                      │
│  {                                   │
│    _id: ObjectId,                    │
│    email: String,                    │
│    password: String,                 │
│    ...other fields...                │
│    studentCategory: String, ◄────────┼─── NEW FIELD
│    /* Options:                       │
│       - Secondary School Student     │
│       - University Student           │
│       - Postgraduate Student         │
│       - Vocational/Technical Student │
│       - Other (default)              │
│    */                                │
│    ...other fields...                │
│  }                                   │
│                                      │
└──────────────────────────────────────┘
        ▲
        │
        Used by: buildQuizPrompt()
        Fetched: await User.findById(req.user._id)
        Impact: studentCategory determines educator role
```

---

## End-to-End Example: University Student, Hard Calculus

```
1. REQUEST
   POST /api/generate/quiz
   {
     "subject": "Calculus",
     "text": "The derivative of a function...",
     "difficulty": "hard",
     "numQuestions": 8
   }
   
                           ▼
                           
2. FETCH USER
   User.findById(req.user._id)
   → Returns: { studentCategory: "University Student", ... }
   
                           ▼
                           
3. GET EDUCATOR ROLE
   educatorRoleMap["University Student"]
   → Returns: "a university lecturer or professor who asks..."
   
                           ▼
                           
4. BUILD PROMPT
   buildQuizPrompt(8, "hard", "The derivative...", 
                   "Calculus", "University Student",
                   "a university lecturer...")
   → Returns: Complete prompt with:
     - Educator role description
     - HARD difficulty & Analyze/Evaluate Bloom's level
     - Calculus special instructions
     - Content excerpt
     - JSON format requirements
   
                           ▼
                           
5. SEND TO OPENAI
   model: "gpt-3.5-turbo"
   messages: [
     { role: "system", content: "You are an expert..." },
     { role: "user", content: [THE BUILT PROMPT] }
   ]
   
                           ▼
                           
6. RECEIVE RESPONSE
   {
     "choices": [{
       "message": {
         "content": "{\"questions\": [
           {
             \"text\": \"Find the derivative of...\",
             \"options\": [...],
             \"correctAnswer\": 1,
             \"explanation\": \"Using the power rule, ...\"
           },
           ... (7 more questions)
         ]}"
       }
     }]
   }
   
                           ▼
                           
7. PARSE & VALIDATE
   - Extract JSON from response
   - Validate structure
   - Ensure 4 options per question
   - Check explanations
   
                           ▼
                           
8. SAVE TO DATABASE
   Quiz.create({
     questions: [... validated questions ...],
     difficulty: "hard",
     subject: "Calculus",
     createdBy: userId,
     isAIGenerated: true,
     generationNote: "AI-generated questions..."
   })
   
                           ▼
                           
9. RETURN TO FRONTEND
   {
     "success": true,
     "data": {
       "questions": [
         {
           "text": "Find the derivative of sin(x) + 2x²...",
           "options": ["Option A", "Option B", "Option C", "Option D"],
           "correctAnswer": 0,
           "explanation": "Using calculus rules..."
         },
         ... (7 more questions)
       ]
     }
   }
   
                           ▼
                           
10. FRONTEND DISPLAYS
    Shows 8 calculus questions that:
    - Test derivative concepts (hard level)
    - Include calculations and working
    - Use university-level language
    - Match educator role expectations
```

---

## Testing Architecture

```
test_quiz_enhancement.js
      │
      ├─ Test 1: Secondary School - Easy Math
      │   ├─ Parameters: easy, math, secondary
      │   ├─ Check: Educator role is "patient teacher"
      │   ├─ Check: Difficulty is "EASY"
      │   ├─ Check: Bloom's is "Remember/Understand"
      │   └─ Check: Math instructions included
      │
      ├─ Test 2: University - Hard Calculus
      │   ├─ Parameters: hard, calculus, university
      │   ├─ Check: Educator role is "lecturer/professor"
      │   ├─ Check: Difficulty is "HARD"
      │   ├─ Check: Bloom's is "Analyze/Evaluate"
      │   └─ Check: Calculus instructions included
      │
      ├─ Test 3: Postgraduate - Very Hard Physics
      │   ├─ Parameters: veryhard, physics, postgraduate
      │   ├─ Check: Educator role is "advanced professor"
      │   ├─ Check: Difficulty is "VERY HARD"
      │   ├─ Check: Bloom's is "Evaluate/Create"
      │   └─ Check: Physics instructions included
      │
      ├─ Test 4: Vocational - Medium Technical
      │   ├─ Parameters: medium, technical, vocational
      │   ├─ Check: Educator role is "technical instructor"
      │   ├─ Check: Difficulty is "MEDIUM"
      │   └─ Check: Hands-on focus
      │
      └─ Test 5: Literature (Non-Math)
          ├─ Parameters: medium, literature, university
          ├─ Check: Educator role is "lecturer"
          ├─ Check: Difficulty is "MEDIUM"
          └─ Check: NO math instructions
                    
      ▼
      
All 5 Tests Pass? → ✅ YES
      │
      └─ Output: "🎉 All tests passed! The quiz generation 
                  enhancement is working correctly."
```

---

## Performance Metrics

```
Operation Timeline for Single Quiz Generation
(Assuming all APIs respond normally)

Time 0ms:     Request arrives
Time 10ms:    User authentication verified
Time 60ms:    User fetched from database (+50ms DB latency)
Time 70ms:    Educator role retrieved
Time 75ms:    Prompt built
Time 100ms:   OpenAI API request sent
Time 5100ms:  OpenAI response received (+5s API latency)
Time 5150ms:  Response parsed and validated
Time 5160ms:  Questions saved to database (+10ms DB write)
Time 5170ms:  Response returned to frontend

Total Time: ~5.17 seconds (mostly OpenAI API latency)

Breakdown:
- Database operations: ~60ms (1%)
- Local processing: ~50ms (1%)
- OpenAI API: ~5000ms (97%)
- Parsing/Validation: ~60ms (1%)
```

---

**Architecture diagrams created to show:**
- ✅ Complete system flow
- ✅ Educator role selection
- ✅ Difficulty & Bloom's taxonomy
- ✅ Subject detection
- ✅ Prompt building process
- ✅ Student category mapping
- ✅ Error handling & fallbacks
- ✅ Integration points
- ✅ Database schema
- ✅ End-to-end example
- ✅ Testing architecture
- ✅ Performance metrics
