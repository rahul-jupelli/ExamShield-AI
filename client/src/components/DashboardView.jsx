import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  CheckCircle, 
  ChevronRight, 
  Activity,
  User,
  Clock
} from 'lucide-react';
import { getBucketPublicUrl } from '../services/storageService';

export default function DashboardView({ students = [], rover = {}, alerts = [], onSelectStudent, theme = 'dark' }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'pending' | 'verified'
  const isLight = theme === 'light';

  // Strict deduplication of students by hallTicket / name / id to keep original entries only
  const uniqueStudents = useMemo(() => {
    const map = new Map();
    students.forEach(s => {
      const key = (s.hallTicket || s.name || s.id || '').trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, s);
      }
    });
    return Array.from(map.values());
  }, [students]);

  // 1. Calculate stats from deduplicated live variables
  const stats = useMemo(() => {
    const total = uniqueStudents.length;
    const verified = uniqueStudents.filter(s => s.status === 'Verified').length;
    const pending = total - verified;

    return {
      total,
      verified,
      pending
    };
  }, [uniqueStudents]);

  // 2. Filter deduplicated students based on search input & category tab
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return uniqueStudents.filter(s => {
      const isVerified = s.status === 'Verified';
      // Category filter
      if (activeCategory === 'verified' && !isVerified) return false;
      if (activeCategory === 'pending' && isVerified) return false;

      // Text query filter
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) || 
        s.hallTicket.toLowerCase().includes(q) || 
        s.seat.toLowerCase().includes(q)
      );
    });
  }, [uniqueStudents, searchQuery, activeCategory]);

  // 3. Separate into 2 groups
  const { pendingGroup, verifiedGroup } = useMemo(() => {
    const pending = [];
    const verified = [];

    filteredStudents.forEach(s => {
      if (s.status === 'Verified') {
        verified.push(s);
      } else {
        pending.push(s);
      }
    });

    return { pendingGroup: pending, verifiedGroup: verified };
  }, [filteredStudents]);

  const CATEGORY_TABS = [
    { id: 'all', label: 'All Students', count: stats.total },
    { id: 'pending', label: 'Verification Pending', count: stats.pending },
    { id: 'verified', label: 'Verified Students', count: stats.verified },
  ];

  return (
    <div className="space-y-6 pb-8 max-w-7xl mx-auto">
      
      {/* 1. Header Section */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-4 border-b ${
        isLight ? 'border-slate-200' : 'border-slate-800'
      }`}>
        <div className="space-y-1">
          <h1 className={`text-2xl font-semibold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Live Monitoring
          </h1>
          <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Monitor student verification status and room activity in real-time.
          </p>
        </div>

        {/* User / Location Info */}
        <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border shadow-sm ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#0d121f] border-slate-800'
        }`}>
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
            isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-300'
          }`}>
            <User className="h-4 w-4" />
          </div>
          <div>
            <span className={`block text-sm font-medium leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Admin Operator
            </span>
            <span className={`block text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Location: {rover.hall || 'LH-302'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Total Students */}
        <div className={`p-5 rounded-xl border flex flex-col gap-2 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0d121f] border-slate-800'
        }`}>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Users className="h-4 w-4" />
            Total Students
          </div>
          <div className={`text-3xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {stats.total}
          </div>
        </div>

        {/* Verification Pending */}
        <div className={`p-5 rounded-xl border flex flex-col gap-2 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0d121f] border-slate-800'
        }`}>
          <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-500">
            <Clock className="h-4 w-4" />
            Verification Pending
          </div>
          <div className={`text-3xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {stats.pending}
          </div>
        </div>

        {/* Verified Students */}
        <div className={`p-5 rounded-xl border flex flex-col gap-2 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0d121f] border-slate-800'
        }`}>
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-500">
            <CheckCircle className="h-4 w-4" />
            Verified Students
          </div>
          <div className={`text-3xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {stats.verified}
          </div>
        </div>

      </div>

      {/* 3. Controls (Tabs & Search) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
        <div className="flex space-x-1">
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
                  ${isActive
                    ? (isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-800 text-white')
                    : (isLight ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-900' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white')
                  }
                `}
              >
                <span>{tab.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  isActive 
                    ? (isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-700 text-slate-300')
                    : (isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-800/50 text-slate-400')
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className={`absolute left-3 top-2.5 h-4 w-4 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students..."
            className={`w-full border rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none transition-shadow ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
                : 'bg-[#0d121f] border-slate-700 text-white placeholder:text-slate-500 focus:border-slate-500 focus:ring-2 focus:ring-slate-800'
            }`}
          />
        </div>
      </div>

      {/* 4. Student Groups */}
      <div className="space-y-8">
        
        {/* Verification Pending Group */}
        {pendingGroup.length > 0 && (
          <div className="space-y-4">
            <h2 className={`text-sm font-semibold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              Verification Pending ({pendingGroup.length})
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingGroup.map((student) => (
                <div 
                  key={student.id} 
                  onClick={() => onSelectStudent(student)}
                  className={`group flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                    isLight
                      ? 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      : 'bg-[#0d121f] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <img 
                    src={getBucketPublicUrl(student.photo) || student.photo} 
                    alt={student.name} 
                    className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0 bg-slate-100 dark:bg-slate-900"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name || 'Student')}&background=F3F4F6&color=4B5563`;
                    }}
                  />
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`text-sm font-semibold truncate ${
                        isLight ? 'text-slate-900' : 'text-white'
                      }`}>{student.name}</h3>
                      <ChevronRight className={`h-4 w-4 flex-shrink-0 ${
                        isLight ? 'text-slate-400 group-hover:text-slate-600' : 'text-slate-500 group-hover:text-slate-300'
                      }`} />
                    </div>
                    <div className={`text-xs mt-1 truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {student.hallTicket} &bull; {student.room} ({student.seat})
                    </div>
                    <div className="mt-2 inline-flex">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                        Verification Pending
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verified Students Group */}
        {verifiedGroup.length > 0 && (
          <div className="space-y-4">
            <h2 className={`text-sm font-semibold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              Verified Students ({verifiedGroup.length})
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {verifiedGroup.map((student) => (
                <div 
                  key={student.id} 
                  onClick={() => onSelectStudent(student)}
                  className={`group flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                    isLight
                      ? 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      : 'bg-[#0d121f] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <img 
                    src={getBucketPublicUrl(student.photo) || student.photo} 
                    alt={student.name} 
                    className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0 bg-slate-100 dark:bg-slate-900"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name || 'Student')}&background=F3F4F6&color=4B5563`;
                    }}
                  />
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`text-sm font-semibold truncate ${
                        isLight ? 'text-slate-900' : 'text-white'
                      }`}>{student.name}</h3>
                      <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                    </div>
                    <div className={`text-xs mt-1 truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {student.hallTicket} &bull; {student.room} ({student.seat})
                    </div>
                    <div className="mt-2 inline-flex">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                        Verified Student
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredStudents.length === 0 && (
          <div className={`p-12 text-center rounded-xl border border-dashed ${
            isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#0d121f]/50 border-slate-700'
          }`}>
            <Search className={`h-8 w-8 mx-auto mb-3 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
            <h3 className={`text-sm font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>
              No students found
            </h3>
            <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Adjust your search query or filters to see more results.
            </p>
          </div>
        )}

      </div>

    </div>
  );
}
