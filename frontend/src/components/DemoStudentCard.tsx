'use client';
import { TimetableTimeline } from '@/components/TimetableTimeline';

const DEMO_LESSONS = [
  { subjectName: 'English', teacherName: 'Mr J Thompson', roomName: 'B12', periodName: 'Period 1', startTime: '08:50', endTime: '09:50', isBreak: false, isAlternative: false, pupilNote: '' },
  { subjectName: '', teacherName: '', roomName: '', periodName: 'Break', startTime: '09:50', endTime: '10:10', isBreak: true, isAlternative: false, pupilNote: '' },
  { subjectName: 'Maths', teacherName: 'Mrs A Patel', roomName: 'C04', periodName: 'Period 2', startTime: '10:10', endTime: '11:10', isBreak: false, isAlternative: false, pupilNote: '' },
  { subjectName: 'Science', teacherName: 'Dr R Evans', roomName: 'Lab 2', periodName: 'Period 3', startTime: '11:10', endTime: '12:10', isBreak: false, isAlternative: false, pupilNote: '' },
  { subjectName: '', teacherName: '', roomName: '', periodName: 'Lunch', startTime: '12:10', endTime: '13:00', isBreak: true, isAlternative: false, pupilNote: '' },
  { subjectName: 'History', teacherName: 'Miss L Davies', roomName: 'A07', periodName: 'Period 4', startTime: '13:00', endTime: '14:00', isBreak: false, isAlternative: false, pupilNote: '' },
  { subjectName: 'PE', teacherName: 'Mr S Wilson', roomName: 'Sports Hall', periodName: 'Period 5', startTime: '14:00', endTime: '15:00', isBreak: false, isAlternative: false, pupilNote: '' },
];

const DEMO_STATS = {
  behaviour: 3,
  homework: 2,
  attendance: 98,
};

interface Props {
  accent: { color: string; bg: string; border: string };
}

export function DemoStudentCard({ accent }: Props) {
  return (
    <div className="card" style={{ '--accent': accent.color, '--accent-bg': accent.bg, '--accent-border': accent.border, overflow: 'hidden', padding: 0, opacity: 0.85, position: 'relative' } as any}>

      {/* Demo badge */}
      <div style={{
        position: 'absolute', top: 8, right: 8, zIndex: 20,
        background: '#6366f1', color: '#fff',
        fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
        padding: '2px 7px', borderRadius: 100, textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
      }}>DEMO</div>

      {/* Accent stripe */}
      <div style={{ height: 4, background: accent.color }} />

      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px 8px' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: accent.color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0,
        }}>DS</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>Demo Student</div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>All Saints' Catholic High School</div>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '3px 10px',
          borderRadius: 100, border: `1px solid ${accent.border}`,
          background: accent.bg, color: accent.color,
        }}>Preview</span>
      </div>

      {/* Timetable */}
      <div style={{ padding: '0 20px' }}>
        <TimetableTimeline
          lessons={DEMO_LESSONS}
          href="#"
          accent={accent}
          compact={true}
        />
      </div>

      {/* Stats row — matches real StatCell exactly */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', borderTop: '1px solid var(--border)' }}>
        {[
          { label: 'Behaviour', value: String(DEMO_STATS.behaviour), sub: 'this week', color: accent.color },
          { label: 'Homework', value: String(DEMO_STATS.homework), sub: 'to do', color: accent.color },
          { label: 'Attendance', value: `${DEMO_STATS.attendance}%`, sub: '30 days', color: 'var(--positive)' },
          { label: 'Latest News', value: 'Sports Day', sub: 'Mrs K Jones', color: accent.color, small: true },
        ].map((stat, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '14px 8px 16px', gap: 2,
            borderRight: i < 3 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 4, color: accent.color }}>{stat.label}</span>
            <span style={{ fontSize: stat.small ? 14 : 22, fontFamily: 'var(--font-display)', fontWeight: 500, color: stat.color, lineHeight: 1.1 }}>{stat.value}</span>
            <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>{stat.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
