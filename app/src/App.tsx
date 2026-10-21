import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { firebaseAuth } from './firebase';
import './auth.css';
import {
  Activity,
  AlarmClock,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  Globe,
  Home,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  Pause,
  Play,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Target,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
const starterApps = [
  { name: 'YouTube', icon: '▶', color: '#f43f46', enabled: true },
  { name: 'Instagram', icon: '◎', color: '#c43c9a', enabled: true },
  { name: 'TikTok', icon: '♪', color: '#10151d', enabled: true },
  { name: 'X (Twitter)', icon: '𝕏', color: '#05070a', enabled: true },
  { name: 'Discord', icon: '◕', color: '#5965ef', enabled: true },
  { name: 'Amazon', icon: 'a', color: '#171d28', enabled: true },
];
const loadSaved = () => {
  try {
    return JSON.parse(localStorage.getItem('vexgridlock-state') || '{}');
  } catch {
    return {};
  }
};
const clock = n =>
  String(Math.floor(Math.max(0, n) / 60)).padStart(2, '0') +
  ':' +
  String(Math.max(0, n) % 60).padStart(2, '0');
const dateKey = () => new Date().toLocaleDateString('en-CA');

function App() {
  const [saved] = useState(loadSaved);
  const [extensionId, setExtensionId] = useState(saved.extensionId || '');
  const [page, setPage] = useState('Home');
  const [mobileNav, setMobileNav] = useState(false);
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [apps, setApps] = useState(saved.apps || starterApps);
  const [sites, setSites] = useState(saved.sites || []);
  const [tab, setTab] = useState('Apps');
  const [search, setSearch] = useState('');
  const [newApp, setNewApp] = useState('');
  const [newSite, setNewSite] = useState('');
  const [siteError, setSiteError] = useState('');
  const [duration, setDuration] = useState(saved.duration || 25);
  const [deadline, setDeadline] = useState(saved.deadline || 0);
  const [remaining, setRemaining] = useState(
    saved.deadline
      ? Math.max(0, Math.ceil((saved.deadline - Date.now()) / 1000))
      : 0
  );
  const [active, setActive] = useState(
    Boolean(saved.deadline && saved.deadline > Date.now())
  );
  const [confirmStart, setConfirmStart] = useState(false);
  const [sessions, setSessions] = useState(saved.sessions || []);
  const [scheduleOn, setScheduleOn] = useState(saved.scheduleOn ?? true);
  const [start, setStart] = useState(saved.start || '18:00');
  const [end, setEnd] = useState(saved.end || '22:00');
  const [days, setDays] = useState(
    saved.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  );
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState('Checking schedule…');
  const [lastAutoStartKey, setLastAutoStartKey] = useState('');
  const [strict, setStrict] = useState(saved.strict ?? true);
  const [notifications, setNotifications] = useState(
    saved.notifications ?? true
  );
  const [dark, setDark] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => {
    // Remove referral tracking from the visible URL without reloading the app.
    const url = new URL(window.location.href);
    if (url.searchParams.has('utm_source')) {
      url.searchParams.delete('utm_source');
      const cleanUrl = url.pathname + (url.search ? url.search : '') + url.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, currentUser => {
      setUser(currentUser ? { email: currentUser.email, name: currentUser.displayName, uid: currentUser.uid } : null);
    });
    return unsubscribe;
  }, []);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!deadline) return;
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0 && active) {
        setActive(false);
        setDeadline(0);
        setSessions(previous => [
          { date: dateKey(), minutes: duration, status: 'Completed' },
          ...previous,
        ]);
        syncExtension('stopFocus');
        setToast('Focus session complete — well done!');
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [deadline, active, duration]);

  // Check the selected local-time schedule while this page is open.
  // This can start an in-page focus timer, but a web page cannot enforce Android-wide blocks.
  useEffect(() => {
    const checkSchedule = () => {
      if (!scheduleOn) {
        setScheduleStatus('Schedule is off.');
        return;
      }
      const now = new Date();
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const currentDay = dayNames[now.getDay()];
      const previousDay = dayNames[(now.getDay() + 6) % 7];
      const [startHour, startMinute] = start.split(':').map(Number);
      const [endHour, endMinute] = end.split(':').map(Number);
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      let endAt = null;
      let windowDate = '';

      if (startMinutes < endMinutes && days.includes(currentDay) && currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        endAt = new Date(now);
        endAt.setHours(endHour, endMinute, 0, 0);
        windowDate = now.toDateString();
      } else if (startMinutes > endMinutes && days.includes(currentDay) && currentMinutes >= startMinutes) {
        endAt = new Date(now);
        endAt.setDate(endAt.getDate() + 1);
        endAt.setHours(endHour, endMinute, 0, 0);
        windowDate = now.toDateString();
      } else if (startMinutes > endMinutes && days.includes(previousDay) && currentMinutes < endMinutes) {
        endAt = new Date(now);
        endAt.setHours(endHour, endMinute, 0, 0);
        const previousDate = new Date(now);
        previousDate.setDate(previousDate.getDate() - 1);
        windowDate = previousDate.toDateString();
      }

      if (endAt) {
        const key = windowDate + '-' + start + '-' + end;
        setScheduleStatus('ACTIVE now · ends at ' + endAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        if (!active && lastAutoStartKey !== key) {
         const secondsLeft = Math.min(
  90 * 60,
  Math.max(
    1,
    Math.ceil((endAt.getTime() - now.getTime()) / 1000)
  )
);
         setDeadline(now.getTime() + secondsLeft * 1000);
          setDeadline(endAt.getTime());
          setRemaining(secondsLeft);
          setActive(true);
          setLastAutoStartKey(key);
          syncExtension('startFocus', { activeUntil: endAt.getTime(), config: currentBlockerConfig() });
          setToast('Your scheduled focus session started.');
        }
      } else {
        setScheduleStatus('Waiting for the next selected day and time (' + start + '–' + end + ').');
      }
    };

    checkSchedule();
    const id = window.setInterval(checkSchedule, 10000);
    return () => window.clearInterval(id);
  }, [scheduleOn, start, end, days, active, lastAutoStartKey]);

  useEffect(() => {
    localStorage.setItem(
      'vexgridlock-state',
      JSON.stringify({
        apps,
        sites,
        duration,
        deadline: active ? deadline : 0,
        sessions,
        scheduleOn,
        start,
        end,
        days,
        strict,
        notifications,
        extensionId,
      })
    );
  }, [
    apps,
    sites,
    duration,
    deadline,
    active,
    sessions,
    scheduleOn,
    start,
    end,
    days,
    strict,
    notifications,
    extensionId,
  ]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const login = () => {
    setAuthError('');
    setAuthMode('signin');
    setAuthOpen(true);
  };
  const submitAuth = async event => {
    event.preventDefault();
    setBusy(true);
    setAuthError('');
    try {
      if (authMode === 'signup') {
        await createUserWithEmailAndPassword(firebaseAuth, authEmail.trim(), authPassword);
        setToast('Account created successfully.');
      } else {
        await signInWithEmailAndPassword(firebaseAuth, authEmail.trim(), authPassword);
        setToast('Signed in successfully.');
      }
      setAuthOpen(false);
      setAuthPassword('');
    } catch (error) {
      const messages = {
        'auth/email-already-in-use': 'An account already uses this email. Try signing in.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/weak-password': 'Choose a password with at least 6 characters.',
        'auth/invalid-credential': 'Email or password is incorrect.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
        'auth/network-request-failed': 'Network error. Check your internet connection.',
        'auth/operation-not-allowed': 'Email/password sign-in is not enabled in Firebase yet.',
      };
      setAuthError(messages[error?.code] || 'Could not authenticate. Please check your details and try again.');
    } finally {
      setBusy(false);
    }
  };
  const resetPassword = async () => {
    if (!authEmail.trim()) {
      setAuthError('Enter your email address first, then choose Forgot password.');
      return;
    }
    setBusy(true);
    setAuthError('');
    try {
      await sendPasswordResetEmail(firebaseAuth, authEmail.trim());
      setAuthError('Password reset email sent. Check your inbox.');
    } catch (error) {
      setAuthError(error?.code === 'auth/invalid-email' ? 'Enter a valid email address.' : 'Could not send a reset email. Check the address and try again.');
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    try {
      await signOut(firebaseAuth);
      setToast('Signed out.');
    } catch {
      setToast('Could not sign out.');
    }
  };
  const syncExtension = (type, extra = {}) => {
    if (!extensionId) return false;
    const runtime = window.chrome?.runtime;
    if (!runtime?.sendMessage) return false;
    try {
      runtime.sendMessage(extensionId, { type, ...extra }, response => {
        if (runtime.lastError) setToast('Could not reach the Chrome extension. Check its ID and make sure it is enabled.');
      });
      return true;
    } catch {
      return false;
    }
  };
  const currentBlockerConfig = () => ({
    version: 1,
    apps,
    sites,
    duration,
    scheduleOn,
    start,
    end,
    days,
    strict,
  });
  const begin = () => {
    const until = Date.now() + duration * 60000;
    syncExtension('startFocus', { activeUntil: until, config: currentBlockerConfig() });
    setDeadline(until);
    setRemaining(duration * 60);
    setActive(true);
    setConfirmStart(false);
    setToast('Focus timer started.');
  };
  const stop = () => {
    syncExtension('stopFocus');
    setActive(false);
    setDeadline(0);
    setRemaining(0);
    setSessions(old => [
      {
        date: dateKey(),
        minutes: Math.max(1, Math.round((duration * 60 - remaining) / 60)),
        status: 'Interrupted',
      },
      ...old,
    ]);
    setToast('Session ended and recorded as interrupted.');
  };
  const addSite = () => {
    const domain = newSite
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/$/, '')
      .toLowerCase();
    if (
      !/^(?=.{3,253}$)[a-z0-9]+([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]+([a-z0-9-]*[a-z0-9])?)+$/.test(
        domain
      )
    ) {
      setSiteError('Enter a valid domain, such as example.com.');
      return;
    }
    if (sites.some(site => site.domain === domain)) {
      setSiteError('That domain is already in your list.');
      return;
    }
    setSites(old => [...old, { domain, enabled: true }]);
    setNewSite('');
    setSiteError('');
    setToast('Website rule saved to this browser.');
  };
  const exportBlockingConfig = () => {
    const config = {
      ...currentBlockerConfig(),
      exportedAt: new Date().toISOString(),
    };
    syncExtension('configUpdated', { config });
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vexgridlock-blocking-config.json';
    link.click();
    URL.revokeObjectURL(url);
    setToast('Blocking setup exported. Import this JSON into the Chrome extension and Windows companion.');
  };
  const navItems = [
    { name: 'Home', icon: Home },
    { name: 'Blocklist', icon: ShieldCheck },
    { name: 'Schedule', icon: CalendarDays },
    { name: 'Stats', icon: BarChart3 },
    { name: 'Settings', icon: SlidersHorizontal },
  ];
  const ruleCount =
    apps.filter(a => a.enabled).length + sites.filter(s => s.enabled).length;
  const completed = sessions.filter(s => s.status === 'Completed');
  const totalMinutes = completed.reduce((sum, s) => sum + s.minutes, 0);
  const filteredApps = apps.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );
  const progress = active
    ? Math.min(
        100,
        Math.max(0, ((duration * 60 - remaining) / (duration * 60)) * 100)
      )
    : 0;

  return (
    <div className={'app-shell' + (dark ? '' : ' light')}>
      <aside className={'sidebar' + (mobileNav ? ' mobile-open' : '')}>
        <div className="brand">
          <div className="brand-mark">
            <Shield size={23} />
            <LockKeyhole size={13} className="brand-lock" />
          </div>
          <span>VexGridlock</span>
          <button
            className="icon-btn mobile-close"
            onClick={() => setMobileNav(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {navItems.map(item => (
            <button
              key={item.name}
              className={'nav-item' + (page === item.name ? ' selected' : '')}
              onClick={() => {
                setPage(item.name);
                setMobileNav(false);
              }}
            >
              <item.icon size={19} />
              <span>{item.name}</span>
              {item.name === 'Blocklist' && (
                <span className="nav-count">{ruleCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-card">
            <div className="mini-icon">
              <Target size={18} />
            </div>
            <div>
              <strong>Stay intentional</strong>
              <p>Small steps add up.</p>
            </div>
          </div>
          <button className="profile-row" onClick={() => user ? setAccountMenuOpen(open => !open) : login()} aria-expanded={Boolean(user && accountMenuOpen)}>
            <div className="avatar">
              {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'G'}
            </div>
            <div className="profile-copy">
              <strong>{user?.name || user?.email || 'Guest account'}</strong>
              <span>{user ? 'Signed in · Account options' : 'Sign in to your account'}</span>
            </div>
            {user ? <ChevronRight size={16} /> : <ChevronRight size={16} />}
          </button>
          {user && accountMenuOpen && (
            <div className="account-menu">
              <div className="account-menu-email">{user.email}</div>
              <button className="account-menu-signout" onClick={async () => { setAccountMenuOpen(false); await logout(); }}><LogOut size={15} /> Sign out</button>
            </div>
          )}
        </div>
      </aside>
      {mobileNav && (
        <div className="nav-scrim" onClick={() => setMobileNav(false)} />
      )}
      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-btn menu-btn"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          {user && accountMenuOpen && (
            <div className="top-account-menu">
              <div className="account-menu-email">{user.email}</div>
              <button className="account-menu-signout" onClick={async () => { setAccountMenuOpen(false); await logout(); }}><LogOut size={15} /> Sign out</button>
            </div>
          )}
          <div className="top-actions">
            <span className="status-pill">
              <span className={'status-dot' + (active ? ' green' : '')} />
              {active ? 'Focus active' : 'Ready to focus'}
            </span>
            <button
              className="icon-btn"
              onClick={() => setPage('Settings')}
              aria-label="Settings"
            >
              <SlidersHorizontal size={18} />
            </button>
            <button
              className="avatar top-avatar"
              onClick={() => user ? setAccountMenuOpen(open => !open) : login()}
              aria-label={user ? 'Account options' : 'Sign in'}
              aria-expanded={Boolean(user && accountMenuOpen)}
            >
              {user?.email?.[0]?.toUpperCase() || 'G'}
            </button>
          </div>
        </header>
        <div className="content">
          {page === 'Home' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR FOCUS SPACE</div>
                  <h1>
                    Make room for <span>deep work.</span>
                  </h1>
                  <p className="subheading">
                    One intentional session at a time. You're closer than you
                    think.
                  </p>
                </div>
                <div className="date-chip">
                  <CalendarDays size={16} />
                  {new Date().toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </div>
              <div className="home-grid">
                <section className="panel timer-panel">
                  <div className="panel-top">
                    <div>
                      <div className="section-kicker">FOCUS SESSION</div>
                      <h2>
                        {active ? 'You’re in the zone.' : 'Ready when you are.'}
                      </h2>
                    </div>
                    <div className="focus-tag">
                      <span />
                      {active ? 'IN SESSION' : 'NO SESSION'}
                    </div>
                  </div>
                  <div className="timer-layout">
                    <div
                      className="timer-ring"
                      style={{ '--progress': progress * 3.6 + 'deg' }}
                    >
                      <div className="timer-inner">
                        <div className="timer-small">
                          {active ? 'TIME REMAINING' : 'SESSION LENGTH'}
                        </div>
                        <div className="timer-value">
                          {clock(active ? remaining : duration * 60)}
                        </div>
                        <div className="timer-caption">
                          {active
                            ? 'Keep going. You’ve got this.'
                            : 'Distractions can wait.'}
                        </div>
                      </div>
                    </div>
                    <div className="timer-controls">
                      {!active ? (
                        <>
                          <div className="duration-label">CHOOSE DURATION</div>
                          <div className="duration-options">
                            {[25, 45, 60, 90].map(n => (
                              <button
                                key={n}
                                className={
                                  'duration' + (duration === n ? ' active' : '')
                                }
                                onClick={() => setDuration(n)}
                              >
                                {n}
                                <small>min</small>
                              </button>
                            ))}
                          </div>
                          <button
                            className="primary-btn start-btn"
                            onClick={() => setConfirmStart(true)}
                          >
                            <Play size={17} fill="currentColor" />
                            Start focus session
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="session-live">
                            <span className="pulse-dot" />
                            <div>
                              <strong>Focus timer is active</strong>
                              <p>Your end time is saved in this browser.</p>
                            </div>
                          </div>
                          <button className="secondary-btn" onClick={stop}>
                            <Pause size={16} />
                            End session early
                          </button>
                          <p className="small-note">
                            Ending early records an interrupted session.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="timer-foot">
                    <div>
                      <span className="quote-mark">“</span>
                      <span>
                        Discipline is choosing what you want most over what you
                        want now.
                      </span>
                    </div>
                    <span className="foot-right">
                      <LockKeyhole size={13} />
                      {strict ? 'Strict mode on' : 'Flexible mode'}
                    </span>
                  </div>
                </section>
                <section className="panel progress-panel">
                  <div className="panel-top">
                    <div>
                      <div className="section-kicker">YOUR MOMENTUM</div>
                      <h2>Today at a glance</h2>
                    </div>
                    <div className="progress-icon">
                      <Activity size={19} />
                    </div>
                  </div>
                  <div className="metric-main">
                    <strong>
                      {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
                    </strong>
                    <span>completed focus time</span>
                  </div>
                  <div className="goal-track">
                    <div
                      style={{
                        width: Math.min(100, (totalMinutes / 120) * 100) + '%',
                      }}
                    />
                  </div>
                  <div className="goal-caption">
                    <span>Daily goal · 2 hours</span>
                    <strong>
                      {Math.round(Math.min(100, (totalMinutes / 120) * 100))}%
                    </strong>
                  </div>
                  <div className="stat-divider" />
                  <div className="mini-stats">
                    <div>
                      <span>Sessions done</span>
                      <strong>{completed.length}</strong>
                    </div>
                    <div>
                      <span>Streak</span>
                      <strong>{completed.length ? '1 day' : '—'}</strong>
                    </div>
                    <div>
                      <span>Saved rules</span>
                      <strong>{ruleCount}</strong>
                    </div>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => setPage('Stats')}
                  >
                    View your stats <ChevronRight size={15} />
                  </button>
                </section>
              </div>
              <div className="lower-grid">
                <section className="panel shortcut-panel">
                  <div className="section-kicker">QUICK ACCESS</div>
                  <h2>Set yourself up</h2>
                  <div className="shortcut-list">
                    <button
                      className="shortcut"
                      onClick={() => setPage('Blocklist')}
                    >
                      <div className="shortcut-icon purple">
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <strong>Blocklist</strong>
                        <p>Choose your distractions</p>
                      </div>
                      <ChevronRight size={17} />
                    </button>
                    <button
                      className="shortcut"
                      onClick={() => setPage('Schedule')}
                    >
                      <div className="shortcut-icon blue">
                        <CalendarDays size={20} />
                      </div>
                      <div>
                        <strong>Focus schedule</strong>
                        <p>Make focus a routine</p>
                      </div>
                      <ChevronRight size={17} />
                    </button>
                    <button
                      className="shortcut"
                      onClick={() => setPage('Settings')}
                    >
                      <div className="shortcut-icon green">
                        <SlidersHorizontal size={20} />
                      </div>
                      <div>
                        <strong>Permissions & settings</strong>
                        <p>Review your setup</p>
                      </div>
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </section>
                <section className="quote-panel">
                  <div className="quote-spark">✦</div>
                  <div className="section-kicker">A REMINDER</div>
                  <h2>
                    Small steps.
                    <br />
                    <span>Big results.</span>
                  </h2>
                  <p>
                    You don’t need a perfect day. Just a focused next 25
                    minutes.
                  </p>
                  <button
                    className="quote-link"
                    onClick={() =>
                      active ? setPage('Home') : setConfirmStart(true)
                    }
                  >
                    {active ? 'Back to your session' : 'Start with 25 minutes'}{' '}
                    <ChevronRight size={16} />
                  </button>
                </section>
              </div>
            </>
          )}
          {page === 'Blocklist' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">PROTECT YOUR ATTENTION</div>
                  <h1>
                    Your <span>blocklist.</span>
                  </h1>
                  <p className="subheading">
                    Choose the distractions you want out of reach during focus
                    time.
                  </p>
                  <div className="blocker-export-row">
                    <button className="secondary-btn compact" onClick={exportBlockingConfig}>
                      <Download size={15} /> Export setup for blockers
                    </button>
                  </div>
                </div>
                <div className="rules-badge">
                  <ShieldCheck size={16} />
                  {ruleCount} rules enabled
                </div>
              </div>
              <section className="panel blocklist-panel">
                <div className="tabs">
                  <button
                    className={tab === 'Apps' ? 'tab active' : 'tab'}
                    onClick={() => setTab('Apps')}
                  >
                    <Smartphone size={16} />
                    Apps <span>{apps.filter(a => a.enabled).length}</span>
                  </button>
                  <button
                    className={tab === 'Websites' ? 'tab active' : 'tab'}
                    onClick={() => setTab('Websites')}
                  >
                    <Globe size={16} />
                    Websites <span>{sites.filter(s => s.enabled).length}</span>
                  </button>
                </div>
                {tab === 'Apps' ? (
                  <>
                    <div className="list-toolbar">
                      <div>
                        <h2>Apps to limit</h2>
                        <p>Choose apps for your focus list.</p>
                      </div>
                      <label className="searchbox">
                        <Search size={15} />
                        <input
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          placeholder="Search apps"
                        />
                      </label>
                    </div>
                    <div className="add-inline">
                      <input
                        value={newApp}
                        onChange={e => setNewApp(e.target.value)}
                        placeholder="Add a custom app label"
                      />
                      <button
                        className="secondary-btn"
                        onClick={() => {
                          if (
                            newApp.trim() &&
                            !apps.some(
                              a =>
                                a.name.toLowerCase() ===
                                newApp.trim().toLowerCase()
                            )
                          ) {
                            setApps(old => [
                              ...old,
                              {
                                name: newApp.trim(),
                                icon: newApp.trim()[0].toUpperCase(),
                                color: '#36476c',
                                enabled: true,
                              },
                            ]);
                            setNewApp('');
                          } else setToast('Enter a new app name.');
                        }}
                      >
                        <Plus size={15} />
                        Add
                      </button>
                    </div>
                    <div className="app-list">
                      {filteredApps.map(app => (
                        <div className="app-row" key={app.name}>
                          <div className="app-ident">
                            <div
                              className="app-glyph"
                              style={{ background: app.color }}
                            >
                              {app.icon}
                            </div>
                            <div>
                              <strong>{app.name}</strong>
                              <span>
                                {app.enabled
                                  ? 'Included in focus list'
                                  : 'Not selected'}
                              </span>
                            </div>
                          </div>
                          <Switch
                            value={app.enabled}
                            disabled={active}
                            label={'Block ' + app.name}
                            onChange={value =>
                              setApps(old =>
                                old.map(a =>
                                  a.name === app.name
                                    ? { ...a, enabled: value }
                                    : a
                                )
                              )
                            }
                          />
                          <button
                            className="icon-btn danger-btn"
                            disabled={active}
                            aria-label={'Remove ' + app.name + ' from blocklist'}
                            title={active ? 'End the focus session before editing the blocklist' : 'Remove from blocklist'}
                            onClick={() => {
                              setApps(old => old.filter(a => a.name !== app.name));
                              setToast(app.name + ' removed from your blocklist.');
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {filteredApps.length === 0 && (
                        <div className="empty-state">
                          No apps match “{search}”.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="list-toolbar">
                      <div>
                        <h2>Website rules</h2>
                        <p>Keep specific domains on your avoid list.</p>
                      </div>
                    </div>
                    <div className="site-form">
                      <div className="site-input-wrap">
                        <Globe size={17} />
                        <input
                          value={newSite}
                          onChange={e => {
                            setNewSite(e.target.value);
                            setSiteError('');
                          }}
                          onKeyDown={e => e.key === 'Enter' && addSite()}
                          placeholder="example.com"
                        />
                      </div>
                      <button className="primary-btn" onClick={addSite}>
                        <Plus size={16} />
                        Add website
                      </button>
                    </div>
                    {siteError && <p className="field-error">{siteError}</p>}
                    <div className="site-list">
                      {sites.map(site => (
                        <div className="site-row" key={site.domain}>
                          <div className="site-symbol">
                            <Globe size={17} />
                          </div>
                          <div className="site-copy">
                            <strong>{site.domain}</strong>
                            <span>
                              {site.enabled ? 'Enabled rule' : 'Rule paused'}
                            </span>
                          </div>
                          <Switch
                            value={site.enabled}
                            disabled={active}
                            onChange={value =>
                              setSites(old =>
                                old.map(s =>
                                  s.domain === site.domain
                                    ? { ...s, enabled: value }
                                    : s
                                )
                              )
                            }
                          />
                          <button
                            className="icon-btn danger-btn"
                            disabled={active}
                            aria-label={'Delete ' + site.domain}
                            onClick={() =>
                              setSites(old =>
                                old.filter(s => s.domain !== site.domain)
                              )
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {sites.length === 0 && (
                        <div className="empty-state">
                          <Globe size={24} />
                          <strong>No website rules yet</strong>
                          <span>
                            Add a domain to keep your intentions visible.
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="disclosure">
                  <CircleHelp size={17} />
                  <p>
                    <strong>Real blocking needs local components.</strong> This dashboard cannot block desktop programs by itself. Use the downloadable VexGridLock Chrome extension to enforce website rules in Chrome and the Windows companion to choose desktop apps and apply best-effort process restrictions. Export your setup above, then import that JSON into both components. They must be installed and running locally; this starter is not tamper-proof.
                  </p>
                </div>
              </section>
            </>
          )}
          {page === 'Schedule' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">BUILD A ROUTINE</div>
                  <h1>
                    Make focus <span>automatic.</span>
                  </h1>
                  <p className="subheading">
                    Choose a repeatable window for your best work.
                  </p>
                </div>
              </div>
              <div className="schedule-grid">
                <section className="panel schedule-panel">
                  <div className="panel-top">
                    <div>
                      <div className="section-kicker">YOUR SCHEDULE</div>
                      <h2>Focus hours</h2>
                    </div>
                    <Switch value={scheduleOn} onChange={setScheduleOn} />
                  </div>
                  <p className="panel-description">
                    Your schedule is checked against your device's local time while this page is open. It can start an in-page focus timer, but cannot start Android blocking in the background.
                  </p>
                  <div className="schedule-status" role="status">
                    <Clock3 size={17} />
                    <div><strong>Live schedule check</strong><span>{scheduleStatus}</span></div>
                  </div>
                  <div className="form-divider" />
                  <label className="field-label">START TIME</label>
                  <input
                    className="time-input"
                    type="time"
                    value={start}
                    onChange={e => {
                      setStart(e.target.value);
                      setScheduleSaved(false);
                    }}
                  />
                  <label className="field-label">END TIME</label>
                  <input
                    className="time-input"
                    type="time"
                    value={end}
                    onChange={e => {
                      setEnd(e.target.value);
                      setScheduleSaved(false);
                    }}
                  />
                  <label className="field-label">REPEAT ON</label>
                  <div className="days-row">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
                      day => (
                        <button
                          key={day}
                          className={
                            'day-chip' + (days.includes(day) ? ' selected' : '')
                          }
                          onClick={() => {
                            setDays(old =>
                              old.includes(day)
                                ? old.filter(d => d !== day)
                                : [...old, day]
                            );
                            setScheduleSaved(false);
                          }}
                        >
                          {day}
                        </button>
                      )
                    )}
                  </div>
                  {scheduleSaved && (
                    <div className="success-inline">
                      <Check size={16} />
                      Schedule saved on this device.
                    </div>
                  )}
                  <button
                    className="primary-btn full-btn"
                    onClick={() => {
                      if (start === end) {
                        setToast('Start and end times must be different.');
                        return;
                      }
                      if (!days.length) {
                        setToast('Choose at least one repeat day.');
                        return;
                      }
                      setScheduleSaved(true);
                      setToast('Schedule saved.');
                    }}
                  >
                    Save schedule <ChevronRight size={16} />
                  </button>
                </section>
                <section className="panel schedule-preview">
                  <div className="section-kicker">WEEK AT A GLANCE</div>
                  <h2>Your focus rhythm</h2>
                  <div className="week-visual">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
                      day => (
                        <div className="week-day" key={day}>
                          <span>{day}</span>
                          <div className="week-column">
                            <div
                              className={
                                'week-block' +
                                (scheduleOn && days.includes(day)
                                  ? ' planned'
                                  : '')
                              }
                              style={{
                                height:
                                  scheduleOn && days.includes(day)
                                    ? '58%'
                                    : '8%',
                              }}
                            />
                          </div>
                          <small>
                            {scheduleOn && days.includes(day) ? start : '—'}
                          </small>
                        </div>
                      )
                    )}
                  </div>
                  <div className="legend">
                    <span />
                    <p>Planned focus window</p>
                  </div>
                  <div className="preview-tip">
                    <Clock3 size={18} />
                    <div>
                      <strong>Consistency beats intensity.</strong>
                      <p>
                        A steady schedule makes it easier to begin before
                        motivation shows up.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
          {page === 'Stats' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">PROGRESS, NOT PERFECTION</div>
                  <h1>
                    Your focus <span>in numbers.</span>
                  </h1>
                  <p className="subheading">
                    Only sessions recorded in this app are included here.
                  </p>
                </div>
              </div>
              <div className="stats-cards">
                <Metric
                  icon={<Clock3 size={19} />}
                  label="Completed focus time"
                  value={
                    totalMinutes >= 60
                      ? Math.floor(totalMinutes / 60) +
                        'h ' +
                        (totalMinutes % 60) +
                        'm'
                      : totalMinutes + 'm'
                  }
                  note="Recorded sessions only"
                />
                <Metric
                  icon={<Check size={19} />}
                  label="Completed sessions"
                  value={completed.length}
                  note={
                    sessions.filter(s => s.status === 'Interrupted').length +
                    ' interrupted'
                  }
                  green
                />
                <Metric
                  icon={<Target size={19} />}
                  label="Rules enabled"
                  value={ruleCount}
                  note="Across apps and websites"
                />
              </div>
              <section className="panel history-panel">
                <div className="panel-top">
                  <div>
                    <div className="section-kicker">SESSION HISTORY</div>
                    <h2>Your recent sessions</h2>
                  </div>
                  
<button
  className="secondary-btn compact"
  onClick={() => {
    const completed = sessions.filter(
      s => s.status === 'Completed'
    );

    const interrupted = sessions.filter(
      s => s.status === 'Interrupted'
    );

    const totalMinutes = completed.reduce(
      (sum, s) => sum + Number(s.minutes || 0),
      0
    );

    const rows = [
      ['VEXGRIDLOCK | FOCUS REPORT', '', ''],
      ['Personal productivity report', new Date().toLocaleDateString(), ''],
      ['', '', ''],
      ['PERFORMANCE SUMMARY', '', ''],
      ['Metric', 'Value', ''],
      ['Total sessions', sessions.length, ''],
      ['Completed sessions', completed.length, ''],
      ['Interrupted sessions', interrupted.length, ''],
      ['Completed focus time (minutes)', totalMinutes, ''],
      [
        'Completed focus time (hours)',
        Number((totalMinutes / 60).toFixed(2)),
        '',
      ],
      ['', '', ''],
      ['SESSION HISTORY', '', ''],
      ['Date', 'Duration (minutes)', 'Status'],
      ...sessions.map(s => [
        s.date,
        Number(s.minutes || 0),
        s.status,
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws['!cols'] = [
      { wch: 34 },
      { wch: 25 },
      { wch: 20 },
    ];

    ws['!rows'] = rows.map((_, i) => ({
      hpt: [0, 3, 11].includes(i) ? 30 : 22,
    }));

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },
      { s: { r: 11, c: 0 }, e: { r: 11, c: 2 } },
    ];

    const navy = '14243A';
    const blue = '2563EB';
    const paleBlue = 'EAF2FF';
    const white = 'FFFFFF';
    const grey = 'F3F6FA';
    const green = 'DCFCE7';
    const red = 'FEE2E2';

    const styleRange = (
      row: number,
      startCol: number,
      endCol: number,
      style: Record<string, unknown>
    ) => {
      for (let col = startCol; col <= endCol; col++) {
        const cell = XLSX.utils.encode_cell({
          r: row,
          c: col,
        });

        if (ws[cell]) {
          ws[cell].s = style;
        }
      }
    };

    const titleStyle = {
      fill: { fgColor: { rgb: navy } },
      font: {
        name: 'Aptos Display',
        sz: 18,
        bold: true,
        color: { rgb: white },
      },
      alignment: {
        vertical: 'center',
        horizontal: 'left',
        indent: 1,
      },
    };

    const sectionStyle = {
      fill: { fgColor: { rgb: blue } },
      font: {
        name: 'Aptos',
        sz: 11,
        bold: true,
        color: { rgb: white },
      },
      alignment: {
        vertical: 'center',
        horizontal: 'left',
        indent: 1,
      },
    };

    const headerStyle = {
      fill: { fgColor: { rgb: navy } },
      font: {
        name: 'Aptos',
        sz: 11,
        bold: true,
        color: { rgb: white },
      },
      alignment: {
        horizontal: 'left',
        vertical: 'center',
        wrapText: true,
      },
      border: {
        bottom: {
          style: 'medium',
          color: { rgb: blue },
        },
      },
    };

    styleRange(0, 0, 2, titleStyle);
    styleRange(3, 0, 2, sectionStyle);
    styleRange(11, 0, 2, sectionStyle);
    styleRange(4, 0, 1, headerStyle);
    styleRange(12, 0, 2, headerStyle);

    for (let r = 5; r <= 9; r++) {
      styleRange(r, 0, 1, {
        fill: {
          fgColor: {
            rgb: r % 2 === 0 ? white : grey,
          },
        },
        font: {
          name: 'Aptos',
          sz: 11,
          color: { rgb: navy },
        },
        alignment: { vertical: 'center' },
      });

      const valueCell = `B${r + 1}`;

      if (ws[valueCell]) {
        ws[valueCell].s = {
          fill: { fgColor: { rgb: paleBlue } },
          font: {
            name: 'Aptos',
            sz: 11,
            bold: true,
            color: { rgb: navy },
          },
          alignment: {
            vertical: 'center',
            horizontal: 'left',
          },
        };
      }
    }

    for (let r = 13; r < rows.length; r++) {
      const fill = r % 2 === 0 ? white : grey;

      styleRange(r, 0, 2, {
        fill: { fgColor: { rgb: fill } },
        font: {
          name: 'Aptos',
          sz: 10,
          color: { rgb: navy },
        },
        alignment: { vertical: 'center' },
        border: {
          bottom: {
            style: 'hair',
            color: { rgb: 'DCE4EE' },
          },
        },
      });

      const statusCell = `C${r + 1}`;

      if (ws[statusCell]) {
        const isDone = ws[statusCell].v === 'Completed';

        ws[statusCell].s = {
          fill: {
            fgColor: { rgb: isDone ? green : red },
          },
          font: {
            name: 'Aptos',
            sz: 10,
            bold: true,
            color: {
              rgb: isDone ? '166534' : '991B1B',
            },
          },
          alignment: {
            vertical: 'center',
            horizontal: 'center',
          },
        };
      }
    }

    ws['!autofilter'] = {
      ref: `A13:C${Math.max(13, rows.length)}`,
    };

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      'Focus Report'
    );

    wb.Props = {
      Title: 'VexGridLock Focus Report',
      Subject: 'Focus session history and performance summary',
      Author: 'VexGridLock',
      CreatedDate: new Date(),
    };

    XLSX.writeFile(
      wb,
      `VexGridLock-Focus-Report-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );

    setToast('Formatted Excel report exported successfully.');
  }}
>
  <Download size={15} />
  Export Excel Report
</button>
                </div>
                {sessions.length === 0 ? (
                  <div className="empty-state">
                    <BarChart3 size={26} />
                    <strong>Your first session starts here.</strong>
                    <span>
                      Complete a focus session and its recorded history will
                      appear here.
                    </span>
                  </div>
                ) : (
                  <div className="history-list">
                    {sessions.map((session, index) => (
                      <div
                        className="history-row"
                        key={session.date + '-' + index}
                      >
                        <div
                          className={
                            'history-status' +
                            (session.status === 'Completed'
                              ? ' done'
                              : ' interrupted')
                          }
                        >
                          {session.status === 'Completed' ? (
                            <Check size={16} />
                          ) : (
                            <Pause size={16} />
                          )}
                        </div>
                        <div className="history-copy">
                          <strong>{session.status} focus session</strong>
                          <span>{session.date}</span>
                        </div>
                        <strong className="history-minutes">
                          {session.minutes} min
                        </strong>
                        <span
                          className={
                            'history-label' +
                            (session.status === 'Completed' ? '' : ' warn')
                          }
                        >
                          {session.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <div className="disclosure">
                <Activity size={17} />
                <p>
                  Statistics come from sessions recorded in this browser on this
                  device. They are not Android Digital Wellbeing data and are
                  not synced to a cloud account.
                </p>
              </div>
            </>
          )}
          {page === 'Settings' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">MAKE IT YOURS</div>
                  <h1>
                    Settings & <span>control.</span>
                  </h1>
                  <p className="subheading">
                    Manage your preferences, account and setup information.
                  </p>
                </div>
              </div>
              <div className="settings-layout">
                <section className="panel settings-panel">
                  <div className="section-kicker">PREFERENCES</div>
                  <h2>Focus experience</h2>
                  <SettingRow
                    icon={<LockKeyhole size={18} />}
                    title="Strict session mode"
                    description="Disable blocklist editing during a timer"
                  >
                    <Switch value={strict} onChange={setStrict} />
                  </SettingRow>
                  <SettingRow
                    icon={<Bell size={18} />}
                    title="Session reminders"
                    description="Show in-app completion messages"
                  >
                    <Switch value={notifications} onChange={setNotifications} />
                  </SettingRow>
                  <SettingRow
                    icon={<Moon size={18} />}
                    title="Dark appearance"
                    description="Use the VexGridlock dark interface"
                  >
                    <Switch value={dark} onChange={setDark} />
                  </SettingRow>
                  <SettingRow
                    icon={<Timer size={18} />}
                    title="Default focus duration"
                    description={'Current default: ' + duration + ' minutes'}
                  >
                    <select
                      className="inline-select"
                      value={duration}
                      onChange={e => setDuration(Number(e.target.value))}
                    >
                      {[25, 45, 60, 90].map(n => (
                        <option key={n} value={n}>
                          {n} min
                        </option>
                      ))}
                    </select>
                  </SettingRow>
                  <div className="form-divider" />
                  <div className="section-kicker">CHROME WEBSITE BLOCKING</div>
                  <label className="extension-id-label">
                    <span>Chrome extension ID</span>
                    <input
                      className="extension-id-input"
                      value={extensionId}
                      onChange={e => setExtensionId(e.target.value.trim())}
                      placeholder="Paste ID from chrome://extensions"
                      autoComplete="off"
                    />
                  </label>
                  <p className="panel-description">Install the VexGridLock extension from the package, turn on Developer mode at chrome://extensions, copy its ID here, and save. Then the dashboard timer can tell that extension when to start and stop blocking websites in Chrome.</p>
                  <div className="form-divider" />
                  <div className="section-kicker">ACCOUNT</div>
                  <SettingRow
                    icon={<ShieldCheck size={18} />}
                    title={user?.name || user?.email || 'Guest account'}
                    description={
                      user
                        ? 'Connected through secure AppDeploy sign-in'
                        : 'Sign in to establish an authenticated session'
                    }
                  >
                    <button
                      className="secondary-btn compact"
                      onClick={user ? logout : login}
                      disabled={busy}
                    >
                      {busy ? 'Opening…' : user ? 'Sign out' : 'Sign in'}
                    </button>
                  </SettingRow>
                </section>
                <section className="panel permissions-panel">
                  <div className="section-kicker">PLATFORM SETUP</div>
                  <h2>Permission checklist</h2>
                  <p className="panel-description">
                    This is a web app preview. It cannot open Android system
                    settings or verify Android permissions.
                  </p>
                  <Permission
                    icon={<Smartphone size={17} />}
                    title="Android Usage Access"
                    status="Unavailable in web app"
                  />
                  <Permission
                    icon={<Shield size={17} />}
                    title="Accessibility service"
                    status="Unavailable in web app"
                  />
                  <Permission
                    icon={<Bell size={17} />}
                    title="Notifications"
                    status={notifications ? 'In-app only' : 'Disabled'}
                  />
                  <Permission
                    icon={<AlarmClock size={17} />}
                    title="Background scheduling"
                    status="Unavailable in web app"
                  />
                  <div className="disclosure compact-disclosure">
                    <CircleHelp size={17} />
                    <p>
                      Genuine system-wide blocking requires a native Android app
                      and explicit permissions. This website does not block
                      distractions outside its own tab.
                    </p>
                  </div>
                </section>
              </div>
              <section className="panel about-panel">
                <div className="about-logo">
                  <div className="brand-mark">
                    <Shield size={22} />
                    <LockKeyhole size={12} className="brand-lock" />
                  </div>
                  <div>
                    <strong>VexGridlock</strong>
                    <span>Block distractions. Build your goals.</span>
                  </div>
                </div>
                <div className="about-links">
                  <button
                    onClick={() =>
                      setToast(
                        'Privacy: focus settings and statistics stay in this browser in this prototype.'
                      )
                    }
                  >
                    Privacy & data
                  </button>
                  <button
                    onClick={() =>
                      setToast(
                        'Help: this web build stores local settings; Android-wide blocking needs a native app.'
                      )
                    }
                  >
                    Help & troubleshooting
                  </button>
                  <span>Web preview · v0.1</span>
                </div>
              </section>
            </>
          )}
        </div>
        <footer className="footer">
          <span>© {new Date().getFullYear()} VexGridlock</span>
          <span>
            <span className="footer-dot" />
            Your focus is yours.
          </span>
          <span>Built for intentional work</span>
        </footer>
      </main>
      {confirmStart && (
        <div className="modal-backdrop" onClick={() => setConfirmStart(false)}>
          <div
            className="confirm-modal"
            onClick={event => event.stopPropagation()}
          >
            <button
              className="modal-close icon-btn"
              onClick={() => setConfirmStart(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="modal-icon">
              <LockKeyhole size={23} />
            </div>
            <div className="section-kicker">READY TO FOCUS?</div>
            <h2>Start a {duration}-minute session?</h2>
            <p>
              Your countdown uses a saved end time and survives a page refresh.
              This web preview cannot prevent other apps or websites from
              opening outside this tab.
            </p>
            <div className="confirm-summary">
              <div>
                <span>Duration</span>
                <strong>{duration} minutes</strong>
              </div>
              <div>
                <span>Selected rules</span>
                <strong>{ruleCount} saved</strong>
              </div>
              <div>
                <span>Strict mode</span>
                <strong>{strict ? 'On' : 'Off'}</strong>
              </div>
            </div>
            <button className="primary-btn full-btn" onClick={begin}>
              <Play size={16} fill="currentColor" />
              Start focus session
            </button>
            <button
              className="cancel-btn"
              onClick={() => setConfirmStart(false)}
            >
              Not yet
            </button>
          </div>
        </div>
      )}
      {authOpen && (
        <div className="modal-backdrop auth-backdrop" onClick={() => !busy && setAuthOpen(false)}>
          <section className="confirm-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-heading" onClick={event => event.stopPropagation()}>
            <button className="modal-close icon-btn" onClick={() => setAuthOpen(false)} aria-label="Close sign in" disabled={busy}><X size={18} /></button>
            <div className="modal-icon"><ShieldCheck size={23} /></div>
            <div className="section-kicker">VEXGRIDLOCK ACCOUNT</div>
            <h2 id="auth-heading">{authMode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
            <p>Use your email and password to keep your account connected.</p>
            <form className="auth-form" onSubmit={submitAuth}>
              <label>Email address<input type="email" autoComplete="email" value={authEmail} onChange={event => setAuthEmail(event.target.value)} placeholder="you@example.com" required /></label>
              <label>Password<input type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={authPassword} onChange={event => setAuthPassword(event.target.value)} placeholder="At least 6 characters" minLength={6} required /></label>
              {authError && <p className="auth-message" role="alert">{authError}</p>}
              <button className="primary-btn full-btn" type="submit" disabled={busy}>{busy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in'}</button>
            </form>
            {authMode === 'signin' && <button className="auth-text-btn" onClick={resetPassword} disabled={busy}>Forgot password?</button>}
            <div className="auth-switch">{authMode === 'signup' ? 'Already have an account?' : 'New to VexGridlock?'} <button onClick={() => { setAuthMode(authMode === 'signup' ? 'signin' : 'signup'); setAuthError(''); }} disabled={busy}>{authMode === 'signup' ? 'Sign in' : 'Create account'}</button></div>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast">
          <Check size={17} />
          {toast}
          <button onClick={() => setToast('')} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function Switch({ value, onChange, disabled = false, label }) {
  return (
    <button
      className={'switch' + (value ? ' on' : '')}
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!value)}
    >
      <span />
    </button>
  );
}
function SettingRow({ icon, title, description, children }) {
  return (
    <div className="setting-row">
      <div className="setting-icon">{icon}</div>
      <div className="setting-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}
function Permission({ icon, title, status }) {
  return (
    <div className="permission-row">
      <div className="setting-icon">{icon}</div>
      <div className="permission-copy">
        <strong>{title}</strong>
        <span>{status}</span>
      </div>
      <span className="permission-dot" />
    </div>
  );
}
function Metric({ icon, label, value, note, green = false }) {
  return (
    <div className="panel stat-card">
      <div className={'stat-icon' + (green ? ' green' : ' purple')}>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
export default App;
