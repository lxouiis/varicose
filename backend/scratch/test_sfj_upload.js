const jwt = require('jsonwebtoken');

async function main() {
  const token = jwt.sign(
    { id: 1, email: 'dr.smith@example.com', name: 'Dr. John Smith', role: 'doctor' },
    'cevi-jnmc-hackathon-2026-secret-key',
    { expiresIn: '24h' }
  );
  
  const { execSync } = require('child_process');
  try {
    const res = execSync(`curl -s -X POST http://localhost:3001/api/doppler-images \\
      -H "Authorization: Bearer ${token}" \\
      -F "leg_id=128" \\
      -F "leg_side=right" \\
      -F "phase=sfj_gsv" \\
      -F "segment=sfj" \\
      -F "view_type=anatomy_mickey" \\
      -F "compressible=true" \\
      -F "diameter_mm=5.5"`);
    console.log("Response:", res.toString());
  } catch(e) {
    console.error("Curl failed:", e.stdout.toString(), e.stderr.toString());
  }
}

main().catch(console.error);
