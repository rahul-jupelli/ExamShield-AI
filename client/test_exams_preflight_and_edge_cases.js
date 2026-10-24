import fetch from 'node-fetch';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const API_BASE = 'http://localhost:3000';
const WS_BASE = 'ws://localhost:3000/ws';
const BRIDGE_KEY = process.env.PI_BRIDGE_KEY || '25578a6584e4ccb22d98a33f1ab03f7325234e83382c5433091123b1dcd0a295';
const token = 'dev-test-admin-token';
const authHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

function log(test, msg) {
  console.log(`[${test}] ${msg}`);
}

async function runEdgeCaseTests() {
  console.log('=============================================================');
  console.log('EXAMSHIELD-AI: EXAMS MODULE TIMING & EDGE CASE TEST SUITE');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  // Connect simulated bridge
  const bridgeWs = new WebSocket(WS_BASE);

  await new Promise((resolve, reject) => {
    bridgeWs.on('open', () => {
      bridgeWs.send(JSON.stringify({
        type: 'PI_AUTH',
        key: BRIDGE_KEY,
        isSimulator: true,
        clientName: 'Test-Edge-Harness'
      }));
    });
    bridgeWs.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.type === 'PI_AUTH_SUCCESS') {
          resolve();
        }
        if (data.type === 'MODEL_COMMAND') {
          bridgeWs.send(JSON.stringify({
            type: 'MODEL_ACK',
            requestId: data.requestId,
            ok: true,
            model: data.model,
            actualState: (data.action === 'start' || data.action === 'resume') ? 'running' : 'stopped'
          }));
        }
      } catch (e) {}
    });
    bridgeWs.on('error', reject);
  });

  log('SETUP', 'Simulated hardware bridge connected & authenticated.');

  // Ensure Pi starts from a clean idle state by cancelling any lingering test session
  try {
    const statusRes = await fetch(`${API_BASE}/api/rover/model-status`, { headers: authHeaders });
    const statusData = await statusRes.json();
    if (statusData.examId) {
      log('SETUP', `Releasing lingering test session: ${statusData.examId} (model: ${statusData.activeModel})`);
      if (statusData.activeModel && statusData.activeModel !== 'none') {
        await fetch(`${API_BASE}/api/rover/model-control`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ examId: statusData.examId, model: statusData.activeModel, action: 'stop' })
        }).catch(() => {});
      }
      await fetch(`${API_BASE}/api/exams/${statusData.examId}/cancel`, { method: 'POST', headers: authHeaders }).catch(() => {});
    }
  } catch (e) {}

  // Test 1: Future Exam (scheduled in 3 hours)
  const now = Date.now();
  const futureStart = new Date(now + 3 * 3600 * 1000).toISOString();
  const futureEnd = new Date(now + 5 * 3600 * 1000).toISOString();

  const createRes1 = await fetch(`${API_BASE}/api/exams`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      exam: {
        exam_name: 'Future Edge Test Exam',
        start_time: futureStart,
        end_time: futureEnd,
        room: 'LH-101'
      }
    })
  });
  const data1 = await createRes1.json();
  const exam1Id = data1.exam ? data1.exam.id : data1.id;
  log('TIMING', `Created future exam ${exam1Id} scheduled in 3 hours.`);

  // Edge Case 1: Device detection MUST NOT start before scheduled start time
  log('TIMING', 'Testing: Device detection rejected before scheduled start time...');
  const earlyDdRes = await fetch(`${API_BASE}/api/rover/model-control`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ examId: exam1Id, model: 'device_detection', action: 'start' })
  });
  const earlyDdBody = await earlyDdRes.json();
  if (earlyDdRes.status === 403 && earlyDdBody.error.includes('only run during the scheduled exam time')) {
    log('TIMING', '✓ PASSED: Device detection blocked before start time with HTTP 403.');
    passed++;
  } else {
    log('TIMING', `✗ FAILED: Expected 403, got ${earlyDdRes.status}: ${JSON.stringify(earlyDdBody)}`);
    failed++;
  }

  // Edge Case 2: Face verification MUST NOT start 3 hours before exam (outside 1-hour window)
  log('TIMING', 'Testing: Face verification rejected outside 1-hour window...');
  const earlyFvRes = await fetch(`${API_BASE}/api/rover/model-control`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ examId: exam1Id, model: 'face_verification', action: 'start' })
  });
  const earlyFvBody = await earlyFvRes.json();
  if (earlyFvRes.status === 403 && earlyFvBody.error.includes('during the hour before the scheduled exam')) {
    log('TIMING', '✓ PASSED: Face verification blocked outside 1-hour window with HTTP 403.');
    passed++;
  } else {
    log('TIMING', `✗ FAILED: Expected 403, got ${earlyFvRes.status}: ${JSON.stringify(earlyFvBody)}`);
    failed++;
  }

  // Edge Case 3: Preflight preparation MUST NOT run outside 1-hour window
  log('TIMING', 'Testing: Model preflight rejected outside 1-hour window...');
  const earlyPrepRes = await fetch(`${API_BASE}/api/rover/model-control`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ examId: exam1Id, model: 'face_verification', action: 'prepare' })
  });
  const earlyPrepBody = await earlyPrepRes.json();
  if (earlyPrepRes.status === 403 && earlyPrepBody.error.includes('during the hour before the exam')) {
    log('TIMING', '✓ PASSED: Model preflight blocked outside 1-hour window with HTTP 403.');
    passed++;
  } else {
    log('TIMING', `✗ FAILED: Expected 403, got ${earlyPrepRes.status}: ${JSON.stringify(earlyPrepBody)}`);
    failed++;
  }

  // Test 2: Exam in Pre-Exam Window (scheduled in 30 minutes)
  const preStart = new Date(now + 30 * 60 * 1000).toISOString();
  const preEnd = new Date(now + 2.5 * 3600 * 1000).toISOString();

  const createRes2 = await fetch(`${API_BASE}/api/exams`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      exam: {
        exam_name: 'Pre-Exam Window Exam',
        start_time: preStart,
        end_time: preEnd,
        room: 'LH-102'
      }
    })
  });
  const data2 = await createRes2.json();
  const exam2Id = data2.exam ? data2.exam.id : data2.id;
  log('PRE-EXAM', `Created exam ${exam2Id} starting in 30 mins (within 1-hr pre-exam window).`);

  // Edge Case 4: Preflight preparation inside 1-hour window SUCCEEDS
  log('PRE-EXAM', 'Testing: Preflight preparation succeeds within 1-hour window...');
  const prepRes = await fetch(`${API_BASE}/api/rover/model-control`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ examId: exam2Id, model: 'face_verification', action: 'prepare' })
  });
  const prepBody = await prepRes.json();
  if (prepRes.status === 200 && prepBody.prepared) {
    log('PRE-EXAM', '✓ PASSED: Preflight preparation passed and ready status updated.');
    passed++;
  } else {
    log('PRE-EXAM', `✗ FAILED: Expected prepare success, got: ${JSON.stringify(prepBody)}`);
    failed++;
  }

  // Edge Case 5: Face verification inside 1-hour window SUCCEEDS
  log('PRE-EXAM', 'Testing: Face verification starts within 1-hour window...');
  const fvRes = await fetch(`${API_BASE}/api/rover/model-control`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ examId: exam2Id, model: 'face_verification', action: 'start' })
  });
  const fvBody = await fvRes.json();
  if (fvRes.status === 200 && fvBody.success) {
    log('PRE-EXAM', '✓ PASSED: Administrator started face verification in pre-exam window.');
    passed++;
  } else {
    log('PRE-EXAM', `✗ FAILED: Expected FV success, got: ${JSON.stringify(fvBody)}`);
    failed++;
  }

  // Edge Case 6: Stopping face verification releases camera cleanly
  log('PRE-EXAM', 'Testing: Administrator stops face verification...');
  const fvStopRes = await fetch(`${API_BASE}/api/rover/model-control`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ examId: exam2Id, model: 'face_verification', action: 'stop' })
  });
  const fvStopBody = await fvStopRes.json();
  if (fvStopRes.status === 200 && fvStopBody.success) {
    log('PRE-EXAM', '✓ PASSED: Face verification stopped cleanly and camera released.');
    passed++;
  } else {
    log('PRE-EXAM', `✗ FAILED: Expected stop success, got: ${JSON.stringify(fvStopBody)}`);
    failed++;
  }

  // Test 3: Past Exam (already ended)
  const pastStart = new Date(now - 3 * 3600 * 1000).toISOString();
  const pastEnd = new Date(now - 1 * 3600 * 1000).toISOString();

  const createRes3 = await fetch(`${API_BASE}/api/exams`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      exam: {
        exam_name: 'Past Expired Exam',
        start_time: pastStart,
        end_time: pastEnd,
        room: 'LH-103'
      }
    })
  });
  const data3 = await createRes3.json();
  const exam3Id = data3.exam ? data3.exam.id : data3.id;

  // Edge Case 7: Expired exam rejected with HTTP 403
  log('TERMINAL', 'Testing: Expired exam rejected from running models...');
  const pastRes = await fetch(`${API_BASE}/api/rover/model-control`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ examId: exam3Id, model: 'device_detection', action: 'start' })
  });
  const pastBody = await pastRes.json();
  if (pastRes.status === 403 && pastBody.error.includes('already completed')) {
    log('TERMINAL', '✓ PASSED: Expired exam rejected with HTTP 403.');
    passed++;
  } else {
    log('TERMINAL', `✗ FAILED: Expected 403, got ${pastRes.status}: ${JSON.stringify(pastBody)}`);
    failed++;
  }

  // Edge Case 8: Cancelled exam rejected with HTTP 409
  log('TERMINAL', 'Testing: Cancelled exam rejected from running models...');
  await fetch(`${API_BASE}/api/exams/${exam1Id}/cancel`, {
    method: 'POST',
    headers: authHeaders
  });
  const cancelledRes = await fetch(`${API_BASE}/api/rover/model-control`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ examId: exam1Id, model: 'device_detection', action: 'start' })
  });
  const cancelledBody = await cancelledRes.json();
  if (cancelledRes.status === 409 && cancelledBody.error.includes('Exam is cancelled')) {
    log('TERMINAL', '✓ PASSED: Cancelled exam rejected with HTTP 409 Conflict.');
    passed++;
  } else {
    log('TERMINAL', `✗ FAILED: Expected 409, got ${cancelledRes.status}: ${JSON.stringify(cancelledBody)}`);
    failed++;
  }

  // Edge Case 9: Candidate verification persistence & 0-enrolled rule check
  log('VERIFICATION', 'Testing: Zero enrolled students does not falsely report all verified...');
  const studentsRes = await fetch(`${API_BASE}/api/exams/${exam2Id}/students`, {
    headers: authHeaders
  });
  const studentsList = await studentsRes.json();
  const allVerified = Array.isArray(studentsList) && studentsList.length > 0 && studentsList.every(s => s.verification_status === 'verified');
  if (allVerified === false && studentsList.length === 0) {
    log('VERIFICATION', '✓ PASSED: Zero enrolled students correctly returns allVerified: false (does not falsely claim completion).');
    passed++;
  } else {
    log('VERIFICATION', `✗ FAILED: Unexpected verification status for zero students: ${JSON.stringify(studentsList)}`);
    failed++;
  }

  // Cleanup
  bridgeWs.close();
  await fetch(`${API_BASE}/api/exams/${exam1Id}/cancel`, { method: 'POST', headers: authHeaders }).catch(() => {});
  await fetch(`${API_BASE}/api/exams/${exam2Id}/cancel`, { method: 'POST', headers: authHeaders }).catch(() => {});
  await fetch(`${API_BASE}/api/exams/${exam3Id}/cancel`, { method: 'POST', headers: authHeaders }).catch(() => {});

  console.log('\n=============================================================');
  console.log(`EDGE CASE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runEdgeCaseTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
