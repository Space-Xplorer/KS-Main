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
from fastapi import FastAPI, BackgroundTasks, HTTPException, Body
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

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

class AttendanceCheck(BaseModel):
    unique_id: str

@app.post("/api/verify-attendance")
def verify_attendance(data: AttendanceCheck):
    try:
        # 1. Match by the 'unique_id' text column instead of 'id'
        participant_res = supabase.table("participants").select("*").eq("unique_id", data.unique_id).execute()
        
        if not participant_res.data:
            raise HTTPException(status_code=404, detail="Participant record not found")

        participant = participant_res.data[0]
        participant_uuid = participant.get("id")  # Get the actual UUID from participants table

        # 2. Check if already recorded in attendance table
        attendance_res = supabase.table("attendance").select("*").eq("unique_id", data.unique_id).execute()

        if attendance_res.data:
            return {
                "status": "already_marked",
                "message": f"Already checked in! Name: {participant['name']}",
                "participant": participant
            }

        # 3. Log check-in entry to 'attendance' table
        supabase.table("attendance").insert({
            "participant_id": participant_uuid,  # Uses the proper UUID
            "unique_id": data.unique_id,          # Stores the "SWAP-1004" text string
            "status": "PRESENT"
        }).execute()

        return {
            "status": "success",
            "message": f"Attendance marked for {participant['name']}!",
            "participant": participant
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/scanner", response_class=HTMLResponse)
def get_scanner_page():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Skill Swap - Pass Scanner</title>
        <script src="https://unpkg.com/html5-qrcode" type="text/javascript"></script>
        <style>
            * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            body { background: #090d16; color: #f8fafc; margin: 0; padding: 16px; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
            .container { width: 100%; max-width: 420px; text-align: center; }
            .header h2 { margin: 0; color: #38bdf8; font-size: 22px; font-weight: 700; }
            .header p { margin: 4px 0 16px; color: #64748b; font-size: 13px; }
            
            /* Camera Container with FamPay Style Overlay */
            .scanner-wrapper {
                position: relative;
                width: 100%;
                aspect-ratio: 1;
                background: #000;
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 12px 30px rgba(0,0,0,0.6);
                border: 1px solid #1e293b;
            }
            #interactive-video { width: 100%; height: 100%; object-fit: cover; }
            
            /* Target Frame Overlay */
            .scan-region {
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                width: 220px; height: 220px;
                border: 2px solid rgba(56, 189, 248, 0.4);
                border-radius: 16px;
                box-shadow: 0 0 0 4000px rgba(9, 13, 22, 0.65);
                pointer-events: none;
            }
            /* Corner Accents */
            .scan-region::before, .scan-region::after {
                content: ''; position: absolute; width: 24px; height: 24px;
                border-color: #38bdf8; border-style: solid;
            }
            .scan-region::before { top: -2px; left: -2px; border-width: 4px 0 0 4px; border-top-left-radius: 12px; }
            .scan-region::after { bottom: -2px; right: -2px; border-width: 0 4px 4px 0; border-bottom-right-radius: 12px; }

            /* Animated Laser Line */
            .laser-line {
                position: absolute;
                width: 100%; height: 3px;
                background: linear-gradient(90deg, transparent, #38bdf8, transparent);
                box-shadow: 0 0 12px #38bdf8;
                animation: scan-animation 2s infinite ease-in-out;
            }
            @keyframes scan-animation {
                0% { top: 0%; opacity: 0.2; }
                50% { top: 98%; opacity: 1; }
                100% { top: 0%; opacity: 0.2; }
            }

            /* Manual ID Entry */
            .manual-box { display: flex; gap: 8px; margin-top: 16px; }
            .manual-box input { flex: 1; padding: 12px 14px; border-radius: 10px; border: 1px solid #334155; background: #1e293b; color: #fff; font-size: 14px; outline: none; }
            .manual-box button { padding: 12px 18px; background: #0284c7; color: white; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
            .manual-box button:hover { background: #0369a1; }

            /* Status Result Card */
            #result-card { margin-top: 16px; padding: 14px; border-radius: 12px; display: none; text-align: left; font-size: 14px; }
            .success { background: #064e3b; border: 1px solid #059669; color: #34d399; }
            .warning { background: #713f12; border: 1px solid #ca8a04; color: #fde047; }
            .error { background: #7f1d1d; border: 1px solid #dc2626; color: #fca5a5; }
            .user-info { margin-top: 6px; font-size: 13px; color: #f1f5f9; line-height: 1.4; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>Skill Swap Check-In</h2>
                <p>Align QR pass inside frame or enter ID manually</p>
            </div>

            <!-- Auto-Scanning Camera Area -->
            <div class="scanner-wrapper">
                <div id="interactive-video"></div>
                <div class="scan-region">
                    <div class="laser-line"></div>
                </div>
            </div>

            <!-- Manual Lookup Option preserved -->
            <div class="manual-box">
                <input type="text" id="manual-id" placeholder="e.g. SWAP-1004" />
                <button onclick="checkManual()">Verify</button>
            </div>

            <div id="result-card"></div>
        </div>

        <script>
            let isProcessing = false;
            let html5QrCode;

            function playSound(freq, duration) {
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = ctx.createOscillator();
                    osc.frequency.value = freq;
                    osc.connect(ctx.destination);
                    osc.start();
                    setTimeout(() => { osc.stop(); ctx.close(); }, duration);
                } catch(e) {}
            }

            function processVerification(uniqueId) {
                if (isProcessing) return;
                isProcessing = true;

                const card = document.getElementById("result-card");
                card.style.display = "block";
                card.className = "";
                card.innerHTML = "⌛ Checking ID: <b>" + uniqueId + "</b>...";

                fetch("/api/verify-attendance", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ unique_id: uniqueId })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.status === "success") {
                        playSound(880, 150);
                        card.className = "success";
                        card.innerHTML = `
                            <strong>✅ Check-In Successful!</strong>
                            <div class="user-info">
                                <b>Name:</b> ${data.participant.name}<br>
                                <b>Email:</b> ${data.participant.email}
                            </div>
                        `;
                    } else if (data.status === "already_marked") {
                        playSound(440, 300);
                        card.className = "warning";
                        card.innerHTML = `
                            <strong>⚠️ Already Checked-In!</strong>
                            <div class="user-info">
                                <b>Name:</b> ${data.participant.name}
                            </div>
                        `;
                    } else {
                        playSound(220, 400);
                        card.className = "error";
                        card.innerHTML = "<strong>❌ Error:</strong> " + (data.detail || "Invalid Pass Code");
                    }
                })
                .catch(err => {
                    playSound(220, 400);
                    card.className = "error";
                    card.innerHTML = "<strong>❌ Server Error</strong>";
                })
                .finally(() => {
                    // Pause for 2 seconds before accepting next scan
                    setTimeout(() => { isProcessing = false; }, 2000);
                });
            }

            function checkManual() {
                const val = document.getElementById("manual-id").value.trim();
                if (val) processVerification(val);
            }

            // Auto-start camera on page load without prompt buttons
            window.addEventListener("DOMContentLoaded", () => {
                html5QrCode = new Html5Qrcode("interactive-video");
                
                const config = { fps: 15, qrbox: { width: 220, height: 220 } };
                
                html5QrCode.start(
                    { facingMode: "environment" }, 
                    config, 
                    (decodedText) => processVerification(decodedText)
                ).catch(err => {
                    console.warn("Auto camera start failed, trying default camera...", err);
                    html5QrCode.start({ facingMode: "user" }, config, (decodedText) => processVerification(decodedText));
                });
            });
        </script>
    </body>
    </html>
    """
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)