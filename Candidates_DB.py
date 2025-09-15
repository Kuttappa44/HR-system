import streamlit as st
import pandas as pd
import sqlite3

DB_PATH = "candidates.db"

def get_connection():
    return sqlite3.connect(DB_PATH, check_same_thread=False)

def create_table():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS candidates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                skills TEXT,
                education TEXT,
                certifications TEXT,
                experience TEXT,
                email TEXT,
                phone_number TEXT,
                linkedin TEXT,
                score REAL,
                status TEXT
            )
        """)
        conn.commit()

def insert_candidate(name, skills, education, certifications, experience, email, phone_number, linkedin, score, status):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO candidates (name, skills, education, certifications, experience, email, phone_number, linkedin, score, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (name, skills, education, certifications, experience, email, phone_number, linkedin, score, status)
    )
    conn.commit()
    conn.close()

def fetch_candidates():
    with get_connection() as conn:
        return conn.execute("SELECT * FROM candidates").fetchall()

def print_candidates_table():
    conn = sqlite3.connect('candidates.db')
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM candidates")
    rows = cursor.fetchall()
    columns = [description[0] for description in cursor.description]
    st.write("\nCandidates Table:")
    st.write("-" * 80)
    st.write("\t".join(columns))
    st.write("-" * 80)
    for row in rows:
        st.write("\t".join(str(item) for item in row))
    st.write("-" * 80)
    conn.close()

# Ensure the table exists
create_table()

tab1, tab2, tab3 = st.tabs(["Interview", "Resume Parser", "HR Management System"])

with tab1:
    st.header("Interview")
    # Example DataFrame with all fields
    interview_results = pd.DataFrame([
        {
            "name": "Jane Doe",
            "skills": "Python, SQL",
            "education": "B.Sc. Computer Science",
            "certifications": "AWS Certified",
            "experience": "5 years",
            "email": "jane@example.com",
            "phone_number": "1234567890",
            "linkedin": "linkedin.com/in/janedoe",
            "score": 92.5,
            "status": "Shortlisted"
        }
        # Add more candidates as needed
    ])
    # Button to save results to DB
    if st.button("Save Interview Results to Database"):
        for _, row in interview_results.iterrows():
            insert_candidate(
                row.get('name', ''),
                row.get('skills', ''),
                row.get('education', ''),
                row.get('certifications', ''),
                row.get('experience', ''),
                row.get('email', ''),
                row.get('phone_number', ''),
                row.get('linkedin', ''),
                row.get('score', 0),
                row.get('status', '')
            )
        st.success("Interview results saved to database!")

with tab2:
    st.header("Resume Parser")
    # ...your resume parsing logic...

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
        df_display = df_display.rename(columns={
            "name": "Name",
            "skills": "Skills",
            "education": "Education",
            "certifications": "Certifications",
            "experience": "Experience",
            "email": "Email",
            "phone_number": "Phone Number",
            "linkedin": "LinkedIn",
            "score": "Score",
            "status": "Status"
        })
        st.table(df_display)
    else:
        st.info("No candidates in the database yet.")
    if st.button("Print Candidates Table"):
        print_candidates_table()