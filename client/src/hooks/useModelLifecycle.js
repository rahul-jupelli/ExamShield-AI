import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  isInFVWindow,
  isInDDWindow,
  sendModelControl,
  getModelStatus,
  getStudentVerificationStatus
} from '../services/examService';

/**
 * Read-only view of the model lifecycle for one exam + manual commands.
 *
 * ALL automation lives on the server (see modelSchedulerTick in server.js), so it
 * works even when nobody has this page open:
 *   - FV auto-stops when every enrolled student is 'verified', or force-stops at exam start
 *   - DD auto-starts at exam start once FV is confirmed stopped on the Pi, auto-stops at exam end
 *
 * This hook only polls the server state and sends the evaluator's manual actions:
 *   start / restart / stop Face Verification (inside [start-60min, start))
 *   stop / restart Device Detection (inside [start, end))
 *
 * Phases: idle | ready_to_verify | face_verification | fv_complete |
 *         transitioning | object_detection | od_stopped
 */

const FV = 'face_verification';
const DD = 'device_detection';
const CLOCK_MS = 1000;
const STATUS_POLL_MS = 3000;

const EMPTY_STATUS = {
  piConnected: false,
  activeModel: 'none',
  examId: null,
  lifecycle: { fvRunning: false, fvEverStarted: false, ddManuallyStopped: false }
};

export default function useModelLifecycle(exam, students = [], { canControl = true } = {}) {
  const examId = exam?.id;
  const cancelled = exam?.status === 'cancelled';

  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Clock (countdowns / phase boundaries)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    const st = await getModelStatus(examId);
    setStatus({ ...EMPTY_STATUS, ...st, lifecycle: { ...EMPTY_STATUS.lifecycle, ...(st.lifecycle || {}) } });
  }, [examId]);

  // Poll server state (Pi connection, running model, per-exam lifecycle flags)
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      const st = await getModelStatus(examId);
      if (alive) setStatus({ ...EMPTY_STATUS, ...st, lifecycle: { ...EMPTY_STATUS.lifecycle, ...(st.lifecycle || {}) } });
    };
    poll();
    const t = setInterval(poll, STATUS_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [examId]);

  const run = useCallback(
    async (model, action) => {
      if (!canControl || !exam) return;
      setBusy(true);
      setError(null);
      try {
        await sendModelControl(exam, model, action);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
        refresh();
      }
    },
    [canControl, exam, refresh]
  );

  // ---- Student progress (display only; the server evaluates the auto-stop itself) ----
  const fvProgress = useMemo(() => {
    const total = students.length;
    const count = (st) => students.filter((s) => getStudentVerificationStatus(s) === st).length;
    const verified = count('verified');
    return {
      total,
      verified,
      failed: count('failed'),
      absent: count('absent'),
      pending: count('unverified'),
      allVerified: total > 0 && verified === total
    };
  }, [students]);

  const { fvRunning, fvEverStarted, ddManuallyStopped } = status.lifecycle;
  const inFVWindow = isInFVWindow(exam, now);
  const inExamWindow = isInDDWindow(exam, now);
  const examOver = !!exam && (cancelled || now >= new Date(exam.end_time).getTime());
  const ddRunningHere = status.activeModel === DD && status.examId === examId;

  const modelPhase = useMemo(() => {
    if (!exam || examOver) return 'idle';
    if (inFVWindow) {
      if (fvRunning) return 'face_verification';
      if (fvEverStarted) return 'fv_complete';
      return 'ready_to_verify';
    }
    if (inExamWindow) {
      // FV can never be active here; the server stops it and then starts DD
      if (ddRunningHere) return 'object_detection';
      if (ddManuallyStopped) return 'od_stopped';
      return 'transitioning';
    }
    return 'idle';
  }, [exam, examOver, inFVWindow, inExamWindow, fvRunning, fvEverStarted, ddManuallyStopped, ddRunningHere]);

  const piBusyElsewhere =
    status.activeModel !== 'none' && !!status.examId && status.examId !== examId;

  const examStart = exam ? new Date(exam.start_time).getTime() : 0;
  const examEnd = exam ? new Date(exam.end_time).getTime() : 0;

  return {
    modelPhase,
    fvProgress,
    piStatus: status,
    piBusyElsewhere,
    busy,
    error,
    canStartFV: canControl && !busy && !piBusyElsewhere && inFVWindow && !fvRunning,
    canStopFV: canControl && !busy && inFVWindow && fvRunning,
    canStopDD: canControl && !busy && modelPhase === 'object_detection',
    canRestartDD: canControl && !busy && !piBusyElsewhere && modelPhase === 'od_stopped',
    timeToExamStart: Math.max(0, examStart - now),
    timeToExamEnd: Math.max(0, examEnd - now),
    startFaceVerification: () => run(FV, 'start'),
    restartFaceVerification: () => run(FV, 'start'),
    stopFaceVerification: () => run(FV, 'stop'),
    stopDeviceDetection: () => run(DD, 'stop'),
    restartDeviceDetection: () => run(DD, 'start')
  };
}
