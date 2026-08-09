import os
import io
import base64
import traceback
import qrcode
import smtplib
import tempfile

from email.message import EmailMessage
from fastapi import FastAPI, BackgroundTasks, HTTPException
from email_service import send_qr_email
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv

# Clear Miniconda SSL variable programmatically
if "SSL_CERT_FILE" in os.environ:
    del os.environ["SSL_CERT_FILE"]

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase environment variables in .env file.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()

class ParticipantRegister(BaseModel):
    name: str
    email: str
    phone: str

@app.get("/")
def read_root():
    return {"message": "Skill Swap Registration API is running"}

@app.post("/api/register")
def register_participant(
    participant: ParticipantRegister, 
    background_tasks: BackgroundTasks
):
    try:
        # 1. Insert participant into Supabase
        response = supabase.table("participants").insert({
            "name": participant.name,
            "email": participant.email,
            "phone": participant.phone
        }).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to insert participant")

        registered_user = response.data[0]
        unique_id = registered_user.get("unique_id") or registered_user.get("id")

        # 2. Generate QR Code in memory using qrcode + pillow
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(unique_id)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")

        # 3. Save image to byte stream & write to temp file for email attachment
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        qr_bytes = buffer.getvalue()
        
        qr_base64 = base64.b64encode(qr_bytes).decode("utf-8")

        # Create temporary PNG file to send as attachment
        temp_qr_path = os.path.join(tempfile.gettempdir(), f"qr_{unique_id}.png")
        with open(temp_qr_path, "wb") as f:
            f.write(qr_bytes)

        # 4. Trigger email sending in background
        background_tasks.add_task(
            send_qr_email,
            recipient_email=participant.email,
            name=participant.name,
            qr_image_path=temp_qr_path
        )

        return {
            "status": "success",
            "message": "Participant registered successfully and email queued",
            "unique_id": unique_id,
            "qr_code_base64": f"data:image/png;base64,{qr_base64}",
            "data": registered_user
        }

    except Exception as e:
        print("\n--- DETAILED SUPABASE ERROR ---")
        traceback.print_exc()
        print("-------------------------------\n")
        raise HTTPException(status_code=500, detail=str(e))
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)