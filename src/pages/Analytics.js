import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  People,
  Assessment,
  CheckCircle,
  Pending,
  Star,
  Work,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('30');
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setAnalyticsData({
        overview: {
          totalCandidates: 156,
          interviewsScheduled: 89,
          interviewsCompleted: 67,
          offersMade: 23,
          offersAccepted: 18,
          averageScore: 78.5,
          conversionRate: 12.3,
        },
        trends: [
          { month: 'Jan', candidates: 45, interviews: 32, offers: 8 },
          { month: 'Feb', candidates: 52, interviews: 38, offers: 12 },
          { month: 'Mar', candidates: 48, interviews: 35, offers: 10 },
          { month: 'Apr', candidates: 61, interviews: 42, offers: 15 },
          { month: 'May', candidates: 55, interviews: 40, offers: 13 },
          { month: 'Jun', candidates: 58, interviews: 44, offers: 16 },
        ],
        scoreDistribution: [
          { range: '90-100', count: 12, percentage: 7.7 },
          { range: '80-89', count: 28, percentage: 17.9 },
          { range: '70-79', count: 45, percentage: 28.8 },
          { range: '60-69', count: 38, percentage: 24.4 },
          { range: '50-59', count: 23, percentage: 14.7 },
          { range: '0-49', count: 10, percentage: 6.4 },
        ],
        statusBreakdown: [
          { status: 'Shortlisted', count: 34, color: '#4caf50' },
          { status: 'Interviewed', count: 67, color: '#2196f3' },
          { status: 'Pending', count: 23, color: '#ff9800' },
          { status: 'Rejected', count: 32, color: '#f44336' },
        ],
        topSkills: [
          { skill: 'JavaScript', count: 45, trend: 'up' },
          { skill: 'Python', count: 38, trend: 'up' },
          { skill: 'React', count: 42, trend: 'up' },
          { skill: 'Node.js', count: 35, trend: 'down' },
          { skill: 'AWS', count: 28, trend: 'up' },
          { skill: 'Docker', count: 25, trend: 'up' },
        ],
        interviewPerformance: [
          { week: 'Week 1', scheduled: 15, completed: 12, success: 8 },
          { week: 'Week 2', scheduled: 18, completed: 16, success: 11 },
          { week: 'Week 3', scheduled: 22, completed: 19, success: 13 },
          { week: 'Week 4', scheduled: 20, completed: 18, success: 12 },
        ],
        recentActivity: [
          { id: 1, action: 'New candidate added', candidate: 'John Doe', time: '2 hours ago', type: 'success' },
          { id: 2, action: 'Interview completed', candidate: 'Jane Smith', time: '4 hours ago', type: 'info' },
          { id: 3, action: 'Offer made', candidate: 'Mike Johnson', time: '6 hours ago', type: 'success' },
          { id: 4, action: 'Resume parsed', candidate: 'Sarah Wilson', time: '8 hours ago', type: 'info' },
        ],
      });
      setLoading(false);
    }, 1000);
  };

  const StatCard = ({ title, value, icon, color, subtitle, trend }) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              backgroundColor: color,
              borderRadius: '50%',
              p: 1,
              mr: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Box>
          {trend && (
            <Chip
              label={trend}
              color={trend === 'up' ? 'success' : 'error'}
              size="small"
              icon={<TrendingUp />}
            />
          )}
        </Box>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const getActivityIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle color="success" />;
      case 'info': return <Assessment color="info" />;
      case 'warning': return <Pending color="warning" />;
      default: return <Work />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Loading analytics...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Analytics Dashboard
        </Typography>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={timeRange}
            label="Time Range"
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <MenuItem value="7">Last 7 days</MenuItem>
            <MenuItem value="30">Last 30 days</MenuItem>
            <MenuItem value="90">Last 90 days</MenuItem>
            <MenuItem value="365">Last year</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Grid container spacing={3}>
        {/* Overview Stats */}
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Total Candidates"
            value={analyticsData.overview.totalCandidates}
            icon={<People sx={{ color: 'white' }} />}
            color="#1976d2"
            trend="up"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Interviews Completed"
            value={analyticsData.overview.interviewsCompleted}
            icon={<Assessment sx={{ color: 'white' }} />}
            color="#2196f3"
            subtitle={`${Math.round((analyticsData.overview.interviewsCompleted / analyticsData.overview.interviewsScheduled) * 100)}% completion rate`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Offers Made"
            value={analyticsData.overview.offersMade}
            icon={<CheckCircle sx={{ color: 'white' }} />}
            color="#4caf50"
            trend="up"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Offers Accepted"
            value={analyticsData.overview.offersAccepted}
            icon={<Star sx={{ color: 'white' }} />}
            color="#ff9800"
            subtitle={`${Math.round((analyticsData.overview.offersAccepted / analyticsData.overview.offersMade) * 100)}% acceptance rate`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Conversion Rate"
            value={`${analyticsData.overview.conversionRate}%`}
            icon={<TrendingUp sx={{ color: 'white' }} />}
            color="#9c27b0"
            trend="up"
          />
        </Grid>

        {/* Trends Chart */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Monthly Trends
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="candidates" stroke="#1976d2" strokeWidth={2} name="Candidates" />
                <Line type="monotone" dataKey="interviews" stroke="#2196f3" strokeWidth={2} name="Interviews" />
                <Line type="monotone" dataKey="offers" stroke="#4caf50" strokeWidth={2} name="Offers" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Status Breakdown */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Status Breakdown
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData.statusBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, percentage }) => `${status} ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {analyticsData.statusBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Score Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Score Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#1976d2" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Interview Performance */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Interview Performance
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analyticsData.interviewPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="scheduled" stackId="1" stroke="#2196f3" fill="#2196f3" name="Scheduled" />
                <Area type="monotone" dataKey="completed" stackId="1" stroke="#4caf50" fill="#4caf50" name="Completed" />
                <Area type="monotone" dataKey="success" stackId="1" stroke="#ff9800" fill="#ff9800" name="Successful" />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Top Skills */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Top Skills in Demand
            </Typography>
            <List>
              {analyticsData.topSkills.map((skill, index) => (
                <ListItem key={index} divider>
                  <ListItemText
                    primary={skill.skill}
                    secondary={`${skill.count} candidates`}
                  />
                  <Chip
                    label={skill.trend}
                    color={skill.trend === 'up' ? 'success' : 'error'}
                    size="small"
                    icon={<TrendingUp />}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            <List>
              {analyticsData.recentActivity.map((activity) => (
                <ListItem key={activity.id} divider>
                  <ListItemIcon>
                    {getActivityIcon(activity.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={activity.action}
                    secondary={`${activity.candidate} • ${activity.time}`}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Analytics;
