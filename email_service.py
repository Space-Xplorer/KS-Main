import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

def send_qr_email(recipient_email: str, name: str, qr_image_path: str):
    sender_email = os.getenv("SENDER_EMAIL")
    sender_password = os.getenv("SENDER_PASSWORD")

    msg = EmailMessage()
    msg['Subject'] = 'Your Skill Swap Pass'
    msg['From'] = sender_email
    msg['To'] = recipient_email

    # Plain text fallback
    msg.set_content(f"Hi {name},\n\nPlease enable HTML emails to view your entry QR code pass.")

    # Inline HTML body embedding the QR code image via Content-ID (cid:qr_pass)
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {{ font-family: Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 20px; }}
        .card {{ max-width: 450px; background: #ffffff; padding: 30px; margin: auto; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); text-align: center; }}
        h2 {{ color: #2d3748; margin-bottom: 8px; }}
        p {{ color: #718096; font-size: 14px; margin-bottom: 20px; }}
        .qr-container {{ background: #f8fafc; padding: 20px; border-radius: 8px; display: inline-block; border: 1px solid #e2e8f0; }}
        img {{ width: 220px; height: 220px; display: block; margin: auto; }}
        .footer {{ font-size: 12px; color: #a0aec0; margin-top: 20px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Welcome to Skill Swap, {name}! 🎉</h2>
        <p>Show this pass to volunteers at the entry counter for attendance check-in.</p>
        <div class="qr-container">
          <img src="cid:qr_pass" alt="Entry QR Code" />
        </div>
        <p class="footer">Please have this ready on your mobile screen upon arrival.</p>
      </div>
    </body>
    </html>
    """
    msg.add_alternative(html_content, subtype='html')

    # Attach image inline using Content-ID
    with open(qr_image_path, 'rb') as f:
        file_data = f.read()

    msg.get_payload(1).add_related(
        file_data,
        maintype='image',
        subtype='png',
        cid='qr_pass'  # Matches the src="cid:qr_pass" in the HTML string
    )

    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
        smtp.login(sender_email, sender_password)
        smtp.send_message(msg)

    # Clean up local temporary QR image file after sending
    if os.path.exists(qr_image_path):
        os.remove(qr_image_path)