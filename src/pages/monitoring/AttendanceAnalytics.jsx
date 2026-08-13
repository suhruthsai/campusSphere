// AttendanceAnalytics.jsx
import { ClipboardList } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import MonitoringLayout, { AlertPill, DonutRing, HBar, MCard } from '../../components/monitoring/MonitoringLayout.jsx';
import { attendance } from '../../data/monitoring.js';

export default function AttendanceAnalytics() {
  const { todayStudents: ts, todayFaculty: tf } = attendance;

  return (
    <MonitoringLayout
      title="Attendance Analytics"
      subtitle="Student & faculty attendance with AI-powered insights"
      icon={<ClipboardList size={22} />}
      accentColor="#818CF8"
      liveLabel="Updated today"
      kpis={[
        { label: 'Students Present', value: ts.present.toLocaleString(), icon: '🎓', unit: '',  delta: 2  },
        { label: 'Students Absent',  value: ts.absent,                  icon: '❌', unit: ''              },
        { label: 'Student %',        value: ts.percentage,              icon: '📊', unit: '%', delta: 1  },
        { label: 'Faculty Present',  value: tf.present,                 icon: '👨‍🏫', unit: '',  delta: 0  },
        { label: 'Faculty Absent',   value: tf.absent,                  icon: '❌', unit: ''              },
        { label: 'Faculty %',        value: tf.percentage,              icon: '📊', unit: '%'             },
      ]}
    >
      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        {/* Donut rings */}
        <MCard title="Today's Overview" accent="#818CF8" className="flex items-center justify-around gap-2">
          <DonutRing value={ts.present} max={ts.total} color="#818CF8" label="Students" size={100} />
          <DonutRing value={tf.present} max={tf.total} color="#00FFB3" label="Faculty"  size={100} />
        </MCard>

        {/* Department-wise */}
        <MCard title="Department Attendance %" accent="#818CF8" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={attendance.departmentWise} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <XAxis dataKey="dept" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis domain={[70, 100]} tick={{ fontSize: 9, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
              <Bar dataKey="students" name="Students %" radius={[4, 4, 0, 0]}>
                {attendance.departmentWise.map((d) => (
                  <rect key={d.dept} fill={d.color} />
                ))}
              </Bar>
              <Bar dataKey="faculty" name="Faculty %" fill="#00FFB3" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </MCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        {/* Weekly student trend */}
        <MCard title="Weekly Attendance Trend" accent="#818CF8">
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={attendance.weeklyStudents.map((w, i) => ({
              day: w.day, students: w.percentage, faculty: attendance.weeklyFaculty[i]?.percentage ?? 0,
            }))} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis domain={[50, 100]} tick={{ fontSize: 9, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
              <Line type="monotone" dataKey="students" stroke="#818CF8" strokeWidth={2} dot={{ r: 3, fill: '#818CF8' }} name="Students %" />
              <Line type="monotone" dataKey="faculty"  stroke="#00FFB3" strokeWidth={2} dot={{ r: 3, fill: '#00FFB3' }} name="Faculty %"  />
            </LineChart>
          </ResponsiveContainer>
        </MCard>

        {/* AI Insights */}
        <MCard title="AI Insights" accent="#818CF8">
          <div className="space-y-1">
            {attendance.aiInsights.map((ins) => (
              <AlertPill key={ins.id} level={ins.type} message={ins.insight} />
            ))}
          </div>
        </MCard>
      </div>

      {/* Low attenders table */}
      <MCard title="⚠️ Low Attendance — At-Risk Students" accent="#818CF8">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/8">
                {['Student', 'Department', 'Roll No', 'Attendance %', 'Risk Level'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attendance.lowAttenders.map((s, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/3 transition">
                  <td className="px-3 py-2 font-semibold text-white">{s.name}</td>
                  <td className="px-3 py-2 text-slate-400">{s.dept}</td>
                  <td className="px-3 py-2 font-mono text-slate-500">{s.rollNo}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold" style={{ color: s.attendance < 60 ? '#ef4444' : '#F59E0B' }}>{s.attendance}%</span>
                      <div className="h-1 w-20 rounded-full bg-white/8 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${s.attendance}%`, background: s.attendance < 60 ? '#ef4444' : '#F59E0B' }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.risk === 'High' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                      {s.risk}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MCard>
    </MonitoringLayout>
  );
}
