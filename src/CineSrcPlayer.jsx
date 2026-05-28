import React, { useState, useEffect, useRef, useCallback } from 'react';
import './CineSrcPlayer.css';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_POSTER = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACK = 'https://image.tmdb.org/t/p/w1280';

/* ─── helpers ─── */
const title = (i) => i?.title || i?.name || 'Unknown';
const year = (i) => (i?.release_date || i?.first_air_date || '').slice(0, 4);

/* ─── AdBlock Overlay Component ─── */
function AdBlockOverlay() {
  const [active, setActive] = useState(true);
  if (!active) return null;
  return (
    <div
      className="ws-adblock-overlay"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActive(false); }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 999, background: 'transparent', cursor: 'pointer' }}
    />
  );
}

export default function WebStream() {
  const [view, setView] = useState('browse');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [trending, setTrending] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [tvInfo, setTvInfo] = useState(null);

  const [tmdbKey, setTmdbKey] = useState(() => localStorage.getItem('ws_tmdb_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(null);

  useEffect(() => { localStorage.setItem('ws_tmdb_key', tmdbKey); }, [tmdbKey]);

  useEffect(() => {
    const fn = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setShowSettings(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => {
    if (!tmdbKey) return;
    fetch(`${TMDB_BASE}/trending/all/week?api_key=${tmdbKey}`)
      .then(r => r.json())
      .then(d => { if (d.results) setTrending(d.results.filter(r => r.media_type !== 'person').slice(0, 18)); })
      .catch(() => { });
  }, [tmdbKey]);

  useEffect(() => {
    if (!selected || selected.media_type !== 'tv' || !tmdbKey) return;
    setTvInfo(null);
    fetch(`${TMDB_BASE}/tv/${selected.id}?api_key=${tmdbKey}`)
      .then(r => r.json())
      .then(d => { if (d.seasons) setTvInfo(d); })
      .catch(() => { });
  }, [selected, tmdbKey]);

  useEffect(() => {
    const handler = (e) => {
      if (e.origin !== 'https://cinesrc.st') return;
      const { type, ...data } = e.data || {};
      if (type === 'cinesrc:nextepisode') {
        if (data.season) setSeason(data.season);
        if (data.episode) setEpisode(data.episode);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleSearch = useCallback(async (e) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (!tmdbKey) { setError('Add your free TMDB API key in Settings to search.'); return; }
    setLoading(true); setError(null); setResults([]); setSearched(true);
    try {
      const res = await fetch(`${TMDB_BASE}/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(q)}&include_adult=false`);
      if (!res.ok) throw new Error(`TMDB ${res.status}`);
      const data = await res.json();
      setResults((data.results || []).filter(r => r.media_type === 'movie' || r.media_type === 'tv').slice(0, 20));
    } catch {
      setError('Search failed. Check your TMDB API key.');
    } finally {
      setLoading(false);
    }
  }, [query, tmdbKey]);

  const openPlayer = (item) => { setSelected(item); setSeason(1); setEpisode(1); setTvInfo(null); setView('player'); };
  const closePlayer = () => { setView('browse'); setSelected(null); };

  const embedUrl = selected
    ? selected.media_type === 'movie'
      ? `https://cinesrc.st/embed/movie/${selected.id}?autonext=true`
      : `https://cinesrc.st/embed/tv/${selected.id}?s=${season}&e=${episode}&autoskip=true&autonext=true`
    : '';

  const seasonList = tvInfo?.seasons?.filter(s => s.season_number > 0)
    ?? Array.from({ length: 5 }, (_, i) => ({ season_number: i + 1, episode_count: 20 }));
  const currentSeason = seasonList.find(s => s.season_number === season);
  const epCount = currentSeason?.episode_count ?? 20;

  const displayItems = searched ? results : trending;
  const sectionLabel = searched ? `${results.length} results for "${query}"` : 'Trending This Week';

  return (
    <div className="ws-root">
      {/* ════════════════════════════════════
           BROWSE VIEW
      ════════════════════════════════════ */}
      {view === 'browse' && (
        <div className="ws-browse">
          {/* ── Nav ── */}
          <nav className="ws-nav">
            <div className="ws-logo">
              <svg className="ws-logo-icon" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14" stroke="url(#nl)" strokeWidth="1.5" />
                <path d="M13 10.5l9 5.5-9 5.5V10.5z" fill="url(#nl)" />
                <defs>
                  <linearGradient id="nl" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#5b7cf6" />
                    <stop offset="1" stopColor="#7b96ff" />
                  </linearGradient>
                </defs>
              </svg>
              WebStream
            </div>

            <div className="ws-nav-right" ref={settingsRef}>
              <button
                id="ws-settings-btn"
                className={`ws-icon-btn ${showSettings ? 'active' : ''}`}
                onClick={() => setShowSettings(v => !v)}
                aria-label="Settings"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>

              {showSettings && (
                <div className="ws-settings-panel" role="dialog">
                  <div className="ws-sp-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    Settings
                  </div>
                  <label className="ws-sp-label" htmlFor="ws-tmdb-input">
                    TMDB API Key
                    <span className="ws-tag-free">Free</span>
                  </label>
                  <input
                    id="ws-tmdb-input"
                    type="password"
                    className="ws-input"
                    placeholder="Paste your key…"
                    value={tmdbKey}
                    onChange={e => setTmdbKey(e.target.value)}
                  />
                  <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="ws-sp-link">
                    Get a free key at themoviedb.org ↗
                  </a>
                  <div className={`ws-key-badge ${tmdbKey ? 'ok' : ''}`}>
                    <span className="ws-key-dot" />
                    {tmdbKey ? 'API key saved' : 'No key — search disabled'}
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* ── Hero Search ── */}
          <div className="ws-hero">
            <div className="ws-hero-inner">
              <h1 className="ws-hero-title">What are you watching?</h1>
              <p className="ws-hero-sub">Search millions of movies and TV shows from TMDB</p>
              <form className="ws-hero-form" onSubmit={handleSearch} role="search">
                <div className="ws-search-wrap">
                  <svg className="ws-search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    id="ws-search-input"
                    type="text"
                    className="ws-input ws-search-input"
                    placeholder="Search by title, genre, actor…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    autoComplete="off"
                  />
                  {query && (
                    <button type="button" className="ws-clear" onClick={() => { setQuery(''); setResults([]); setSearched(false); setError(null); }}>✕</button>
                  )}
                </div>
                <button type="submit" className="ws-btn-search" disabled={loading} id="ws-search-btn">
                  {loading ? <><span className="ws-spin-sm" />Searching…</> : 'Search'}
                </button>
              </form>

              {error && (
                <div className="ws-error-msg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* ── Grid ── */}
          <div className="ws-content">
            {!tmdbKey && !loading && (
              <div className="ws-setup-prompt">
                <div className="ws-setup-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h3>Connect your TMDB key to start</h3>
                <p>WebStream uses the free TMDB API to search movies &amp; TV shows. It takes 30 seconds to get a key.</p>
                <button className="ws-btn-setup" onClick={() => setShowSettings(true)}>⚙ Open Settings</button>
              </div>
            )}

            {tmdbKey && displayItems.length > 0 && (
              <>
                <div className="ws-section-header">
                  <span className="ws-section-label">{sectionLabel}</span>
                  {searched && (
                    <button className="ws-back-search" onClick={() => { setSearched(false); setResults([]); setQuery(''); }}>
                      ← Back to trending
                    </button>
                  )}
                </div>
                <div className="ws-grid">
                  {displayItems.map(item => (
                    <button key={item.id} className="ws-card" onClick={() => openPlayer(item)}>
                      <div className="ws-card-poster">
                        {item.poster_path
                          ? <img src={`${TMDB_POSTER}${item.poster_path}`} alt={title(item)} loading="lazy" />
                          : <div className="ws-card-no-img">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" width="30" height="30">
                              <rect x="2" y="2" width="20" height="20" rx="3" /><path d="M2 9h20M9 21V9" />
                            </svg>
                          </div>
                        }
                        <div className="ws-card-overlay">
                          <div className="ws-card-play">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                        <span className={`ws-card-badge ${item.media_type}`}>
                          {item.media_type === 'tv' ? 'Series' : 'Film'}
                        </span>
                        {item.vote_average > 0 && (
                          <span className="ws-card-score">★ {item.vote_average.toFixed(1)}</span>
                        )}
                      </div>
                      <div className="ws-card-meta">
                        <div className="ws-card-title">{title(item)}</div>
                        <div className="ws-card-year">{year(item)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {tmdbKey && searched && !loading && results.length === 0 && (
              <div className="ws-no-results">
                <div className="ws-no-results-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                </div>
                <p>No results found for <strong>"{query}"</strong></p>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <footer className="ws-footer">
            <span>Powered by <strong>Astra Client</strong></span>
            <span className="ws-footer-dot">·</span>
            <span>Data from TMDB</span>
          </footer>
        </div>
      )}

      {/* ════════════════════════════════════
           PLAYER VIEW
      ════════════════════════════════════ */}
      {view === 'player' && selected && (
        <div className="ws-player-view">
          {selected.backdrop_path && (
            <div
              className="ws-player-backdrop"
              style={{ backgroundImage: `url(${TMDB_BACK}${selected.backdrop_path})` }}
            />
          )}

          {/* ── Player top bar ── */}
          <div className="ws-player-bar">
            <button className="ws-back-btn" onClick={closePlayer} id="ws-back-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Back
            </button>

            <div className="ws-player-title-block">
              <span className={`ws-badge ${selected.media_type}`}>
                {selected.media_type === 'tv' ? 'Series' : 'Film'}
              </span>
              <span className="ws-player-name">{title(selected)}</span>
              {year(selected) && <span className="ws-player-year">{year(selected)}</span>}
              {selected.media_type === 'tv' && (
                <span className="ws-player-ep">S{season} · E{episode}</span>
              )}
            </div>

            <div className="ws-player-bar-right">
              {selected.vote_average > 0 && (
                <span className="ws-player-score">★ {selected.vote_average.toFixed(1)}</span>
              )}
              <div className="ws-logo ws-logo-sm">
                <svg className="ws-logo-icon" viewBox="0 0 32 32" fill="none" width="18" height="18">
                  <circle cx="16" cy="16" r="14" stroke="url(#pl)" strokeWidth="1.5" />
                  <path d="M13 10.5l9 5.5-9 5.5V10.5z" fill="url(#pl)" />
                  <defs>
                    <linearGradient id="pl" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#5b7cf6" />
                      <stop offset="1" stopColor="#7b96ff" />
                    </linearGradient>
                  </defs>
                </svg>
                WebStream
              </div>
            </div>
          </div>

          {/* ── Iframe ── */}
          <div className="ws-iframe-wrap" style={{ position: 'relative' }}>
            <AdBlockOverlay />
            <iframe
              key={`${selected.id}-${season}-${episode}`}
              src={embedUrl}
              title={title(selected)}
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock allow-modals"
            />
          </div>

          {/* ── Episode controls (TV only) ── */}
          {selected.media_type === 'tv' && (
            <div className="ws-ep-bar">
              <div className="ws-ep-group">
                <span className="ws-ep-label">Season</span>
                <select
                  id="ws-season-select"
                  className="ws-select"
                  value={season}
                  onChange={e => { setSeason(+e.target.value); setEpisode(1); }}
                >
                  {seasonList.map(s => (
                    <option key={s.season_number} value={s.season_number}>
                      Season {s.season_number}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ws-ep-group">
                <span className="ws-ep-label">Episode</span>
                <select
                  id="ws-episode-select"
                  className="ws-select"
                  value={episode}
                  onChange={e => setEpisode(+e.target.value)}
                >
                  {Array.from({ length: epCount }, (_, i) => (
                    <option key={i} value={i + 1}>Episode {i + 1}</option>
                  ))}
                </select>
              </div>

              <div className="ws-ep-arrows">
                <button
                  className="ws-ep-btn"
                  disabled={episode <= 1 && season <= 1}
                  onClick={() => {
                    if (episode > 1) setEpisode(v => v - 1);
                    else if (season > 1) { setSeason(v => v - 1); setEpisode(epCount); }
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  Prev
                </button>
                <button
                  className="ws-ep-btn ws-ep-btn-next"
                  disabled={episode >= epCount && season >= seasonList.length}
                  onClick={() => {
                    if (episode < epCount) setEpisode(v => v + 1);
                    else if (season < seasonList.length) { setSeason(v => v + 1); setEpisode(1); }
                  }}
                >
                  Next
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>

              <span className="ws-player-credit">Powered by <strong>Astra Client</strong></span>
            </div>
          )}

          {selected.media_type === 'movie' && (
            <div className="ws-movie-bar">
              <span>{title(selected)}{year(selected) ? ` (${year(selected)})` : ''}</span>
              <span className="ws-player-credit">Powered by <strong>Astra Client</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}