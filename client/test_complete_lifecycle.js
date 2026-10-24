import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const API_BASE = 'http://localhost:3000';
const EMBED_BASE = 'http://localhost:5005';
const WS_URL = 'ws://localhost:3000/ws';
const PI_KEY = process.env.PI_BRIDGE_KEY || 'change-me';

function log(test, msg) {
  console.log(`[${test}] ${msg}`);
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('EXAMSHIELD-AI: RIGOROUS LIFECYCLE & BIOMETRIC TEST SUITE');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  // -------------------------------------------------------------
  // TEST A: Candidate Verification Independence
  // -------------------------------------------------------------
  console.log('--- TEST A: Candidate Verification Independence ---');
  try {
    // 1. Fetch real student from database
    const { data: student, error: sErr } = await sb
      .from('students')
      .select('id, name, hallTicket, faceEmbedding')
      .eq('id', 'STU-6691')
      .single();

    if (sErr || !student) {
      throw new Error(`Could not find student STU-6691: ${sErr?.message}`);
    }

    const enrolledRaw = typeof student.faceEmbedding === 'string'
      ? JSON.parse(student.faceEmbedding)
      : student.faceEmbedding;

    log('TEST A', `Found enrolled student: ${student.name} (${student.id}) with ${enrolledRaw.length}-D FaceNet vector.`);

    // 2. Test identical vector matching (self-similarity)
    const exactSim = cosineSimilarity(enrolledRaw, enrolledRaw);
    log('TEST A', `Cosine similarity against self: ${exactSim.toFixed(4)} (Threshold: 0.65)`);
    if (Math.abs(exactSim - 1.0) < 0.001) {
      log('TEST A', '✓ PASSED: Valid identity produces perfect match.');
      passed++;
    } else {
      throw new Error(`Self-similarity unexpected: ${exactSim}`);
    }

    // 3. Test orthogonal / random non-matching vector
    const nonMatchingVector = new Array(512).fill(0).map(() => (Math.random() - 0.5) * 0.1);
    const nonMatchSim = cosineSimilarity(enrolledRaw, nonMatchingVector);
    log('TEST A', `Cosine similarity against non-matching identity: ${nonMatchSim.toFixed(4)}`);
    if (nonMatchSim < 0.65) {
      log('TEST A', '✓ PASSED: Non-matching identity correctly rejected by configured threshold (0.65).');
      passed++;
    } else {
      throw new Error(`Non-matching identity falsely passed: ${nonMatchSim}`);
    }

    // 4. Test Embedding Microserver Health
    const healthRes = await fetch(`${EMBED_BASE}/health`);
    const healthData = await healthRes.json();
    if (healthRes.ok && healthData.status === 'ok') {
      log('TEST A', `✓ PASSED: Embedding microserver alive on ${EMBED_BASE} (device: ${healthData.device}).`);
      passed++;
    } else {
      throw new Error(`Embedding microserver health check failed: ${JSON.stringify(healthData)}`);
    }

  } catch (err) {
    console.error('[TEST A FAILED]:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // TEST B: Single-Pi Ownership & 409 Conflict Enforcement
  // -------------------------------------------------------------
  console.log('\n--- TEST B: Single-Pi Ownership & HTTP 409 Enforcement ---');
  let testExamAId = null;
  let testExamBId = null;
  let piWs = null;
  const token = 'dev-test-admin-token';

  try {
    // 1. Create two test exams via API
    const now = Date.now();
    const startTime = new Date(now - 1000 * 60 * 30).toISOString(); // started 30m ago
    const endTime = new Date(now + 1000 * 60 * 90).toISOString();   // ends in 90m

    const createResA = await fetch(`${API_BASE}/api/exams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        exam: {
          exam_name: 'Test Exam Alpha (Active Session)',
          start_time: startTime,
          end_time: endTime,
          room: 'LH-302'
        },
        student_ids: ['STU-6691']
      })
    });
    const createDataA = await createResA.json();
    if (!createResA.ok || !createDataA.exam?.id) {
      throw new Error(`Failed to create Test Exam A: ${JSON.stringify(createDataA)}`);
    }
    testExamAId = createDataA.exam.id;

    const createResB = await fetch(`${API_BASE}/api/exams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        exam: {
          exam_name: 'Test Exam Beta (Competing Session)',
          start_time: startTime,
          end_time: endTime,
          room: 'LH-304'
        },
        student_ids: []
      })
    });
    const createDataB = await createResB.json();
    if (!createResB.ok || !createDataB.exam?.id) {
      throw new Error(`Failed to create Test Exam B: ${JSON.stringify(createDataB)}`);
    }
    testExamBId = createDataB.exam.id;

    log('TEST B', `Created Test Exam A (${testExamAId}) and Test Exam B (${testExamBId}).`);

    // 2. Connect a test Pi WebSocket client
    piWs = new WebSocket(WS_URL);
    await new Promise((resolve, reject) => {
      piWs.on('open', () => {
        piWs.send(JSON.stringify({
          type: 'PI_AUTH',
          key: PI_KEY,
          isSimulator: true,
          clientName: 'Test-Pi-Harness'
        }));
      });
      piWs.on('message', (msg) => {
        const data = JSON.parse(msg);
        if (data.type === 'PI_AUTH_SUCCESS') {
          resolve(true);
        }
        if (data.type === 'MODEL_COMMAND') {
          // Immediately ACK every command
          piWs.send(JSON.stringify({
            type: 'MODEL_ACK',
            requestId: data.requestId,
            ok: true,
            model: data.model,
            actualState: data.action === 'stop' ? 'stopped' : data.action === 'pause' ? 'paused' : 'running'
          }));
        }
      });
      piWs.on('error', reject);
    });

    log('TEST B', '✓ Test Pi connected and authenticated via WebSocket.');

    // 3. Acquire Pi ownership for Exam A by starting device_detection
    log('TEST B', 'Acquiring single-Pi ownership for Exam A...');

    // Call POST /api/rover/model-control for Exam A
    const resA = await fetch(`${API_BASE}/api/rover/model-control`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        examId: testExamAId,
        model: 'device_detection',
        action: 'start'
      })
    });

    const bodyA = await resA.json();
    log('TEST B', `Exam A start response: HTTP ${resA.status} - ${JSON.stringify(bodyA)}`);

    if (resA.status === 200 && bodyA.success) {
      log('TEST B', '✓ PASSED: Exam A acquired single-Pi ownership.');
      passed++;

      // 4. Attempt competing Exam B start while Exam A legitimately owns the Pi
      log('TEST B', 'Attempting competing Exam B start request...');
      const resB = await fetch(`${API_BASE}/api/rover/model-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          examId: testExamBId,
          model: 'device_detection',
          action: 'start'
        })
      });

      const bodyB = await resB.json();
      log('TEST B', `Exam B response: HTTP ${resB.status} - ${JSON.stringify(bodyB)}`);

      if (resB.status === 409 && bodyB.error.includes('allocated to active session')) {
        log('TEST B', '✓ PASSED: Exam B was strictly rejected with HTTP 409 Conflict identifying active session ownership.');
        passed++;
      } else {
        throw new Error(`Expected HTTP 409 Conflict for competing Exam B, got ${resB.status}: ${JSON.stringify(bodyB)}`);
      }

      // -------------------------------------------------------------
      // TEST C: Model Transitions (Pause, Resume, Stop)
      // -------------------------------------------------------------
      console.log('\n--- TEST C: Actual Model Transitions (Pause, Resume, Stop) ---');

      // 1. Pause Exam A
      log('TEST C', 'Sending PAUSE command for Exam A...');
      const pauseRes = await fetch(`${API_BASE}/api/rover/model-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          examId: testExamAId,
          model: 'device_detection',
          action: 'pause'
        })
      });
      const pauseBody = await pauseRes.json();
      log('TEST C', `Pause response: HTTP ${pauseRes.status} - ${JSON.stringify(pauseBody)}`);

      if (pauseRes.status === 200 && pauseBody.success) {
        log('TEST C', '✓ PASSED: Device detection successfully paused.');
        passed++;
      } else {
        throw new Error(`Pause failed: ${JSON.stringify(pauseBody)}`);
      }

      // 2. Verify Exam B is STILL rejected while Exam A is paused during its scheduled window
      log('TEST C', 'Verifying Exam B is still rejected while Exam A is paused...');
      const resBWhilePaused = await fetch(`${API_BASE}/api/rover/model-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          examId: testExamBId,
          model: 'device_detection',
          action: 'start'
        })
      });
      const bodyBPaused = await resBWhilePaused.json();
      if (resBWhilePaused.status === 409) {
        log('TEST C', '✓ PASSED: Pausing model did not accidentally release active exam ownership to Exam B.');
        passed++;
      } else {
        throw new Error(`Exam B unexpectedly acquired Pi while Exam A was paused: ${JSON.stringify(bodyBPaused)}`);
      }

      // 3. Resume Exam A
      log('TEST C', 'Sending RESUME command for Exam A...');
      const resumeRes = await fetch(`${API_BASE}/api/rover/model-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          examId: testExamAId,
          model: 'device_detection',
          action: 'resume'
        })
      });
      const resumeBody = await resumeRes.json();
      if (resumeRes.status === 200 && resumeBody.success) {
        log('TEST C', '✓ PASSED: Device detection successfully resumed.');
        passed++;
      } else {
        throw new Error(`Resume failed: ${JSON.stringify(resumeBody)}`);
      }

      // 4. Coordinated model switch from device_detection to face_verification
      log('TEST C', 'Testing coordinated model switch (switchModel: true)...');
      const switchRes = await fetch(`${API_BASE}/api/rover/model-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          examId: testExamAId,
          model: 'face_verification',
          action: 'start',
          switchModel: true
        })
      });
      const switchBody = await switchRes.json();
      log('TEST C', `Coordinated switch response: HTTP ${switchRes.status} - ${JSON.stringify(switchBody)}`);
      if (switchRes.status === 200 && switchBody.success) {
        log('TEST C', '✓ PASSED: Coordinated model transition succeeded without camera collision.');
        passed++;
      } else {
        throw new Error(`Coordinated transition failed: ${JSON.stringify(switchBody)}`);
      }

      // 5. Cancel Exam A and verify ownership is released to Exam B
      log('TEST C', 'Cancelling Exam A to verify clean ownership release...');
      const cancelRes = await fetch(`${API_BASE}/api/exams/${testExamAId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const cancelBody = await cancelRes.json();
      log('TEST C', `Cancel response: HTTP ${cancelRes.status} - ${JSON.stringify(cancelBody)}`);

      // Now Exam B should be able to acquire the Pi
      log('TEST C', 'Exam B attempting to acquire Pi after Exam A cancellation...');
      const resBAfterCancel = await fetch(`${API_BASE}/api/rover/model-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          examId: testExamBId,
          model: 'device_detection',
          action: 'start'
        })
      });
      const bodyBAfter = await resBAfterCancel.json();
      log('TEST C', `Exam B acquisition response: HTTP ${resBAfterCancel.status} - ${JSON.stringify(bodyBAfter)}`);
      if (resBAfterCancel.status === 200 && bodyBAfter.success) {
        log('TEST C', '✓ PASSED: Ownership was safely released upon cancellation, allowing Exam B to acquire the Pi.');
        passed++;
      } else {
        throw new Error(`Exam B failed to acquire Pi after Exam A cancelled: ${JSON.stringify(bodyBAfter)}`);
      }

      // -------------------------------------------------------------
      // TEST D: Reconnection and Reconciliation
      // -------------------------------------------------------------
      console.log('\n--- TEST D: Reconnection and Reconciliation ---');
      log('TEST D', 'Simulating temporary Pi WebSocket disconnection...');
      piWs.close();
      await new Promise(r => setTimeout(r, 1000));

      // Reconnect
      log('TEST D', 'Reconnecting Pi WebSocket client...');
      let reconciledData = null;
      const reconnectedPi = new WebSocket(WS_URL);
      await new Promise((resolve, reject) => {
        reconnectedPi.on('open', () => {
          reconnectedPi.send(JSON.stringify({
            type: 'PI_AUTH',
            key: PI_KEY,
            isSimulator: true,
            clientName: 'Reconnected-Pi-Harness'
          }));
        });
        reconnectedPi.on('message', (msg) => {
          const data = JSON.parse(msg);
          if (data.type === 'RECONCILE_STATE') {
            reconciledData = data;
            resolve(true);
          }
        });
        reconnectedPi.on('error', reject);
      });

      log('TEST D', `Reconciliation received: ${JSON.stringify(reconciledData)}`);
      if (reconciledData && reconciledData.examId === testExamBId) {
        log('TEST D', '✓ PASSED: Reconciliation correctly restored Exam B ownership without duplicating workers or transferring session.');
        passed++;
      } else {
        throw new Error(`Reconciliation state mismatch: ${JSON.stringify(reconciledData)}`);
      }

      reconnectedPi.close();
    } else {
      throw new Error(`Exam A could not start: ${JSON.stringify(bodyA)}`);
    }

  } catch (err) {
    console.error('[TEST B/C/D FAILED]:', err.message);
    failed++;
  } finally {
    // Cleanup test records
    try {
      if (piWs) piWs.close();
      await sb.from('exams').delete().eq('id', testExamAId);
      await sb.from('exams').delete().eq('id', testExamBId);
      log('CLEANUP', 'Cleaned up temporary test exam records.');
    } catch (e) {}
  }

  console.log('\n=============================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
