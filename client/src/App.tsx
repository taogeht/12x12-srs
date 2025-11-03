import { useEffect, useState } from 'react';
import { CardDTO, Grade } from './types';
import { statusFor } from './lib/time';
import LoginPage from './LoginPage';
import TeacherDashboard from './TeacherDashboard';

interface User {
  id: string;
  username: string;
  display_name: string;
  user_type: string;
}

type PracticeSet = '9x9' | 'full';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionSize, setSessionSize] = useState<number | null>(null);
  const [practiceSet, setPracticeSet] = useState<PracticeSet | null>(null);
  const [cards, setCards] = useState<CardDTO[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isTeacherRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/teacher');

  useEffect(() => {
    if (!currentUser) return;
    if (isTeacherRoute && currentUser.user_type !== 'teacher') {
      setCurrentUser(null);
      window.location.href = '/';
    }
  }, [currentUser, isTeacherRoute]);

  useEffect(() => {
    if (
      sessionSize !== null &&
      practiceSet !== null &&
      currentUser &&
      currentUser.user_type !== 'teacher'
    ) {
      let active = true;
      setLoading(true);
      setError(null);
      (async () => {
        try {
          const params = new URLSearchParams();
          params.set('limit', String(sessionSize));
          params.set('set', practiceSet);
          const res = await fetch(`/api/cards?${params.toString()}`, {
            headers: { 'X-User-Id': currentUser.id }
          });
          if (!res.ok) {
            throw new Error(`Failed to load cards: ${res.status}`);
          }
          const data: CardDTO[] = await res.json();
          if (active) {
            setCards(data);
          }
        } catch (err) {
          console.error('Failed to fetch cards', err);
          if (active) {
            setCards([]);
            setError('Unable to load cards right now. Please try again.');
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      })();
      return () => {
        active = false;
      };
    }
  }, [sessionSize, practiceSet, currentUser]);

  // Show login page if no user is logged in
  if (!currentUser) {
    return (
      <LoginPage
        onLogin={setCurrentUser}
        mode={isTeacherRoute ? 'teacher' : 'student'}
      />
    );
  }

  // Show teacher dashboard if user is teacher
  if (currentUser.user_type === 'teacher') {
    if (!isTeacherRoute) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f5f5f5',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '48px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            textAlign: 'center',
            maxWidth: '520px'
          }}>
            <h1 style={{ marginBottom: '16px', color: '#dc3545' }}>Teacher Portal Required</h1>
            <p style={{ marginBottom: '24px', color: '#666' }}>
              Teacher accounts must sign in from <code>/teacher</code>.
            </p>
            <button
              onClick={() => {
                setCurrentUser(null);
                window.location.href = '/teacher';
              }}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Go to Teacher Login
            </button>
          </div>
        </div>
      );
    }
    return <TeacherDashboard userId={currentUser.id} onLogout={() => setCurrentUser(null)} />;
  }

  if (practiceSet === null || sessionSize === null) {
    return (
      <SessionSetup
        initialSet={practiceSet}
        onStart={({ size, chosenSet }) => {
          setError(null);
          setCards([]);
          setCurrentCardIndex(0);
          setPracticeSet(chosenSet);
          setSessionSize(size);
        }}
      />
    );
  }

  if (loading) return <div>Loading…</div>;

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '48px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '520px'
        }}>
          <h1 style={{ marginBottom: '16px', color: '#dc3545' }}>Something went wrong</h1>
          <p style={{ marginBottom: '24px', color: '#666' }}>{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              setCards([]);
              setCurrentCardIndex(0);
              setPracticeSet(null);
              setSessionSize(null);
            }}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Back to Session Setup
          </button>
        </div>
      </div>
    );
  }

  if (currentCardIndex >= cards.length) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '48px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h1 style={{ marginBottom: '16px', color: '#28a745' }}>🎉 Session Complete!</h1>
          <p style={{ marginBottom: '32px', color: '#666' }}>
            You've reviewed all {cards.length} cards in this session.
          </p>
          <button
            onClick={() => {
              setSessionSize(null);
              setLoading(true);
              setCards([]);
              setPracticeSet(null);
              setCurrentCardIndex(0);
            }}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentCardIndex];
  const isLastCard = currentCardIndex === cards.length - 1;

  return (
    <div>
      <div style={{ padding: '16px', borderBottom: '1px solid #ddd', marginBottom: '16px' }}>
          <button 
            onClick={() => {
              setSessionSize(null);
              setLoading(true);
              setCards([]);
              setPracticeSet(null);
              setError(null);
              setCurrentCardIndex(0);
            }}
            style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            ← Back to Session Setup
        </button>
        <div>
          <h2 style={{ margin: '8px 0' }}>
            {currentUser.display_name}'s Practice: Card {currentCardIndex + 1} of {cards.length}
          </h2>
          <div style={{ fontSize: '14px', color: '#666', margin: '0 0 8px 0' }}>
            @{currentUser.username} • Student Account
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Practice Set: {practiceSet === '9x9' ? '9×9 Times Table' : 'Full Times Table'}
          </div>
        </div>
      </div>
      <SingleCard
        card={currentCard}
        onUpdate={(updated) => {
          setCards(prev => prev.map(x => x.card_state_id === updated.card_state_id ? updated : x));
        }}
        onNext={() => setCurrentCardIndex(prev => prev + 1)}
        isLastCard={isLastCard}
        userId={currentUser.id}
      />
    </div>
  );
}

function SessionSetup({
  onStart,
  initialSet
}: {
  onStart: (options: { size: number; chosenSet: PracticeSet }) => void;
  initialSet?: PracticeSet | null;
}) {
  const [selectedSet, setSelectedSet] = useState<PracticeSet | null>(initialSet ?? null);

  useEffect(() => {
    setSelectedSet(initialSet ?? null);
  }, [initialSet]);

  const setOptions: { id: PracticeSet; label: string; description: string }[] = [
    { id: '9x9', label: '9×9', description: 'Focus on factors 1–9' },
    { id: 'full', label: 'Full Table', description: 'Complete factors 1–12' }
  ];
  const sessionSizes = [5, 10, 15, 20];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '48px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h1 style={{ marginBottom: '8px', color: '#333' }}>12x12</h1>
        <p style={{ marginBottom: '16px', color: '#666' }}>Pick a practice set, then choose your session size.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {setOptions.map(option => {
            const isSelected = selectedSet === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setSelectedSet(option.id)}
                style={{
                  padding: '20px 24px',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  border: isSelected ? '2px solid #28a745' : '2px solid #007bff',
                  backgroundColor: isSelected ? '#28a745' : 'white',
                  color: isSelected ? 'white' : '#007bff',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {option.label}
                <div style={{ fontSize: '14px', fontWeight: 'normal', marginTop: '8px', color: isSelected ? 'white' : '#555' }}>
                  {option.description}
                </div>
              </button>
            );
          })}
        </div>

        <p style={{ marginBottom: '16px', color: '#666' }}>How many cards would you like to practice?</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {sessionSizes.map(size => (
            <button
              key={size}
              onClick={() => {
                if (!selectedSet) return;
                onStart({ size, chosenSet: selectedSet });
              }}
              disabled={!selectedSet}
              style={{
                padding: '24px 32px',
                fontSize: '24px',
                fontWeight: 'bold',
                border: '2px solid #007bff',
                backgroundColor: !selectedSet ? '#f1f1f1' : 'white',
                color: !selectedSet ? '#999' : '#007bff',
                borderRadius: '8px',
                cursor: !selectedSet ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '120px'
              }}
            >
              {size}
            </button>
          ))}
        </div>
        
        <p style={{ fontSize: '14px', color: '#999' }}>
          Cards will be selected from those due for review
        </p>
      </div>
    </div>
  );
}

function SingleCard({ 
  card, 
  onUpdate, 
  onNext, 
  isLastCard,
  userId
}: { 
  card: CardDTO; 
  onUpdate: (updated: CardDTO) => void; 
  onNext: () => void; 
  isLastCard: boolean;
  userId: string;
}) {
  const [showBack, setShowBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const color = statusFor(card.next_review); // red/yellow/green
  const due = color === 'red';

  const grade = async (label: Grade) => {
    if (busy || hasAnswered) return;
    setBusy(true);
    setHasAnswered(true);

    try {
      const res = await fetch(`/api/review/${card.card_state_id}`, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({ grade: label })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onUpdate({ ...card,
        next_review: data.next_review,
        interval_days: data.interval_days,
        ease_factor: data.ease_factor,
        repetitions: data.repetitions
      });
      
      // Auto-advance to next card after grading
      setTimeout(() => {
        onNext();
        setShowBack(false);
        setHasAnswered(false);
      }, 1000);
    } catch {
      alert('Failed to submit review.');
      setBusy(false);
      setHasAnswered(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      padding: '20px'
    }}>
      <div style={{
        border: '2px solid #ddd',
        borderRadius: '12px',
        padding: '40px',
        minHeight: '300px',
        width: '100%',
        maxWidth: '600px',
        backgroundColor: 
          color === 'red' ? '#ffe5e5' :
          color === 'yellow' ? '#fff7cc' : '#e8ffe8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: '24px',
        fontWeight: 'bold',
        cursor: due && !showBack ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}
      onClick={() => { 
        if (due && !showBack && !hasAnswered) {
          setShowBack(true);
        }
      }}
      onMouseOver={(e) => {
        if (due && !showBack && !hasAnswered) {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
        }
      }}
      onMouseOut={(e) => {
        if (due && !showBack && !hasAnswered) {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        }
      }}
      >
        <div style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>
          {!showBack ? 'Question' : 'Answer'}
        </div>
        <div style={{ minHeight: '60px' }}>
          {showBack ? card.back : card.front}
        </div>
      </div>

      {showBack && !hasAnswered && (
        <div style={{ 
          marginTop: '30px', 
          display: 'flex', 
          gap: '16px',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          {[
            { label: 'again', color: '#dc3545' },
            { label: 'hard', color: '#fd7e14' },
            { label: 'good', color: '#28a745' },
            { label: 'easy', color: '#007bff' }
          ].map(({ label, color }) => (
            <button
              key={label}
              onClick={(e) => { 
                e.stopPropagation(); 
                grade(label as 'again'|'hard'|'good'|'easy'); 
              }}
              disabled={busy}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: color,
                color: 'white',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.6 : 1,
                transition: 'all 0.2s ease',
                minWidth: '80px'
              }}
              onMouseOver={(e) => {
                if (!busy) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = `0 4px 8px ${color}40`;
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {hasAnswered && (
        <div style={{ 
          marginTop: '20px', 
          padding: '12px 20px',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '8px',
          color: '#155724',
          fontSize: '14px'
        }}>
          ✓ Moving to next card...
        </div>
      )}

      {!due && !hasAnswered && (
        <div style={{ 
          marginTop: '20px', 
          padding: '12px 20px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '8px',
          color: '#721c24',
          fontSize: '14px'
        }}>
          This card is not due for review yet
        </div>
      )}
    </div>
  );
}
