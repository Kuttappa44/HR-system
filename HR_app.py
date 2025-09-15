
import streamlit as st
import base64
import os
import pandas as pd
from dotenv import load_dotenv
import re
import json
from datetime import datetime
from pdfminer.high_level import extract_text
import docx  # python-docx
from openai import OpenAI
from twilio.rest import Client
import requests
import smtplib
from email.mime.text import MIMEText
import time
import io
import yagmail
import sqlite3
from Candidates_DB import create_table, insert_candidate, fetch_candidates

# Load environment variables
load_dotenv("credentials.env",override=True)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

CSV_FILE = 'candidates.csv'

# Twilio config
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.getenv('TWILIO_PHONE_NUMBER')
NGROK_URL = os.getenv('NGROK_URL')
twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

HR_EMAIL = os.getenv("HR_EMAIL")
YOUR_EMAIL = os.getenv("YOUR_EMAIL")
YOUR_EMAIL_PASSWORD = os.getenv("YOUR_EMAIL_PASSWORD")

# Create the candidates table in the database
create_table()

# Connect to SQLite database
def get_connection():
    return sqlite3.connect('candidates.db', check_same_thread=False)

# Insert candidate into DB
def insert_candidate_db(name, email, phone, skills, education="", certifications="", experience="", phone_number="", linkedin="", score=0, status=""):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO candidates (name, skills, education, certifications, experience, email, phone_number, linkedin, score, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (name, skills, education, certifications, experience, email, phone_number, linkedin, score, status)
    )
    conn.commit()
    conn.close()

def extract_text_from_docx(file):
    doc = docx.Document(file)
    return "\n".join([para.text for para in doc.paragraphs])

def extract_text_from_file(file):
    if file.type == "application/pdf":
        return extract_text(file)
    elif file.type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"]:
        return extract_text_from_docx(file)
    else:
        return file.read().decode("utf-8", errors="ignore")

def extract_and_score_candidate(resume_text, job_desc):
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
                st.error(f"JSON decode error after fix: {e}")
                st.code(json_str)
                return {}
        else:
            st.warning("OpenAI did not return valid JSON for candidate extraction/scoring. Raw response:")
            st.code(content)
            return {}
    except Exception as e:
        st.error(f"Error from OpenAI (candidate extraction/scoring): {e}")
        return {}

def conduct_interview_call(candidate, job_desc):
    API_SERVER_URL = os.getenv('API_SERVER_URL', 'http://127.0.0.1:8000')
    job_desc_short = truncate_text(job_desc, 1500)
    candidate_short = {k: candidate[k] for k in ['name', 'skills', 'experience', 'email', 'phone number', 'linkedin', 'score'] if k in candidate}
    prompt = (
        "You are Sasha, a patient and attentive HR interviewer.\n\n"
        "Given the following job description:\n"
        f"{job_desc_short}\n\n"
        "And the following candidate details:\n"
        f"{candidate_short}\n\n"
        "Conduct a short interview with the candidate. "
        "Ask one question at a time, wait for the candidate to finish answering before asking the next. "
        "Do not repeat questions, and do not interrupt the candidate. "
        "Be patient and conversational. "
        "After three questions, summarize if the candidate is a potential fit.\n\n"
        "IMPORTANT: Respond ONLY with a valid JSON object in this exact format. "
        "Do NOT include any markdown, code block, explanation, or extra text. "
        "Your entire response MUST be a single valid JSON object as shown below:\n\n"
        '{\n'
        '  "questions": ["<question 1>", "<question 2>", "<question 3>"],\n'
        '  "summary": "<summary of the candidate\'s fit>",\n'
        '  "transcript": "<the full conversation transcript as a string>"\n'
        '}\n'
    )
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0
        )
        content = response.choices[0].message.content
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        json_match = re.search(r"\{.*\}", content, re.DOTALL)
        if json_match:
            interview = json.loads(json_match.group())
        else:
            st.warning("OpenAI did not return valid JSON for interview.")
            interview = {"questions": [], "summary": ""}
    except Exception as e:
        st.error(f"Error from OpenAI (interview): {e}")
        interview = {"questions": [], "summary": ""}

    call_sid = None
    call_status = ""
    try:
        requests.post(
            f"{API_SERVER_URL}/set-prospect",
            json={"name": candidate.get('name', '')}
        )
        phone = candidate.get('phone number', '')
        st.write("Phone number to call:", phone)
        if phone and phone.startswith('+'):
            call = twilio_client.calls.create(
                url=f"{NGROK_URL}/outgoing-call",
                to=phone,
                from_=TWILIO_PHONE_NUMBER
            )
            call_sid = call.sid
            call_status = "Call initiated"
        else:
            call_sid = None
            call_status = "Invalid or missing phone number. Call not initiated."
            st.warning("Invalid or missing phone number. Call not initiated.")
    except Exception as e:
        st.error(f"Error initiating call: {e}")
        call_sid = None
        call_status = f"Error initiating call: {e}"

    df = st.session_state.get('df', None)
    candidate_email = candidate.get("email", "")
    if df is not None and candidate_email:
        df.loc[df["email"] == candidate_email, "called"] = True
        candidate["called"] = True

    return interview, call_sid, call_status

def send_hr_report(df, hr_email):
    buffer = io.BytesIO()
    df.to_excel(buffer, index=False)
    buffer.seek(0)
    buffer.name = "candidates.xlsx"  # Set the name attribute for yagmail
    try:
        yag = yagmail.SMTP(user=YOUR_EMAIL, password=YOUR_EMAIL_PASSWORD)
        yag.send(
            to=hr_email,
            subject="HR Interview Report",
            contents="Please find attached the candidate details and scores.",
            attachments=[buffer]
        )
        return True
    except Exception as e:
        st.error(f"Failed to send email: {e}")
        return False

def send_candidate_status_email(candidate_email, candidate_name, status):
    if not candidate_email or not isinstance(candidate_email, str) or '@' not in candidate_email:
        st.warning(f"Skipping email: Invalid or empty candidate email for {candidate_name}.")
        return False
    try:
        yag = yagmail.SMTP(user=YOUR_EMAIL, password=YOUR_EMAIL_PASSWORD)
        subject = "Your Interview Status Update"
        contents = f"Dear {candidate_name},\n\nYour interview status is: {status}.\n\nThank you for your interest.\n\nBest regards,\nHR Team"
        yag.send(
            to=candidate_email,
            subject=subject,
            contents=contents
        )
        return True
    except Exception as e:
        st.error(f"Failed to send status email to {candidate_email}: {e}")
        return False

def show_document(file_content, file_type, file_name, title):
    st.markdown(f"### {title}")
    if file_type == "application/pdf":
        base64_pdf = base64.b64encode(file_content).decode('utf-8')
        pdf_display = f'<iframe src="data:application/pdf;base64,{base64_pdf}" width="700" height="1000" type="application/pdf"></iframe>'
        st.markdown(pdf_display, unsafe_allow_html=True)
    elif file_type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"]:
        st.download_button(
            label=f"Download {file_name}",
            data=file_content,
            file_name=file_name
        )
    else:
        st.text(file_content.decode("utf-8", errors="ignore"))

def truncate_text(text, max_chars=1500):
    return text[:max_chars] + ("..." if len(text) > max_chars else "")

BACKEND_URL = "http://127.0.0.1:8000/transcripts"

def display_chat_transcript():
    response = requests.get(BACKEND_URL)
    if response.status_code == 200:
        data = response.json()
        sessions = data.get("sessions", {})
        if sessions:
            # Show the latest session
            latest_session = list(sessions.values())[-1]
            conversation = latest_session.get("conversation_history", [])
            st.subheader("Interview Conversation Transcript")
            for line in conversation:
                st.write(line)
        else:
            st.info("No conversation yet.")
    else:
        st.error("Could not fetch transcript from backend.")

def candidate_exists(email, phone):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT 1 FROM candidates WHERE email = ? OR phone_number = ?",
        (email, phone)
    )
    exists = cursor.fetchone() is not None
    conn.close()
    return exists

# Secondary interview scoring method removed - using only primary AI scoring method

def min_questions_answered(interview):
    questions = interview.get("questions", [])
    transcript = interview.get("transcript", "")
    # Count how many questions from the list appear in the transcript
    count = sum(1 for q in questions if q and q in transcript)
    return count >= 2  # or 3 for stricter

def main():
    st.title("HR System")

    tab1, tab2, tab3 = st.tabs([
        "Resume & JD Parser",
        "Prescreening Call & Send Details to HR",
        "HR Management System"
    ])

    # --- TAB 1: Resume & JD Parser ---
    with tab1:
        st.header("Resume & JD Parser")
        df = st.session_state.get('df', None)
        job_desc_content = st.session_state.get('job_desc_content', None)
        job_desc_type = st.session_state.get('job_desc_type', None)
        job_desc_name = st.session_state.get('job_desc_name', None)

        if df is not None:
            st.subheader("Candidate Details")
            st.dataframe(df)
        if job_desc_content is not None:
            st.subheader("Job Description")
            st.write(f"**File Name:** {job_desc_name}")
            if job_desc_type == "text/plain":
                st.text(job_desc_content.decode("utf-8", errors="ignore"))

        job_desc_file = st.file_uploader(
            "Upload Job Description (txt, pdf, doc, docx)",
            type=['txt', 'pdf', 'doc', 'docx'],
            key="job_desc_file"
        )

        if job_desc_file:
            job_desc_content = job_desc_file.getvalue()
            job_desc_type = job_desc_file.type
            job_desc_name = job_desc_file.name
            st.session_state['job_desc_content'] = job_desc_content
            st.session_state['job_desc_type'] = job_desc_type
            st.session_state['job_desc_name'] = job_desc_name
            if st.button("View JD"):
                show_document(job_desc_content, job_desc_type, job_desc_name, "Job Description")

        uploaded_files = st.file_uploader(
            "Upload Resumes (txt, pdf, doc, docx)",
            accept_multiple_files=True,
            type=['txt', 'pdf', 'doc', 'docx'],
            key="resumes"
        )

        if job_desc_file and uploaded_files:
            job_desc_text = extract_text_from_file(job_desc_file)
            st.session_state['job_desc_text'] = job_desc_text 
            results = []
            expected_keys = ['name', 'skills', 'education', 'certifications', 'experience', 'email', 'phone number', 'linkedin', 'score']
            for idx, file in enumerate(uploaded_files):
                resume_content = file.getvalue()
                resume_type = file.type
                resume_name = file.name
                resume_text = extract_text_from_file(file)
                candidate = extract_and_score_candidate(resume_text, job_desc_text)
                # Ensure all expected keys exist with default values
                for key in expected_keys:
                    if key not in candidate:
                        candidate[key] = '' if key != 'score' else 0
                candidate['resume_content'] = resume_content
                candidate['resume_type'] = resume_type
                candidate['resume_name'] = resume_name
                candidate['row_idx'] = idx
                results.append(candidate)

            df = pd.DataFrame(results)
            if 'score' not in df.columns:
                df['score'] = 0
            else:
                df['score'] = pd.to_numeric(df['score'], errors='coerce').fillna(0)
            df['Status'] = df['score'].apply(lambda x: "Interview Scheduled" if x >= 70 else "Not Scheduled")
            df["called"] = df.get("called", False)
            df["call_status"] = "not called"
            st.session_state['df'] = df

            # Save extracted candidates to the database
            if not df.empty:
                for _, row in df.iterrows():
                    skills = row.get('skills', '')
                    if isinstance(skills, list):
                        skills = ', '.join(skills)
                    email = row.get('email', '')
                    phone = row.get('phone number', '')
                    certifications = row.get('certifications', '') or ''
                    if not candidate_exists(email, phone):
                        insert_candidate(
                            row.get('name', ''),
                            skills,
                            row.get('education', ''),
                            certifications,
                            row.get('experience', ''),
                            email,
                            phone,
                            row.get('linkedin', ''),
                            row.get('score', 0),
                            row.get('Status', '')
                        )
                        # Send status email
                        send_candidate_status_email(
                            candidate_email=email,
                            candidate_name=row.get('name', ''),
                            status=row.get('Status', '')
                        )
                st.success("Candidates saved to database!")

            st.subheader("Candidate Details Table")
            display_cols = [
                'name', 'skills', 'education', 'certifications', 'experience',
                'email', 'phone number', 'linkedin', 'score', 'Status'
            ]

            download_links = []
            for idx, row in df.iterrows():
                resume_content = row['resume_content']
                resume_name = row['resume_name']
                b64 = base64.b64encode(resume_content).decode()
                href = f'<a href="data:application/octet-stream;base64,{b64}" download="{resume_name}">Download</a>'
                download_links.append(href)
            df_display = df[display_cols].copy()
            df_display['Download Resume'] = download_links

            st.markdown(
                df_display.to_html(escape=False, index=False),
                unsafe_allow_html=True
            )

            df_to_save = df.drop(columns=['resume_content', 'resume_type', 'resume_name', 'row_idx'], errors='ignore')
            csv_data = df_to_save[display_cols].to_csv(index=False)
            st.download_button(
                label="Download Candidate Details as CSV",
                data=csv_data,
                file_name="candidates.csv",
                mime="text/csv"
            )

    # --- TAB 2: Prescreening Call & Send Details to HR ---
    with tab2:
        st.header("Prescreening Call & Send Details to HR")
        df = st.session_state.get('df', None)
        job_desc_text = st.session_state.get('job_desc_text', None)
        if df is not None and not df.empty:
            st.info("Automatically conducting prescreening calls and emailing HR report for all candidates...")

            qualified_df = df[(df['score'] >= 70) & (~df.get('called', False))]
            called_emails = set()
            for idx, candidate_row in qualified_df.iterrows():
                candidate = candidate_row.to_dict()
                interview, call_sid, call_status = conduct_interview_call(candidate, job_desc_text)
                st.write(f"Candidate: {candidate.get('name', '')} - Call Status: {call_status}")
                df.at[idx, 'called'] = True

                candidate_email = candidate.get('email', '')
                candidate_name = candidate.get('name', '')
                called_emails.add(candidate_email)
                summary = interview.get('summary', '') if isinstance(interview, dict) else ''

                transcript = interview.get('transcript', '') if isinstance(interview, dict) else ''
                summary = interview.get('summary', '') if isinstance(interview, dict) else ''

                llm_score = llm_score_transcript(transcript)
                enough_questions = min_questions_answered(interview)

                if (
                    call_status == "Call initiated"
                    and summary
                    and transcript
                    and llm_score >= 7  # You can adjust this threshold
                    and enough_questions
                    and ("potential fit" in summary.lower() or "selected" in summary.lower())
                ):
                    next_step_status = (
                        "Congratulations! You have cleared the prescreening call. "
                        "The next round of the interview will be held on a date and time of your choice within the next week. "
                        "Please use the following link to schedule your interview: https://calendly.com/vvnamuth/round-2-interview"
                    )
                    send_candidate_status_email(
                        candidate_email=candidate_email,
                        candidate_name=candidate_name,
                        status=next_step_status
                    )
                elif call_status != "Call initiated":
                    missed_call_status = (
                        "We attempted to reach you for the prescreening call, but were unable to connect. "
                        "Please reply to this email or contact us to reschedule your prescreening call. "
                        "This step is required before proceeding to the next round."
                    )
                    send_candidate_status_email(
                        candidate_email=candidate_email,
                        candidate_name=candidate_name,
                        status=missed_call_status
                    )

            # Notify candidates who did NOT get a prescreening call
            not_called_df = df[(df['score'] < 70) & (~df['email'].isin(called_emails))]
            for idx, candidate_row in not_called_df.iterrows():
                candidate_email = candidate_row.get('email', '')
                candidate_name = candidate_row.get('name', '')
                not_selected_status = "After keen consideration and current requirements, you have not been selected for the prescreening interview. We wish you the best in your job search."
                send_candidate_status_email(
                    candidate_email=candidate_email,
                    candidate_name=candidate_name,
                    status=not_selected_status
                )

            # Email HR report
            df_to_save = df.drop(columns=['resume_content', 'resume_type', 'resume_name', 'row_idx'], errors='ignore')
            sent = send_hr_report(df_to_save, HR_EMAIL)
            if sent:
                st.success("HR report sent via email.")
        else:
            st.info("No candidate data available. Please parse resumes in Tab 1 first.")

    # --- TAB 3: HR Management System ---
    with tab3:
        st.header("HR Management System")
        candidates = fetch_candidates()
        columns = [
            "id", "name", "skills", "education", "certifications", "experience",
            "email", "phone_number", "linkedin", "score", "status"
        ]
        if candidates:
            df = pd.DataFrame(candidates, columns=columns)
            df_display = df.drop(columns=['id'])

            # --- Search and Filter UI ---
            search_name = st.text_input("Search by Name or Email")
            filter_skill = st.text_input("Filter by Skill (comma separated, e.g. Python,SQL)")
            min_score, max_score = st.slider("Score Range", 0, 100, (0, 100))
            status_options = ["All"] + sorted(df_display["status"].unique())
            filter_status = st.selectbox("Filter by Status", status_options)

            # --- Filtering Logic ---
            if search_name:
                df_display = df_display[
                    df_display["name"].str.contains(search_name, case=False, na=False) |
                    df_display["email"].str.contains(search_name, case=False, na=False)
                ]
            if filter_skill:
                skills = [s.strip().lower() for s in filter_skill.split(",") if s.strip()]
                df_display = df_display[
                    df_display["skills"].str.lower().apply(lambda x: all(skill in x for skill in skills))
                ]
            df_display = df_display[
                (df_display["score"] >= min_score) & (df_display["score"] <= max_score)
            ]
            if filter_status != "All":
                df_display = df_display[df_display["status"] == filter_status]

            # Rename columns for readability
            df_display = df_display.rename(columns={
                "name": "Name",
                "skills": "Skills",
                "experience": "Experience",
                "email": "Email",
                "phone_number": "Phone Number",
                "linkedin": "LinkedIn",
                "score": "Score",
                "status": "Status"
            })
            st.dataframe(df_display, use_container_width=True)
        else:
            st.info("No candidates in the database yet.")

if __name__ == "__main__":
    main()