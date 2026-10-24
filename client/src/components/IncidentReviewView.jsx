import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Users,
  Building,
  Calendar
} from 'lucide-react';
import IncidentReviewModal from './IncidentReviewModal';
import { formatKolkata } from '../utils/timezone';
import {
  getAllIncidents,
  getExams,
  getExamStudents,
  updateIncidentReview,
  subscribeToExamUpdates
} from '../services/examService';

export default function IncidentReviewView({
  theme = 'dark',
  role = 'Admin',
  operatorName = 'Admin Officer'
}) {
  const isLight = theme === 'light';

  const [incidents, setIncidents] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deviceClassFilter, setDeviceClassFilter] = useState('ALL');

  // Selected incident for modal
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [modalAssignedStudents, setModalAssignedStudents] = useState([]);
  const [loadError, setLoadError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [incs, examList] = await Promise.all([
        getAllIncidents(),
        getExams()
      ]);
      setIncidents(incs || []);
      setExams(examList || []);
    } catch (err) {
      console.error('Error loading incidents:', err);
      setLoadError(err.message || 'Failed to load device incidents from database.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription
  useEffect(() => {
    const unsubscribe = subscribeToExamUpdates((payload) => {
      if (payload.table === 'device_incidents') {
        loadData();
      }
    });
    return () => unsubscribe();
  }, [loadData]);

  // Unique device classes
  const deviceClasses = useMemo(() => {
    const set = new Set();
    incidents.forEach(i => {
      if (i.detected_class) set.add(i.detected_class);
    });
    return Array.from(set);
  }, [incidents]);

  // Counts
  const counts = useMemo(() => {
    const total = incidents.length;
    const pending = incidents.filter(i => i.review_status === 'pending').length;
    const confirmed = incidents.filter(i => i.review_status === 'confirmed').length;
    const dismissed = incidents.filter(i => i.review_status === 'dismissed').length;
    return { total, pending, confirmed, dismissed };
  }, [incidents]);

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return incidents.filter(inc => {
      if (statusFilter !== 'ALL' && inc.review_status !== statusFilter) return false;
      if (deviceClassFilter !== 'ALL' && inc.detected_class !== deviceClassFilter) return false;
      if (!q) return true;
      const dev = (inc.detected_class || '').toLowerCase();
      const examName = (inc.exam?.exam_name || '').toLowerCase();
      const studentName = (inc.student?.name || '').toLowerCase();
      const id = (inc.id || '').toLowerCase();
      return dev.includes(q) || examName.includes(q) || studentName.includes(q) || id.includes(q);
    });
  }, [incidents, statusFilter, deviceClassFilter, searchQuery]);

  // Handle open review modal
  const handleOpenReview = async (incident) => {
    setSelectedIncident(incident);
    try {
      if (incident.exam_id) {
        const assigned = await getExamStudents(incident.exam_id);
        setModalAssignedStudents(assigned || []);
      } else {
        setModalAssignedStudents([]);
      }
    } catch {
      setModalAssignedStudents([]);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-4 border-b ${
        isLight ? 'border-slate-200' : 'border-slate-800'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Device Incident Review & Audit Queue
            </h1>
            {counts.pending > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold">
                {counts.pending} Awaiting Review
              </span>
            )}
          </div>
          <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Inspect AI rover device detections, review multi-frame visual evidence, and record official violation decisions.
          </p>
        </div>

        <button
          onClick={loadData}
          title="Refresh Incidents"
          className={`p-2.5 rounded-2xl border text-slate-400 hover:text-white cursor-pointer transition-colors ${
            isLight ? 'bg-white border-slate-300' : 'bg-[#121626] border-slate-800'
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error Alert */}
      {loadError && (
        <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className={`p-4 rounded-3xl border flex items-center justify-between ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#101424] border-slate-800/80'
        }`}>
          <div>
            <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">Total Detections</span>
            <span className="text-2xl font-bold font-mono mt-1 block">{counts.total}</span>
          </div>
          <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>

        <div className={`p-4 rounded-3xl border flex items-center justify-between ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#101424] border-slate-800/80'
        }`}>
          <div>
            <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">Pending Review</span>
            <span className="text-2xl font-bold font-mono text-amber-400 mt-1 block">{counts.pending}</span>
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className={`p-4 rounded-3xl border flex items-center justify-between ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#101424] border-slate-800/80'
        }`}>
          <div>
            <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">Confirmed Violations</span>
            <span className="text-2xl font-bold font-mono text-rose-400 mt-1 block">{counts.confirmed}</span>
          </div>
          <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>

        <div className={`p-4 rounded-3xl border flex items-center justify-between ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#101424] border-slate-800/80'
        }`}>
          <div>
            <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">Dismissed Cases</span>
            <span className="text-2xl font-bold font-mono text-slate-400 mt-1 block">{counts.dismissed}</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <XCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by device class, candidate name, or exam..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-3.5 py-2.5 rounded-2xl text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900'
                : 'bg-[#101424] border-slate-800 text-white placeholder-slate-500'
            }`}
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'ALL', label: 'All Reviews' },
            { id: 'pending', label: 'Pending' },
            { id: 'confirmed', label: 'Confirmed' },
            { id: 'dismissed', label: 'Dismissed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium border cursor-pointer transition-all ${
                statusFilter === tab.id
                  ? 'bg-rose-600 border-rose-500 text-white shadow-sm'
                  : isLight
                  ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  : 'bg-[#101424] border-slate-800 text-slate-400 hover:bg-[#181d33]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Incidents List */}
      {loading ? (
        <div className="py-24 text-center font-mono text-xs text-slate-400">
          <div className="h-8 w-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Synchronizing incident logs and evidence vaults...
        </div>
      ) : filteredIncidents.length === 0 ? (
        <div className="py-20 text-center rounded-3xl border border-dashed border-slate-800 p-8 space-y-3">
          <ShieldAlert className="h-10 w-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-300">No Incidents Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No device incidents match the selected filter criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIncidents.map((incident) => {
            const examObj = incident.exam || exams.find(e => e.id === incident.exam_id);
            const studentObj = incident.student;

            const statusStyles = {
              pending: {
                badge: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
                label: 'Pending Review'
              },
              confirmed: {
                badge: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
                label: 'Confirmed Violation'
              },
              dismissed: {
                badge: 'bg-slate-500/15 border-slate-500/30 text-slate-400',
                label: 'Dismissed'
              }
            }[incident.review_status] || {
              badge: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
              label: 'Pending'
            };

            return (
              <div
                key={incident.id}
                className={`p-5 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                  isLight
                    ? 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                    : 'bg-[#101424] border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border uppercase font-bold ${statusStyles.badge}`}>
                      {statusStyles.label}
                    </span>
                    <span className="text-sm font-bold text-white">
                      {incident.detected_class}
                    </span>
                    <span className="text-xs font-mono text-amber-400">
                      Confidence: {(incident.confidence * (incident.confidence > 1 ? 1 : 100)).toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
                    <span>Incident: {incident.id?.slice(0, 8)}</span>
                    <span>Exam: {examObj?.exam_name || 'Scheduled Exam'}</span>
                    <span>Captured: {formatKolkata(incident.created_at, 'short')}</span>
                    <span>Frames: {incident.qualifying_frames || (incident.evidence_paths?.length || 0)}</span>
                    {incident.evidence_complete ? (
                      <span className="text-emerald-400 font-bold">✓ 20 Frames Collected</span>
                    ) : (
                      <span className="text-amber-400 font-bold" title="Fewer than 20 frames before timeout">
                        ⚠ Incomplete Evidence
                      </span>
                    )}
                    {studentObj && (
                      <span className="text-blue-400 font-bold">
                        Associated: {studentObj.name} ({studentObj.hallTicket || studentObj.id})
                      </span>
                    )}
                  </div>

                  {incident.reviewed_by && (
                    <p className="text-[11px] font-mono text-slate-500">
                      Audit: Decision logged by {incident.reviewed_by} at {formatKolkata(incident.reviewed_at, 'short')}
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => handleOpenReview(incident)}
                    className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Audit Evidence</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {selectedIncident && (
        <IncidentReviewModal
          incident={selectedIncident}
          exam={selectedIncident.exam || exams.find(e => e.id === selectedIncident.exam_id)}
          assignedStudents={modalAssignedStudents}
          theme={theme}
          role={role}
          currentReviewer={operatorName}
          onClose={() => setSelectedIncident(null)}
          onUpdateReview={async (id, data) => {
            await updateIncidentReview(id, data);
            loadData();
          }}
        />
      )}
    </div>
  );
}
