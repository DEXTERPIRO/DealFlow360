import asyncio
import logging
from email.message import EmailMessage
import aiosmtplib

from app.config import settings

logger = logging.getLogger("dealflow360.mailer")

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587

def get_email_credentials():
    user = (settings.EMAIL_USER or "strangegaming66@gmail.com").strip()
    password = (settings.EMAIL_PASS or "xuthwmbdmsgembpz").strip()
    return user, password

async def send_email_async(to_email: str, subject: str, html_content: str, text_content: str = ""):
    """Core async email sender using aiosmtplib with Gmail STARTTLS."""
    user, password = get_email_credentials()
    if not user or not password:
        logger.warning("[Mailer] EMAIL_USER or EMAIL_PASS not configured. Skipping email.")
        return False

    msg = EmailMessage()
    msg["From"] = f"DealFlow360 Operations <{user}>"
    msg["To"] = to_email
    msg["Subject"] = subject

    if not text_content:
        text_content = html_content.replace("<br>", "\n").replace("</p>", "\n\n")

    msg.set_content(text_content)
    msg.add_alternative(html_content, subtype="html")

    try:
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            start_tls=True,
            username=user,
            password=password,
            timeout=15
        )
        logger.info(f"[Mailer] Successfully sent email '{subject}' to {to_email}")
        return True
    except Exception as e:
        logger.error(f"[Mailer Error] Failed to send email to {to_email}: {e}")
        return False

def trigger_background_email(to_email: str, subject: str, html_content: str, text_content: str = ""):
    """Non-blocking email dispatch so HTTP endpoints return instantly."""
    import threading
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(send_email_async(to_email, subject, html_content, text_content))
    except RuntimeError:
        # If no running event loop in thread, run in background thread
        def _run():
            asyncio.run(send_email_async(to_email, subject, html_content, text_content))
        threading.Thread(target=_run, daemon=True).start()

# ─── 1. Magic Link / Customer Portal Access Email ───────────────────────────

def send_magic_link_email(to_email: str, portal_token: str, customer_name: str = "Valued Customer"):
    portal_url = f"{settings.FRONTEND_URL}/portal/{portal_token}"
    subject = "Your DealFlow360 Secure Client Portal Access"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 24px; color: #f1f5f9; }}
        .container {{ max-width: 560px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }}
        .header {{ background: linear-gradient(135deg, #1d4ed8 0%, #4338ca 100%); padding: 32px 28px; text-align: center; }}
        .logo {{ font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; }}
        .body {{ padding: 32px 28px; line-height: 1.6; }}
        .btn {{ display: inline-block; background: #2563eb; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 10px; margin: 24px 0; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.4); text-align: center; }}
        .btn:hover {{ background: #1d4ed8; }}
        .footer {{ border-top: 1px solid #1e293b; padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; background: #0b1120; }}
        .badge {{ display: inline-block; padding: 4px 10px; border-radius: 6px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); color: #93c5fd; font-family: monospace; font-size: 12px; margin-top: 8px; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">DealFlow<span style="color:#60a5fa;">360</span></div>
          <div style="color: #bfdbfe; font-size: 13px; margin-top: 4px; font-weight: 500;">Intelligent Sales Operations Platform</div>
        </div>
        <div class="body">
          <h2 style="margin-top: 0; color: #ffffff; font-size: 20px; font-weight: 800;">Hello {customer_name},</h2>
          <p style="color: #94a3b8; font-size: 14px;">
            You requested passwordless access to your secure client quotation portal on DealFlow360.
          </p>
          <div style="text-align: center;">
            <a href="{portal_url}" class="btn" target="_blank">Launch Client Portal &rarr;</a>
          </div>
          <p style="color: #94a3b8; font-size: 13px;">
            Or copy and paste this direct portal link into your browser:
          </p>
          <div style="background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 11px; word-break: break-all; color: #38bdf8;">
            {portal_url}
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
            This link is authenticated with your enterprise account. If you did not request this email, you can safely disregard it.
          </p>
        </div>
        <div class="footer">
          &copy; 2026 DealFlow360 Enterprise CPQ &bull; All rights reserved.
        </div>
      </div>
    </body>
    </html>
    """

    text = f"Hello {customer_name},\n\nYour DealFlow360 Client Portal link is ready:\n{portal_url}\n\nThank you,\nDealFlow360 Team"
    trigger_background_email(to_email, subject, html, text)

# ─── 2. Quotation Sent to Customer Email ─────────────────────────────────────

def send_quotation_email(to_email: str, customer_name: str, quotation_number: str, total_amount: float, portal_token: str, rep_name: str = "Sales Operations"):
    portal_url = f"{settings.FRONTEND_URL}/portal/{portal_token}"
    subject = f"Official Proposal: Quotation {quotation_number} from DealFlow360"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 24px; color: #f1f5f9; }}
        .container {{ max-width: 580px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 32px 28px; text-align: center; }}
        .logo {{ font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; }}
        .body {{ padding: 32px 28px; line-height: 1.6; }}
        .summary-card {{ background: #020617; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; margin: 20px 0; }}
        .btn {{ display: inline-block; background: #10b981; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 10px; margin: 20px 0; text-align: center; }}
        .footer {{ border-top: 1px solid #1e293b; padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; background: #0b1120; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">DealFlow<span style="color:#a7f3d0;">360</span></div>
          <div style="color: #d1fae5; font-size: 13px; margin-top: 4px;">Commercial Deal Operations</div>
        </div>
        <div class="body">
          <h2 style="margin-top: 0; color: #ffffff; font-size: 20px; font-weight: 800;">Dear {customer_name},</h2>
          <p style="color: #94a3b8; font-size: 14px;">
            A formal commercial proposal has been prepared for your organization by <strong>{rep_name}</strong>.
          </p>
          <div class="summary-card">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b; font-size: 12px;">Proposal Number:</span>
              <strong style="color: #f8fafc; font-family: monospace;">{quotation_number}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b; font-size: 12px;">Total Value:</span>
              <strong style="color: #34d399; font-size: 16px;">₹{total_amount:,.2f}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b; font-size: 12px;">Portal Access:</span>
              <span style="color: #60a5fa; font-size: 12px;">Interactive Negotiation & E-Signature</span>
            </div>
          </div>
          <div style="text-align: center;">
            <a href="{portal_url}" class="btn" target="_blank">Review & Confirm Proposal &rarr;</a>
          </div>
          <p style="color: #94a3b8; font-size: 13px;">
            Through your dedicated portal link, you can review line-item pricing, download the official PDF, and negotiate discounts in real-time.
          </p>
        </div>
        <div class="footer">
          Sent by DealFlow360 on behalf of {rep_name}.
        </div>
      </div>
    </body>
    </html>
    """

    text = f"Dear {customer_name},\n\nQuotation {quotation_number} for ₹{total_amount:,.2f} is ready for your review.\nAccess your portal: {portal_url}\n\nBest regards,\n{rep_name}"
    trigger_background_email(to_email, subject, html, text)

# ─── 3. Welcome Email for New Team Members / Customers ──────────────────────

def send_welcome_email(to_email: str, user_name: str, role: str, temp_password: str = "Password@123"):
    login_url = f"{settings.FRONTEND_URL}/login"
    subject = "Welcome to DealFlow360 — Your Account is Ready"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 24px; color: #f1f5f9; }}
        .container {{ max-width: 560px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 32px 28px; text-align: center; }}
        .logo {{ font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; }}
        .body {{ padding: 32px 28px; line-height: 1.6; }}
        .credentials-card {{ background: #020617; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; margin: 20px 0; }}
        .btn {{ display: inline-block; background: #3b82f6; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 10px; margin: 20px 0; text-align: center; }}
        .footer {{ border-top: 1px solid #1e293b; padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; background: #0b1120; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">DealFlow<span style="color:#93c5fd;">360</span></div>
          <div style="color: #bfdbfe; font-size: 13px; margin-top: 4px;">User Onboarding</div>
        </div>
        <div class="body">
          <h2 style="margin-top: 0; color: #ffffff; font-size: 20px; font-weight: 800;">Welcome, {user_name}!</h2>
          <p style="color: #94a3b8; font-size: 14px;">
            Your account on DealFlow360 has been provisioned with the role <strong>{role}</strong>.
          </p>
          <div class="credentials-card">
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">Login Email:</p>
            <p style="margin: 0 0 16px 0; font-family: monospace; font-size: 14px; color: #38bdf8;">{to_email}</p>
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">Initial Password:</p>
            <p style="margin: 0; font-family: monospace; font-size: 14px; color: #a78bfa;">{temp_password}</p>
          </div>
          <div style="text-align: center;">
            <a href="{login_url}" class="btn" target="_blank">Sign In to DealFlow360 &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; 2026 DealFlow360 Enterprise Platform
        </div>
      </div>
    </body>
    </html>
    """

    text = f"Welcome {user_name}!\n\nYour DealFlow360 account ({role}) is ready.\nEmail: {to_email}\nPassword: {temp_password}\nLogin at: {login_url}"
    trigger_background_email(to_email, subject, html, text)
