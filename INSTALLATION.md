# HR Management System - Installation Guide

## Prerequisites

- Python 3.9 or higher
- Node.js 16 or higher
- npm or yarn package manager

## Backend Setup (FastAPI)

### 1. Create Virtual Environment
```bash
python -m venv hr_system_env
source hr_system_env/bin/activate  # On Windows: hr_system_env\Scripts\activate
```

### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 3. Environment Configuration
Create a `credentials.env` file with the following variables:
```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
NGROK_URL=your_ngrok_url

# Email Configuration
YOUR_EMAIL=your_email@gmail.com
YOUR_EMAIL_PASSWORD=your_app_password
HR_EMAIL=hr_email@gmail.com

# API Configuration
API_SERVER_URL=http://localhost:8080
PORT=8080

# Google API (if using Google Sheets)
GOOGLE_API_KEY=your_google_api_key
```

### 4. Start Backend Server
```bash
python main.py
```
The backend will be available at: http://localhost:8080

## Frontend Setup (React)

### 1. Install Node Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm start
```
The frontend will be available at: http://localhost:3000

## Database Setup

The system uses SQLite database which will be created automatically on first run. The database file `candidates.db` will be created in the project root.

## Key Dependencies

### Backend Dependencies
- **FastAPI**: Web framework for building APIs
- **OpenAI**: AI integration for resume analysis
- **Twilio**: Voice call integration for prescreening
- **Pandas**: Data processing and analysis
- **PDFMiner**: PDF document processing
- **python-docx**: Word document processing
- **yagmail**: Email sending functionality
- **python-dotenv**: Environment variable management

### Frontend Dependencies
- **React**: Frontend framework
- **Material-UI**: UI component library
- **Axios**: HTTP client for API calls
- **React Router**: Client-side routing
- **React Dropzone**: File upload functionality
- **Recharts**: Data visualization

## API Endpoints

### Core Endpoints
- `GET /candidates` - Get all candidates
- `POST /parse-resume` - Parse single resume
- `POST /parse-and-score-resumes` - Parse and score multiple resumes
- `GET /job-descriptions` - Get all job descriptions
- `POST /parse-job-description` - Parse job description
- `GET /analytics/dashboard` - Get analytics data

### Prescreening Endpoints
- `POST /set-prospect` - Set prospect name for calls
- `POST /outgoing-call` - Handle outgoing calls
- `POST /gather-response/{call_sid}/{question_num}` - Handle call responses
- `POST /prescreening/bulk-process` - Process multiple candidates

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   - Backend: Change PORT in credentials.env
   - Frontend: Use `PORT=3001 npm start`

2. **Missing Dependencies**
   - Run `pip install -r requirements.txt` again
   - Check Python version compatibility

3. **API Key Issues**
   - Verify all API keys in credentials.env
   - Check OpenAI API quota
   - Verify Twilio account status

4. **Database Issues**
   - Delete `candidates.db` to reset database
   - Check file permissions

### Environment Variables
Make sure all required environment variables are set in `credentials.env`:
- OpenAI API key for AI features
- Twilio credentials for voice calls
- Email credentials for notifications
- Ngrok URL for webhook endpoints

## Production Deployment

For production deployment:
1. Set up proper database (PostgreSQL recommended)
2. Configure environment variables securely
3. Use production WSGI server (Gunicorn)
4. Set up reverse proxy (Nginx)
5. Configure SSL certificates
6. Set up monitoring and logging

## Support

For issues or questions:
1. Check the logs in terminal output
2. Verify all dependencies are installed
3. Ensure all environment variables are set
4. Check API quotas and account status
