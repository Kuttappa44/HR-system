import React, { useState, useCallback, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab
} from '@mui/material';
import { resumeAPI } from '../services/api';
import { useDropzone } from 'react-dropzone';
import { Upload, Download, Assessment, Phone } from '@mui/icons-material';

const ResumeParser = () => {
  const [selectedJobDescription, setSelectedJobDescription] = useState('');
  const [jobDescriptions, setJobDescriptions] = useState([]);
  const [resumeFiles, setResumeFiles] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [tabValue, setTabValue] = useState(0);
  const [prescreeningResults, setPrescreeningResults] = useState([]);
  const [prescreeningLoading, setPrescreeningLoading] = useState(false);

  useEffect(() => {
    fetchJobDescriptions();
    fetchCandidates();
  }, []);

  const fetchJobDescriptions = async () => {
    try {
      const response = await fetch('http://localhost:8080/job-descriptions');
      if (response.ok) {
        const data = await response.json();
        setJobDescriptions(data);
      }
    } catch (error) {
      console.error('Error fetching job descriptions:', error);
      setSnackbar({ open: true, message: 'Failed to fetch job descriptions', severity: 'error' });
    }
  };

  const fetchCandidates = async () => {
    try {
      const response = await fetch('http://localhost:8080/candidates');
      if (response.ok) {
        const data = await response.json();
        setCandidates(data);
      }
    } catch (error) {
      console.error('Error fetching candidates:', error);
    }
  };

  const onResumeDrop = useCallback((acceptedFiles, rejectedFiles) => {
    console.log('Files dropped:', acceptedFiles.length, 'accepted,', rejectedFiles.length, 'rejected');
    console.log('Accepted files:', acceptedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));
    if (rejectedFiles.length > 0) {
      console.log('Rejected files:', rejectedFiles.map(f => ({ file: f.file?.name, errors: f.errors })));
    }
    
    // Add new files to existing files
    setResumeFiles(prevFiles => {
      const newFiles = [...prevFiles, ...acceptedFiles];
      console.log('Total files after adding:', newFiles.length);
      console.log('File names:', newFiles.map(f => f.name));
      return newFiles;
    });
  }, []);

  const { getRootProps: getResumeRootProps, getInputProps: getResumeInputProps, isDragActive: isResumeDragActive } = useDropzone({
    onDrop: onResumeDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    multiple: true,
    maxSize: 10 * 1024 * 1024, // 10MB limit
    onDropRejected: (rejectedFiles) => {
      console.log('Files rejected by dropzone:', rejectedFiles);
      rejectedFiles.forEach(rejection => {
        console.log(`File ${rejection.file.name} rejected:`, rejection.errors);
      });
    }
  });

  const parseAndScoreResumes = async () => {
    // Prevent multiple simultaneous requests
    if (loading) {
      console.log('Already processing, ignoring duplicate request');
      return;
    }

    if (!selectedJobDescription || resumeFiles.length === 0) {
      setSnackbar({ open: true, message: 'Please select a job description and upload resume files', severity: 'error' });
      return;
    }

    // Validate files before sending
    const validFiles = resumeFiles.filter(file => file && file.size > 0);
    if (validFiles.length === 0) {
      setSnackbar({ open: true, message: 'Please upload valid resume files', severity: 'error' });
      return;
    }

    console.log('Starting resume parsing with', validFiles.length, 'valid files');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('job_id', selectedJobDescription);
      validFiles.forEach(file => {
        console.log('Adding file:', file.name, 'Size:', file.size, 'Type:', file.type);
        formData.append('files', file);
      });

      console.log('FormData entries:', Array.from(formData.entries()).map(([key, value]) => [key, value instanceof File ? `File(${value.name})` : value]));

      // Double-check that we have files before sending
      const fileEntries = Array.from(formData.entries()).filter(([key]) => key === 'files');
      if (fileEntries.length === 0) {
        throw new Error('No files found in FormData - this should not happen');
      }

      console.log('Sending request to backend with', fileEntries.length, 'files');
      const response = await resumeAPI.parseAndScoreResumes(formData);
      const data = response.data;
      
      // Extract candidate data from results
      const candidateData = (data.results || [])
        .filter(result => result.success)
        .map(result => result.candidate);
      
      
      // Set the parsed candidates
      setCandidates(candidateData);
      
      // Clear the uploaded files after successful parsing
      setResumeFiles([]);
      
      // Handle auto-processing results
      const autoProcessing = data.auto_processing;
      if (autoProcessing && autoProcessing.success) {
        const results = autoProcessing.results;
        const message = `Resumes parsed successfully! 
        📧 Emails sent: ${results.emails_sent}/${results.total_candidates} candidates
        📊 HR report sent: ${results.hr_report_sent ? 'Yes' : 'No'}
        ✅ Auto-processing completed!`;
        setSnackbar({ open: true, message: message, severity: 'success' });
      } else if (autoProcessing && !autoProcessing.success) {
        setSnackbar({ 
          open: true, 
          message: `Resumes parsed successfully, but auto-processing failed: ${autoProcessing.error || 'Unknown error'}`, 
          severity: 'warning' 
        });
      } else {
        setSnackbar({ open: true, message: 'Resumes parsed successfully!', severity: 'success' });
      }
    } catch (error) {
      console.error('Error parsing resumes:', error);
      console.error('Error details:', error.response?.data || error.response || error);
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error occurred';
      setSnackbar({ open: true, message: `Error: ${errorMessage}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const runPrescreeningCalls = async () => {
    setPrescreeningLoading(true);
    try {
      const response = await fetch('http://localhost:8080/prescreening/bulk-process', {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setPrescreeningResults(data.results || []);
        
        // Show success notification with details
        let message = 'Prescreening calls completed!';
        if (data.hr_report_sent) {
          message += ' HR report sent via email.';
        }
        if (data.emails_sent) {
          message += ` ${data.emails_sent} status emails sent to candidates.`;
        }
        if (data.error) {
          message += ` Warning: ${data.error}`;
        }
        
        setSnackbar({ 
          open: true, 
          message: message, 
          severity: data.error ? 'warning' : 'success' 
        });
      } else {
        throw new Error('Failed to initiate prescreening calls');
      }
    } catch (error) {
      console.error('Error running prescreening calls:', error);
      setSnackbar({ open: true, message: `Error: ${error.message}`, severity: 'error' });
    } finally {
      setPrescreeningLoading(false);
    }
  };

  const downloadCSV = () => {
    if (candidates.length === 0) return;

    const headers = ['Name', 'Skills', 'Education', 'Certifications', 'Experience', 'Email', 'Phone Number', 'LinkedIn', 'Score', 'Status'];
    const csvContent = [
      headers.join(','),
      ...candidates.map(candidate => [
        `"${candidate.name || ''}"`,
        `"${candidate.skills || ''}"`,
        `"${candidate.education || ''}"`,
        `"${candidate.certifications || ''}"`,
        `"${candidate.experience || ''}"`,
        `"${candidate.email || ''}"`,
        `"${candidate.phone_number || ''}"`,
        `"${candidate.linkedin || ''}"`,
        candidate.score || 0,
        `"${candidate.status || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidates.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadResume = (candidate, index) => {
    // Find the original file from resumeFiles array
    const originalFile = resumeFiles[index];
    if (originalFile) {
      const url = window.URL.createObjectURL(originalFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalFile.name;
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      setSnackbar({ 
        open: true, 
        message: 'Original file not found for download', 
        severity: 'error' 
      });
    }
  };

  const removeFile = (indexToRemove) => {
    setResumeFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'success';
    if (score >= 80) return 'primary';
    if (score >= 70) return 'warning';
    if (score >= 60) return 'info';
    return 'error';
  };

  const getStatusColor = (status) => {
    return status === 'Interview Scheduled' ? 'success' : 'default';
  };

  const getCallStatusColor = (status) => {
    if (status === 'Call initiated') return 'success';
    if (status.includes('Failed')) return 'error';
    return 'default';
  };

  const qualifiedCandidates = candidates.filter(c => c.score >= 70);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
        HR Management System
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Upload job descriptions and resumes to automatically extract candidate information, 
        score them using AI, and conduct prescreening calls.
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Resume & JD Parser" />
          <Tab label="Prescreening Call & Send Details to HR" />
        </Tabs>
      </Box>

      {/* Tab 1: Resume & JD Parser */}
      {tabValue === 0 && (
        <Box>
          {/* Job Description Selection */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Select Job Description
            </Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Job Description</InputLabel>
              <Select
                value={selectedJobDescription}
                label="Job Description"
                onChange={(e) => setSelectedJobDescription(e.target.value)}
              >
                {jobDescriptions.map((jd) => (
                  <MenuItem key={jd.id} value={jd.id}>
                    {jd.title} - {jd.company} ({jd.type})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedJobDescription && (
              <Alert severity="info">
                Selected job description will be used for AI scoring and candidate evaluation.
              </Alert>
            )}
          </Paper>

          {/* Resume Upload */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              <Upload sx={{ mr: 1, verticalAlign: 'middle' }} />
              Upload Resumes (Multiple)
            </Typography>
            <Box
              {...getResumeRootProps()}
              sx={{
                border: '2px dashed',
                borderColor: isResumeDragActive ? 'primary.main' : 'grey.300',
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: isResumeDragActive ? 'action.hover' : 'background.paper',
                transition: 'all 0.2s'
              }}
            >
              <input {...getResumeInputProps()} />
              <Upload sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                {isResumeDragActive
                  ? 'Drop resumes here...'
                  : 'Drag & drop resumes or click to select'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Supports: PDF, DOC, DOCX, TXT (Multiple files)
              </Typography>
            </Box>
            {resumeFiles.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="success" sx={{ mb: 2 }}>
                  Selected {resumeFiles.length} resume(s)
                </Alert>
                <Box sx={{ mb: 2 }}>
                  {resumeFiles.map((file, index) => (
                    <Box key={index} sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      p: 1, 
                      border: '1px solid', 
                      borderColor: 'grey.300', 
                      borderRadius: 1, 
                      mb: 1,
                      bgcolor: 'background.paper'
                    }}>
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>
                        {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        onClick={() => removeFile(index)}
                        sx={{ ml: 1 }}
                      >
                        Remove
                      </Button>
                    </Box>
                  ))}
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setResumeFiles([])}
                  sx={{ mb: 1 }}
                >
                  Clear All Files
                </Button>
              </Box>
            )}
          </Paper>

          {/* Parse Button */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Button
              variant="contained"
              size="large"
              onClick={parseAndScoreResumes}
              disabled={loading || !selectedJobDescription || resumeFiles.length === 0}
              startIcon={loading ? <CircularProgress size={20} /> : <Assessment />}
              sx={{ px: 4, py: 1.5 }}
            >
              {loading ? 'Parsing Resumes...' : `Parse & Score ${resumeFiles.length} Candidates`}
            </Button>
          </Box>

          {/* Results Table */}
          {candidates.length > 0 && (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  Candidate Analysis Results ({candidates.length} candidates)
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  onClick={downloadCSV}
                  sx={{ ml: 2 }}
                >
                  Download All Candidates as CSV
                </Button>
              </Box>

              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Skills</TableCell>
                      <TableCell>Education</TableCell>
                      <TableCell>Certifications</TableCell>
                      <TableCell>Experience</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Phone Number</TableCell>
                      <TableCell>LinkedIn</TableCell>
                      <TableCell align="center">Score</TableCell>
                      <TableCell align="center">Status</TableCell>
                      <TableCell align="center">Download Resume</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {candidates.map((candidate, index) => (
                      <TableRow key={index} hover>
                        <TableCell sx={{ fontWeight: 'medium' }}>
                          {candidate.name || 'N/A'}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 200 }}>
                          <Typography variant="body2" noWrap>
                            {candidate.skills || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 150 }}>
                          <Typography variant="body2" noWrap>
                            {candidate.education || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 150 }}>
                          <Typography variant="body2" noWrap>
                            {candidate.certifications || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 200 }}>
                          <Typography variant="body2" noWrap>
                            {candidate.experience || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {candidate.email || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {candidate.phone_number || candidate['phone number'] || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {candidate.linkedin || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={candidate.score || 0}
                            color={getScoreColor(candidate.score)}
                            variant="filled"
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={candidate.status || 'Not Scheduled'}
                            color={getStatusColor(candidate.status)}
                            variant="outlined"
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Download />}
                            onClick={() => downloadResume(candidate, index)}
                          >
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>
      )}

      {/* Tab 2: Prescreening Call & Send Details to HR */}
      {tabValue === 1 && (
        <Box>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Prescreening Call & Send Details to HR
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              This will automatically call all candidates with score ≥ 70, send status emails, and generate HR report.
            </Typography>
            
            <Button
              variant="contained"
              size="large"
              onClick={runPrescreeningCalls}
              disabled={prescreeningLoading || qualifiedCandidates.length === 0}
              startIcon={prescreeningLoading ? <CircularProgress size={20} /> : <Phone />}
              sx={{ px: 4, py: 1.5 }}
            >
              {prescreeningLoading ? 'Running Prescreening Calls...' : 'Run Prescreening Calls'}
            </Button>
            
            {qualifiedCandidates.length === 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                No qualified candidates (score ≥ 70) found. Please parse resumes first.
              </Alert>
            )}
          </Paper>

          {/* Prescreening Results */}
          {prescreeningResults.length > 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Prescreening Call Results
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Candidate Name</TableCell>
                      <TableCell align="center">Call Status</TableCell>
                      <TableCell>AI Interview Summary</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {prescreeningResults.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ fontWeight: 'medium' }}>
                          {result.candidate_name}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={result.call_status}
                            color={getCallStatusColor(result.call_status)}
                            variant="outlined"
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 400 }}>
                            {result.interview_summary || 'No interview summary available'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* HR Report Status */}
          {prescreeningResults.length > 0 && (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                HR Report Status
              </Typography>
              <Alert severity="success">
                HR report (Excel) has been automatically sent to HR email with all candidate details and scores.
              </Alert>
            </Paper>
          )}
        </Box>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Container>
  );
};

export default ResumeParser;