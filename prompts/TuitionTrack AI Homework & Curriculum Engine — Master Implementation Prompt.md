# MASTER IMPLEMENTATION PROMPT
## TuitionTrack AI Homework, Assignment, Curriculum, FAQ & Learning Engine

You are the lead software architect, senior full-stack engineer, AI engineer, education-product designer, database architect, QA engineer, and autonomous implementation agent for TuitionTrack.

Your task is to transform the existing TuitionTrack application into a production-grade, AI-powered homework, assignment, curriculum, chapter FAQ, mind-map, assessment, grading, and adaptive-learning platform.

Do NOT create a disconnected demo.

Do NOT replace working TuitionTrack functionality unnecessarily.

First inspect the existing repository, architecture, database, authentication, user roles, UI system, components, APIs, Supabase schema, storage system, and deployment configuration.

Extend the current product safely.

The system must be data-driven, curriculum-versioned, AI-powered, teacher-controlled, student-friendly, and scalable from Class 1 through Class 12.

---

# 1. CORE PRODUCT OBJECTIVE

Build a complete academic workflow:

Teacher
→ selects class
→ subject
→ book
→ chapter
→ topic
→ learning objectives
→ creates/generates homework
→ reviews
→ publishes

Student
→ receives homework
→ attempts it
→ submits answers/files/photos
→ receives feedback
→ sees mistakes
→ retries/remediates

AI
→ generates curriculum-aligned unique questions
→ verifies answer keys
→ detects duplicates
→ evaluates objective answers
→ assists with subjective grading
→ identifies weak concepts
→ generates remedial homework
→ generates chapter FAQs
→ generates chapter mind maps
→ updates student mastery

Admin
→ manages academic years
→ manages curriculum
→ synchronizes official sources
→ manages books
→ manages subjects
→ manages chapters
→ reviews AI-generated content
→ monitors curriculum versions
→ controls AI policies.

---

# 2. CRITICAL PRINCIPLE

Separate:

CURRICULUM TRUTH
from
AI GENERATION.

Official CBSE/NCERT curriculum and source documents define the authoritative boundaries.

AI must NOT invent syllabus content.

AI generates learning material only after identifying:

- academic year
- board
- class
- subject
- textbook
- chapter
- topic
- learning objective
- competency
- source content
- approved curriculum scope.

Every generated question must be traceable to a curriculum node.

---

# 3. CURRICULUM HIERARCHY

Implement:

Academic Year
→ Board
→ Class
→ Subject
→ Course
→ Textbook
→ Chapter
→ Section
→ Topic
→ Subtopic
→ Learning Objective
→ Competency
→ Question Blueprint
→ Question Variant

Support:

Class 1
Class 2
Class 3
Class 4
Class 5
Class 6
Class 7
Class 8
Class 9
Class 10
Class 11
Class 12

Do not hard-code chapter lists in frontend code.

All curriculum data must come from the database.

---

# 4. CURRICULUM VERSIONING

Every curriculum must have:

id
academic_year
board
class
subject
version
source_authority
source_url
document_url
published_at
retrieved_at
content_hash
status

Possible status:

draft
active
superseded
archived

Never overwrite an old curriculum.

Create a new version.

The application must always know which curriculum version was used to generate an assignment.

---

# 5. OFFICIAL SOURCES

Create a curriculum source registry.

Initial authoritative sources:

CBSE Academic Unit:
https://cbseacademic.nic.in/

NCERT:
https://ncert.nic.in/

NCERT official textbook portal:
https://ncert.nic.in/textbook.php

Use the official CBSE curriculum pages/documents applicable to the academic year.

Use official NCERT textbook resources.

Do not silently substitute unofficial websites.

When official sources disagree, flag the conflict for administrator review rather than inventing a resolution.

---

# 6. SOURCE INGESTION ENGINE

Create:

CurriculumSource

CurriculumDocument

CurriculumVersion

Book

BookEdition

Chapter

ChapterSection

Topic

LearningObjective

Competency

SourceReference

The ingestion pipeline must support:

HTML
PDF
EPUB
structured text
official chapter links
official resource links

Pipeline:

SOURCE
→ FETCH
→ VALIDATE
→ VERSION
→ EXTRACT
→ NORMALIZE
→ CLASSIFY
→ CHAPTER DETECTION
→ TOPIC DETECTION
→ LEARNING OBJECTIVE EXTRACTION
→ STORE
→ EMBED
→ INDEX
→ VALIDATE

Each chunk must retain:

source_document_id
page_number when available
chapter_id
section
heading
source_url
content_hash

---

# 7. NCERT CONTENT HANDLING

Integrate official NCERT textbook metadata and chapter references for Classes 1–12.

Prefer official source links.

Where local storage/redistribution is permitted, ingest the content.

Otherwise retain the official URL and use controlled retrieval.

Never misrepresent AI-generated material as NCERT-authored content.

Clearly differentiate:

Official NCERT
Official CBSE
Teacher-created
AI-generated
AI-assisted

---

# 8. TEXTBOOK VIEW

Create:

/curriculum
/classes
/classes/:classId
/subjects/:subjectId
/books/:bookId
/chapters/:chapterId

Every chapter page should show:

Chapter title
Chapter number
Book
Class
Subject
Academic year
Learning objectives
Key concepts
Topics
Official resources
Mind map
FAQ
Practice questions
Homework
Assignments
Revision
Student mastery where applicable

---

# 9. TEACHER HOMEWORK STUDIO

Create a dedicated:

/teacher/homework/create

workflow.

Fields:

Class
Subject
Book
Chapter
Topic
Learning objectives
Difficulty
Question count
Marks
Estimated completion time
Question types
Language
Deadline
Attempt limit
Late submission policy
Submission type
AI grading enabled/disabled
Teacher notes

Presets:

Quick Homework
Daily Practice
Chapter Practice
Revision
Exam Practice
Remedial
Challenge
Project
Activity
Custom

Allow:

Generate with AI
Create manually
Mix AI + manual questions
Import existing questions

---

# 10. AI HOMEWORK GENERATOR

Implement:

POST /api/ai/homework/generate

Input:

classId
subjectId
bookId
chapterId
topicIds
learningObjectiveIds
difficulty
questionTypes
questionCount
marks
language
studentIds
excludePreviouslyAssigned
deadline
teacherInstructions

Generation pipeline:

1. Load curriculum.
2. Load textbook/chapter content.
3. Load selected learning objectives.
4. Load competency requirements.
5. Load student history.
6. Build question blueprints.
7. Generate variants.
8. Generate answer keys.
9. Generate solutions.
10. Verify answers independently.
11. Check curriculum alignment.
12. Check difficulty.
13. Check duplicates.
14. Check prohibited/unsafe content.
15. Check age appropriateness.
16. Store approved questions.
17. Return teacher preview.

Never directly publish raw AI output.

---

# 11. QUESTION BLUEPRINT SYSTEM

Create question_blueprints.

Fields:

concept_id
learning_objective_id
competency_id
question_type
difficulty
cognitive_level
marks
expected_time
required_operations
allowed_contexts
variation_dimensions

Examples:

MCQ
Numerical
Short Answer
Long Answer
Case Study
Assertion Reason
Fill Blank
True False
Match
Diagram
Proof
Derivation
Application
Reasoning
Project
Experiment
Oral

---

# 12. TRUE UNIQUE QUESTION GENERATION

Implement a variation engine.

Variation dimensions may include:

numbers
names
objects
contexts
units
ordering
scenario
representation
wording
diagram structure
data table
application context

But changes must preserve the intended learning objective.

Example:

Question A:
3x + 7 = 25

Question B:
5y - 9 = 31

These are variants of the same learning objective.

Do NOT consider simple synonym replacement to be genuine uniqueness.

---

# 13. QUESTION FINGERPRINT

Create:

question_fingerprint

based on:

normalized_stem
concept_id
answer_structure
question_type
difficulty
variables
scenario
solution_pattern

Use:

exact duplicate detection
hash detection
semantic similarity detection

Store:

question_fingerprint
embedding
generated_for_student
generated_at

---

# 14. STUDENT-SPECIFIC GENERATION

Each student may receive a different version of the same assignment.

Example:

Assignment:
Fractions — 10 questions

Student A:
Version A1

Student B:
Version A2

Student C:
Version A3

All must assess the same learning objectives and approximately the same difficulty.

Provide teacher controls:

Same questions for everyone
Random variants
Personalized variants
Adaptive variants

---

# 15. QUESTION QUALITY VERIFICATION

Every AI-generated question requires:

Question Validator

It must verify:

Is the question valid?
Is it curriculum aligned?
Is it age appropriate?
Is it unambiguous?
Does it have exactly one correct answer where required?
Is the answer mathematically/scientifically correct?
Does the solution logically derive the answer?
Are units correct?
Are marks appropriate?
Does difficulty match the requested level?
Does it contain unsupported claims?

If validation fails:

REJECT → REGENERATE

Never publish invalid questions.

---

# 16. STUDENT HOMEWORK PAGE

Create:

/student/homework

Display:

Subject
Chapter
Title
Teacher
Question count
Marks
Estimated time
Due date
Submission status
Attempt status

Example:

Mathematics
Linear Equations
10 Questions
20 Marks
20 minutes
Due Tomorrow 7 PM

[Start Homework]

---

# 17. QUESTION PLAYER

Create a focused distraction-free question interface.

Support:

MCQ
Multiple select
text answer
numeric answer
equation
fill blank
matching
diagram interaction
image upload
PDF upload
audio upload where enabled

Features:

Save
Next
Previous
Flag question
Auto-save
Progress indicator
Timer optional
Resume later
Submit

Do not accidentally submit when navigating away.

---

# 18. HANDWRITTEN SUBMISSION

Students must be able to:

Take/upload photographs
Upload PDF
Upload image
Upload handwritten work

Pipeline:

UPLOAD
→ STORAGE
→ OCR/HANDWRITING EXTRACTION
→ QUESTION MATCHING
→ ANSWER EXTRACTION
→ AI EVALUATION
→ CONFIDENCE SCORE
→ TEACHER REVIEW

Store:

original_file
extracted_text
evaluation
confidence
teacher_override

---

# 19. AI GRADING

Objective questions:

Automatically grade.

Subjective questions:

AI proposes:

marks
feedback
rubric evidence
mistake type
confidence

Teacher must be able to override.

Never hide the original student submission.

---

# 20. GRADING RUBRICS

Create reusable rubrics.

Example:

5-mark answer:

Concept:
1
Explanation:
1
Method:
1
Accuracy:
1
Conclusion:
1

AI must show exactly why marks were awarded.

---

# 21. ASSIGNMENT LIFECYCLE

Implement:

DRAFT
GENERATING
GENERATED
TEACHER_REVIEW
PUBLISHED
STARTED
IN_PROGRESS
SUBMITTED
AI_EVALUATED
TEACHER_REVIEWED
GRADED
RETURNED
ARCHIVED

---

# 22. LATE SUBMISSIONS

Support:

No late submission
Allow late submission
Allow with penalty
Teacher approval required

Store:

submitted_at
due_at
is_late
late_reason
teacher_override

---

# 23. RESUBMISSION

Teacher can allow:

No resubmission
One resubmission
Multiple resubmissions

Store assignment attempts independently.

Never overwrite previous submissions.

---

# 24. AI CHAPTER FAQ

Every chapter automatically receives:

Chapter FAQ

Generate questions from:

textbook concepts
definitions
common confusions
prerequisites
student mistakes
teacher-created FAQs
historical anonymous student questions

Categories:

Basics
Conceptual
Formula
Examples
Exam
Common Mistakes
Application

Every AI answer must be source-grounded.

For each answer return:

answer
source_reference
confidence

If source support is missing:

say that additional information is required.

Do not hallucinate.

---

# 25. CHAPTER AI TUTOR

Create:

/student/chapters/:chapterId/ask

Students can ask:

Explain this concept
Give me an example
Explain simply
Why does this work?
Give me practice
What formula should I remember?
Explain my mistake

The chatbot must respect the selected chapter context.

Modes:

Simple
Detailed
Exam
Practice
Hint Only

IMPORTANT:

Do not immediately solve an active homework question when doing so would defeat the assignment.

Use progressive hints when homework is in progress.

---

# 26. AI MIND MAP

Generate a machine-readable concept graph.

Store:

nodes
relationships
definitions
examples
formulas
prerequisites
common_errors
exam_connections

Support:

JSON graph
SVG rendering
interactive web mind map
printable version

Teacher can edit.

Student can expand/collapse nodes.

---

# 27. CHAPTER KNOWLEDGE PACK

Every chapter should automatically generate:

1. Chapter summary
2. Key concepts
3. Definitions
4. Important formulas
5. Examples
6. Common mistakes
7. FAQ
8. Mind map
9. Practice questions
10. Exam questions
11. Revision checklist
12. Learning objectives
13. Competencies
14. Prerequisite concepts

---

# 28. ADAPTIVE PRACTICE

Track:

attempts
accuracy
time
hints_used
mistake_types
question_difficulty
concept_mastery

Create:

student_concept_mastery

Example:

Fractions
82%

Linear Equations
61%

Algebraic Expressions
93%

The AI should use this information to generate future homework.

---

# 29. MISTAKE CLASSIFICATION

Every wrong answer should attempt to classify:

Conceptual error
Calculation error
Formula error
Reading error
Unit error
Sign error
Careless error
Incomplete answer
Misinterpretation
Reasoning error
Method error

Store mistake history.

---

# 30. AUTOMATIC REMEDIAL HOMEWORK

When mastery falls below teacher-configurable threshold:

Generate:

Remedial Homework

Example:

Mastery < 50%
→ 5 foundational questions

50–70%
→ 5 basic + 3 medium

70–85%
→ 5 medium + 2 application

85%+
→ challenge/revision

Never punish the student with endless repetitive questions.

---

# 31. PERSONALIZED HOMEWORK

Support three modes:

CLASS MODE
Everyone gets same questions.

VARIANT MODE
Everyone gets equivalent but unique questions.

ADAPTIVE MODE
Questions vary according to individual mastery.

Teacher chooses the mode.

---

# 32. ASSIGNMENT ANALYTICS

Teacher dashboard must show:

Assigned
Started
Submitted
Missing
Late
Average score
Median score
Completion rate
Question-level accuracy
Concept-level accuracy
Common mistakes
Weak students
High-performing students
Students needing intervention

---

# 33. CLASS INSIGHT

For every assignment provide:

Class average
Question difficulty
Most-missed question
Most common misconception
Most successful concept
Students needing support

Do not reduce students to a single “AI intelligence score.”

Use measurable academic indicators.

---

# 34. STUDENT DASHBOARD

Display:

Today's Homework
Upcoming
Overdue
Recent Scores
Weak Concepts
Mastered Concepts
Revision Suggestions
Recent Feedback
Chapter Progress

Make the experience motivating without manipulative gamification.

---

# 35. PARENT VIEW

Parents may see:

Homework assigned
Homework completed
Upcoming deadlines
Scores
Teacher feedback
Weak concepts
Study recommendations

Do not expose sensitive internal AI reasoning.

---

# 36. TEACHER CONTENT LIBRARY

Teacher can create:

Question
Worksheet
Assignment
Quiz
Project
Practice Sheet
Revision Sheet
Mind Map
FAQ
Study Notes

Teacher content can be reused.

Teacher-created questions must remain distinguishable from AI-generated questions.

---

# 37. QUESTION BANK

Build a global question bank with filters:

Class
Subject
Book
Chapter
Topic
Learning Objective
Difficulty
Question Type
Marks
Competency
Academic Year
Source
Status

Statuses:

Draft
AI Generated
Verified
Teacher Created
Approved
Rejected
Archived

---

# 38. AI QUESTION APPROVAL QUEUE

Create:

/teacher/ai-review

Teacher can:

Approve
Edit
Reject
Regenerate
Duplicate as template
Change difficulty
Change marks
Change wording

---

# 39. SEARCH

Global search must find:

chapters
topics
questions
assignments
students
FAQs
mind maps
resources

Use semantic search for educational content.

---

# 40. DATABASE

Use the existing Supabase database if already present.

Do not recreate the database blindly.

First inspect current schema.

Add tables approximately:

academic_years
boards
classes
subjects
courses
textbooks
textbook_editions
chapters
chapter_sections
topics
subtopics
learning_objectives
competencies
curriculum_documents
curriculum_versions
curriculum_sources
source_references
content_chunks
content_embeddings
question_blueprints
questions
question_variants
question_fingerprints
assignments
assignment_questions
assignment_variants
student_assignment_attempts
student_answers
submissions
submission_files
evaluations
rubrics
evaluation_items
student_concept_mastery
student_mistakes
chapter_faqs
chapter_mindmaps
generation_jobs
ai_review_queue
sync_jobs
audit_logs

Adapt naming to the existing schema where appropriate.

---

# 41. STORAGE

Create secure storage paths such as:

/homework-submissions/
/teacher-resources/
/curriculum-resources/
/mindmaps/
/generated-worksheets/

Use signed URLs.

Students should not be able to access another student's files.

---

# 42. SECURITY

Implement row-level security.

Student:
Can only access own assignments, submissions, feedback and permitted resources.

Teacher:
Can access assigned classes/students and teacher-managed content.

Admin:
Can manage curriculum and system settings.

Never trust frontend authorization.

Enforce authorization server-side.

---

# 43. AI JOB SYSTEM

Do not perform massive curriculum generation inside synchronous HTTP requests.

Create background jobs:

curriculum_ingestion
chapter_embedding
faq_generation
mindmap_generation
question_generation
answer_verification
duplicate_detection
grading
analytics

Show progress to the user.

---

# 44. AI MODEL ABSTRACTION

Do not hard-code one AI provider into business logic.

Create:

AIProvider
GenerationService
EmbeddingService
EvaluationService

Allow future providers.

All AI calls should pass through an internal service abstraction.

---

# 45. PROMPT VERSIONING

Every AI generation must record:

model
provider
prompt_version
temperature/settings
generation_seed when supported
curriculum_version
source_documents
created_at

This allows auditing and reproduction.

---

# 46. SOURCE-GROUNDED GENERATION

For educational generation:

Retrieve relevant source chunks first.

Then provide them to the model.

The AI should not rely solely on its pretrained knowledge when generating curriculum-specific questions.

Pipeline:

Query
→ retrieve curriculum
→ retrieve source content
→ retrieve learning objective
→ retrieve constraints
→ generate
→ validate
→ store

---

# 47. NO HALLUCINATED CURRICULUM

Never allow:

AI assumption
→ new chapter
→ fake NCERT chapter
→ fake CBSE requirement

If data is unavailable:

Display:

“Curriculum data has not been verified for this academic year.”

Then send the item to admin review.

---

# 48. CURRICULUM CHANGE DETECTION

Create automated source checks.

When a source changes:

detect
→ diff
→ identify impacted nodes
→ mark affected generated content
→ revalidate
→ notify admin

Example:

NCERT chapter changes.

System marks:

old AI questions:
REVALIDATION_REQUIRED

new questions:
generated using new content.

---

# 49. ACADEMIC YEAR ISOLATION

Never mix:

2025–26
2026–27
2027–28

unless explicitly requested.

A teacher selecting 2026–27 must receive 2026–27 curriculum.

---

# 50. LANGUAGE

Support at minimum:

English
Hindi

Architecture must support future Indian languages.

Do not translate technical concepts blindly.

Store:

language
translated_text
source_language

---

# 51. WORKSHEET GENERATION

Allow:

Generate Worksheet
→ PDF

Include:

School/Tuition branding
Class
Subject
Chapter
Instructions
Questions
Space for answers
Marks
Teacher name
Student name
Date
QR/reference if configured

Separate:

student worksheet
teacher answer key

---

# 52. PRINT MODE

Everything must be printable.

Homework
FAQ
Mind Map
Worksheets
Revision notes

Use clean A4 layouts.

---

# 53. QR CODE RESOURCE SYSTEM

Where useful, create QR-linked resources:

chapter
assignment
worksheet
submission portal
revision material

QR links must require authentication where student-specific.

---

# 54. NOTIFICATIONS

Support:

Homework assigned
Homework reminder
Due soon
Overdue
Homework graded
Teacher feedback
Resubmission requested
New remedial homework
New chapter material

Respect notification settings.

---

# 55. TEACHER AUTOMATION

Allow teacher settings such as:

Automatically generate weekly homework.

Example:

Every Monday:

Class 8
Mathematics
Current chapter
10 questions
Medium difficulty
Variant mode

But teacher retains control over publication unless explicitly enabled.

---

# 56. ADMIN CURRICULUM DASHBOARD

Create:

/admin/curriculum

Show:

Academic year
Source
Last sync
Version
Status
Classes loaded
Subjects loaded
Books loaded
Chapters loaded
Missing items
Changed items
Validation errors

Buttons:

Sync Now
Validate
Compare Versions
Review Changes
Publish Version
Rollback

---

# 57. SEEDING

Do NOT fill the database with fake textbook chapters merely to make the UI look complete.

Use real official source metadata where available.

For development:

allow clearly labelled mock/demo data.

Production:

only verified curriculum data.

---

# 58. FRONTEND UX

The UI should feel like a modern education SaaS product.

Use:

clean hierarchy
large readable typography
clear status indicators
minimal cognitive overload
excellent mobile responsiveness
accessible controls
fast navigation

Teacher interface:
information-dense but organized.

Student interface:
simple and focused.

---

# 59. ACCESSIBILITY

Support:

keyboard navigation
screen-reader labels
sufficient contrast
large tap targets
math-readable rendering
LaTeX/math notation
Hindi/English typography

---

# 60. EQUATION AND SCIENCE SUPPORT

Use proper mathematical rendering.

Support:

LaTeX
chemical equations
symbols
fractions
graphs
tables
units
scientific notation

---

# 61. TESTING

Create tests for:

curriculum ingestion
duplicate detection
question generation
answer verification
assignment creation
student assignment access
submission
file upload
AI grading
teacher override
mind map generation
FAQ generation
RLS
academic year isolation

Create end-to-end tests:

Teacher creates homework
→ Student receives it
→ Student completes it
→ Student submits
→ AI evaluates
→ Teacher reviews
→ Results appear
→ Concept mastery updates
→ Remedial homework is generated.

---

# 62. ACCEPTANCE TEST

The implementation is NOT complete until this entire scenario works:

Teacher selects:

Class 8
Mathematics
Chapter
Linear Equations

Clicks:

Generate Homework

System:

loads curriculum
loads chapter
loads learning objectives
generates 10 valid questions
creates equivalent variants
checks duplicates
checks correctness
creates answer key
shows preview

Teacher clicks:

Publish

Student logs in.

Student sees:

Homework Assigned.

Student completes it.

Student submits.

System grades objective questions.

AI evaluates subjective questions.

Teacher sees:

8/10

and concept-level feedback.

Student sees feedback.

The student's weak concept is recorded.

The system generates remedial questions.

No previously assigned equivalent question is reused.

---

# 63. IMPORTANT PRODUCT RULE

Do not create a generic chatbot with a homework form.

This is a structured educational system.

Curriculum is the source of truth.

Learning objectives define what is assessed.

AI is the generation and personalization layer.

Teacher is the final authority.

Student performance feeds adaptive practice.

---

# 64. IMPLEMENTATION ORDER

Implement in this order:

PHASE 1
Audit existing TuitionTrack repository.

PHASE 2
Understand existing authentication, roles, database and UI.

PHASE 3
Create curriculum data architecture.

PHASE 4
Create Academic Year/Class/Subject/Book/Chapter system.

PHASE 5
Integrate official curriculum/source metadata.

PHASE 6
Implement chapter knowledge/RAG layer.

PHASE 7
Implement question blueprint and generation engine.

PHASE 8
Implement uniqueness/deduplication.

PHASE 9
Implement teacher Homework Studio.

PHASE 10
Implement student Homework Player.

PHASE 11
Implement assignment submission.

PHASE 12
Implement AI evaluation.

PHASE 13
Implement teacher grading/override.

PHASE 14
Implement chapter FAQ.

PHASE 15
Implement AI chapter tutor.

PHASE 16
Implement mind maps.

PHASE 17
Implement mastery tracking.

PHASE 18
Implement remedial homework.

PHASE 19
Implement analytics.

PHASE 20
Implement curriculum synchronization.

PHASE 21
Implement worksheet/PDF generation.

PHASE 22
Security/RLS.

PHASE 23
Testing.

PHASE 24
Production hardening.

---

# 65. AUTONOMOUS BEHAVIOR

Do not repeatedly ask the user what obvious implementation detail should be done next.

Inspect the repository and make reasonable engineering decisions.

If an existing feature already solves part of the requirement:

reuse it.

If an existing architecture is sound:

extend it.

If a schema change is required:

create a migration.

If a dependency is missing:

use the project's existing package manager and conventions.

Do not rewrite unrelated features.

Do not destroy existing production data.

Before destructive migrations:

create a safe migration path.

---

# 66. FINAL DELIVERY REQUIREMENT

At completion provide:

1. What was implemented.
2. Database migrations created.
3. New routes.
4. New components.
5. AI services.
6. Curriculum ingestion mechanism.
7. Current official source mappings.
8. Environment variables required.
9. Any external API requirements.
10. Tests completed.
11. Known limitations.
12. Exact instructions for importing the current TuitionTrack students/classes.
13. Exact instructions for running the curriculum sync.
14. Exact instructions for generating the first homework.
15. Exact instructions for publishing the first assignment.

Do not claim that all Classes 1–12 content has been successfully imported unless the system has actually verified the corresponding official source data.

Build the system incrementally, verify each phase, and leave the repository in a runnable state after every major phase.