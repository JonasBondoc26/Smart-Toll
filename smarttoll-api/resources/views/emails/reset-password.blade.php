<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reset your SmartToll password</title>
</head>
{{-- Email clients ignore <style> blocks and modern CSS, so everything is inline and table-based. --}}
<body style="margin:0; padding:0; background:#F1F3F4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F3F4; padding:32px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background:#FFFFFF; border-radius:12px; overflow:hidden; font-family:Arial, Helvetica, sans-serif;">
        <tr>
          <td style="background:#14201C; padding:22px 32px; border-bottom:3px solid #E8A33D;">
            <span style="display:inline-block; width:26px; height:26px; line-height:26px; text-align:center; background:#E8A33D; color:#14201C; border-radius:6px; font-weight:bold; font-size:15px; vertical-align:middle;">&#9776;</span>
            <span style="color:#FFFFFF; font-size:18px; font-weight:bold; letter-spacing:1px; vertical-align:middle; margin-left:8px;">SMARTTOLL</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 8px;">
            <h1 style="margin:0 0 18px; font-size:24px; color:#0B4F3F; text-transform:uppercase; letter-spacing:0.5px;">Reset Your Password</h1>
            <p style="margin:0 0 14px; font-size:15px; line-height:1.6; color:#3C4A43;">Hi {{ $name }},</p>
            <p style="margin:0 0 26px; font-size:15px; line-height:1.6; color:#3C4A43;">
              We received a request to reset the password for your SmartToll account. Click the button below to choose a new password.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#0B4F3F; border-radius:8px;">
                  <a href="{{ $url }}" style="display:inline-block; padding:14px 30px; font-size:15px; font-weight:bold; color:#FFFFFF; text-decoration:none;">Reset Password</a>
                </td>
              </tr>
            </table>
            <p style="margin:26px 0 6px; font-size:13px; color:#5B6B63;">Or copy and paste this link into your browser:</p>
            <p style="margin:0 0 22px; font-size:13px; line-height:1.5; word-break:break-all;">
              <a href="{{ $url }}" style="color:#0B4F3F;">{{ $url }}</a>
            </p>
            <p style="margin:0 0 14px; font-size:14px; line-height:1.6; color:#3C4A43;">
              This link will expire in <strong>{{ $minutes }} minutes</strong> for your security.
            </p>
            <p style="margin:0 0 30px; font-size:14px; line-height:1.6; color:#5B6B63;">
              If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#F1F1F1; padding:20px 32px; border-top:1px solid #E2E4DC;">
            <p style="margin:0 0 4px; font-size:12px; font-weight:bold; letter-spacing:1px; color:#14201C;">SMARTTOLL</p>
            <p style="margin:0 0 6px; font-size:12px; color:#5B6B63;">Toll route planner with RFID balance tracking</p>
            <p style="margin:0; font-size:11px; color:#93A099;">This is an automated message. Please do not reply.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
