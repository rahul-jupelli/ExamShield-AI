import React, { useRef, useEffect, useState } from 'react';
import { Download, Share2, Copy, Check, QrCode, Sparkles } from 'lucide-react';
import QRCode from 'qrcode';

export default function StudentQRCode({ student = {}, theme = 'dark' }) {
  const canvasRef = useRef(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const isLight = theme === 'light';

  const studentId = String(student.id || '').trim();
  const studentName = String(student.name || 'Student').trim();

  // Render 100% compliant, camera-scannable QR code onto HTML5 canvas using official qrcode library
  useEffect(() => {
    if (!studentId || !canvasRef.current) return;

    const canvas = canvasRef.current;
    
    QRCode.toCanvas(
      canvas,
      studentId,
      {
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      },
      (err) => {
        if (err) {
          console.error('[StudentQRCode] Canvas QR render error:', err);
        }
      }
    );
  }, [studentId]);

  // Toast notification helper
  const showToast = (text) => {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Download QR Code as PNG image
  const handleDownload = () => {
    if (!canvasRef.current) return;
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const cleanName = studentName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `QRCode_${cleanName}_${studentId}.png`;

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(`Downloaded ${filename}`);
    } catch (err) {
      console.error('Download error:', err);
      showToast('Download failed');
    }
  };

  // Native Web Share API or Clipboard Fallback
  const handleShare = async () => {
    if (!canvasRef.current) return;

    try {
      const canvas = canvasRef.current;
      const dataUrl = canvas.toDataURL('image/png');
      const blob = await (await fetch(dataUrl)).blob();
      const cleanName = studentName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const file = new File([blob], `QRCode_${cleanName}_${studentId}.png`, { type: 'image/png' });

      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: `ExamShield ID QR Code - ${studentName}`,
          text: `Student Column ID: ${studentId}\nName: ${studentName}`,
          files: [file]
        });
        showToast('Shared successfully!');
      } else if (navigator.share) {
        await navigator.share({
          title: `ExamShield ID QR Code - ${studentName}`,
          text: `Student Column ID: ${studentId}\nName: ${studentName}`
        });
        showToast('Shared text details!');
      } else {
        // Fallback: Copy Student ID & QR Details to Clipboard
        await navigator.clipboard.writeText(`ExamShield Student QR ID: ${studentId} (${studentName})`);
        showToast('Student ID copied to clipboard for sharing!');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Share notice:', err);
        try {
          await navigator.clipboard.writeText(`Student Column ID: ${studentId}`);
          showToast('Student ID copied to clipboard!');
        } catch (clipErr) {
          showToast('Share not supported on this browser');
        }
      }
    }
  };

  // Copy Column ID to Clipboard
  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(studentId);
      setCopied(true);
      showToast('Column ID copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showToast('Copy failed');
    }
  };

  return (
    <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
      isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-[#060a12] border-blue-900/30 text-white'
    }`}>
      
      {/* Toast Notification Alert */}
      {toastMsg && (
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-lg animate-in fade-in">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-5">
        
        {/* Scannable QR Code Canvas Box */}
        <div className="relative p-3 rounded-2xl bg-white border border-slate-300 dark:border-slate-700 shadow-lg flex-shrink-0 group">
          <canvas
            ref={canvasRef}
            className="w-36 h-36 sm:w-40 sm:h-40 rounded-lg block object-contain shadow-inner"
          />
          <div className="absolute inset-0 rounded-2xl border-2 border-blue-500/0 group-hover:border-blue-500/40 pointer-events-none transition-all" />
        </div>

        {/* QR Code Info & Action Buttons */}
        <div className="flex-1 text-center sm:text-left space-y-3">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 inline-flex items-center gap-1">
              <QrCode className="h-3 w-3" />
              IDENTIFIER QR MATRIX
            </span>
            <h4 className="text-sm font-extrabold mt-1.5 font-sans">
              Student Column ID QR Code
            </h4>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Embedded value generated directly from database record primary key:
            </p>
          </div>

          {/* Embedded Column ID Display Box */}
          <div className={`p-2.5 rounded-xl border flex items-center justify-between font-mono text-xs ${
            isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-950 border-slate-800 text-blue-300'
          }`}>
            <span className="truncate font-bold max-w-[200px]" title={studentId}>
              {studentId || 'N/A'}
            </span>
            <button
              onClick={handleCopyId}
              title="Copy Column ID"
              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          {/* Action Buttons: Download & Share */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
            <button
              onClick={handleDownload}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-sans transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Image</span>
            </button>

            <button
              onClick={handleShare}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold font-sans border transition-all flex items-center gap-1.5 cursor-pointer ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Share2 className="h-3.5 w-3.5 text-blue-400" />
              <span>Share QR Code</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
