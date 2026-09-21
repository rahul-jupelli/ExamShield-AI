# ExamShield Face Enrollment Corrected Files

## What was fixed
1. Registration uploads the actual enrollment image to Supabase Storage `student-photos`.
2. FaceNet embedding is generated from the SAME original image bytes after upload.
   The embedding step no longer downloads the public Storage URL, so a private/blocked
   Storage URL cannot break biometric generation.
3. No random, deterministic, or fake embedding fallback exists anywhere in the enrollment pipeline.
4. The embedding must be exactly 512 finite values and exactly one face must be detected.
5. The server sends the embedding to Supabase as a numeric array, which is the correct
   representation for a PostgreSQL `vector(512)` column through Supabase/PostgREST.
6. Preset/external profile images were removed from student enrollment; only an uploaded
   image or camera capture can be registered.
7. Legacy FaceNet maintenance scripts no longer create fake embeddings.
8. A non-destructive SQL migration is included for verifying/fixing the FaceNet vector column
   and Storage policies.

## Files
- client/src/components/AddStudentView.jsx
- client/src/services/embeddingService.js
- client/src/services/storageService.js
- client/src/App.jsx
- client/server.js
- embedding_server.py
- client/generate_embeddings_facenet.py
- client/generate_facenet_single.py
- client/update_all_students_facenet.py
- supabase_face_embedding_migration.sql

## Run
Terminal 1 (from ExamShield-AI):
    python embedding_server.py

Terminal 2:
    cd client
    npm run dev

The embedding server must be running on:
    http://localhost:5005

The web application runs according to `PORT` in client/.env (currently 3000).

## Database
The live project previously used a pgvector `students.faceEmbedding` column. The included
migration is safe to run against the live database and does not drop the students table.
Do NOT run the old `client/supabase_schema.sql` to repair embeddings: that file is a stale
full-reset schema and declares faceEmbedding as TEXT.

## Enrollment flow
Student photo -> Supabase Storage upload -> real FaceNet 512-D embedding from same image ->
POST /api/students -> pgvector column.

If a face is not detected, multiple faces are detected, the embedding server is unavailable,
or Supabase rejects the upload/insert, registration fails instead of inventing an embedding.
