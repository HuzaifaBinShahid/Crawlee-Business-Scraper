import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout } from './components/Layout';
import { RunScraperTab } from './components/RunScraperTab';
import { DataTab } from './components/DataTab';
import { StatsTab } from './components/StatsTab';
import { HistoryTab } from './components/HistoryTab';
import { SettingsTab } from './components/SettingsTab';
import { getRunStatus } from './api/client';

const POLL_INTERVAL_MS = 2000;

const initialRunState = {
  jobId: null,
  status: 'idle',
  error: null,
  success: null,
};

function App() {
  const [activeTab, setActiveTab] = useState('run');
  const [runState, setRunState] = useState(initialRunState);
  const pollTimeoutRef = useRef(null);

  const pollStatus = useCallback((jobId) => {
    getRunStatus(jobId)
      .then((res) => {
        setRunState((prev) => ({
          ...prev,
          status: res.status,
          error: res.error ?? prev.error,
        }));
        if (res.status === 'completed') {
          setRunState((prev) => ({ ...prev, jobId: null, success: 'Scraper finished successfully.', error: null }));
          return;
        }
        if (res.status === 'failed') {
          setRunState((prev) => ({ ...prev, jobId: null, error: res.error || 'Scraper run failed.', success: null }));
          return;
        }
        pollTimeoutRef.current = setTimeout(() => pollStatus(jobId), POLL_INTERVAL_MS);
      })
      .catch((err) => {
        setRunState((prev) => ({
          ...prev,
          jobId: null,
          status: 'idle',
          error: err.message || 'Failed to get status',
        }));
      });
  }, []);

  useEffect(() => {
    if (!runState.jobId || (runState.status !== 'running' && runState.status !== 'paused')) return;
    pollStatus(runState.jobId);
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [runState.jobId, runState.status, pollStatus]);

  useEffect(() => {
    getRunStatus()
      .then((res) => {
        if ((res.status === 'running' || res.status === 'paused') && res.jobId) {
          setRunState({ jobId: res.jobId, status: res.status, error: null, success: null });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'run' && (
        <RunScraperTab
          runState={runState}
          setRunState={setRunState}
        />
      )}
      {activeTab === 'data' && <DataTab />}
      {activeTab === 'stats' && <StatsTab />}
      {activeTab === 'history' && <HistoryTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </Layout>
  );
}

export default App;
