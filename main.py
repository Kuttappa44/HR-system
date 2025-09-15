from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, HTMLResponse
import uvicorn
import sqlite3
import json
import os
import pandas as pd
from datetime import datetime
from pdfminer.high_level import extract_text
import docx
from openai import OpenAI
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Gather, Say, Hangup
import smtplib
from email.mime.text import MIMEText
import yagmail
from dotenv import load_dotenv
import requests
import base64
import io
import re

# Load environment variables
load_dotenv("credentials.env", override=True)

# Initialize FastAPI app
app = FastAPI(title="HR Management System API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.getenv('TWILIO_PHONE_NUMBER')
NGROK_URL = os.getenv('NGROK_URL')
twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# Global state for conversations
conversations = {}  # call_sid -> {responses: [], question_count: int, prospect_name: str}
prospect_name = ""

HR_EMAIL = os.getenv("HR_EMAIL")
YOUR_EMAIL = os.getenv("YOUR_EMAIL")
YOUR_EMAIL_PASSWORD = os.getenv("YOUR_EMAIL_PASSWORD")

# Database connection
def get_connection():
    return sqlite3.connect('candidates.db', check_same_thread=False)

# Phone number formatting function
def format_phone_number(phone):
    """Clean and format phone number for Twilio"""
    if not phone or phone == 'None' or phone == 'null' or not str(phone).strip():
        return None
    
    phone = str(phone).strip()
    # Remove all non-digit characters except +
    phone_clean = re.sub(r'[^\d+]', '', phone)
    
    if not phone_clean:
        return None
    
    # Handle different formats
    if phone_clean.startswith('+'):
        return phone_clean
    elif len(phone_clean) == 10 and phone_clean.isdigit():
        return '+91 ' + phone_clean
    elif len(phone_clean) == 12 and phone_clean.startswith('91'):
        return '+91 ' + phone_clean[2:]
    else:
        return '+' + phone_clean

# Basic endpoints
@app.get("/")
async def root():
    return {"message": "HR Management System API", "status": "running"}


@app.get("/candidates")
async def get_candidates():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM candidates")
    candidates = cursor.fetchall()
    conn.close()
    
    result = []
    for candidate in candidates:
        result.append({
            "id": candidate[0],
            "name": candidate[1],
            "skills": candidate[2],
            "education": candidate[3],
            "certifications": candidate[4],
            "experience": candidate[5],
            "email": candidate[6],
            "phone_number": candidate[7],
            "linkedin": candidate[8],
            "score": candidate[9],
            "status": candidate[10]
        })
    
    return result

@app.get("/analytics/dashboard")
async def get_analytics_dashboard():
    """Get analytics dashboard data"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get candidate statistics
        cursor.execute("SELECT COUNT(*) FROM candidates")
        total_candidates = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM candidates WHERE score >= 70")
        qualified_candidates = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM candidates WHERE status = 'Interview Scheduled'")
        scheduled_interviews = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM job_descriptions")
        total_job_descriptions = cursor.fetchone()[0]
        
        # Get recent candidates
        cursor.execute("SELECT name, score, status, email FROM candidates ORDER BY id DESC LIMIT 10")
        recent_candidates = cursor.fetchall()
        
        conn.close()
        
        return {
            "total_candidates": total_candidates,
            "qualified_candidates": qualified_candidates,
            "scheduled_interviews": scheduled_interviews,
            "total_job_descriptions": total_job_descriptions,
            "recent_candidates": [
                {
                    "name": candidate[0],
                    "score": candidate[1],
                    "status": candidate[2],
                    "email": candidate[3]
                } for candidate in recent_candidates
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/job-descriptions")
async def get_job_descriptions():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM job_descriptions")
    job_descriptions = cursor.fetchall()
    conn.close()
    
    result = []
    for jd in job_descriptions:
        result.append({
            "id": jd[0],
            "title": jd[1],
            "company": jd[2],
            "location": jd[3],
            "type": jd[4],
            "salary": jd[5],
            "experience": jd[6],
            "description": jd[7],
            "requirements": jd[8],
            "responsibilities": jd[9],
            "skills": jd[10],
            "benefits": jd[11]
        })
    
    return result

# Resume and JD parsing endpoints
def extract_text_from_file(file_content, file_type):
    """Extract text from uploaded file"""
    try:
        if file_type == "application/pdf":
            return extract_text(io.BytesIO(file_content))
        elif file_type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"]:
            doc = docx.Document(io.BytesIO(file_content))
            return "\n".join([para.text for para in doc.paragraphs])
        else:
            return file_content.decode("utf-8", errors="ignore")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error extracting text: {str(e)}")

@app.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    """Parse resume and extract candidate information"""
    try:
        file_content = await file.read()
        resume_text = extract_text_from_file(file_content, file.content_type)
        
        # Use OpenAI to extract candidate information
        prompt = """
        Extract the following information from this resume and return ONLY a valid JSON object:
        {
            "name": "candidate name",
            "email": "email address",
            "phone": "phone number",
            "skills": "comma-separated skills",
            "experience": "work experience summary",
            "education": "education summary",
            "linkedin": "linkedin profile if available"
        }
        """
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert at extracting information from resumes. Return only valid JSON."},
                {"role": "user", "content": f"{prompt}\n\nResume:\n{resume_text}"}
            ],
            max_tokens=100,
            temperature=0.7
        )
        
        content = response.choices[0].message.content.strip()
        
        # Clean up the response
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        
        # Extract JSON
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            candidate_data = json.loads(json_match.group())
            
            # Save to database
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO candidates (name, email, phone_number, skills, experience, education, linkedin, score, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                candidate_data.get('name', ''),
                candidate_data.get('email', ''),
                candidate_data.get('phone', ''),
                candidate_data.get('skills', ''),
                candidate_data.get('experience', ''),
                candidate_data.get('education', ''),
                candidate_data.get('linkedin', ''),
                0,  # Default score
                'New'  # Default status
            ))
            conn.commit()
            conn.close()
            
            return {"success": True, "candidate": candidate_data}
        else:
            raise HTTPException(status_code=400, detail="Could not extract candidate information")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/parse-job-description")
async def parse_job_description(file: UploadFile = File(...)):
    """Parse job description and extract key information"""
    try:
        file_content = await file.read()
        jd_text = extract_text_from_file(file_content, file.content_type)
        
        # Use OpenAI to extract job description information
        prompt = """
        Extract the following information from this job description and return ONLY a valid JSON object:
        {
            "title": "job title",
            "company": "company name",
            "location": "job location",
            "type": "job type (full-time, part-time, etc.)",
            "salary": "salary range if mentioned",
            "experience": "required experience",
            "description": "job description summary",
            "requirements": "key requirements",
            "responsibilities": "main responsibilities",
            "skills": "required skills",
            "benefits": "benefits if mentioned"
        }
        """
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert at extracting information from job descriptions. Return only valid JSON."},
                {"role": "user", "content": f"{prompt}\n\nJob Description:\n{jd_text}"}
            ],
            max_tokens=400,
            temperature=0.7
        )
        
        content = response.choices[0].message.content.strip()
        
        # Clean up the response
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        
        # Extract JSON
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            jd_data = json.loads(json_match.group())
            print(f"JD Data: {jd_data}")
            
            # Save to database
            conn = get_connection()
            cursor = conn.cursor()
            
            # Convert lists to strings for database storage
            def list_to_string(value):
                if isinstance(value, list):
                    return ', '.join(str(item) for item in value)
                return str(value) if value is not None else ''
            
            cursor.execute("""
                INSERT INTO job_descriptions (title, company, location, type, salary, experience, description, requirements, responsibilities, skills, benefits)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                jd_data.get('title', ''),
                jd_data.get('company', ''),
                jd_data.get('location', ''),
                jd_data.get('type', ''),
                jd_data.get('salary', ''),
                jd_data.get('experience', ''),
                jd_data.get('description', ''),
                list_to_string(jd_data.get('requirements', '')),
                list_to_string(jd_data.get('responsibilities', '')),
                list_to_string(jd_data.get('skills', '')),
                list_to_string(jd_data.get('benefits', ''))
            ))
            conn.commit()
            conn.close()
            
            return {"success": True, "job_description": jd_data}
        else:
            raise HTTPException(status_code=400, detail="Could not extract job description information")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def extract_and_score_candidate(resume_text, job_desc):
    """Extract and score candidate from resume text - copied from HR_app.py"""
    job_desc_short = job_desc
    resume_text_short = resume_text
    prompt = (
        "Given the following job description:\n"
        f"{job_desc_short}\n\n"
        "And the following candidate resume:\n"
        f"{resume_text_short}\n\n"
        "Extract the candidate's name, a comma-separated string of skills, a comma-separated string of certifications (look for words like 'certified', 'certificate', 'certification', 'diploma', 'license'; if none, return an empty string), a one-line summary of education (if none, return an empty string), a one-line summary of experience, email, phone number, linkedin id, and years of experience. "
        "Then, based on the skills, experience, education, and certifications, score the candidate's overall qualifications on a scale of 0 to 100 using the PRIMARY SCORING METHOD ONLY. "
        "Use this scoring scale: 90-100 (Exceptional), 80-89 (Strong), 70-79 (Good), 60-69 (Average), 50-59 (Below Average), Below 50 (Poor). "
        "Set the status to 'Interview Scheduled' if the score is 70 or above, otherwise 'Not Scheduled'. "
        "Return ONLY a valid JSON object with the following fields: "
        "'name', 'skills', 'education', 'certifications', 'experience', 'email', 'phone number', 'linkedin', 'score', 'status'. "
        "Do not include any explanation or extra text."
    )
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0
        )
        content = response.choices[0].message.content.strip()
        # Remove markdown/code block wrappers if present
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        # Try to extract the largest valid JSON object
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            json_str = json_match.group()
            # Try to fix common JSON issues
            json_str = re.sub(r',\s*}', '}', json_str)  # Remove trailing commas before }
            json_str = re.sub(r',\s*]', ']', json_str)  # Remove trailing commas before ]
            try:
                return json.loads(json_str)
            except Exception as e:
                print(f"JSON decode error after fix: {e}")
                print(json_str)
                return {}
        else:
            print("OpenAI did not return valid JSON for candidate extraction/scoring. Raw response:")
            print(content)
            return {}
    except Exception as e:
        print(f"Error from OpenAI (candidate extraction/scoring): {e}")
        return {}

@app.post("/parse-and-score-resumes")
async def parse_and_score_resumes(files: List[UploadFile] = File(...), job_id: str = Form(None)):
    """Parse multiple resumes and score them against a job description - using HR_app.py logic"""
    try:
        results = []
        
        # Get job description text if job_id is provided
        job_desc_text = ""
        if job_id:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM job_descriptions WHERE id = ?", (job_id,))
            jd_row = cursor.fetchone()
            conn.close()
            
            if jd_row:
                # Combine job description fields into text
                job_desc_text = f"Title: {jd_row[1]}\nCompany: {jd_row[2]}\nLocation: {jd_row[3]}\nType: {jd_row[4]}\nSalary: {jd_row[5]}\nExperience: {jd_row[6]}\nDescription: {jd_row[7]}\nRequirements: {jd_row[8]}\nResponsibilities: {jd_row[9]}\nSkills: {jd_row[10]}\nBenefits: {jd_row[11]}"
        
        for file in files:
            try:
                file_content = await file.read()
                resume_text = extract_text_from_file(file_content, file.content_type)
                
                # Use the exact same logic as HR_app.py
                candidate = extract_and_score_candidate(resume_text, job_desc_text)
                
                # Ensure all expected keys exist with default values (copied from HR_app.py)
                expected_keys = ['name', 'skills', 'education', 'certifications', 'experience', 'email', 'phone number', 'linkedin', 'score', 'status']
                for key in expected_keys:
                    if key not in candidate:
                        candidate[key] = '' if key != 'score' else 0
                
                # Save to database
                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO candidates (name, skills, education, certifications, experience, email, phone_number, linkedin, score, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    candidate.get('name', ''),
                    candidate.get('skills', ''),
                    candidate.get('education', ''),
                    candidate.get('certifications', ''),
                    candidate.get('experience', ''),
                    candidate.get('email', ''),
                    candidate.get('phone number', ''),
                    candidate.get('linkedin', ''),
                    candidate.get('score', 0),
                    candidate.get('status', 'New')
                ))
                conn.commit()
                conn.close()
                
                results.append({
                    "success": True,
                    "candidate": candidate,
                    "score": candidate.get('score', 0),
                    "filename": file.filename
                })
                    
            except Exception as e:
                results.append({
                    "success": False,
                    "error": str(e),
                    "filename": file.filename
                })
        
        # Auto-process only the newly parsed candidates (send emails and HR report)
        auto_process_result = None
        try:
            # Process only the candidates that were just parsed
            email_results = []
            candidates_data = []
            
            for result in results:
                if result.get("success") and result.get("candidate"):
                    candidate = result["candidate"]
                    name = candidate.get('name', '')
                    email = candidate.get('email', '')
                    score = candidate.get('score', 0)
                    status = candidate.get('status', '')
                    
                    # Only process candidates with valid email
                    if email and email.strip():
                        # Prepare data for HR report
                        candidates_data.append({
                            'name': name,
                            'email': email,
                            'score': score,
                            'status': status,
                            'processed_date': datetime.now().strftime('%Y-%m-%d %H:%M')
                        })
                        
                        # Send email to candidate
                        email_sent = send_candidate_email(email, name, score, status)
                        email_results.append({
                            'name': name,
                            'email': email,
                            'email_sent': email_sent
                        })
            
            # Send HR report only if we have candidates
            hr_report_sent = False
            if candidates_data:
                hr_report_sent = send_hr_report(candidates_data)
            
            # Count results
            successful_emails = len([r for r in email_results if r['email_sent']])
            total_emails = len(email_results)
            
            auto_process_result = {
                "success": True,
                "message": f"Auto-processing completed for {len(candidates_data)} newly parsed candidates",
                "results": {
                    "total_candidates": len(candidates_data),
                    "emails_sent": successful_emails,
                    "emails_failed": total_emails - successful_emails,
                    "hr_report_sent": hr_report_sent,
                    "email_results": email_results
                }
            }
            print(f"Auto-processing completed: {auto_process_result}")
        except Exception as e:
            print(f"Auto-processing failed: {str(e)}")
            auto_process_result = {"success": False, "error": str(e)}
        
        return {
            "results": results,
            "auto_processing": auto_process_result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Twilio call endpoints
@app.post("/set-prospect")
async def set_prospect(request: Request):
    """Set the prospect name for the call"""
    global prospect_name
    data = await request.json()
    prospect_name = data.get('name', '')
    return {"status": "success", "name": prospect_name}

@app.post("/outgoing-call")
async def handle_outgoing_call(request: Request):
    """Handle outgoing call from Twilio"""
    try:
        form_data = await request.form()
        call_sid = form_data.get('CallSid', 'unknown')
        to_number = form_data.get('To', '')
        
        print(f"Outgoing call received for {call_sid} to {to_number}")
        print(f"Prospect name: {prospect_name}")
        
        # Initialize conversation for this call
        conversations[call_sid] = {
            "responses": [],
            "question_count": 0,
            "prospect_name": prospect_name
        }
        
        # Create TwiML response
        response = VoiceResponse()
        
        # Greeting
        greeting = f"Hi {prospect_name}, this is Sasha from HR. I'm calling to conduct a brief prescreening interview. Is this a good time to talk?"
        response.say(greeting)
        
        # Gather response
        gather = Gather(
            input='speech',
            timeout=7,
            action=f"{NGROK_URL}/gather-response/{call_sid}/0",
            method='POST'
        )
        response.append(gather)
        
        # Fallback if no response
        response.say("I didn't hear a response. Let me continue.")
        response.redirect(f"{NGROK_URL}/gather-response/{call_sid}/0")
        
        print(f"Returning TwiML for call {call_sid}")
        return HTMLResponse(content=str(response), media_type="application/xml")
        
    except Exception as e:
        print(f"Error in outgoing call handler: {e}")
        error_twiml = '''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Sorry, there was an error. Please try again later.</Say>
    <Hangup/>
</Response>'''
        return Response(content=error_twiml, media_type="application/xml")

@app.post("/gather-response/{call_sid}/{question_num}")
async def handle_gather_response(call_sid: str, question_num: int, request: Request):
    """Handle candidate responses and generate next questions"""
    try:
        form_data = await request.form()
        speech_result = form_data.get('SpeechResult', '')
        
        print(f"Gather response for call {call_sid}, question {question_num}, speech: {speech_result}")
        
        # Store the response
        if call_sid in conversations:
            conversations[call_sid]["responses"].append(speech_result)
            conversations[call_sid]["question_count"] = question_num + 1
        
        # Generate AI response based on conversation
        ai_response = await generate_ai_response(call_sid, speech_result, question_num)
        
        # Create TwiML response
        response = VoiceResponse()
        response.say(ai_response)
        
        # If this is not the final question, gather next response
        if question_num < 3:  # Limit to 3-4 questions
            gather = Gather(
                input='speech',
                timeout=7,
                action=f"{NGROK_URL}/gather-response/{call_sid}/{question_num + 1}",
                method='POST'
            )
            response.append(gather)
            
            # Fallback
            response.say("I didn't hear a response. Let me continue.")
            response.redirect(f"{NGROK_URL}/gather-response/{call_sid}/{question_num + 1}")
        else:
            # End the call and process results
            response.say("Thank you for your time. We will review your responses and get back to you soon. Have a great day!")
            response.hangup()
            
            # Process call results (scoring and emails)
            await process_call_results(call_sid)
        
        print(f"Returning TwiML for question {question_num}: {str(response)}")
        return HTMLResponse(content=str(response), media_type="application/xml")
        
    except Exception as e:
        print(f"Error in gather response handler: {e}")
        error_twiml = '''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Thank you for your time. We will get back to you soon.</Say>
    <Hangup/>
</Response>'''
        return Response(content=error_twiml, media_type="application/xml")

async def generate_ai_response(call_sid: str, user_response: str, question_num: int):
    """Generate AI response based on conversation context"""
    try:
        if call_sid not in conversations:
            return "I'm sorry, I lost track of our conversation. Let me start over."
        
        conversation = conversations[call_sid]
        prospect_name = conversation.get("prospect_name", "there")
        responses = conversation.get("responses", [])
        
        # Build conversation context
        context = f"Interview with {prospect_name}. "
        for i, resp in enumerate(responses):
            context += f"Response {i+1}: {resp}. "
        
        # Generate contextual response
        prompt = f"""
        You are Sasha, a friendly HR interviewer conducting a prescreening call with {prospect_name}.
        
        Conversation so far: {context}
        
        Current user response: {user_response}
        
        Generate a natural, conversational response that:
        1. Acknowledges what they said
        2. Asks a relevant follow-up question (if not the final question)
        3. Keeps the conversation flowing naturally
        4. Uses their name when appropriate
        
        Keep your response brief (1-2 sentences) and conversational.
        If this is question 3 or more, start wrapping up the conversation.
        """
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Use faster model instead of gpt-4o
            messages=[
                {"role": "system", "content": "You are a friendly HR interviewer. Keep responses brief and conversational."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=100,  # Reduce from 150 for faster responses
            temperature=0.7
        )
        
        ai_response = response.choices[0].message.content
        
        ai_response = ai_response.strip()
        print(f"Generated AI response: {ai_response}")
        return ai_response
        
    except Exception as e:
        print(f"Error generating AI response: {e}")
        return "That's interesting. Can you tell me more about your experience?"

@app.get("/conversations")
async def get_conversations():
    """Get all conversation data"""
    return {"conversations": conversations}

# Prescreening workflow
@app.post("/prescreening/bulk-process")
async def bulk_prescreening_process(data: dict):
    """Process prescreening calls for multiple candidates"""
    try:
        candidate_ids = data.get("candidate_ids", [])
        job_description_id = data.get("job_description_id")
        
        if not candidate_ids:
            raise HTTPException(status_code=400, detail="No candidates selected")
        
        # Get candidates
        conn = get_connection()
        cursor = conn.cursor()
        placeholders = ','.join(['?' for _ in candidate_ids])
        cursor.execute(f"""
            SELECT id, name, email, phone_number, score, skills, experience, education
            FROM candidates 
            WHERE id IN ({placeholders})
        """, candidate_ids)
        candidates = cursor.fetchall()
        
        results = []
        successful_calls = 0
        failed_calls = 0
        
        for candidate in candidates:
            candidate_id, name, email, phone, score, skills, experience, education = candidate
            
            print(f"Processing candidate: {name}, Phone: '{phone}' (type: {type(phone)})")
            
            try:
                call_status = "Skipped"
                call_sid = None
                
                # Always use verified number for testing
                verified_phone = "+918971820623"
                
                try:
                    print(f"Attempting to call {name} at verified number {verified_phone}")
                    
                    # Set prospect name globally
                    global prospect_name
                    prospect_name = name
                    
                    # Make the call to verified number
                    call = twilio_client.calls.create(
                        url=f"{NGROK_URL}/outgoing-call",
                        to=verified_phone,
                        from_=TWILIO_PHONE_NUMBER
                    )
                    call_sid = call.sid
                    call_status = "Call initiated"
                    successful_calls += 1
                    
                    print(f"Call initiated successfully. Call SID: {call_sid}")
                    
                except Exception as call_error:
                    print(f"Error making call to {verified_phone}: {call_error}")
                    call_status = "Call failed"
                    failed_calls += 1
                
                # Format phone number for display
                formatted_phone = format_phone_number(phone) if phone else "No phone number"
                
                # Add to results
                results.append({
                    "candidate_id": candidate_id,
                    "name": name,
                    "email": email,
                    "phone": formatted_phone,
                    "score": score,
                    "call_status": call_status,
                    "interview_summary": f"Call {call_status.lower()}",
                    "new_status": "Interview Completed"
                })
                    
            except Exception as e:
                print(f"Error processing candidate {name}: {e}")
                # Format phone number for display in error case too
                formatted_phone = format_phone_number(phone) if phone else "No phone number"
                results.append({
                    "candidate_id": candidate_id,
                    "name": name,
                    "email": email,
                    "phone": formatted_phone,
                    "score": score,
                    "call_status": "Error",
                    "interview_summary": f"Error: {str(e)}",
                    "new_status": "Error"
                })
                failed_calls += 1
        
        conn.close()
        
        return {
            "success": True,
            "message": f"Prescreening completed for {len(candidate_ids)} candidates",
            "results": results,
            "summary": {
                "total_processed": len(candidate_ids),
                "successful_calls": successful_calls,
                "failed_calls": failed_calls
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def send_candidate_email(candidate_email, candidate_name, score, status):
    """Send email to candidate with their status"""
    try:
        # Load email credentials
        load_dotenv('credentials.env')
        email_user = os.getenv('YOUR_EMAIL')
        email_password = os.getenv('YOUR_EMAIL_PASSWORD')
        
        if not email_user or not email_password:
            print("Email credentials not found")
            return False
            
        # Create email content
        subject = f"Application Status Update - {candidate_name}"
        
        if status == "Interview Scheduled":
            body = f"""
Dear {candidate_name},

Congratulations! We are pleased to inform you that your application has been reviewed and you have been selected for an interview.

Your Score: {score}/100
Status: {status}

We will be in touch soon to schedule your interview. Please keep an eye on your email for further updates.

Best regards,
HR Team
            """
        else:
            body = f"""
Dear {candidate_name},

Thank you for your interest in our position. After careful review of your application, we have decided to move forward with other candidates at this time.

Your Score: {score}/100
Status: {status}

We appreciate the time and effort you put into your application and encourage you to apply for future opportunities that match your qualifications.

Best regards,
HR Team
            """
        
        # Send email using yagmail
        yag = yagmail.SMTP(user=email_user, password=email_password)
        yag.send(to=candidate_email, subject=subject, contents=body)
        yag.close()
        
        print(f"Email sent successfully to {candidate_email}")
        return True
        
    except Exception as e:
        print(f"Error sending email to {candidate_email}: {str(e)}")
        return False

def generate_hr_excel_report(candidates_data):
    """Generate Excel report for HR"""
    try:
        # Create DataFrame
        df = pd.DataFrame(candidates_data)
        
        # Create Excel file in memory
        from io import BytesIO
        output = BytesIO()
        
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Candidate Report', index=False)
            
            # Get the workbook and worksheet
            workbook = writer.book
            worksheet = writer.sheets['Candidate Report']
            
            # Auto-adjust column widths
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width
        
        output.seek(0)
        return output.getvalue()
        
    except Exception as e:
        print(f"Error generating Excel report: {str(e)}")
        return None

def send_hr_report(candidates_data):
    """Send Excel report to HR email"""
    try:
        # Load email credentials
        load_dotenv('credentials.env')
        email_user = os.getenv('YOUR_EMAIL')
        email_password = os.getenv('YOUR_EMAIL_PASSWORD')
        hr_email = os.getenv('HR_EMAIL', email_user)  # Default to sender if HR_EMAIL not set
        
        if not email_user or not email_password:
            print("Email credentials not found")
            return False
            
        # Generate Excel report
        excel_data = generate_hr_excel_report(candidates_data)
        if not excel_data:
            return False
            
        # Create email
        subject = f"HR Candidate Report - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        body = f"""
Dear HR Team,

Please find attached the candidate report for the recent resume processing session.

Total Candidates: {len(candidates_data)}
Qualified Candidates (Score ≥ 70): {len([c for c in candidates_data if c.get('score', 0) >= 70])}

The report includes detailed information about all candidates including their scores, skills, and contact information.

Best regards,
HR Management System
        """
        
        # Save Excel data to temporary file
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
            tmp_file.write(excel_data)
            tmp_file_path = tmp_file.name
        
        # Send email with attachment
        yag = yagmail.SMTP(user=email_user, password=email_password)
        yag.send(
            to=hr_email,
            subject=subject,
            contents=body,
            attachments=[tmp_file_path]
        )
        yag.close()
        
        # Clean up temporary file
        os.unlink(tmp_file_path)
        
        print(f"HR report sent successfully to {hr_email}")
        return True
        
    except Exception as e:
        print(f"Error sending HR report: {str(e)}")
        return False

async def process_call_results(call_sid: str):
    """Process call results: score the call and send emails"""
    try:
        if call_sid not in conversations:
            print(f"No conversation found for call {call_sid}")
            return
        
        conversation = conversations[call_sid]
        prospect_name = conversation.get("prospect_name", "Unknown")
        responses = conversation.get("responses", [])
        
        # Get candidate info from database
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM candidates WHERE name = ?", (prospect_name,))
        candidate_row = cursor.fetchone()
        conn.close()
        
        if not candidate_row:
            print(f"No candidate found for {prospect_name}")
            return
        
        # Extract candidate info
        candidate_id, name, skills, education, certifications, experience, email, phone_number, linkedin, score, status = candidate_row
        
        # Score the call based on responses
        call_score = await score_call_responses(responses)
        
        # Update candidate status based on call score
        new_status = "Interview Scheduled" if call_score >= 7 else "Not Scheduled"
        
        # Update database
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE candidates SET status = ? WHERE id = ?", (new_status, candidate_id))
        conn.commit()
        conn.close()
        
        # Send emails
        if email:
            # Send email to candidate
            candidate_email_sent = send_candidate_email(email, name, call_score, new_status)
            
            # Send email to HR
            hr_email_sent = send_call_summary_to_hr(name, email, call_score, responses, new_status)
            
            print(f"Call processing completed for {name}: Score={call_score}, Status={new_status}, Emails sent: Candidate={candidate_email_sent}, HR={hr_email_sent}")
        else:
            print(f"No email found for candidate {name}")
            
    except Exception as e:
        print(f"Error processing call results: {str(e)}")

async def score_call_responses(responses: list) -> int:
    """Score the call based on candidate responses"""
    try:
        if not responses:
            return 3  # Default score for no responses
        
        # Create prompt for scoring
        responses_text = "\n".join([f"Response {i+1}: {resp}" for i, resp in enumerate(responses)])
        
        prompt = f"""
        Based on the following interview responses, score the candidate on a scale of 1-10:
        
        {responses_text}
        
        Consider:
        - Relevance of responses
        - Communication skills
        - Enthusiasm and interest
        - Professionalism
        
        Return ONLY a number between 1-10.
        """
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=10,
            temperature=0.3
        )
        
        score_text = response.choices[0].message.content.strip()
        score = int(score_text) if score_text.isdigit() else 5
        return max(1, min(10, score))  # Ensure score is between 1-10
        
    except Exception as e:
        print(f"Error scoring call responses: {str(e)}")
        return 5  # Default score

def send_call_summary_to_hr(candidate_name: str, candidate_email: str, call_score: int, responses: list, status: str):
    """Send call summary to HR email"""
    try:
        # Load email credentials
        load_dotenv('credentials.env')
        email_user = os.getenv('YOUR_EMAIL')
        email_password = os.getenv('YOUR_EMAIL_PASSWORD')
        hr_email = os.getenv('HR_EMAIL', email_user)
        
        if not email_user or not email_password:
            print("Email credentials not found")
            return False
        
        # Create email content
        subject = f"Call Summary: {candidate_name} - Score: {call_score}/10"
        responses_text = "\n".join([f"Q{i+1}: {resp}" for i, resp in enumerate(responses)])
        
        body = f"""
Dear HR Team,

Call Summary for {candidate_name}:

Call Score: {call_score}/10
Status: {status}
Candidate Email: {candidate_email}

Interview Responses:
{responses_text}

Recommendation: {'Proceed to next round' if call_score >= 7 else 'Not suitable for this position'}

Best regards,
HR Management System
        """
        
        # Send email
        yag = yagmail.SMTP(user=email_user, password=email_password)
        yag.send(to=hr_email, subject=subject, contents=body)
        yag.close()
        
        print(f"Call summary sent to HR for {candidate_name}")
        return True
        
    except Exception as e:
        print(f"Error sending call summary to HR: {str(e)}")
        return False

@app.post("/auto-process-candidates")
async def auto_process_candidates():
    """Automatically process candidates after scoring - send emails and HR report"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get all candidates with scores
        cursor.execute("""
            SELECT name, email, score, status FROM candidates 
            WHERE score IS NOT NULL AND email IS NOT NULL AND email != ''
        """)
        candidates = cursor.fetchall()
        conn.close()
        
        if not candidates:
            return {"success": False, "message": "No candidates found for processing"}
        
        # Process each candidate
        email_results = []
        candidates_data = []
        
        for candidate in candidates:
            name, email, score, status = candidate
            
            # Prepare data for HR report
            candidates_data.append({
                'name': name,
                'email': email,
                'score': score,
                'status': status,
                'processed_date': datetime.now().strftime('%Y-%m-%d %H:%M')
            })
            
            # Send email to candidate
            email_sent = send_candidate_email(email, name, score, status)
            email_results.append({
                'name': name,
                'email': email,
                'email_sent': email_sent
            })
        
        # Send HR report
        hr_report_sent = send_hr_report(candidates_data)
        
        # Count results
        successful_emails = len([r for r in email_results if r['email_sent']])
        total_emails = len(email_results)
        
        return {
            "success": True,
            "message": f"Auto-processing completed",
            "results": {
                "total_candidates": len(candidates),
                "emails_sent": successful_emails,
                "emails_failed": total_emails - successful_emails,
                "hr_report_sent": hr_report_sent,
                "email_results": email_results
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)