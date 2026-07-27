const axios = require('axios');

async function test() {
  try {
    // 1. login
    const loginRes = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'doctor@cevi.com', // wait, do I know the email? I'll check seed.ts
      password: 'password123'
    }).catch(() => null);
    
    // I don't know the exact login. I'll just look at the DB for a patient.
  } catch(e) {
    console.error(e);
  }
}
test();
