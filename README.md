# HR Management System - React UI

A modern, responsive React application for comprehensive HR management with candidate tracking, prescreening calls, resume parsing, and analytics.

## Features

### 🏠 Dashboard
- Real-time statistics and KPIs
- Interactive charts and visualizations
- Recent activity feed
- Performance metrics

### 👥 Candidate Management
- Complete candidate database
- Advanced search and filtering
- Add, edit, and delete candidates
- Status tracking and scoring
- Skills and experience management

### 📞 Prescreening Calls
- Twilio integration for automated calls
- Real-time conversation monitoring
- AI-powered conversation analysis
- Transcript export functionality
- Call status tracking

### 📄 Resume Parser
- Support for PDF, DOC, and DOCX files
- Automated data extraction
- Skills and experience parsing
- Scoring and recommendations
- Database integration

### 📊 Analytics
- Comprehensive reporting dashboard
- Trend analysis and forecasting
- Score distribution charts
- Interview performance metrics
- Skills demand analysis

## Technology Stack

- **Frontend**: React 18, Material-UI (MUI)
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Routing**: React Router DOM
- **File Upload**: React Dropzone
- **Styling**: Emotion (CSS-in-JS)

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Backend API server running

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Configure environment variables:
```env
REACT_APP_API_URL=http://localhost:8080
REACT_APP_TWILIO_ACCOUNT_SID=your_twilio_sid
REACT_APP_TWILIO_AUTH_TOKEN=your_twilio_token
REACT_APP_OPENAI_API_KEY=your_openai_key
```

4. Start the development server:
```bash
npm start
```

5. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   └── Navbar.js       # Main navigation component
├── pages/              # Page components
│   ├── Dashboard.js    # Main dashboard
│   ├── Candidates.js   # Candidate management
│   ├── Prescreening.js # Call interface
│   ├── ResumeParser.js # Resume parsing
│   └── Analytics.js    # Analytics dashboard
├── services/           # API services
│   └── api.js         # API configuration and endpoints
├── App.js             # Main app component
└── index.js           # App entry point
```

## API Integration

The application is designed to work with a backend API that provides:

- Candidate CRUD operations
- Prescreening call management
- Resume parsing services
- Analytics data
- Authentication

### Backend Requirements

Your backend should implement these endpoints:

- `GET /candidates` - Get all candidates
- `POST /candidates` - Create new candidate
- `PUT /candidates/:id` - Update candidate
- `DELETE /candidates/:id` - Delete candidate
- `POST /set-prospect` - Set prospect for call
- `POST /make-call` - Initiate Twilio call
- `GET /transcripts` - Get call transcripts
- `POST /analyze` - Analyze conversation
- `POST /parse-resume` - Parse resume file
- `GET /analytics/*` - Analytics endpoints

## Features in Detail

### Dashboard
- Real-time candidate statistics
- Interview completion rates
- Offer acceptance metrics
- Visual trend analysis
- Recent activity feed

### Candidate Management
- Comprehensive candidate profiles
- Advanced search and filtering
- Skills and experience tracking
- Status management
- Bulk operations

### Prescreening
- Automated call initiation
- Real-time conversation display
- AI-powered analysis
- Transcript management
- Call quality metrics

### Resume Parser
- Multi-format support (PDF, DOC, DOCX)
- Intelligent data extraction
- Skills and experience parsing
- Automated scoring
- Database integration

### Analytics
- Performance dashboards
- Trend analysis
- Score distributions
- Skills demand analysis
- Interview metrics

## Customization

### Theming
The application uses Material-UI theming. Customize the theme in `src/index.js`:

```javascript
const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
  // ... other theme options
});
```

### API Configuration
Update API endpoints in `src/services/api.js`:

```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';
```

## Deployment

### Build for Production
```bash
npm run build
```

### Environment Variables
Set the following environment variables in production:

- `REACT_APP_API_URL` - Backend API URL
- `REACT_APP_TWILIO_ACCOUNT_SID` - Twilio Account SID
- `REACT_APP_TWILIO_AUTH_TOKEN` - Twilio Auth Token
- `REACT_APP_OPENAI_API_KEY` - OpenAI API Key

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.