import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';
import Navbar from './components/Navbar';
import Candidates from './pages/Candidates';
import Prescreening from './pages/Prescreening';
import ResumeParser from './pages/ResumeParser';
import JobDescription from './pages/JobDescription';
import Analytics from './pages/Analytics';

function App() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Routes>
          <Route path="/" element={<Analytics />} />
          <Route path="/candidates" element={<Candidates />} />
          <Route path="/prescreening" element={<Prescreening />} />
          <Route path="/resume-parser" element={<ResumeParser />} />
          <Route path="/job-descriptions" element={<JobDescription />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </Box>
    </Box>
  );
}

export default App;

