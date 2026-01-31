/**
 * Quick API Call Examples for SOTW Data
 * Use these to integrate SOTW data into your frontend
 */

// Example 1: Get Current Week's SOTW Winner
const getSotwWinner = async () => {
  const response = await fetch('/api/sotw/current');
  const data = await response.json();
  
  console.log('Current SOTW Winner:', data);
  /*
  {
    "success": true,
    "winner": {
      "user_id": "695c7554f9d6072b4e29fbe6",
      "name": "Abolude Testimony",
      "user": {
        "name": "Abolude Testimony",
        "institution": "FUTMinna",
        "profilePicture": "...",
        "username": "abolude_testimony"
      },
      "weekly_score": 240,
      "start_date": "2026-01-19T00:00:00Z",
      "end_date": "2026-01-25T23:59:59Z",
      "winner_quote": ""
    }
  }
  */
};

// Example 2: Get SOTW Archive (Past Winners)
const getSotwArchive = async () => {
  const response = await fetch('/api/sotw/archive');
  const data = await response.json();
  
  console.log('Past SOTW Winners:', data);
  /*
  {
    "success": true,
    "archive": [
      {
        "id": "...",
        "name": "Abolude Testimony",
        "weekly_score": 240,
        "start_date": "2026-01-19T00:00:00Z",
        "end_date": "2026-01-25T23:59:59Z",
        "winner_quote": ""
      }
    ]
  }
  */
};

// Example 3: Command Line Check
// npm run check-sotw
// Shows:
// - Top 10 weekly leaderboard
// - Winner details
// - Institution breakdown
// - Performance metrics

// Example 4: Get Weekly Leaderboard (from gamification route)
const getWeeklyLeaderboard = async () => {
  const response = await fetch('/api/gamification/leaderboard');
  const data = await response.json();
  
  console.log('Weekly Leaderboard:', data);
  /*
  {
    "leaderboard": [
      {
        "rank": 1,
        "name": "Abolude Testimony",
        "total_xp": 240,
        "level": 6,
        "badges": ["ActiveLearner"]
      }
    ]
  }
  */
};

// ============================================
// SOTW WEEKLY DASHBOARD DATA
// ============================================

const getSotwDashboardData = async () => {
  try {
    // Fetch current week's winner
    const winnerRes = await fetch('/api/sotw/current');
    const winner = await winnerRes.json();
    
    // Fetch recent activity
    const activityRes = await fetch('/api/gamification/recent-activity', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const activities = await activityRes.json();
    
    return {
      currentWinner: winner.winner,
      recentActivities: activities.activities,
      weekRange: {
        start: winner.winner?.start_date,
        end: winner.winner?.end_date
      }
    };
  } catch (error) {
    console.error('Error fetching SOTW data:', error);
  }
};

// ============================================
// SOTW WINNER CARD COMPONENT (React)
// ============================================

/*
import React, { useEffect, useState } from 'react';

function SotwWinnerCard() {
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sotw/current')
      .then(res => res.json())
      .then(data => {
        if (data.winner) {
          setWinner(data.winner);
        }
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!winner) return <div>No winner yet</div>;

  return (
    <div className="sotw-card">
      <div className="trophy">🏆</div>
      <h2>Student of the Week</h2>
      
      <div className="winner-info">
        <img 
          src={winner.user.profilePicture} 
          alt={winner.name}
          className="profile-pic"
        />
        <h3>{winner.name}</h3>
        <p className="institution">{winner.institution}</p>
        
        <div className="stats">
          <div className="stat">
            <span className="label">Weekly XP</span>
            <span className="value">⚡ {winner.weekly_score}</span>
          </div>
          <div className="stat">
            <span className="label">Level</span>
            <span className="value">📈 {Math.floor(winner.weekly_score / 100) + 1}</span>
          </div>
        </div>

        <div className="quote">
          {winner.winner_quote ? (
            <p>"{winner.winner_quote}"</p>
          ) : (
            <p className="no-quote">Quote coming soon...</p>
          )}
        </div>

        <p className="week-range">
          {new Date(winner.start_date).toLocaleDateString()} - {new Date(winner.end_date).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

export default SotwWinnerCard;
*/

// ============================================
// SOTW WEEKLY STATS COMPONENT (React)
// ============================================

/*
import React, { useEffect, useState } from 'react';

function SotwWeeklyStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/sotw/current').then(r => r.json()),
      fetch('/api/gamification/leaderboard').then(r => r.json())
    ]).then(([winner, leaderboard]) => {
      setStats({
        winner: winner.winner,
        leaderboard: leaderboard.leaderboard,
        gap: winner.winner?.weekly_score - leaderboard.leaderboard?.[1]?.total_xp
      });
    });
  }, []);

  if (!stats) return <div>Loading...</div>;

  return (
    <div className="sotw-stats">
      <div className="stat-card">
        <h3>This Week's Leader</h3>
        <p className="leader-name">🥇 {stats.winner?.name}</p>
        <p className="leader-score">{stats.winner?.weekly_score} XP</p>
      </div>

      <div className="stat-card">
        <h3>Leader Gap</h3>
        <p className="gap">{stats.gap} XP ahead</p>
        <p className="percentage">{((stats.gap / stats.winner?.weekly_score) * 100).toFixed(0)}% lead</p>
      </div>

      <div className="stat-card">
        <h3>Top 3 This Week</h3>
        <ol>
          {stats.leaderboard?.slice(0, 3).map((user, i) => (
            <li key={i}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {user.name} - {user.total_xp} XP
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default SotwWeeklyStats;
*/

console.log('SOTW API Integration Examples Ready');
console.log('See comments above for React component examples');
