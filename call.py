# streamlit_app.py
import streamlit as st
import pandas as pd
import requests
import json
import time
from twilio.rest import Client
from dotenv import load_dotenv
import os
from openai import OpenAI

# Load environment variables
load_dotenv("credentials.env")

# Configuration
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.getenv('TWILIO_PHONE_NUMBER')
NGROK_URL = os.getenv('NGROK_URL')
API_SERVER_URL = os.getenv('API_SERVER_URL',)
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Initialize Twilio client
twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
# Initialize OpenAI client
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Load candidates data
@st.cache_data
def load_candidates():
    df = pd.read_csv('candidates.csv')
    # Filter candidates with score >= 50 and valid phone number
    filtered = df[(df['Score'] >= 50) & (df['Phone'].notna()) & (df['Phone'] != 'N/A')]
    # Clean phone numbers (remove spaces)
    filtered['Phone'] = filtered['Phone'].str.replace(' ', '')
    return filtered

candidates_df = load_candidates()

def make_call(name, mobile_number):
    """Initiate a call to the prospect"""
    # First, set the prospect name on the server
    try:
        resp = requests.post(
            f"{API_SERVER_URL}/set-prospect",
            json={"name": name}
        )
        if resp.status_code != 200:
            return False, f"Failed to set prospect name: {resp.text}"
    except Exception as e:
        return False, f"Error setting prospect name: {str(e)}"
    
    # Then initiate the call
    try:
        call = twilio_client.calls.create(
            url=f"{NGROK_URL}/outgoing-call",
            to=mobile_number,
            from_=TWILIO_PHONE_NUMBER
        )
        return True, call.sid
    except Exception as e:
        return False, f"Error initiating call: {str(e)}"

def get_transcripts():
    """Get the transcripts from the API server"""
    try:
        resp = requests.get(f"{API_SERVER_URL}/transcripts")
        if resp.status_code == 200:
            return resp.json()
        return {"transcripts": [], "conversation": []}
    except Exception as e:
        st.error(f"Error fetching transcripts: {str(e)}")
        return {"transcripts": [], "conversation": []}

def export_transcripts_to_excel(transcripts):
    """Convert transcripts to Excel file"""
    df = pd.DataFrame({'Transcripts': transcripts})
    df.to_excel('transcripts.xlsx', index=False)
    return 'transcripts.xlsx'

def analyze_conversation(conversation):
    """Analyze the conversation and provide verdict and recommendations"""
    try:
        conversation_text = "\n".join(conversation)
        
        # Call OpenAI API to analyze the conversation
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": """
    You are an expert HR assistant. Analyze the conversation between a HR and a Potential Candidate.
    Provide a brief assessment with:
    1. Verdict: Is this person a potential acndidate? (Yes/No/Maybe)
    2. Confidence level: Low/Medium/High
    3. 2-3 key observations that led to this verdict
    4. 2-3 actionable recommendations for follow-up

    Keep your analysis concise and straightforward.
    """},
                {"role": "user", "content": f"Here is the conversation transcript:\n\n{conversation_text}"}
            ],
            temperature=0.7,
            max_tokens=500
        )
        
        return response.choices[0].message.content
    except Exception as e:
        return f"Error analyzing conversation: {str(e)}"

# Streamlit UI
st.title("Prescreening call Interface")

# Check server status
try:
    resp = requests.get(API_SERVER_URL)
    if resp.status_code == 200:
        st.success("✅ API Server is running and ready")
    else:
        st.error("❌ API Server returned an error response")
except Exception as e:
    st.error(f"❌ API Server is not available: {str(e)}")
    st.warning("Please start the FastAPI server first before making calls")

# Candidate selection dropdown
candidate_names = candidates_df['Name'].tolist()
selected_candidate = st.selectbox("Select Candidate (Score >= 50)", [""] + candidate_names)

# Autofill candidate name and mobile number based on selection
if selected_candidate:
    candidate_row = candidates_df[candidates_df['Name'] == selected_candidate].iloc[0]
    prospect_name_input = candidate_row['Name']
    mobile_number = candidate_row['Phone']
else:
    prospect_name_input = st.text_input("Prospect's Name")
    mobile_number = st.text_input("Mobile Number")

# Call button
if st.button("Make Call"):
    if prospect_name_input and mobile_number:
        with st.spinner("Initiating call..."):
            success, result = make_call(prospect_name_input, mobile_number)
            if success:
                st.success(f"Call initiated with SID: {result}")
            else:
                st.error(result)
    else:
        st.error("Please enter both prospect's name and mobile number")

# Display conversation
st.subheader("Call Conversation")
conversation_container = st.container()

# Auto-refresh conversation (optional)
auto_refresh = st.checkbox("Auto-refresh conversation", value=True)

if auto_refresh:
    placeholder = st.empty()
    while auto_refresh:
        with placeholder.container():
            data = get_transcripts()
            for entry in data.get("conversation", []):
                if entry.startswith("Customer:"):
                    st.markdown(f"**{entry}**")
                else:
                    st.markdown(f"*{entry}*")
        time.sleep(3)  # Refresh every 3 seconds
else:
    if st.button("Refresh Conversation"):
        data = get_transcripts()
        for entry in data.get("conversation", []):
            if entry.startswith("Customer:"):
                conversation_container.markdown(f"**{entry}**")
            else:
                conversation_container.markdown(f"*{entry}*")

# Add a divider
st.divider()

# Analysis section
st.subheader("Conversation Analysis")

# Analysis button
if st.button("Analyze Conversation"):
    with st.spinner("Analyzing conversation..."):
        # Get the latest conversation data
        data = get_transcripts()
        conversation = data.get("conversation", [])
        
        if conversation:
            # Perform analysis
            analysis_result = analyze_conversation(conversation)
            
            # Display the analysis result in a nice format
            st.markdown("### Analysis Result")
            st.markdown(analysis_result)
            
            # Option to save the analysis
            if st.button("Save Analysis"):
                with open("conversation_analysis.txt", "w") as f:
                    f.write(f"Conversation Analysis\n{'='*30}\n\n")
                    f.write(f"Prospect: {prospect_name_input}\n\n")
                    f.write(f"Conversation:\n{'-'*20}\n")
                    for entry in conversation:
                        f.write(f"{entry}\n")
                    f.write(f"\nAnalysis:\n{'-'*20}\n{analysis_result}")
                st.success("Analysis saved to conversation_analysis.txt")
        else:
            st.warning("No conversation data available for analysis.")

# Export transcripts
if st.button("Export Transcripts"):
    data = get_transcripts()
    filename = export_transcripts_to_excel(data.get("transcripts", []))
    st.success(f"Transcripts exported to {filename}")

# Interview Slot Booking
st.title("Select Interview Slot")

candidate_name = st.text_input("Enter your name")
if candidate_name:
    resp = requests.get(f"http://127.0.0.1:8000/get-slots/{candidate_name}")
    slots = resp.json().get("slots", [])
    slot_options = [f"{slot['datetime']} (ID: {slot['slot_id']})" for slot in slots if not slot["booked"]]
    selected = st.selectbox("Available Slots", slot_options)
    if st.button("Book Slot"):
        slot_id = selected.split("ID: ")[1][:-1]
        resp = requests.post("http://127.0.0.1:8000/book-slot", json={
            "candidate_name": candidate_name,
            "slot_id": slot_id
        })
        st.success(resp.json().get("status"))
