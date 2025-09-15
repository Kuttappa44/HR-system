import React, { useState, useEffect } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  Phone,
  Assessment,
  CheckCircle,
  Cancel,
  Warning,
  Info,
  Email
} from '@mui/icons-material';

const Prescreening = () => {
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [jobDescriptions, setJobDescriptions] = useState([]);
  const [selectedJobDescription, setSelectedJobDescription] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [resultsDialog, setResultsDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    fetchCandidates();
    fetchJobDescriptions();
  }, []);

  const fetchCandidates = async () => {
    try {
      const response = await fetch('http://localhost:8080/candidates');
      if (response.ok) {
        const allCandidates = await response.json();
        // Filter candidates with score >= 70 and status 'Interview Scheduled' (matching HR_app.py logic)
        const eligible = allCandidates.filter(c => c.score >= 70 && c.status === 'Interview Scheduled');
        setCandidates(eligible);
      }
    } catch (error) {
      console.error('Error fetching candidates:', error);
      setSnackbar({ open: true, message: 'Failed to fetch candidates', severity: 'error' });
    }
  };

  const fetchJobDescriptions = async () => {
    try {
      const response = await fetch('http://localhost:8080/job-descriptions');
      if (response.ok) {
        const data = await response.json();
        setJobDescriptions(data);
      }
    } catch (error) {
      console.error('Error fetching job descriptions:', error);
    }
  };

  const handleCandidateSelection = (candidateId) => {
    setSelectedCandidates(prev => 
      prev.includes(candidateId) 
        ? prev.filter(id => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCandidates.length === candidates.length) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(candidates.map(c => c.id));
    }
  };

  const runPrescreeningCalls = async () => {
    if (selectedCandidates.length === 0) {
      setSnackbar({ open: true, message: 'Please select at least one candidate', severity: 'warning' });
      return;
    }

    if (!selectedJobDescription) {
      setSnackbar({ open: true, message: 'Please select a job description', severity: 'warning' });
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('http://localhost:8080/prescreening/bulk-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidate_ids: selectedCandidates,
          job_description_id: selectedJobDescription
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data);
        setResultsDialog(true);
        
        // Show success notification
        setSnackbar({ 
          open: true, 
          message: '✅ Prescreening completed! HR report sent via email and candidate emails delivered.', 
          severity: 'success' 
        });
        
        // Refresh candidates list
        fetchCandidates();
        setSelectedCandidates([]);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to process prescreening');
      }
    } catch (error) {
      console.error('Error processing prescreening:', error);
      setSnackbar({ 
        open: true, 
        message: `⚠️ Error: ${error.message}`, 
        severity: 'error' 
      });
    } finally {
      setProcessing(false);
    }
  };

  const getCallStatusIcon = (status) => {
    switch (status) {
      case 'Call initiated':
        return <CheckCircle color="success" />;
      case 'Failed':
        return <Cancel color="error" />;
      case 'Skipped':
        return <Warning color="warning" />;
      default:
        return <Info color="info" />;
    }
  };

  const getCallStatusColor = (status) => {
    switch (status) {
      case 'Call initiated':
        return 'success';
      case 'Failed':
        return 'error';
      case 'Skipped':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
        Prescreening Calls & HR Report
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        <strong>Goal:</strong> Automate prescreening calls & generate HR report.
        <br />
        Select qualified candidates (score ≥ 70) and run automated prescreening calls with AI interview questions.
      </Typography>

      {/* Job Description Selection */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Select Job Description for Prescreening
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
                {jd.title} - {jd.company}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {selectedJobDescription && (
          <Alert severity="info">
            Selected job description will be used for AI interview questions and candidate evaluation.
          </Alert>
        )}
      </Paper>

      {/* Main Prescreening Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">
            Run Prescreening Calls
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleSelectAll}
              disabled={candidates.length === 0}
            >
              {selectedCandidates.length === candidates.length ? 'Deselect All' : 'Select All'}
            </Button>
            <Button
              variant="contained"
              onClick={runPrescreeningCalls}
              disabled={processing || selectedCandidates.length === 0 || !selectedJobDescription}
              startIcon={processing ? <CircularProgress size={20} /> : <Phone />}
              color="success"
              size="large"
            >
              {processing ? 'Processing...' : `Run Prescreening Calls (${selectedCandidates.length})`}
            </Button>
          </Box>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Automated Process:</strong> For each selected candidate, the system will:
            <br />• Generate AI interview questions based on job description
            <br />• Simulate prescreening call with AI agent
            <br />• Show Call Status (Initiated / Failed / Skipped)
            <br />• Generate Interview Summary from AI
            <br />• Send HR Excel report via email
            <br />• Send status emails to candidates
          </Typography>
        </Alert>

        {candidates.length === 0 ? (
          <Alert severity="warning">
            No eligible candidates found. Candidates need a score ≥ 70 and status "Interview Scheduled" to appear here.
            Please parse resumes first in the Resume Parser page.
          </Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedCandidates.length === candidates.length && candidates.length > 0}
                      indeterminate={selectedCandidates.length > 0 && selectedCandidates.length < candidates.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>Candidate Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell align="center">Score</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {candidates.map((candidate) => (
                  <TableRow key={candidate.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedCandidates.includes(candidate.id)}
                        onChange={() => handleCandidateSelection(candidate.id)}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'medium' }}>
                      {candidate.name}
                    </TableCell>
                    <TableCell>{candidate.email}</TableCell>
                    <TableCell>{candidate.phone_number}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={candidate.score}
                        color={candidate.score >= 80 ? 'success' : candidate.score >= 70 ? 'warning' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={candidate.status}
                        color="success"
                        variant="outlined"
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Results Dialog */}
      <Dialog
        open={resultsDialog}
        onClose={() => setResultsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment color="primary" />
            Prescreening Results
          </Box>
        </DialogTitle>
        <DialogContent>
          {results && (
            <Box>
              <Alert severity="success" sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Email color="success" />
                  <Typography variant="body2">
                    <strong>✅ Success!</strong> HR report sent via email and candidate emails delivered.
                    <br />
                    Processed {results.results?.length || 0} candidates.
                  </Typography>
                </Box>
              </Alert>
              
              <Typography variant="h6" gutterBottom>
                Call Results Summary
              </Typography>
              
              {results.results && results.results.map((result, index) => (
                <Card key={index} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">{result.candidate_name}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getCallStatusIcon(result.call_status)}
                        <Chip
                          label={result.call_status}
                          color={getCallStatusColor(result.call_status)}
                          size="small"
                        />
                      </Box>
                    </Box>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Interview Summary (from AI):
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic', bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                      {result.interview_summary || 'No summary available'}
                    </Typography>
                    
                    <Typography variant="subtitle2" gutterBottom>
                      New Status:
                    </Typography>
                    <Chip
                      label={result.new_status}
                      color={result.new_status === 'Interview Scheduled' ? 'success' : 'default'}
                      variant="outlined"
                      size="small"
                    />
                  </CardContent>
                </Card>
              ))}
              
              <Alert severity="info" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  <strong>Next Steps:</strong>
                  <br />• Email notifications have been sent to all candidates
                  <br />• HR report (Excel) has been generated and sent via email
                  <br />• Candidate statuses have been updated in the database
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResultsDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Container>
  );
};

export default Prescreening;