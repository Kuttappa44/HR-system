import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  Snackbar,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { jobDescriptionAPI } from '../services/api';
import {
  CloudUpload,
  Description,
  Add,
  Edit,
  Delete,
  Business,
  LocationOn,
  AttachMoney,
  Schedule,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';

const JobDescription = () => {
  const [jobDescriptions, setJobDescriptions] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [openDialog, setOpenDialog] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    type: 'Full-time',
    salary: '',
    experience: '',
    description: '',
    requirements: '',
    responsibilities: '',
    skills: '',
    benefits: '',
    status: 'Active',
  });

  // Fetch job descriptions from API
  useEffect(() => {
    const fetchJobDescriptions = async () => {
      setLoading(true);
      try {
        const response = await fetch('http://localhost:8080/job-descriptions');
        const data = await response.json();
        setJobDescriptions(data);
      } catch (error) {
        console.error('Error fetching job descriptions:', error);
        // Fallback to mock data
        setJobDescriptions([
          {
            id: 1,
            title: 'Senior Software Engineer',
            company: 'Tech Corp',
            location: 'San Francisco, CA',
            type: 'Full-time',
            salary: '$120,000 - $150,000',
            experience: '5+ years',
            description: 'We are looking for a senior software engineer...',
            status: 'Active',
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchJobDescriptions();
  }, []);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      setError(null);
      setParsedData(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
  });

  const parseJobDescription = async () => {
    if (!uploadedFile) {
      setSnackbar({ open: true, message: 'Please upload a file first', severity: 'error' });
      return;
    }

    setParsing(true);
    setProgress(0);
    setError(null);

    try {
      // Simulate parsing progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', uploadedFile);

      // Call actual API
      const response = await jobDescriptionAPI.parseJobDescription(formData);
      const parsedData = response.data;
      setParsedData(parsedData);
      setProgress(100);
      setSnackbar({ open: true, message: 'Job description parsed successfully', severity: 'success' });
    } catch (err) {
      console.error('Error parsing job description:', err);
      setError('Failed to parse job description. Please try again.');
      setSnackbar({ open: true, message: 'Failed to parse job description', severity: 'error' });
    } finally {
      setParsing(false);
    }
  };

  const saveJobDescription = async () => {
    try {
      const response = await fetch('http://localhost:8080/job-descriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        setJobDescriptions([...jobDescriptions, { ...formData, id: result.id }]);
        setSnackbar({ open: true, message: 'Job description saved successfully', severity: 'success' });
        setOpenDialog(false);
        resetForm();
      } else {
        throw new Error('Failed to save job description');
      }
    } catch (err) {
      console.error('Error saving job description:', err);
      setSnackbar({ open: true, message: 'Failed to save job description', severity: 'error' });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      company: '',
      location: '',
      type: 'Full-time',
      salary: '',
      experience: '',
      description: '',
      requirements: '',
      responsibilities: '',
      skills: '',
      benefits: '',
      status: 'Active',
    });
    setEditingJob(null);
  };

  const handleInputChange = (field) => (event) => {
    setFormData({ ...formData, [field]: event.target.value });
  };

  const handleAddNew = () => {
    setEditingJob(null);
    resetForm();
    setOpenDialog(true);
  };

  const handleEdit = (job) => {
    setEditingJob(job);
    setFormData(job);
    setOpenDialog(true);
  };

  const handleDelete = async (jobId) => {
    try {
      const response = await fetch(`http://localhost:8080/job-descriptions/${jobId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setJobDescriptions(jobDescriptions.filter(job => job.id !== jobId));
        setSnackbar({ open: true, message: 'Job description deleted successfully', severity: 'success' });
      } else {
        throw new Error('Failed to delete job description');
      }
    } catch (err) {
      console.error('Error deleting job description:', err);
      setSnackbar({ open: true, message: 'Failed to delete job description', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Job Descriptions
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAddNew}
          sx={{ borderRadius: 2 }}
        >
          Add Job Description
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Upload Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Upload Job Description
            </Typography>
            
            <Box
              {...getRootProps()}
              sx={{
                border: '2px dashed',
                borderColor: isDragActive ? 'primary.main' : 'grey.300',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <input {...getInputProps()} />
              <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {isDragActive ? 'Drop the file here' : 'Drag & drop a job description here'}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                or click to select a file
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Supports PDF, DOC, DOCX, TXT files
              </Typography>
            </Box>

            {uploadedFile && (
              <Card sx={{ mt: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Description sx={{ mr: 2, color: 'primary.main' }} />
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {uploadedFile.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </Typography>
                    </Box>
                    <Chip label="Ready to parse" color="success" size="small" />
                  </Box>
                </CardContent>
              </Card>
            )}

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                onClick={parseJobDescription}
                disabled={!uploadedFile || parsing}
                startIcon={parsing ? <CircularProgress size={20} /> : <Description />}
                fullWidth
              >
                {parsing ? 'Parsing...' : 'Parse Job Description'}
              </Button>
            </Box>

            {parsing && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress variant="determinate" value={progress} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Parsing job description... {progress}%
                </Typography>
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* Parsed Data Display */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Parsed Information
            </Typography>
            
            {parsedData ? (
              <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                      {parsedData.title}
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Business sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">{parsedData.company}</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <LocationOn sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">{parsedData.location}</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <AttachMoney sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">{parsedData.salary}</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Schedule sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">{parsedData.experience}</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {parsedData.skills && (
                  <Card sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                        Required Skills
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {Array.isArray(parsedData.skills) ? parsedData.skills.map((skill, index) => (
                          <Chip key={index} label={skill} size="small" variant="outlined" />
                        )) : (
                          <Chip label={parsedData.skills} size="small" variant="outlined" />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                )}

                {parsedData.description && (
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                        Description
                      </Typography>
                      <Typography variant="body2">
                        {parsedData.description}
                      </Typography>
                    </CardContent>
                  </Card>
                )}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', color: 'text.secondary', mt: 4 }}>
                <Description sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
                <Typography>No parsed data yet. Upload and parse a job description to see the results here.</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Job Descriptions List */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              All Job Descriptions
            </Typography>
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={2}>
                {jobDescriptions.map((job) => (
                  <Grid item xs={12} md={6} lg={4} key={job.id}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {job.title}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button size="small" onClick={() => handleEdit(job)}>
                              <Edit />
                            </Button>
                            <Button size="small" color="error" onClick={() => handleDelete(job.id)}>
                              <Delete />
                            </Button>
                          </Box>
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Business sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">{job.company}</Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <LocationOn sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">{job.location}</Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <AttachMoney sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">{job.salary}</Typography>
                        </Box>
                        
                        <Chip 
                          label={job.status} 
                          color={job.status === 'Active' ? 'success' : 'default'} 
                          size="small" 
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingJob ? 'Edit Job Description' : 'Add New Job Description'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Job Title"
                value={formData.title}
                onChange={handleInputChange('title')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company"
                value={formData.company}
                onChange={handleInputChange('company')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Location"
                value={formData.location}
                onChange={handleInputChange('location')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  label="Type"
                  onChange={handleInputChange('type')}
                >
                  <MenuItem value="Full-time">Full-time</MenuItem>
                  <MenuItem value="Part-time">Part-time</MenuItem>
                  <MenuItem value="Contract">Contract</MenuItem>
                  <MenuItem value="Internship">Internship</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Salary"
                value={formData.salary}
                onChange={handleInputChange('salary')}
                placeholder="e.g., $50,000 - $70,000"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Experience Required"
                value={formData.experience}
                onChange={handleInputChange('experience')}
                placeholder="e.g., 3+ years"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Job Description"
                multiline
                rows={4}
                value={formData.description}
                onChange={handleInputChange('description')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Requirements"
                multiline
                rows={3}
                value={formData.requirements}
                onChange={handleInputChange('requirements')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Responsibilities"
                multiline
                rows={3}
                value={formData.responsibilities}
                onChange={handleInputChange('responsibilities')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Skills"
                value={formData.skills}
                onChange={handleInputChange('skills')}
                placeholder="e.g., Python, React, Node.js"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Benefits"
                multiline
                rows={2}
                value={formData.benefits}
                onChange={handleInputChange('benefits')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={handleInputChange('status')}
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                  <MenuItem value="Draft">Draft</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={saveJobDescription} variant="contained">
            {editingJob ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default JobDescription;


