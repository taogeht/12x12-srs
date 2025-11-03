import { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Student {
  id: string;
  username: string;
  display_name: string;
  total_reviews: number;
  correct_reviews: number;
  cards_completed: number;
  last_activity: string | null;
}

interface StudentStats {
  total_reviews: number;
  correct_reviews: number;
  cards_completed: number;
}

interface ReviewData {
  date: string;
  reviews_count: number;
  correct_count: number;
}

const PICTURE_OPTIONS = [
  { id: '1', label: 'Dog 🐶' },
  { id: '2', label: 'Cat 🐱' },
  { id: '3', label: 'Rabbit 🐰' },
  { id: '4', label: 'Fox 🦊' },
  { id: '5', label: 'Bear 🐻' }
];

export default function TeacherDashboard({ onLogout, userId }: { onLogout: () => void; userId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentStats, setStudentStats] = useState<StudentStats | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    displayName: '',
    username: '',
    picturePassword: '1'
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    try {
      const response = await fetch('/api/teacher/students', {
        headers: { 'X-User-Id': userId }
      });
      const data = await response.json();
      setStudents(data);
    } catch (err) {
      console.error('Failed to load students:', err);
    }
  }, [userId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const loadStudentStats = async (student: Student) => {
    try {
      const response = await fetch(`/api/teacher/stats/${student.id}`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        const errorMessage =
          data?.error ?? `Failed to load stats (${response.status})`;
        throw new Error(errorMessage);
      }
      setSelectedStudent(student);
      setStudentStats(
        data?.stats ?? { total_reviews: 0, correct_reviews: 0, cards_completed: 0 }
      );
      setReviewData(Array.isArray(data?.recentReviews) ? data.recentReviews : []);
    } catch (err) {
      console.error('Failed to load student stats:', err);
      setStudentStats({ total_reviews: 0, correct_reviews: 0, cards_completed: 0 });
      setReviewData([]);
    }
  };

  const resetStudent = async (studentId: string, type: 'clear' | 'reset-srs') => {
    setActionLoading(type);
    try {
      const response = await fetch(`/api/teacher/${type}/${studentId}`, {
        method: 'POST',
        headers: { 'X-User-Id': userId }
      });
      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        loadStudents();
        if (selectedStudent?.id === studentId) {
          loadStudentStats(selectedStudent);
        }
      } else {
        alert('Failed to reset student data');
      }
    } catch (err) {
      alert('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const createStudent = async () => {
    if (!addForm.displayName.trim() || !addForm.username.trim()) {
      setAddError('Please enter a display name and username.');
      return;
    }

    setAddBusy(true);
    setAddError(null);

    try {
      const response = await fetch('/api/teacher/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          displayName: addForm.displayName.trim(),
          username: addForm.username.trim(),
          picturePassword: addForm.picturePassword
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add student');
      }

      const newStudent: Student = await response.json();
      setShowAddForm(false);
      setAddForm({ displayName: '', username: '', picturePassword: '1' });
      setAddError(null);
      await loadStudents();
      setSelectedStudent(newStudent);
      setStudentStats({
        total_reviews: 0,
        correct_reviews: 0,
        cards_completed: 0
      });
      setReviewData([]);
    } catch (err: any) {
      setAddError(err.message || 'Failed to add student');
    } finally {
      setAddBusy(false);
    }
  };

  const deleteStudent = async (student: Student) => {
    const confirmed = window.confirm(`Remove ${student.display_name}? This will delete their progress.`);
    if (!confirmed) return;

    setDeleteBusyId(student.id);
    try {
      const response = await fetch(`/api/teacher/students/${student.id}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': userId }
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        const errMsg = data?.error || `Failed to delete student (${response.status})`;
        throw new Error(errMsg);
      }
      if (data?.message) {
        alert(data.message);
      }
      await loadStudents();
      if (selectedStudent?.id === student.id) {
        setSelectedStudent(null);
        setStudentStats(null);
        setReviewData([]);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete student');
    } finally {
      setDeleteBusyId(null);
    }
  };

  const chartData = {
    labels: reviewData.map(d => new Date(d.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Cards Reviewed',
        data: reviewData.map(d => d.reviews_count),
        borderColor: '#007bff',
        backgroundColor: '#007bff20',
        tension: 0.1
      },
      {
        label: 'Correct Answers',
        data: reviewData.map(d => d.correct_count),
        borderColor: '#28a745',
        backgroundColor: '#28a74520',
        tension: 0.1
      }
    ]
  };

  return (
    <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '16px 24px',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ margin: 0, color: '#333' }}>Teacher Dashboard</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => {
              setShowAddForm(prev => !prev);
              setAddError(null);
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: showAddForm ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {showAddForm ? 'Close' : 'Add Student'}
          </button>
          <button
            onClick={onLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 73px)' }}>
        {/* Student List */}
        <div style={{
          width: '350px',
          backgroundColor: 'white',
          borderRight: '1px solid #ddd',
          overflowY: 'auto'
        }}>
          <h2 style={{ padding: '16px', margin: 0, borderBottom: '1px solid #eee' }}>
            Students ({students.length})
          </h2>
          {students.map(student => (
            <div
              key={student.id}
              onClick={() => loadStudentStats(student)}
              style={{
                padding: '16px',
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
                backgroundColor: selectedStudent?.id === student.id ? '#f8f9fa' : 'white',
                transition: 'background-color 0.2s ease'
              }}
              onMouseOver={(e) => {
                if (selectedStudent?.id !== student.id) {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }
              }}
              onMouseOut={(e) => {
                if (selectedStudent?.id !== student.id) {
                  e.currentTarget.style.backgroundColor = 'white';
                }
              }}
            >
              <div style={{ fontWeight: 'bold', color: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{student.display_name} (@{student.username})</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteStudent(student);
                  }}
                  disabled={deleteBusyId === student.id}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: deleteBusyId === student.id ? 'not-allowed' : 'pointer'
                  }}
                >
                  {deleteBusyId === student.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                Reviews: {student.total_reviews} | 
                Correct: {student.correct_reviews} | 
                Completed: {student.cards_completed}
              </div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                Last activity: {student.last_activity ? new Date(student.last_activity).toLocaleDateString() : 'Never'}
              </div>
            </div>
          ))}
        </div>

        {/* Student Details */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {showAddForm && (
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #ddd',
              backgroundColor: '#ffffff'
            }}>
              <h2 style={{ margin: '0 0 16px 0', color: '#333' }}>Add Student</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: '1 1 240px' }}>
                  <label style={{ display: 'block', fontSize: '14px', color: '#555', marginBottom: '4px' }}>Display Name</label>
                  <input
                    value={addForm.displayName}
                    onChange={e => setAddForm(prev => ({ ...prev, displayName: e.target.value }))}
                    placeholder="Student Name"
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #ccc'
                    }}
                  />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '14px', color: '#555', marginBottom: '4px' }}>Username</label>
                  <input
                    value={addForm.username}
                    onChange={e => setAddForm(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="username"
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #ccc'
                    }}
                  />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '14px', color: '#555', marginBottom: '4px' }}>Picture Password</label>
                  <select
                    value={addForm.picturePassword}
                    onChange={e => setAddForm(prev => ({ ...prev, picturePassword: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #ccc'
                    }}
                  >
                    {PICTURE_OPTIONS.map(option => (
                      <option value={option.id} key={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {addError && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#f8d7da',
                  border: '1px solid #f5c6cb',
                  borderRadius: '6px',
                  color: '#721c24',
                  fontSize: '14px'
                }}>
                  {addError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={createStudent}
                  disabled={addBusy}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: addBusy ? 'not-allowed' : 'pointer'
                  }}
                >
                  {addBusy ? 'Adding…' : 'Add Student'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setAddForm({ displayName: '', username: '', picturePassword: '1' });
                    setAddError(null);
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {selectedStudent ? (
            <div style={{ padding: '24px' }}>
              <h2 style={{ margin: '0 0 24px 0', color: '#333' }}>
                {selectedStudent.display_name}'s Progress
              </h2>

              {/* Stats Summary */}
              {studentStats && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  marginBottom: '32px'
                }}>
                  <div style={{
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    border: '1px solid #ddd'
                  }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                      Total Reviews
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                      {studentStats.total_reviews}
                    </div>
                  </div>
                  <div style={{
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    border: '1px solid #ddd'
                  }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                      Correct Answers
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                      {studentStats.correct_reviews}
                    </div>
                  </div>
                  <div style={{
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    border: '1px solid #ddd'
                  }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                      Success Rate
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
                      {studentStats.total_reviews > 0 
                        ? Math.round((studentStats.correct_reviews / studentStats.total_reviews) * 100)
                        : 0}%
                    </div>
                  </div>
                </div>
              )}

              {/* Progress Chart */}
              {reviewData.length > 0 && (
                <div style={{
                  backgroundColor: 'white',
                  padding: '24px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  marginBottom: '32px'
                }}>
                  <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>
                    Progress Over Last 30 Days
                  </h3>
                  <div style={{ height: '300px' }}>
                    <Line data={chartData} options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        title: {
                          display: true,
                          text: 'Daily Progress'
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true
                        }
                      }
                    }} />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <button
                  onClick={() => resetStudent(selectedStudent.id, 'reset-srs')}
                  disabled={actionLoading === 'reset-srs'}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#ffc107',
                    color: '#212529',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: actionLoading === 'reset-srs' ? 'not-allowed' : 'pointer',
                    opacity: actionLoading === 'reset-srs' ? 0.6 : 1
                  }}
                >
                  {actionLoading === 'reset-srs' ? 'Resetting...' : 'Reset SRS Only'}
                </button>
                <button
                  onClick={() => resetStudent(selectedStudent.id, 'clear')}
                  disabled={actionLoading === 'clear'}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: actionLoading === 'clear' ? 'not-allowed' : 'pointer',
                    opacity: actionLoading === 'clear' ? 0.6 : 1
                  }}
                >
                  {actionLoading === 'clear' ? 'Clearing...' : 'Clear All Data'}
                </button>
              </div>

              <div style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>
                <strong>Reset SRS Only:</strong> Keeps cards but resets scheduling and intervals<br />
                <strong>Clear All Data:</strong> Removes all progress and card assignments
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#666'
            }}>
              Select a student to view their progress
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
