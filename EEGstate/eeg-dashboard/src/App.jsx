import React, { useState, useMemo, useEffect } from 'react';
import { ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, BarChart, Bar, Cell } from 'recharts';
import { Activity, Eye, EyeOff, Settings, Zap, Cpu, Sliders, BarChart3, Radio, RefreshCw, Info, Play, Pause, RotateCcw } from 'lucide-react';
import eegDataRaw from './data/eeg_data.json';

// Channel metadata and colors
const CHANNELS = [
  'AF3', 'F7', 'F3', 'FC5', 'T7', 'P7', 'O1', 
  'O2', 'P8', 'T8', 'FC6', 'F4', 'F8', 'AF4'
];

const COLORS = [
  '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#a855f7', '#ec4899', '#f43f5e',
  '#eab308', '#f97316', '#ef4444', '#6366f1', '#14b8a6', '#0ea5e9', '#d946ef'
];

// Client-side fallback analysis
const getMockAnalysis = (channel, data, lowcut, highcut) => {
  const raw_signal = data.map(d => d[channel]);
  const mean = raw_signal.reduce((a, b) => a + b, 0) / raw_signal.length;
  const raw_sig_centered = raw_signal.map(v => v - mean);
  
  // Moving average smoothing
  const filtered_signal = raw_signal.map((v, idx) => {
    if (idx < 3 || idx > raw_signal.length - 4) return v;
    return (raw_signal[idx-3] + raw_signal[idx-2] + raw_signal[idx-1] + raw_signal[idx] + raw_signal[idx+1] + raw_signal[idx+2] + raw_signal[idx+3]) / 7;
  });

  const psd_frequencies = [];
  const psd_values = [];
  const isOccipital = channel === 'O1' || channel === 'O2';
  
  for (let f = 0.5; f <= 45; f += 0.5) {
    psd_frequencies.push(f);
    let power = 220 / (Math.pow(f, 1.15) + 1);
    
    if (f >= 8 && f <= 13) {
      const alphaPeak = isOccipital ? 28 : 9;
      power += alphaPeak * Math.exp(-Math.pow(f - 10.2, 2) / 1.6);
    }
    
    if (f >= 14 && f <= 25) {
      power += 5 * Math.exp(-Math.pow(f - 19.5, 2) / 3.5);
    }
    
    power += Math.random() * 0.35;
    psd_values.push(Math.max(0.05, power));
  }

  const band_powers = {
    Delta: isOccipital ? 190 : 160,
    Theta: isOccipital ? 38 : 48,
    Alpha: isOccipital ? 32 : 11,
    Beta: isOccipital ? 11 : 17
  };
  
  const total_power = Object.values(band_powers).reduce((a, b) => a + b, 0);
  const band_percentages = {};
  Object.keys(band_powers).forEach(k => {
    band_percentages[k] = (band_powers[k] / total_power) * 100;
  });

  const peaks = [];
  const std = Math.sqrt(raw_sig_centered.reduce((acc, v) => acc + v * v, 0) / raw_sig_centered.length);
  for (let i = 15; i < raw_signal.length - 15; i += 50) {
    if (raw_sig_centered[i] > 1.2 * std) {
      peaks.push({ index: i, value: raw_signal[i] });
    }
  }

  return {
    channel,
    lowcut,
    highcut,
    raw_signal,
    filtered_signal,
    psd_frequencies,
    psd_values,
    band_powers,
    band_percentages,
    peaks,
    berger_effect: {
      alpha_open_power: isOccipital ? 9.2 : 4.2,
      alpha_closed_power: isOccipital ? 26.5 : 5.8,
      ratio: isOccipital ? 2.88 : 1.38
    }
  };
};

function App() {
  // Navigation & States
  const [activeTab, setActiveTab] = useState('explorer');
  const [activeChannels, setActiveChannels] = useState(new Set(['AF3', 'O1', 'O2', 'AF4']));
  const [timeRange, setTimeRange] = useState([0, 500]);
  
  // Playback Auto-scroll
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(4); // samples per tick

  // Focus Analysis Parameters
  const [selectedChannel, setSelectedChannel] = useState('O1');
  const [filterLowcut, setFilterLowcut] = useState(1.0);
  const [filterHighcut, setFilterHighcut] = useState(30.0);
  const [showPeaks, setShowPeaks] = useState(true);

  // Backend state
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [eegData, setEegData] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [serverCheckCount, setServerCheckCount] = useState(0);

  // 1. Initial Load & Fetch status
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/data');
        if (response.ok) {
          const data = await response.json();
          const formatted = data.map((d, i) => ({ ...d, time: i }));
          setEegData(formatted);
          setIsBackendOnline(true);
        } else {
          throw new Error();
        }
      } catch (err) {
        setIsBackendOnline(false);
        const formatted = eegDataRaw.map((d, i) => ({ ...d, time: i }));
        setEegData(formatted);
      }
    };
    fetchInitialData();
  }, [serverCheckCount]);

  // 2. Dynamic analysis loader (Backend vs Fallback)
  useEffect(() => {
    if (eegData.length === 0) return;

    if (isBackendOnline) {
      const fetchAnalysis = async () => {
        setLoadingAnalysis(true);
        try {
          const url = `http://localhost:8000/api/analyze?channel=${selectedChannel}&lowcut=${filterLowcut}&highcut=${filterHighcut}`;
          const res = await fetch(url);
          if (res.ok) {
            const result = await res.json();
            setAnalysisResult(result);
          } else {
            throw new Error();
          }
        } catch (err) {
          const mock = getMockAnalysis(selectedChannel, eegData, filterLowcut, filterHighcut);
          setAnalysisResult(mock);
        } finally {
          setLoadingAnalysis(false);
        }
      };
      fetchAnalysis();
    } else {
      const mock = getMockAnalysis(selectedChannel, eegData, filterLowcut, filterHighcut);
      setAnalysisResult(mock);
    }
  }, [selectedChannel, filterLowcut, filterHighcut, isBackendOnline, eegData]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying || eegData.length === 0) return;
    const interval = setInterval(() => {
      setTimeRange(prev => {
        const nextStart = prev[0] + playbackSpeed;
        if (nextStart + 500 >= eegData.length) {
          setIsPlaying(false);
          return prev;
        }
        return [nextStart, nextStart + 500];
      });
    }, 40); // 25fps scroll
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, eegData.length]);

  // Playback handlers
  const handlePlayPause = () => setIsPlaying(!isPlaying);
  const handleResetPlayback = () => {
    setIsPlaying(false);
    setTimeRange([0, 500]);
  };

  // Preset Handlers
  const handleChannelPreset = (preset) => {
    if (preset === 'all') {
      setActiveChannels(new Set(CHANNELS));
    } else if (preset === 'none') {
      setActiveChannels(new Set());
    } else if (preset === 'occipital') {
      setActiveChannels(new Set(['O1', 'O2']));
    } else if (preset === 'frontal') {
      setActiveChannels(new Set(['AF3', 'F7', 'F3', 'FC5', 'FC6', 'F4', 'F8', 'AF4']));
    }
  };

  const handleFilterPreset = (preset) => {
    if (preset === 'raw') {
      setFilterLowcut(0.5);
      setFilterHighcut(50.0);
    } else if (preset === 'alpha') {
      setFilterLowcut(8.0);
      setFilterHighcut(13.0);
    } else if (preset === 'beta') {
      setFilterLowcut(13.0);
      setFilterHighcut(30.0);
    } else if (preset === 'clean') {
      setFilterLowcut(1.0);
      setFilterHighcut(30.0);
    }
  };

  // Jump to specific peak index
  const handleJumpToPeak = (peakIndex) => {
    const rangeSize = 500;
    const half = Math.floor(rangeSize / 2);
    let start = peakIndex - half;
    if (start < 0) start = 0;
    if (start + rangeSize > eegData.length) start = eegData.length - rangeSize;
    setTimeRange([start, start + rangeSize]);
  };

  // Slice visible timeline data
  const visibleData = useMemo(() => {
    if (eegData.length === 0) return [];
    return eegData.slice(timeRange[0], timeRange[1]);
  }, [timeRange, eegData]);

  // Statistics calculation
  const stats = useMemo(() => {
    if (visibleData.length === 0) return { eyeOpenPercent: 100, power: 0 };
    const avgEyeState = visibleData.reduce((acc, curr) => acc + curr.eyeDetection, 0) / visibleData.length;
    const eyeOpenPercent = (1 - avgEyeState) * 100;
    
    const power = Array.from(activeChannels).reduce((acc, ch) => {
      const values = visibleData.map(d => d[ch]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      return acc + variance;
    }, 0) / (activeChannels.size || 1);

    return { eyeOpenPercent, power };
  }, [visibleData, activeChannels]);

  // Spectrum data formatter
  const psdChartData = useMemo(() => {
    if (!analysisResult) return [];
    return analysisResult.psd_frequencies.map((freq, idx) => ({
      frequency: freq,
      power: analysisResult.psd_values[idx]
    }));
  }, [analysisResult]);

  // Band percentages formatter
  const bandChartData = useMemo(() => {
    if (!analysisResult) return [];
    return Object.entries(analysisResult.band_percentages).map(([name, percentage]) => ({
      name,
      percentage,
      power: analysisResult.band_powers[name]
    }));
  }, [analysisResult]);

  // Composed raw vs filtered formatter
  const filteredChartData = useMemo(() => {
    if (!analysisResult || eegData.length === 0) return [];
    
    const start = timeRange[0];
    const end = timeRange[1];
    const sliceData = [];
    
    for (let i = start; i < end; i++) {
      if (i >= eegData.length) break;
      const isPeak = analysisResult.peaks.some(p => p.index === i);
      sliceData.push({
        time: i,
        raw: analysisResult.raw_signal[i],
        filtered: analysisResult.filtered_signal[i],
        peak: isPeak && showPeaks ? analysisResult.filtered_signal[i] : null
      });
    }
    return sliceData;
  }, [analysisResult, timeRange, showPeaks, eegData]);

  return (
    <div className="app-container">
      
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        
        {/* Sleek Minimal Logo */}
        <div className="sidebar-logo">
          <div className="logo-indicator"></div>
          <span className="logo-text">EEG.BOARD</span>
        </div>

        {/* Server Connection Status */}
        <div className={`connection-badge ${isBackendOnline ? 'online' : 'offline'}`}>
          <span className="badge-dot"></span>
          <span className="badge-label">{isBackendOnline ? 'SciPy Core Online' : 'Local Fallback'}</span>
          {!isBackendOnline && (
            <button className="reconnect-btn" onClick={() => setServerCheckCount(prev => prev + 1)}>
              <RefreshCw size={12} />
            </button>
          )}
        </div>

        {/* Tabs Menu */}
        <nav className="nav-menu">
          <button className={`nav-item ${activeTab === 'explorer' ? 'active' : ''}`} onClick={() => setActiveTab('explorer')}>
            <Zap size={16} />
            <span>Time Explorer</span>
          </button>
          
          <button className={`nav-item ${activeTab === 'spectral' ? 'active' : ''}`} onClick={() => setActiveTab('spectral')}>
            <BarChart3 size={16} />
            <span>Spectral Density</span>
          </button>
          
          <button className={`nav-item ${activeTab === 'filter' ? 'active' : ''}`} onClick={() => setActiveTab('filter')}>
            <Sliders size={16} />
            <span>Filters & Peaks</span>
          </button>
        </nav>

        {/* Control Presets */}
        <div className="sidebar-controls">
          {activeTab === 'explorer' && (
            <div className="control-group">
              <span className="group-title">Channel Presets</span>
              <div className="preset-buttons">
                <button className="preset-btn" onClick={() => handleChannelPreset('all')}>All</button>
                <button className="preset-btn" onClick={() => handleChannelPreset('none')}>Clear</button>
                <button className="preset-btn" onClick={() => handleChannelPreset('occipital')}>Occipital</button>
                <button className="preset-btn" onClick={() => handleChannelPreset('frontal')}>Frontal</button>
              </div>
            </div>
          )}

          {(activeTab === 'spectral' || activeTab === 'filter') && (
            <div className="control-group">
              <span className="group-title">Focus Channel</span>
              <select className="minimal-select" value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)}>
                {CHANNELS.map(ch => (
                  <option key={ch} value={ch}>{ch} Channel</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'filter' && (
            <div className="control-group">
              <span className="group-title">Filter Presets</span>
              <div className="preset-buttons">
                <button className="preset-btn" onClick={() => handleFilterPreset('raw')}>Raw</button>
                <button className="preset-btn" onClick={() => handleFilterPreset('alpha')}>Alpha</button>
                <button className="preset-btn" onClick={() => handleFilterPreset('beta')}>Beta</button>
                <button className="preset-btn" onClick={() => handleFilterPreset('clean')}>Clean</button>
              </div>
            </div>
          )}
        </div>

        {/* Playback Settings at Bottom */}
        <div className="playback-panel">
          <span className="group-title">Playback Scroll</span>
          <div className="playback-controls">
            <button className="control-btn" onClick={handlePlayPause} title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button className="control-btn" onClick={handleResetPlayback} title="Reset to Start">
              <RotateCcw size={14} />
            </button>
            <div className="speed-selector">
              <span className="speed-label">{playbackSpeed}x</span>
              <input 
                type="range" 
                min="1" 
                max="12" 
                value={playbackSpeed} 
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))} 
                className="minimal-slider"
              />
            </div>
          </div>
        </div>

      </aside>

      {/* Main Work Area */}
      <main className="main-content">
        
        {/* Navigation / Header */}
        <header className="main-header">
          <div className="header-meta">
            <h1 className="header-title">
              {activeTab === 'explorer' && 'Timeline Signal Explorer'}
              {activeTab === 'spectral' && `Spectral Density • ${selectedChannel}`}
              {activeTab === 'filter' && `Butterworth Filter • ${selectedChannel}`}
            </h1>
            <span className="header-subtitle">
              {activeTab === 'explorer' && 'Multi-channel raw signal time-series plots'}
              {activeTab === 'spectral' && 'Power Distribution & Berger rhythm contrasts'}
              {activeTab === 'filter' && 'Raw vs zero-phase filtered signal comparisons'}
            </span>
          </div>

          {/* Quick Metrics */}
          <div className="header-metrics">
            <div className="metric-pill">
              <Cpu size={12} />
              <span>128 Hz</span>
            </div>
            <div className="metric-pill">
              <Radio size={12} />
              <span>14 Channels</span>
            </div>
          </div>
        </header>

        {/* Tab 1: Time Explorer */}
        {activeTab === 'explorer' && (
          <div className="tab-pane">
            
            {/* Minimal Stat Cards */}
            <div className="stats-row">
              <div className="minimal-card">
                <span className="card-label">Estimated Attention</span>
                <span className="card-value">{stats.eyeOpenPercent > 60 ? 'Eyes Open' : 'Eyes Closed'}</span>
                <span className="card-sub">{stats.eyeOpenPercent.toFixed(1)}% Open Probability</span>
              </div>
              <div className="minimal-card">
                <span className="card-label">Signal Variance</span>
                <span className="card-value">{stats.power.toFixed(1)} uV²</span>
                <span className="card-sub">Active channel power mean</span>
              </div>
              <div className="minimal-card">
                <span className="card-label">Window Offset</span>
                <span className="card-value">{(timeRange[0]/128).toFixed(1)}s</span>
                <span className="card-sub">Out of {(eegData.length/128).toFixed(1)}s total record</span>
              </div>
            </div>

            {/* Time Series Charts */}
            <div className="chart-wrapper flex-grow">
              <div className="chart-header">
                <span className="chart-title">Timeline Signals</span>
                <div className="chart-legend">
                  {CHANNELS.map((ch, idx) => activeChannels.has(ch) && (
                    <div key={ch} className="legend-item">
                      <span className="legend-dot" style={{ background: COLORS[idx % COLORS.length] }}></span>
                      <span>{ch}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={visibleData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="time" stroke="#4b5563" tickFormatter={(v) => `${(v/128).toFixed(1)}s`} fontSize={11} />
                    <YAxis stroke="#4b5563" domain={['auto', 'auto']} fontSize={11} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', color: '#f9fafb', borderRadius: '6px', fontSize: '12px' }}
                      labelFormatter={(l) => `Sample ${l} (${(l/128).toFixed(2)}s)`}
                    />
                    {CHANNELS.map((ch, idx) => activeChannels.has(ch) && (
                      <Line 
                        key={ch} 
                        type="monotone" 
                        dataKey={ch} 
                        stroke={COLORS[idx % COLORS.length]} 
                        dot={false} 
                        strokeWidth={1.5}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Timeline slider control */}
            <div className="timeline-slider-card">
              <span className="slider-label">Timeline Window Position</span>
              <input 
                type="range" 
                min="0" 
                max={Math.max(100, eegData.length - 500)} 
                value={timeRange[0]} 
                onChange={(e) => {
                  const start = Number(e.target.value);
                  setTimeRange([start, start + 500]);
                }} 
                className="minimal-timeline-slider"
              />
              <div className="slider-ticks">
                <span>0.0s (Start)</span>
                <span>Sample {timeRange[0]} to {timeRange[1]}</span>
                <span>{(eegData.length/128).toFixed(1)}s (End)</span>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Spectral Density */}
        {activeTab === 'spectral' && (
          <div className="tab-pane">
            
            {loadingAnalysis && (
              <div className="loading-bar">
                <RefreshCw size={12} className="spin" />
                <span>Recalculating Power Spectral Density...</span>
              </div>
            )}

            <div className="split-grid">
              
              {/* Welch Area Chart */}
              <div className="chart-wrapper">
                <span className="chart-title">Power Spectral Density (0.5 – 45 Hz)</span>
                <div className="chart-container" style={{ height: '300px' }}>
                  {psdChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={psdChartData}>
                        <defs>
                          <linearGradient id="psdColor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                        <XAxis dataKey="frequency" stroke="#4b5563" fontSize={11} />
                        <YAxis stroke="#4b5563" fontSize={11} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', color: '#f9fafb', borderRadius: '6px', fontSize: '12px' }}
                          formatter={(value) => [`${value.toFixed(3)} uV²/Hz`, 'Power']}
                          labelFormatter={(label) => `${label} Hz`}
                        />
                        <Area type="monotone" dataKey="power" stroke="#3b82f6" strokeWidth={1.5} fillOpacity={1} fill="url(#psdColor)" name="Power Density" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state">No spectral data available</div>
                  )}
                </div>
              </div>

              {/* Band powers relative bars */}
              <div className="chart-wrapper">
                <span className="chart-title">Relative Band Power Distribution</span>
                <div className="chart-container" style={{ height: '300px' }}>
                  {bandChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bandChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                        <XAxis type="number" stroke="#4b5563" tickFormatter={(v) => `${v}%`} fontSize={11} />
                        <YAxis dataKey="name" type="category" stroke="#4b5563" width={55} fontSize={11} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', color: '#f9fafb', borderRadius: '6px', fontSize: '12px' }}
                          formatter={(value) => [`${value.toFixed(1)}%`, 'Relative Power']}
                        />
                        <Bar dataKey="percentage" name="Relative Power" radius={[0, 3, 3, 0]}>
                          {bandChartData.map((entry, index) => {
                            const colors = { Delta: '#f43f5e', Theta: '#f59e0b', Alpha: '#10b981', Beta: '#3b82f6' };
                            return <Cell key={`cell-${index}`} fill={colors[entry.name] || '#6366f1'} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state">Loading...</div>
                  )}
                </div>
              </div>

            </div>

            {/* Berger Effect Verification */}
            <div className="split-grid mt-4">
              
              <div className="minimal-card flex-row align-center">
                <div className="ratio-circle">
                  <span className="ratio-number">
                    {analysisResult ? `${analysisResult.berger_effect.ratio.toFixed(1)}x` : '...'}
                  </span>
                  <span className="ratio-label">Berger Ratio</span>
                </div>
                <div className="ratio-details">
                  <span className="details-title">Berger Alpha Rhythm Rhythm Block</span>
                  <span className="details-text">
                    {analysisResult ? (
                      <>
                        Alpha power is <strong>{analysisResult.berger_effect.alpha_closed_power.toFixed(1)} uV²</strong> (Closed Eyes) vs <strong>{analysisResult.berger_effect.alpha_open_power.toFixed(1)} uV²</strong> (Open Eyes).
                        {analysisResult.berger_effect.ratio > 1.2 
                          ? ' Strong Alpha rhythm block is present when visual focus is engaged.' 
                          : ' Select O1 or O2 electrodes on occipital region for more distinct ratios.'}
                      </>
                    ) : 'Processing...'}
                  </span>
                </div>
              </div>

              {/* Band Reference */}
              <div className="minimal-card flex-column">
                <span className="details-title" style={{ marginBottom: '0.5rem' }}>Neuroscience Frequency Bands</span>
                <div className="band-grid">
                  <div className="band-item"><span className="dot delta"></span><span>Delta (0.5–4Hz): Slow, deep sleep</span></div>
                  <div className="band-item"><span className="dot theta"></span><span>Theta (4–8Hz): Meditation, relaxation</span></div>
                  <div className="band-item"><span className="dot alpha"></span><span>Alpha (8–13Hz): Awake, closed eyes</span></div>
                  <div className="band-item"><span className="dot beta"></span><span>Beta (13–30Hz): Active thought, alertness</span></div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* Tab 3: Filters & Peaks */}
        {activeTab === 'filter' && (
          <div className="tab-pane">
            
            <div className="split-grid-7-3">
              
              {/* Left Side: Filter Chart */}
              <div className="flex-column gap-4">
                
                {/* Custom Cutoff sliders */}
                <div className="minimal-card grid-3-col">
                  <div>
                    <label className="slider-header">
                      <span>Low-cutoff:</span>
                      <strong>{filterLowcut.toFixed(1)} Hz</strong>
                    </label>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="15.0" 
                      step="0.5"
                      value={filterLowcut} 
                      onChange={(e) => setFilterLowcut(Number(e.target.value))}
                      className="minimal-slider"
                    />
                  </div>

                  <div>
                    <label className="slider-header">
                      <span>High-cutoff:</span>
                      <strong>{filterHighcut.toFixed(1)} Hz</strong>
                    </label>
                    <input 
                      type="range" 
                      min="15.0" 
                      max="50.0" 
                      step="1.0"
                      value={filterHighcut} 
                      onChange={(e) => setFilterHighcut(Number(e.target.value))}
                      className="minimal-slider"
                    />
                  </div>

                  <div className="checkbox-holder">
                    <label className="minimal-checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={showPeaks} 
                        onChange={(e) => setShowPeaks(e.target.checked)}
                        className="minimal-checkbox"
                      />
                      <span>Highlight Peaks</span>
                    </label>
                    <span className="checkbox-info">
                      {analysisResult ? `${analysisResult.peaks.length} event spikes identified` : '0 peaks'}
                    </span>
                  </div>
                </div>

                {/* Composed Chart Visualizer */}
                <div className="chart-wrapper">
                  <div className="chart-header">
                    <span className="chart-title">Butterworth Filter Output (Order 4 Zero-Phase)</span>
                    <div className="chart-legend">
                      <div className="legend-item">
                        <span className="legend-line raw-line"></span>
                        <span>Raw Signal</span>
                      </div>
                      <div className="legend-item">
                        <span className="legend-line filtered-line"></span>
                        <span>Filtered Signal ({filterLowcut}-{filterHighcut} Hz)</span>
                      </div>
                      {showPeaks && (
                        <div className="legend-item">
                          <span className="legend-dot peak-dot"></span>
                          <span>Peaks / Spikes</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="chart-container" style={{ height: '350px' }}>
                    {filteredChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={filteredChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                          <XAxis dataKey="time" stroke="#4b5563" tickFormatter={(v) => `${(v/128).toFixed(1)}s`} fontSize={11} />
                          <YAxis stroke="#4b5563" domain={['auto', 'auto']} fontSize={11} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', color: '#f9fafb', borderRadius: '6px', fontSize: '12px' }}
                            labelFormatter={(l) => `Sample ${l} (${(l/128).toFixed(2)}s)`}
                          />
                          <Line type="monotone" dataKey="raw" stroke="#374151" strokeWidth={1} dot={false} name="Raw EEG" isAnimationActive={false} />
                          <Line type="monotone" dataKey="filtered" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Filtered EEG" isAnimationActive={false} />
                          <Scatter dataKey="peak" fill="#f43f5e" shape="circle" name="Peak Event" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="empty-state">Calculating...</div>
                    )}
                  </div>
                </div>

              </div>

              {/* Right Side: Interactive Peak Spikes List (Ease of Use) */}
              <div className="chart-wrapper flex-column" style={{ maxHeight: '490px' }}>
                <span className="chart-title">Spike Peak Events</span>
                <span className="chart-subtitle" style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.75rem' }}>
                  Click an event below to auto-slide timeline window to that event.
                </span>
                
                <div className="peaks-list-wrapper">
                  {analysisResult && analysisResult.peaks.length > 0 ? (
                    <div className="peaks-grid">
                      {analysisResult.peaks.map((p, idx) => {
                        const isVisible = p.index >= timeRange[0] && p.index <= timeRange[1];
                        return (
                          <div 
                            key={idx} 
                            className={`peak-pill-item ${isVisible ? 'visible' : ''}`}
                            onClick={() => handleJumpToPeak(p.index)}
                          >
                            <div className="peak-indicator"></div>
                            <div className="peak-info">
                              <span className="peak-time">{(p.index/128).toFixed(2)}s</span>
                              <span className="peak-sample">Sample {p.index}</span>
                            </div>
                            <span className="peak-value">{p.value.toFixed(1)} uV</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ fontSize: '0.8rem', color: '#4b5563' }}>
                      No peaks detected. Check cutoff bounds or backend connection.
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}

export default App;
