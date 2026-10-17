import React from 'react';
import {
  ScanFace,
  ScanSearch,
  Play,
  Square,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2
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

const PHASE_LABELS = {
  idle: 'Unavailable',
  ready_to_verify: 'Ready to verify',
  face_verification: 'Running',
  fv_complete: 'Stopped',
  transitioning: 'Starting device detection…',
  object_detection: 'Running',
  od_stopped: 'Stopped manually'
};

export default function ModelControlPanel({ exam, students, theme = 'dark', canControl = true }) {
  const isLight = theme === 'light';
  const lc = useModelLifecycle(exam, students, { canControl });
  const { modelPhase: phase, fvProgress: p } = lc;

  const cardCls = `p-4 rounded-2xl border space-y-3 ${
    isLight ? 'bg-white border-slate-200' : 'bg-[#151a2d] border-slate-800'
  }`;
  const btnBase =
    'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';

  // ---- Face verification card ----
  const fvActive = phase === 'face_verification';
  const fvPct = p.total ? Math.round((p.verified / p.total) * 100) : 0;
  let fvButton = null;
  if (phase === 'face_verification') {
    fvButton = (
      <button
        id="fv-stop-btn"
        onClick={lc.stopFaceVerification}
        disabled={!lc.canStopFV}
        className={`${btnBase} bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25`}
      >
        <Square className="h-3.5 w-3.5" /> Stop Face Verification
      </button>
    );
  } else if (phase === 'ready_to_verify' || phase === 'fv_complete') {
    const restart = phase === 'fv_complete';
    fvButton = (
      <button
        id="fv-start-btn"
        onClick={lc.startFaceVerification}
        disabled={!lc.canStartFV}
        className={`${btnBase} bg-blue-600 hover:bg-blue-500 text-white`}
      >
        <Play className="h-3.5 w-3.5" /> {restart ? 'Restart Face Verification' : 'Start Face Verification'}
      </button>
    );
  } else {
    fvButton = (
      <button disabled className={`${btnBase} bg-slate-500/10 border border-slate-500/20 text-slate-400`}>
        {phase === 'idle' ? 'Face Verification Unavailable' : 'FV Window Closed'}
      </button>
    );
  }

  // ---- Device detection card ----
  let ddButton = (
    <button disabled className={`${btnBase} bg-slate-500/10 border border-slate-500/20 text-slate-400`}>
      {phase === 'idle' && exam && new Date(exam.end_time) <= new Date() ? 'Exam Completed' : 'Starts at Exam Time'}
    </button>
  );
  if (phase === 'object_detection') {
    ddButton = (
      <button
        id="dd-stop-btn"
        onClick={lc.stopDeviceDetection}
        disabled={!lc.canStopDD}
        className={`${btnBase} bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25`}
      >
        <Square className="h-3.5 w-3.5" /> Stop Device Detection
      </button>
    );
  } else if (phase === 'od_stopped') {
    ddButton = (
      <button
        id="dd-restart-btn"
        onClick={lc.restartDeviceDetection}
        disabled={!lc.canRestartDD}
        className={`${btnBase} bg-emerald-600 hover:bg-emerald-500 text-white`}
      >
        <Play className="h-3.5 w-3.5" /> Restart Device Detection
      </button>
    );
  }

  const ddActive = phase === 'object_detection';

  return (
    <div
      id="model-control-panel"
      className={`p-5 rounded-3xl border space-y-4 ${
        isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#0f1422] border-slate-800/80'
      }`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold tracking-tight">AI Model Control (Raspberry Pi 4)</h3>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${
            lc.piStatus.piConnected
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              : 'bg-slate-500/20 border-slate-500/30 text-slate-400'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${lc.piStatus.piConnected ? 'bg-emerald-400' : 'bg-slate-400'}`} />
          {lc.piStatus.piConnected ? 'Pi connected' : 'Pi offline'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Face Verification */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
              <ScanFace className="h-4 w-4" /> Face Verification
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              fvActive
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-400 animate-pulse'
                : 'bg-slate-500/15 border-slate-500/30 text-slate-400'
            }`}>
              {phase === 'face_verification' || phase === 'ready_to_verify' || phase === 'fv_complete'
                ? PHASE_LABELS[phase]
                : phase === 'idle' ? 'Unavailable' : 'Ended'}
            </span>
          </div>

          <div>
            <div className="h-2 rounded-full bg-slate-500/20 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${fvPct}%` }} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] font-mono text-slate-400">
              <span className="text-emerald-400">✓ {p.verified}/{p.total} verified</span>
              <span className="text-rose-400">✗ {p.failed} failed</span>
              <span className="text-amber-400">🚫 {p.absent} absent</span>
              <span>⏳ {p.pending} pending</span>
            </div>
          </div>

          {p.total === 0 && (
            <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> No students assigned — FV won't auto-stop until exam start.
            </p>
          )}
          {(phase === 'ready_to_verify' || phase === 'face_verification' || phase === 'fv_complete') && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Exam starts in {formatCountdown(lc.timeToExamStart)} — FV force-stops then.
            </p>
          )}
          {phase === 'transitioning' && (
            <p className="text-[11px] text-blue-400 flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Exam started — server is stopping face verification and starting device detection…
            </p>
          )}

          {canControl ? fvButton : null}
        </div>

        {/* Device Detection */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <ScanSearch className="h-4 w-4" /> Device Detection
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              ddActive
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 animate-pulse'
                : 'bg-slate-500/15 border-slate-500/30 text-slate-400'
            }`}>
              {ddActive ? 'Running' : phase === 'od_stopped' ? 'Stopped manually' : phase === 'transitioning' && lc.timeToExamStart === 0 ? 'Starting…' : 'Not started'}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            {ddActive || phase === 'od_stopped' ? (
              <><Clock className="h-3.5 w-3.5" /> Exam ends in {formatCountdown(lc.timeToExamEnd)} — DD auto-stops then.</>
            ) : (
              <><CheckCircle2 className="h-3.5 w-3.5" /> Starts automatically at exam time, only after FV is confirmed stopped.</>
            )}
          </p>

          {lc.piStatus.fps != null && ddActive && (
            <p className="text-[11px] font-mono text-slate-400">{Number(lc.piStatus.fps).toFixed(1)} FPS</p>
          )}

          {canControl ? ddButton : null}
        </div>
      </div>

      {lc.piBusyElsewhere && (
        <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> The Pi is currently running a model for another exam.
        </p>
      )}
      {lc.error && (
        <p className="text-[11px] text-rose-400 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> {lc.error}
        </p>
      )}
    </div>
  );
}
