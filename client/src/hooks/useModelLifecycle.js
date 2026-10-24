import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  sendModelControl,
  getModelStatus,
  getStudentVerificationStatus
} from '../services/examService';

const FV = 'face_verification';
const DD = 'device_detection';
const CLOCK_MS = 1000;
const STATUS_POLL_MS = 3000;

const EMPTY_STATUS = {
  piConnected: false,
  isSimulated: false,
  activeModel: 'none',
  examId: null,
  status: 'stopped',
  fps: null,
  lifecycle: {
    fvRunning: false,
    fvEverStarted: false,
    fvEnabled: false,
    ddManuallyStopped: false,
    isPaused: false,
    preparedModels: { face_verification: false, device_detection: false },
    runtimeReady: false,
    readyAt: null
  }
};

export default function useModelLifecycle(exam, students = [], { canControl = true } = {}) {
  const examId = exam?.id;
  const cancelled = exam?.status === 'cancelled';
  const completed = exam?.status === 'completed';

  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Clock for countdowns
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    if (!examId) return;
    const st = await getModelStatus(examId);
    setStatus({
      ...EMPTY_STATUS,
      ...st,
      lifecycle: { ...EMPTY_STATUS.lifecycle, ...(st.lifecycle || {}) }
    });
  }, [examId]);

  // Poll server state
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (!examId) return;
      const st = await getModelStatus(examId);
      if (alive) {
        setStatus({
          ...EMPTY_STATUS,
          ...st,
          lifecycle: { ...EMPTY_STATUS.lifecycle, ...(st.lifecycle || {}) }
        });
      }
    };
    poll();
    const t = setInterval(poll, STATUS_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [examId]);

  const run = useCallback(
    async (model, action, options = {}) => {
      if (!canControl || !exam) return;
      setBusy(true);
      setError(null);
      try {
        await sendModelControl(exam, model, action, options);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
        refresh();
      }
    },
    [canControl, exam, refresh]
  );

  // Candidate verification statistics
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

  const examStart = exam ? new Date(exam.start_time).getTime() : 0;
  const examEnd = exam ? new Date(exam.end_time).getTime() : 0;
  const inExamWindow = now >= examStart && now < examEnd;
  const inPreparationWindow = examStart > 0 && now >= examStart - 60 * 60 * 1000 && now < examStart;
  const examOver = completed || cancelled || (examEnd > 0 && now >= examEnd);
  const preparedModels = status.lifecycle?.preparedModels || EMPTY_STATUS.lifecycle.preparedModels;
  const runtimeReady = Boolean(status.lifecycle?.runtimeReady);

  const fvEnabled = Boolean(status.lifecycle?.fvEnabled || exam?.face_verification_enabled);
  const fvRunning = Boolean(
    (status.activeModel === FV && String(status.examId) === String(examId) && status.status === 'running') ||
    (status.lifecycle?.fvRunning && status.status !== 'stopped' && (status.activeModel === FV || status.activeModel === 'none'))
  );
  const ddPaused = Boolean(status.lifecycle?.ddManuallyStopped || status.lifecycle?.isPaused || status.status === 'paused' || exam?.device_detection_paused);
  const ddRunning = Boolean(status.activeModel === DD && String(status.examId) === String(examId) && status.status === 'running');
  const ddConflictWithFV = ddRunning || (status.activeModel === DD && String(status.examId) === String(examId));

  const piBusyElsewhere =
    (status.activeModel !== 'none' || status.status === 'paused' || status.status === 'running') &&
    !!status.examId &&
    String(status.examId) !== String(examId);

  // Unified lifecycle phase descriptor
  const modelPhase = useMemo(() => {
    if (examOver) return 'completed';
    if (inExamWindow) {
      if (ddRunning) return 'device_detection';
      if (ddPaused) return 'device_detection_paused';
      return 'device_detection_pending';
    }
    // Pre-exam window
    if (fvRunning) return 'face_verification';
    if (fvEnabled) return 'face_verification_pending';
    if (inPreparationWindow && runtimeReady) return 'ready';
    if (inPreparationWindow) return 'preparing';
    return 'idle';
  }, [examOver, inExamWindow, ddRunning, ddPaused, fvRunning, fvEnabled, inPreparationWindow, runtimeReady]);

  return {
    modelPhase,
    fvProgress,
    fvEnabled,
    fvRunning,
    ddPaused,
    ddRunning,
    ddConflictWithFV,
    piStatus: status,
    isSimulated: Boolean(status.isSimulated),
    piBusyElsewhere,
    busy,
    error,
    inExamWindow,
    inPreparationWindow,
    runtimeReady,
    preparedModels,
    examOver,
    // Permissions & actionable states
    canToggleFV: canControl && !busy && !examOver && !ddRunning && !piBusyElsewhere && (fvEnabled || fvRunning || ((inPreparationWindow || status.piConnected) && !fvProgress.allVerified)),
    canPauseDD: canControl && !busy && inExamWindow && !examOver && !ddPaused,
    canResumeDD: canControl && !busy && inExamWindow && !examOver && ddPaused,
    timeToExamStart: Math.max(0, examStart - now),
    timeToExamEnd: Math.max(0, examEnd - now),
    // Actions
    enableFaceVerification: () => run(FV, 'start'),
    disableFaceVerification: () => run(FV, 'stop'),
    toggleFaceVerification: () => run(FV, fvEnabled ? 'stop' : 'start'),
    switchModelToFaceVerification: () => run(FV, 'start', { switchModel: true }),
    switchModelToDeviceDetection: () => run(DD, 'start', { switchModel: true }),
    pauseDeviceDetection: () => run(DD, 'pause'),
    resumeDeviceDetection: () => run(DD, 'resume'),
    stopDeviceDetection: () => run(DD, 'pause'),
    restartDeviceDetection: () => run(DD, 'resume')
  };
}
