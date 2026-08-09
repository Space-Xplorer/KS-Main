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
    
    msg.set_content(f"Hi {name},\n\nYour registration for Skill Swap is confirmed! Please find your entry QR code attached.\n\nBest,\nSkill Swap Team")

    with open(qr_image_path, 'rb') as f:
        file_data = f.read()

    msg.add_attachment(
        file_data, 
        maintype='image', 
        subtype='png', 
        filename=os.path.basename(qr_image_path)
    )

    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
        smtp.login(sender_email, sender_password)
        smtp.send_message(msg)