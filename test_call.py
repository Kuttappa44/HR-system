#!/usr/bin/env python3
"""
Test call script to make a direct call to +918971820623
"""
import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv("credentials.env")

# Configuration
NGROK_URL = os.getenv('NGROK_URL')
API_SERVER_URL = os.getenv('API_SERVER_URL', 'http://localhost:8080')

def test_call():
    """Make a test call to +918971820623"""
    try:
        # First, set the prospect name
        print("Setting prospect name...")
        resp = requests.post(
            f"{API_SERVER_URL}/set-prospect",
            json={"name": "VARUN KUTTAPPA"}
        )
        print(f"Set prospect response: {resp.status_code} - {resp.text}")
        
        # Make the call using Twilio directly
        from twilio.rest import Client
        
        TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
        TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
        TWILIO_PHONE_NUMBER = os.getenv('TWILIO_PHONE_NUMBER')
        
        twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        
        print(f"Making call to +918971820623 using webhook: {NGROK_URL}/outgoing-call")
        
        call = twilio_client.calls.create(
            url=f"{NGROK_URL}/outgoing-call",
            to="+918971820623",
            from_=TWILIO_PHONE_NUMBER
        )
        
        print(f"Call initiated successfully! Call SID: {call.sid}")
        return call.sid
        
    except Exception as e:
        print(f"Error making call: {e}")
        return None

if __name__ == "__main__":
    test_call()

