import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  TextField,
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
  Slider,
  Alert,
  CircularProgress,
  Snackbar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Search,
  FilterList,
  Edit,
  Delete,
  Refresh
} from '@mui/icons-material';

const Candidates = () => {
  const [candidates, setCandidates] = useState([]);
  const [filteredCandidates, setFilteredCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Filter states
  const [searchName, setSearchName] = useState('');
  const [filterSkill, setFilterSkill] = useState('');
  const [scoreRange, setScoreRange] = useState([0, 100]);
  const [filterStatus, setFilterStatus] = useState('All');
  
  // Edit dialog states
  const [editDialog, setEditDialog] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    fetchCandidates();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [candidates, searchName, filterSkill, scoreRange, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8080/candidates');
      if (response.ok) {
        const data = await response.json();
        setCandidates(data);
      } else {
        throw new Error('Failed to fetch candidates');
      }
    } catch (error) {
      console.error('Error fetching candidates:', error);
      setSnackbar({ open: true, message: 'Failed to fetch candidates', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...candidates];

    // Search by name or email
    if (searchName) {
      filtered = filtered.filter(candidate =>
        candidate.name?.toLowerCase().includes(searchName.toLowerCase()) ||
        candidate.email?.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    // Filter by skills
    if (filterSkill) {
      const skills = filterSkill.split(',').map(s => s.trim().toLowerCase());
      filtered = filtered.filter(candidate =>
        skills.every(skill => 
          candidate.skills?.toLowerCase().includes(skill)
        )
      );
    }

    // Filter by score range
    filtered = filtered.filter(candidate =>
      candidate.score >= scoreRange[0] && candidate.score <= scoreRange[1]
    );

    // Filter by status
    if (filterStatus !== 'All') {
      filtered = filtered.filter(candidate => candidate.status === filterStatus);
    }

    setFilteredCandidates(filtered);
  };

  const handleEdit = (candidate) => {
    setEditingCandidate(candidate);
    setEditForm({
      name: candidate.name || '',
      email: candidate.email || '',
      phone_number: candidate.phone_number || '',
      skills: candidate.skills || '',
      education: candidate.education || '',
      certifications: candidate.certifications || '',
      experience: candidate.experience || '',
      linkedin: candidate.linkedin || '',
      score: candidate.score || 0,
      status: candidate.status || ''
    });
    setEditDialog(true);
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`http://localhost:8080/candidates/${editingCandidate.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        setSnackbar({ open: true, message: 'Candidate updated successfully', severity: 'success' });
        setEditDialog(false);
        fetchCandidates();
      } else {
        throw new Error('Failed to update candidate');
      }
    } catch (error) {
      console.error('Error updating candidate:', error);
      setSnackbar({ open: true, message: 'Failed to update candidate', severity: 'error' });
    }
  };

  const handleDelete = async (candidateId) => {
    if (window.confirm('Are you sure you want to delete this candidate?')) {
      try {
        const response = await fetch(`http://localhost:8080/candidates/${candidateId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setSnackbar({ open: true, message: 'Candidate deleted successfully', severity: 'success' });
          fetchCandidates();
        } else {
          throw new Error('Failed to delete candidate');
        }
      } catch (error) {
        console.error('Error deleting candidate:', error);
        setSnackbar({ open: true, message: 'Failed to delete candidate', severity: 'error' });
      }
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'success';
    if (score >= 80) return 'primary';
    if (score >= 70) return 'warning';
    if (score >= 60) return 'info';
    return 'error';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Interview Scheduled':
        return 'success';
      case 'Not Scheduled':
        return 'default';
      default:
        return 'info';
    }
  };

  const statusOptions = ['All', ...Array.from(new Set(candidates.map(c => c.status).filter(Boolean)))];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          HR Management System
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchCandidates}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Manage and filter candidates with advanced search capabilities. This matches the exact functionality 
        from the Streamlit HR Management System.
      </Typography>

      {/* Search and Filter Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <FilterList color="primary" />
          <Typography variant="h6">Search & Filter</Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3, mb: 3 }}>
          <TextField
            label="Search by Name or Email"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />

          <TextField
            label="Filter by Skills (comma separated)"
            placeholder="e.g. Python, SQL, React"
            value={filterSkill}
            onChange={(e) => setFilterSkill(e.target.value)}
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel>Filter by Status</InputLabel>
            <Select
              value={filterStatus}
              label="Filter by Status"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              {statusOptions.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ px: 2 }}>
          <Typography gutterBottom>Score Range: {scoreRange[0]} - {scoreRange[1]}</Typography>
          <Slider
            value={scoreRange}
            onChange={(e, newValue) => setScoreRange(newValue)}
            valueLabelDisplay="auto"
            min={0}
            max={100}
            marks={[
              { value: 0, label: '0' },
              { value: 50, label: '50' },
              { value: 70, label: '70' },
              { value: 100, label: '100' }
            ]}
          />
        </Box>
      </Paper>

      {/* Results Summary */}
      <Alert severity="info" sx={{ mb: 3 }}>
        Showing {filteredCandidates.length} of {candidates.length} candidates
      </Alert>

      {/* Candidates Table */}
      <Paper sx={{ p: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredCandidates.length === 0 ? (
          <Alert severity="info">
            No candidates found matching your criteria.
          </Alert>
        ) : (
          <TableContainer>
            <Table>
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
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCandidates.map((candidate) => (
                  <TableRow key={candidate.id} hover>
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
                        {candidate.phone_number || 'N/A'}
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
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(candidate)}
                          color="primary"
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(candidate.id)}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Candidate</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              fullWidth
            />
            <TextField
              label="Phone Number"
              value={editForm.phone_number}
              onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
              fullWidth
            />
            <TextField
              label="Skills"
              value={editForm.skills}
              onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Education"
              value={editForm.education}
              onChange={(e) => setEditForm({ ...editForm, education: e.target.value })}
              fullWidth
            />
            <TextField
              label="Certifications"
              value={editForm.certifications}
              onChange={(e) => setEditForm({ ...editForm, certifications: e.target.value })}
              fullWidth
            />
            <TextField
              label="Experience"
              value={editForm.experience}
              onChange={(e) => setEditForm({ ...editForm, experience: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="LinkedIn"
              value={editForm.linkedin}
              onChange={(e) => setEditForm({ ...editForm, linkedin: e.target.value })}
              fullWidth
            />
            <TextField
              label="Score"
              type="number"
              value={editForm.score}
              onChange={(e) => setEditForm({ ...editForm, score: parseInt(e.target.value) || 0 })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={editForm.status}
                label="Status"
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <MenuItem value="Interview Scheduled">Interview Scheduled</MenuItem>
                <MenuItem value="Not Scheduled">Not Scheduled</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save</Button>
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

export default Candidates;