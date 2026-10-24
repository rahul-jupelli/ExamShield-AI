import React from 'react';
import {
  ScanFace,
  ScanSearch,
  Play,
  Square,
  Pause,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Power
} from 'lucide-react';
import useModelLifecycle from '../hooks/useModelLifecycle';

function formatCountdown(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function ModelControlPanel({ exam, students, theme = 'dark', canControl = true }) {
  const isLight = theme === 'light';
  const lc = useModelLifecycle(exam, students, { canControl });
  const { fvProgress: p } = lc;

  const cardCls = `p-4 rounded-2xl border space-y-3 ${
    isLight ? 'bg-white border-slate-200' : 'bg-[#151a2d] border-slate-800'
  }`;
  const btnBase =
    'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';

  // ---- Face verification status & controls ----
  const fvPct = p.total ? Math.round((p.verified / p.total) * 100) : 0;
  const fvRunning = lc.fvRunning;
  const fvEnabled = lc.fvEnabled;

  let fvStatusBadge = null;
  if (fvRunning) {
    fvStatusBadge = (
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-blue-500/15 border-blue-500/30 text-blue-400 animate-pulse">
        Running on Pi
      </span>
    );
  } else if (fvEnabled) {
    fvStatusBadge = (
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-amber-500/15 border-amber-500/30 text-amber-400">
        {lc.piStatus.piConnected ? 'Starting…' : 'Start queued (Pi offline)'}
      </span>
    );
  } else if (lc.runtimeReady) {
    fvStatusBadge = (
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-500/30 text-emerald-400">
        Ready — waiting for admin
      </span>
    );
  } else if (lc.inPreparationWindow) {
    const faceReady = Boolean(lc.preparedModels?.face_verification);
    const deviceReady = Boolean(lc.preparedModels?.device_detection);
    fvStatusBadge = (
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-amber-500/15 border-amber-500/30 text-amber-400">
        {faceReady || deviceReady ? 'Preparing models…' : lc.piStatus.piConnected ? 'Preflight pending' : 'Waiting for Pi runtime'}
      </span>
    );
  } else {
    fvStatusBadge = (
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-slate-500/15 border-slate-500/30 text-slate-400">
        Scheduled — not in preparation window
      </span>
    );
  }

  // ---- Device detection status & controls ----
  const ddRunning = lc.ddRunning;
  const ddPaused = lc.ddPaused;
  const inExamWindow = lc.inExamWindow;
  const examOver = lc.examOver;

  let ddStatusBadge = null;
  if (examOver) {
    ddStatusBadge = (
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-slate-500/15 border-slate-500/30 text-slate-400">
        Completed
      </span>
    );
  } else if (ddRunning) {
    ddStatusBadge = (
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-500/30 text-emerald-400 animate-pulse">
        Active Patrolling
      </span>
    );
  } else if (ddPaused) {
    ddStatusBadge = (
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-amber-500/15 border-amber-500/30 text-amber-400">
        Paused by Admin
      </span>
    );
  } else if (inExamWindow) {
    ddStatusBadge = (
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-blue-500/15 border-blue-500/30 text-blue-400">
        {lc.piStatus.piConnected ? 'Starting…' : 'Pending Pi Connection'}
      </span>
    );
  } else {
    ddStatusBadge = (
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-slate-500/15 border-slate-500/30 text-slate-400">
        Starts at Exam Time
      </span>
    );
  }

  return (
    <div
      id="model-control-panel"
      className={`p-5 rounded-3xl border space-y-4 ${
        isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#0f1422] border-slate-800/80'
      }`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold tracking-tight">Rover AI Model Control (Raspberry Pi 4)</h3>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            Controls onboard camera AI models on the autonomous rover. Laptop candidate verification operates independently below.
          </p>
        </div>
        <span
          className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
            lc.piStatus.piConnected
              ? lc.isSimulated
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              : 'bg-slate-500/20 border-slate-500/30 text-slate-400'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${
            lc.piStatus.piConnected
              ? lc.isSimulated
                ? 'bg-amber-400 animate-pulse'
                : 'bg-emerald-400'
              : 'bg-slate-400'
          }`} />
          {lc.piStatus.piConnected
            ? lc.isSimulated
              ? 'Pi Simulator (Dev)'
              : 'Pi connected'
            : 'Pi offline'}
        </span>
      </div>

      {lc.piStatus.piConnected && lc.isSimulated && (
        <div className="px-3.5 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300/90 text-[11px] font-mono flex items-center gap-2">
          <span className="font-bold uppercase tracking-wider text-[9px] bg-amber-500/25 px-1.5 py-0.5 rounded text-amber-200">DEV SIMULATOR</span>
          <span>Development Raspberry Pi simulator attached. Physical camera stream and motors are simulated.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Face Verification Card on Rover */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
              <ScanFace className="h-4 w-4" /> Rover Face Verification (Pi Camera)
            </div>
            {fvStatusBadge}
          </div>

          <p className="text-[11px] text-slate-400">
            The one-hour pre-exam check validates both model weights and the real camera. Face verification starts only when an administrator presses Start. The YOLO face model locates faces; identity matching requires the enrolled FaceNet/MTCNN pipeline.
          </p>

          {!inExamWindow && !examOver && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
              <Clock className="h-3.5 w-3.5" /> Exam starts in {formatCountdown(lc.timeToExamStart)}. {lc.inPreparationWindow ? 'Runtime preflight is active.' : 'Runtime preflight begins one hour before the exam.'}
            </p>
          )}

          {inExamWindow && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" /> Exam in progress — Prohibited device detection is the primary patrol model.
            </p>
          )}

          {lc.ddRunning && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] font-mono flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Rover device detection is active. Pause device detection first to switch rover camera mode.</span>
            </div>
          )}

          {canControl && (
            <div className="pt-1 flex items-center gap-2 flex-wrap">
              <button
                id="fv-toggle-btn"
                onClick={lc.toggleFaceVerification}
                disabled={!lc.canToggleFV || lc.busy}
                className={`${btnBase} ${
                  fvEnabled
                    ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
                title={lc.ddRunning ? 'Pause device detection before starting face verification' : fvEnabled ? 'Stop verification; you can start it again before exam time' : 'Start face verification for assigned students'}
              >
                <Power className="h-3.5 w-3.5" />
                {fvEnabled ? 'Stop Face Verification' : 'Start Face Verification'}
              </button>

              {lc.ddRunning && (
                <button
                  onClick={lc.switchModelToFaceVerification}
                  disabled={lc.busy}
                  className={`${btnBase} bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25`}
                  title="Perform a coordinated stop of device detection and start rover face verification"
                >
                  <ScanFace className="h-3.5 w-3.5" /> Switch Camera to Face Verification
                </button>
              )}
            </div>
          )}
        </div>

        {/* Prohibited Device Detection Card */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <ScanSearch className="h-4 w-4" /> Rover Device Detection (Pi Camera)
            </div>
            {ddStatusBadge}
          </div>

          <p className="text-[11px] text-slate-400">
            Real-time YOLO prohibited device detection (new_device_latest.pt) for phones, earbuds, and smartwatches.
          </p>

          <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
            {inExamWindow ? (
              <><Clock className="h-3.5 w-3.5 text-emerald-400" /> Exam ends in {formatCountdown(lc.timeToExamEnd)} — Device detection auto-completes then.</>
            ) : examOver ? (
              <><CheckCircle2 className="h-3.5 w-3.5 text-slate-400" /> Scheduled exam has concluded. AI camera workers released.</>
            ) : (
              <><Clock className="h-3.5 w-3.5" /> Starts automatically at scheduled exam start ({formatCountdown(lc.timeToExamStart)} remaining).</>
            )}
          </p>

          {lc.piStatus.fps != null && ddRunning && (
            <p className="text-[11px] font-mono text-slate-400">{Number(lc.piStatus.fps).toFixed(1)} FPS inference speed</p>
          )}

          {canControl && (
            <div className="pt-1 flex items-center gap-2 flex-wrap">
              {/* Stop Detection = Temporary Pause */}
              <button
                id="dd-stop-btn"
                onClick={lc.pauseDeviceDetection}
                disabled={!lc.canPauseDD || lc.busy}
                className={`${btnBase} bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25`}
                title="Pause AI device detection safely and release camera"
              >
                <Pause className="h-3.5 w-3.5" /> Stop Detection
              </button>

              {/* Resume Detection */}
              <button
                id="dd-resume-btn"
                onClick={lc.resumeDeviceDetection}
                disabled={!lc.canResumeDD || lc.busy}
                className={`${btnBase} bg-emerald-600 hover:bg-emerald-500 text-white`}
                title="Resume AI device detection for active exam"
              >
                <Play className="h-3.5 w-3.5" /> Resume Detection
              </button>
            </div>
          )}
        </div>
      </div>

      {lc.piBusyElsewhere && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-mono flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>The Raspberry Pi is currently allocated to active session {lc.piStatus.examId ? `"${lc.piStatus.examId}"` : ''}. Only one exam session can own the Pi at a time.</span>
        </div>
      )}

      {lc.error && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-mono flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{lc.error}</span>
        </div>
      )}
    </div>
  );
}
